/**
 * 答题服务模块
 * 提供答题相关的业务逻辑
 */

const { answerDb, studentDb } = require('../config/database');
const { safeParse, getCorrectAnswerFromJson, processAnswerValue } = require('../utils/jsonReader');
const { info, warn, logOperation } = require('../utils/logger');

/**
 * 获取学生姓名（从学生数据库）
 * @param {string} studentId - 学生ID
 * @returns {Promise<string|null>} - 学生姓名
 */
async function getStudentName(studentId) {
  return new Promise((resolve) => {
    studentDb.get(
      'SELECT name FROM students WHERE student_id = ?',
      [studentId],
      (err, row) => {
        if (err) {
          console.warn('查询学生姓名失败:', err);
          resolve(null);
        } else {
          resolve(row?.name || null);
        }
      }
    );
  });
}

/**
 * 提交答题记录
 * @param {object} data - 答题数据
 * @returns {Promise<object>} - 提交结果
 */
async function submitAnswers(data) {
  const { studentId, studentName, wenId, submittedAt, answers, questions = [] } = data;

  info('开始处理答题提交', {
    studentId,
    studentName,
    wenId,
    questionCount: questions.length,
  });

  // 如果提供了学生姓名，自动注册或更新学生信息
  if (studentName) {
    try {
      // 动态导入避免循环依赖
      const { createOrUpdateStudent } = await import('./studentService');
      await createOrUpdateStudent(studentId, studentName);
      info('学生信息更新成功', { studentId, studentName });
    } catch (err) {
      warn('学生信息更新失败', { studentId, studentName, error: err.message });
    }
  }

  // 计算得分并准备插入数据
  const insertPromises = questions.map((question) => {
    return new Promise((resolve, reject) => {
      const userAnswer = answers[question.id];
      const correctAnswer = question.correctAnswer;

      // 计算得分和是否正确
      let score = 0;
      let isCorrect = 0;

      if (Array.isArray(correctAnswer)) {
        // 多选答案比较（统一转换为字符串后比较）
        if (Array.isArray(userAnswer)) {
          const sortedCorrect = [...correctAnswer].map(String).sort();
          const sortedUser = [...userAnswer].map(String).sort();
          if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
            score = 100;
            isCorrect = 1;
          }
        }
      } else {
        // 单选答案比较（统一转换为字符串后比较，避免类型不匹配）
        const stringCorrect = String(correctAnswer ?? '');
        const stringUser = String(userAnswer ?? '');
        if (stringCorrect === stringUser) {
          score = 100;
          isCorrect = 1;
        }
      }

      // 使用事务保证原子性，避免并发写入时的竞态条件
      answerDb.serialize(() => {
        answerDb.get(
          `SELECT COUNT(*) as count FROM answer_records WHERE wen_id = ? AND student_id = ? AND question_id = ?`,
          [wenId, studentId, question.id],
          (countErr, countRow) => {
            if (countErr) {
              reject(countErr);
              return;
            }

            const attemptNumber = (countRow?.count || 0) + 1;

            // 插入新记录（不覆盖，保留每次答题记录）
            const stmt = answerDb.prepare(`
              INSERT INTO answer_records (
                wen_id,
                student_id,
                question_id,
                user_answer,
                correct_answer,
                is_correct,
                score,
                submitted_at,
                attempt_number
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
              wenId,
              studentId,
              question.id,
              JSON.stringify(userAnswer ?? null),
              JSON.stringify(correctAnswer ?? null),
              isCorrect,
              score,
              submittedAt,
              attemptNumber,
              (err) => {
                stmt.finalize();
                if (err) {
                  reject(err);
                } else {
                  resolve({ questionId: question.id, score, isCorrect, attemptNumber });
                }
              }
            );
          }
        );
      });
    });
  });

  // 执行所有插入操作
  const results = await Promise.all(insertPromises);
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const correctCount = results.filter((r) => r.isCorrect === 1).length;
  const avgScore = Math.round(totalScore / results.length);

  const result = {
    studentId,
    wenId,
    submittedAt,
    questionCount: results.length,
    correctCount,
    wrongCount: results.length - correctCount,
    totalScore,
    avgScore,
    details: results,
  };

  logOperation('答题提交完成', {
    studentId,
    wenId,
    questionCount: results.length,
    correctCount,
    wrongCount: results.length - correctCount,
    totalScore,
    avgScore,
  });

  return result;
}

/**
 * 按文言文ID查询答题情况
 * @param {string} wenId - 文言文ID
 * @returns {Promise<object>} - 查询结果
 */
async function getAnswersByWenId(wenId) {
  return new Promise((resolve, reject) => {
    answerDb.all(
      `SELECT * FROM answer_records
       WHERE wen_id = ?
       ORDER BY submitted_at DESC`,
      [wenId],
      async (err, rows) => {
        if (err) {
          return reject(err);
        }

        // 获取所有学生ID
        const studentIds = [...new Set(rows.map((row) => row.student_id))];
        
        // 批量查询学生姓名
        const studentNames = {};
        for (const studentId of studentIds) {
          studentNames[studentId] = await getStudentName(studentId);
        }

        // 按学生分组统计
        const studentStats = {};
        rows.forEach((row) => {
          const studentName = studentNames[row.student_id];
          
          if (!studentStats[row.student_id]) {
            studentStats[row.student_id] = {
              studentId: row.student_id,
              studentName: studentName,
              wenId: row.wen_id,
              totalQuestions: 0,
              correctCount: 0,
              wrongCount: 0,
              totalScore: 0,
              answers: [],
            };
          }

          const stat = studentStats[row.student_id];
          stat.totalQuestions++;
          stat.correctCount += row.is_correct;
          stat.wrongCount += row.is_correct === 0 ? 1 : 0;
          stat.totalScore += row.score;

          // 处理答案值
          let correctAnswerValue = processAnswerValue(row.correct_answer);
          if (correctAnswerValue === null || correctAnswerValue === 'unknown') {
            correctAnswerValue = getCorrectAnswerFromJson(row.question_id, row.wen_id);
          }

          stat.answers.push({
            questionId: row.question_id,
            userAnswer: safeParse(row.user_answer),
            correctAnswer: correctAnswerValue,
            isCorrect: row.is_correct === 1,
            score: row.score,
            submittedAt: row.submitted_at,
            attemptNumber: row.attempt_number,
          });
        });

        // 计算平均分
        Object.values(studentStats).forEach((stat) => {
          stat.avgScore =
            stat.totalQuestions > 0 ? Math.round(stat.totalScore / stat.totalQuestions) : 0;
        });

        resolve({
          wenId,
          studentCount: Object.keys(studentStats).length,
          students: Object.values(studentStats),
        });
      }
    );
  });
}

/**
 * 按学生ID查询答题情况
 * @param {string} studentId - 学生ID
 * @returns {Promise<object>} - 查询结果
 */
async function getAnswersByStudentId(studentId) {
  return new Promise((resolve, reject) => {
    answerDb.all(
      `SELECT * FROM answer_records
       WHERE student_id = ?
       ORDER BY wen_id, submitted_at DESC`,
      [studentId],
      async (err, rows) => {
        if (err) {
          return reject(err);
        }

        // 获取学生姓名
        const studentName = await getStudentName(studentId);

        // 按文言文分组统计
        const wenStats = {};
        rows.forEach((row) => {
          if (!wenStats[row.wen_id]) {
            wenStats[row.wen_id] = {
              studentId: row.student_id,
              studentName: studentName,
              wenId: row.wen_id,
              submittedAt: row.submitted_at,
              totalQuestions: 0,
              correctCount: 0,
              wrongCount: 0,
              totalScore: 0,
              answers: [],
            };
          }

          const stat = wenStats[row.wen_id];
          stat.totalQuestions++;
          stat.correctCount += row.is_correct;
          stat.wrongCount += row.is_correct === 0 ? 1 : 0;
          stat.totalScore += row.score;

          // 处理答案值
          let correctAnswerValue = processAnswerValue(row.correct_answer);
          if (correctAnswerValue === null || correctAnswerValue === 'unknown') {
            correctAnswerValue = getCorrectAnswerFromJson(row.question_id, row.wen_id);
          }

          stat.answers.push({
            questionId: row.question_id,
            userAnswer: safeParse(row.user_answer),
            correctAnswer: correctAnswerValue,
            isCorrect: row.is_correct === 1,
            score: row.score,
            submittedAt: row.submitted_at,
            attemptNumber: row.attempt_number,
          });
        });

        // 计算平均分和总统计
        let totalAllQuestions = 0;
        let totalAllCorrect = 0;
        let totalAllScore = 0;

        Object.values(wenStats).forEach((stat) => {
          stat.avgScore =
            stat.totalQuestions > 0 ? Math.round(stat.totalScore / stat.totalQuestions) : 0;
          totalAllQuestions += stat.totalQuestions;
          totalAllCorrect += stat.correctCount;
          totalAllScore += stat.totalScore;
        });

        resolve({
          studentId,
          studentName: studentName,
          totalWenCount: Object.keys(wenStats).length,
          totalAllQuestions,
          totalAllCorrect,
          totalAllWrong: totalAllQuestions - totalAllCorrect,
          overallAvgScore:
            totalAllQuestions > 0 ? Math.round(totalAllScore / totalAllQuestions) : 0,
          wenRecords: Object.values(wenStats),
        });
      }
    );
  });
}

/**
 * 提交单题答题记录
 * @param {object} data - 单题答题数据
 * @returns {Promise<object>} - 提交结果
 */
async function submitSingleAnswer(data) {
  const { studentId, studentName, wenId, questionId, userAnswer, correctAnswer, submittedAt } = data;

  info('开始处理单题答题提交', {
    studentId,
    studentName,
    wenId,
    questionId,
  });

  // 如果提供了学生姓名，自动注册或更新学生信息
  if (studentName) {
    try {
      const { createOrUpdateStudent } = await import('./studentService');
      await createOrUpdateStudent(studentId, studentName);
      info('学生信息更新成功', { studentId, studentName });
    } catch (err) {
      warn('学生信息更新失败', { studentId, studentName, error: err.message });
    }
  }

  return new Promise((resolve, reject) => {
    // 计算得分和是否正确
    let score = 0;
    let isCorrect = 0;

    if (Array.isArray(correctAnswer)) {
      if (Array.isArray(userAnswer)) {
        const sortedCorrect = [...correctAnswer].map(String).sort();
        const sortedUser = [...userAnswer].map(String).sort();
        if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
          score = 100;
          isCorrect = 1;
        }
      }
    } else {
      const stringCorrect = String(correctAnswer ?? '');
      const stringUser = String(userAnswer ?? '');
      if (stringCorrect === stringUser) {
        score = 100;
        isCorrect = 1;
      }
    }

    answerDb.serialize(() => {
      answerDb.get(
        `SELECT COUNT(*) as count FROM answer_records WHERE wen_id = ? AND student_id = ? AND question_id = ?`,
        [wenId, studentId, questionId],
        (countErr, countRow) => {
          if (countErr) {
            reject(countErr);
            return;
          }

          const attemptNumber = (countRow?.count || 0) + 1;

          const stmt = answerDb.prepare(`
            INSERT INTO answer_records (
              wen_id,
              student_id,
              question_id,
              user_answer,
              correct_answer,
              is_correct,
              score,
              submitted_at,
              attempt_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          stmt.run(
            wenId,
            studentId,
            questionId,
            JSON.stringify(userAnswer ?? null),
            JSON.stringify(correctAnswer ?? null),
            isCorrect,
            score,
            submittedAt,
            attemptNumber,
            (err) => {
              stmt.finalize();
              if (err) {
                reject(err);
              } else {
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
                };
                logOperation('单题答题提交完成', result);
                resolve(result);
              }
            }
          );
        }
      );
    });
  });
}

module.exports = {
  submitAnswers,
  submitSingleAnswer,
  getAnswersByWenId,
  getAnswersByStudentId
};
