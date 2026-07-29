/**
 * 答题服务模块
 * 提供答题相关的业务逻辑
 */

const { db } = require('../config/database')
const { dbGet, dbAll, dbRun, stmtRun } = require('../utils/dbPromise')
const { safeParse, getCorrectAnswerFromJson, processAnswerValue } = require('../utils/jsonReader')
const { info, warn, logOperation } = require('../utils/logger')

/**
 * 获取学生姓名（从学生数据库）
 * @param {string} studentId - 学生ID
 * @returns {Promise<string|null>} - 学生姓名
 */
async function getStudentName(studentId) {
  const row = await dbGet(db, 'SELECT student_name FROM students WHERE student_id = ?', [studentId])
  return row?.student_name || null
}

/**
 * 比较用户答案和正确答案
 * @param {any} userAnswer - 用户答案
 * @param {any} correctAnswer - 正确答案
 * @returns {object} - { score: number, isCorrect: number }
 */
function compareAnswers(userAnswer, correctAnswer) {
  let score = 0
  let isCorrect = 0

  if (Array.isArray(correctAnswer)) {
    // 正确答案是数组的情况
    if (Array.isArray(userAnswer)) {
      const sortedCorrect = [...correctAnswer].map(String).sort()
      const sortedUser = [...userAnswer].map(String).sort()
      if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
        score = 100
        isCorrect = 1
      }
    } else {
      // 用户答案不是数组，转为数组进行对比
      const sortedCorrect = [...correctAnswer].map(String).sort()
      const sortedUser = [String(userAnswer ?? '')].sort()
      if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
        score = 100
        isCorrect = 1
      }
    }
  } else {
    // 正确答案不是数组的情况
    const stringCorrect = String(correctAnswer ?? '')
    if (Array.isArray(userAnswer)) {
      // 用户答案是数组，取第一个元素或用逗号拼接对比
      const stringUser = userAnswer.map(String).join(',')
      if (stringCorrect === stringUser) {
        score = 100
        isCorrect = 1
      }
    } else {
      const stringUser = String(userAnswer ?? '')
      if (stringCorrect === stringUser) {
        score = 100
        isCorrect = 1
      }
    }
  }

  return { score, isCorrect }
}

/**
 * 确保学生信息存在（自动注册或更新）
 * @param {string} studentId - 学生ID
 * @param {string} studentName - 学生姓名
 */
async function ensureStudentInfo(studentId, studentName) {
  if (!studentName) {
    return
  }

  try {
    const { createOrUpdateStudent } = await import('./studentService')
    await createOrUpdateStudent(studentId, studentName)
    info('学生信息更新成功', { studentId, studentName })
  } catch (err) {
    warn('学生信息更新失败', { studentId, studentName, error: err.message })
  }
}

/**
 * 处理正确答案的值
 * @param {string} correctAnswer - 正确答案（JSON字符串）
 * @param {string} questionId - 题目ID
 * @param {string} wenId - 文言文ID
 * @returns {any} - 处理后的正确答案值
 */
function processCorrectAnswerValue(correctAnswer, questionId, wenId) {
  let correctAnswerValue = processAnswerValue(correctAnswer)
  if (correctAnswerValue === null || correctAnswerValue === 'unknown') {
    correctAnswerValue = getCorrectAnswerFromJson(questionId, wenId)
  }
  return correctAnswerValue
}

/**
 * 提交答题记录
 * @param {object} data - 答题数据
 * @returns {Promise<object>} - 提交结果
 */
async function submitAnswers(data) {
  const { studentId, studentName, wenId, submittedAt, answers, questions = [] } = data

  info('开始处理答题提交', {
    studentId,
    studentName,
    wenId,
    questionCount: questions.length,
  })

  await ensureStudentInfo(studentId, studentName)

  // 计算得分并准备插入数据（使用子查询保证原子性）
  const results = await Promise.all(
    questions.map(async (question) => {
      const userAnswer = answers[question.id]
      const correctAnswer = question.correctAnswer
      const { score, isCorrect } = compareAnswers(userAnswer, correctAnswer)

      // 使用子查询计算 attempt_number，保证并发安全
      const stmt = db.prepare(`
        INSERT INTO answers (
          wen_id, student_id, question_id, user_answer, correct_answer,
          is_correct, score, submitted_at, attempt_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, (
          SELECT COALESCE(MAX(attempt_number), 0) + 1
          FROM answers
          WHERE wen_id = ? AND student_id = ? AND question_id = ?
        ))
      `)

      await stmtRun(
        stmt,
        wenId,
        studentId,
        question.id,
        JSON.stringify(userAnswer ?? null),
        JSON.stringify(correctAnswer ?? null),
        isCorrect,
        score,
        submittedAt,
        wenId,
        studentId,
        question.id
      )
      stmt.finalize()

      // 获取刚插入的 attempt_number
      const insertRow = await dbGet(
        db,
        `SELECT attempt_number FROM answers WHERE wen_id = ? AND student_id = ? AND question_id = ? ORDER BY id DESC LIMIT 1`,
        [wenId, studentId, question.id]
      )

      return {
        questionId: question.id,
        score,
        isCorrect,
        attemptNumber: insertRow?.attempt_number || 1,
      }
    })
  )

  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const correctCount = results.filter((r) => r.isCorrect === 1).length
  const avgScore = Math.round(totalScore / results.length)

  const resultData = {
    studentId,
    wenId,
    submittedAt,
    questionCount: results.length,
    correctCount,
    wrongCount: results.length - correctCount,
    totalScore,
    avgScore,
    details: results,
  }

  logOperation('答题提交完成', {
    studentId,
    wenId,
    questionCount: results.length,
    correctCount,
    wrongCount: results.length - correctCount,
    totalScore,
    avgScore,
  })

  return { success: true, data: resultData }
}

/**
 * 按文言文ID查询答题情况
 * @param {string} wenId - 文言文ID
 * @returns {Promise<object>} - 查询结果
 */
async function getAnswersByWenId(wenId) {
  const rows = await dbAll(
    db,
    `SELECT * FROM answers WHERE wen_id = ? ORDER BY submitted_at DESC`,
    [wenId]
  )

  // 获取所有学生ID并批量查询姓名
  const studentIds = [...new Set(rows.map((row) => row.student_id))]
  const studentNames = {}
  for (const studentId of studentIds) {
    studentNames[studentId] = await getStudentName(studentId)
  }

  // 按学生分组统计
  const studentStats = {}
  rows.forEach((row) => {
    const studentName = studentNames[row.student_id]

    if (!studentStats[row.student_id]) {
      studentStats[row.student_id] = {
        studentId: row.student_id,
        studentName,
        wenId: row.wen_id,
        totalQuestions: 0,
        correctCount: 0,
        wrongCount: 0,
        totalScore: 0,
        answers: [],
      }
    }

    const stat = studentStats[row.student_id]
    stat.totalQuestions++
    stat.correctCount += row.is_correct
    stat.wrongCount += row.is_correct === 0 ? 1 : 0
    stat.totalScore += row.score

    const correctAnswerValue = processCorrectAnswerValue(
      row.correct_answer,
      row.question_id,
      row.wen_id
    )

    stat.answers.push({
      questionId: row.question_id,
      userAnswer: safeParse(row.user_answer),
      correctAnswer: correctAnswerValue,
      isCorrect: row.is_correct === 1,
      score: row.score,
      submittedAt: row.submitted_at,
      attemptNumber: row.attempt_number,
    })
  })

  // 计算平均分
  Object.values(studentStats).forEach((stat) => {
    stat.avgScore =
      stat.totalQuestions > 0 ? Math.round(stat.totalScore / stat.totalQuestions) : 0
  })

  return {
    wenId,
    studentCount: Object.keys(studentStats).length,
    students: Object.values(studentStats),
  }
}

/**
 * 按学生ID查询答题情况
 * @param {string} studentId - 学生ID
 * @returns {Promise<object>} - 查询结果
 */
async function getAnswersByStudentId(studentId) {
  const rows = await dbAll(
    db,
    `SELECT * FROM answers WHERE student_id = ? ORDER BY wen_id, submitted_at DESC`,
    [studentId]
  )

  // 获取学生姓名
  const studentName = await getStudentName(studentId)

  // 按文言文分组统计
  const wenStats = {}
  rows.forEach((row) => {
    if (!wenStats[row.wen_id]) {
      wenStats[row.wen_id] = {
        studentId: row.student_id,
        studentName,
        wenId: row.wen_id,
        submittedAt: row.submitted_at,
        totalQuestions: 0,
        correctCount: 0,
        wrongCount: 0,
        totalScore: 0,
        answers: [],
      }
    }

    const stat = wenStats[row.wen_id]
    stat.totalQuestions++
    stat.correctCount += row.is_correct
    stat.wrongCount += row.is_correct === 0 ? 1 : 0
    stat.totalScore += row.score

    const correctAnswerValue = processCorrectAnswerValue(
      row.correct_answer,
      row.question_id,
      row.wen_id
    )

    stat.answers.push({
      questionId: row.question_id,
      userAnswer: safeParse(row.user_answer),
      correctAnswer: correctAnswerValue,
      isCorrect: row.is_correct === 1,
      score: row.score,
      submittedAt: row.submitted_at,
      attemptNumber: row.attempt_number,
    })
  })

  // 计算平均分和总统计
  let totalAllQuestions = 0
  let totalAllCorrect = 0
  let totalAllScore = 0

  Object.values(wenStats).forEach((stat) => {
    stat.avgScore =
      stat.totalQuestions > 0 ? Math.round(stat.totalScore / stat.totalQuestions) : 0
    totalAllQuestions += stat.totalQuestions
    totalAllCorrect += stat.correctCount
    totalAllScore += stat.totalScore
  })

  return {
    studentId,
    studentName,
    totalWenCount: Object.keys(wenStats).length,
    totalAllQuestions,
    totalAllCorrect,
    totalAllWrong: totalAllQuestions - totalAllCorrect,
    overallAvgScore:
      totalAllQuestions > 0 ? Math.round(totalAllScore / totalAllQuestions) : 0,
    wenRecords: Object.values(wenStats),
  }
}

/**
 * 提交单题答题记录
 * @param {object} data - 单题答题数据
 * @returns {Promise<object>} - 提交结果
 */
async function submitSingleAnswer(data) {
  const { studentId, studentName, wenId, questionId, userAnswer, correctAnswer, submittedAt } = data

  info('开始处理单题答题提交', {
    studentId,
    studentName,
    wenId,
    questionId,
  })

  await ensureStudentInfo(studentId, studentName)

  const { score, isCorrect } = compareAnswers(userAnswer, correctAnswer)

  // 使用子查询计算 attempt_number，保证并发安全
  const stmt = db.prepare(`
    INSERT INTO answers (
      wen_id, student_id, question_id, user_answer, correct_answer,
      is_correct, score, submitted_at, attempt_number
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, (
      SELECT COALESCE(MAX(attempt_number), 0) + 1
      FROM answers
      WHERE wen_id = ? AND student_id = ? AND question_id = ?
    ))
  `)

  await stmtRun(
    stmt,
    wenId,
    studentId,
    questionId,
    JSON.stringify(userAnswer ?? null),
    JSON.stringify(correctAnswer ?? null),
    isCorrect,
    score,
    submittedAt,
    wenId,
    studentId,
    questionId
  )
  stmt.finalize()

  // 获取刚插入的 attempt_number
  const insertRow = await dbGet(
    db,
    `SELECT attempt_number FROM answers WHERE wen_id = ? AND student_id = ? AND question_id = ? ORDER BY id DESC LIMIT 1`,
    [wenId, studentId, questionId]
  )
  const attemptNumber = insertRow?.attempt_number || 1

  const result = {
    studentId,
    wenId,
    questionId,
    userAnswer,
    correctAnswer,
    isCorrect,
    score,
    submittedAt,
    attemptNumber,
  }

  logOperation('单题答题提交完成', result)
  return result
}

module.exports = {
  submitAnswers,
  submitSingleAnswer,
  getAnswersByWenId,
  getAnswersByStudentId,
}
