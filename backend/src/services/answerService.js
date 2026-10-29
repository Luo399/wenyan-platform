/**
 * 答题服务模块
 * 提供答题相关的业务逻辑
 */

const { db } = require('../config/database')
const { dbGet, dbAll, dbTransaction } = require('../utils/dbPromise')
const { safeParse, getCorrectAnswerFromJson, processAnswerValue } = require('../utils/jsonReader')
const { info, warn, logOperation } = require('../utils/logger')
// B04: 答案比较逻辑统一到 utils/answerUtils，消除 controller/service 双份实现
const { compareAnswers } = require('../utils/answerUtils')
// R170: 教师后台同步（异步，失败不阻塞主流程）
const { syncToTeacherBackend } = require('./teacherSync')

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
 * 判分只认服务端：从后端 JSON 数据源读取正确答案。
 * 取不到时直接抛 500，绝不回退到客户端提交的 correctAnswer。
 * @param {string} questionId
 * @param {string} wenId
 * @returns {any}
 */
function getServerCorrectAnswer(questionId, wenId) {
  const answer = getCorrectAnswerFromJson(questionId, wenId)
  if (answer === undefined || answer === null) {
    const err = new Error('题目答案不可用')
    err.statusCode = 500
    err.error = 'ANSWER_KEY_UNAVAILABLE'
    throw err
  }
  return answer
}

/**
 * 构造 400 业务错误（由 controller 统一转成响应）
 * @param {string} message
 * @returns {Error}
 */
function createBadRequest(message) {
  const err = new Error(message)
  err.statusCode = 400
  err.error = 'VALIDATION_ERROR'
  return err
}

/**
 * 查询学生班级（用于教师后台同步，失败不影响答题结果）
 * @param {string} studentId
 * @returns {Promise<string|null>}
 */
async function getStudentClassCode(studentId) {
  try {
    const row = await dbGet(db, 'SELECT class_code FROM students WHERE student_id = ?', [studentId])
    return row?.class_code || null
  } catch {
    return null
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

  // 空题保护：没有题目 / 没有答案直接 400
  if (!Array.isArray(questions) || questions.length === 0) {
    throw createBadRequest('questions 至少包含 1 道题')
  }
  if (!answers || Object.keys(answers).length === 0) {
    throw createBadRequest('answers 至少包含 1 道题')
  }

  info('开始处理答题提交', {
    studentId,
    studentName,
    wenId,
    questionCount: questions.length,
  })

  await ensureStudentInfo(studentId, studentName)

  // P0: 批量提交整体置于事务中——任一题插入失败即回滚，避免"部分成功"脏数据
  const results = await dbTransaction(db, async (tx) => {
    const inserted = []
    for (const question of questions) {
      const userAnswer = answers[question.id]
      // 判分只认服务端 JSON，客户端传入的 correctAnswer 一律忽略
      const correctAnswer = getServerCorrectAnswer(question.id, wenId)
      const { score, isCorrect } = compareAnswers(userAnswer, correctAnswer)

      // 事务内先算 next_attempt 再插入；dbTransaction 已串行化，避免子查询竞态
      const attemptRow = await tx.dbGet(
        `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
         FROM answers
         WHERE wen_id = ? AND student_id = ? AND question_id = ?`,
        [wenId, studentId, question.id],
      )
      const attemptNumber = attemptRow?.next_attempt || 1

      await tx.dbRun(
        `INSERT INTO answers (
          wen_id, student_id, question_id, user_answer, correct_answer,
          is_correct, score, submitted_at, attempt_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          wenId,
          studentId,
          question.id,
          JSON.stringify(userAnswer ?? null),
          JSON.stringify(correctAnswer ?? null),
          isCorrect,
          score,
          submittedAt,
          attemptNumber,
        ],
      )

      inserted.push({
        questionId: question.id,
        score,
        isCorrect,
        attemptNumber,
      })
    }
    return inserted
  })

  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const correctCount = results.filter((r) => r.isCorrect === 1).length
  const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0

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

  // R170: 异步推送最小字段到教师后台（Fire-and-forget）
  // - 只发学生 id/姓名/班级/分数汇总，不整包 answers（减少敏感数据外发）
  // - 未配置 TEACHER_BACKEND_URL 时 syncToTeacherBackend 内部静默跳过，零开销
  void (async () => {
    const classCode = await getStudentClassCode(studentId)
    await syncToTeacherBackend({
      studentId,
      studentName,
      classCode,
      wenId,
      submittedAt,
      questionCount: results.length,
      totalScore,
      correctCount,
      wrongCount: results.length - correctCount,
      avgScore,
    })
  })()

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
  const { studentId, studentName, wenId, questionId, userAnswer } = data
  const submittedAtValue = data.submittedAt || new Date().toISOString()

  info('开始处理单题答题提交', {
    studentId,
    studentName,
    wenId,
    questionId,
  })

  await ensureStudentInfo(studentId, studentName)

  // 判分只认服务端 JSON；客户端传入的 correctAnswer 一律忽略
  const finalCorrectAnswer = getServerCorrectAnswer(questionId, wenId)
  const { score, isCorrect } = compareAnswers(userAnswer, finalCorrectAnswer)

  // 与批量提交共用串行事务：先算 next_attempt 再插入，避免竞态
  const attemptNumber = await dbTransaction(db, async (tx) => {
    const attemptRow = await tx.dbGet(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
       FROM answers
       WHERE wen_id = ? AND student_id = ? AND question_id = ?`,
      [wenId, studentId, questionId],
    )
    const nextAttempt = attemptRow?.next_attempt || 1

    await tx.dbRun(
      `INSERT INTO answers (
        wen_id, student_id, question_id, user_answer, correct_answer,
        is_correct, score, submitted_at, attempt_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wenId,
        studentId,
        questionId,
        JSON.stringify(userAnswer ?? null),
        JSON.stringify(finalCorrectAnswer ?? null),
        isCorrect,
        score,
        submittedAtValue,
        nextAttempt,
      ],
    )
    return nextAttempt
  })

  const result = {
    studentId,
    wenId,
    questionId,
    userAnswer,
    correctAnswer: finalCorrectAnswer,
    isCorrect,
    score,
    submittedAt: submittedAtValue,
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
