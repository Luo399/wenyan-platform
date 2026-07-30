const { db } = require('../config/database');
const { getCorrectAnswerFromJson } = require('../utils/jsonReader');

// R90 已移除 HMAC 签名校验（AUTH_SECRET/AUTH_ENABLED/generateHmacSignature/verifyHmacSignature）
// 鉴权完全交给路由层的 optionalAuthMiddleware（JWT Bearer token）
// 旧实现的问题：前端从不发送 signature 字段，导致 AUTH_SECRET 非空时 /api/submit 直接 401
// 客户端密钥无法安全存储，HMAC 签名方案已被 JWT 取代

function compareAnswers(userAnswer, correctAnswer) {
  if (Array.isArray(correctAnswer)) {
    // 正确答案是数组的情况
    if (Array.isArray(userAnswer)) {
      const sortedCorrect = [...correctAnswer].map(String).sort();
      const sortedUser = [...userAnswer].map(String).sort();
      return JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser);
    } else {
      // 用户答案不是数组，转为数组进行对比
      const sortedCorrect = [...correctAnswer].map(String).sort();
      const sortedUser = [String(userAnswer ?? '')].sort();
      return JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser);
    }
  } else {
    // 正确答案不是数组的情况
    const stringCorrect = String(correctAnswer ?? '');
    if (Array.isArray(userAnswer)) {
      // 用户答案是数组，用逗号拼接对比
      const stringUser = userAnswer.map(String).join(',');
      return stringCorrect === stringUser;
    } else {
      return String(userAnswer ?? '') === stringCorrect;
    }
  }
}

async function submitAnswers(req, res) {
  try {
    const { studentId, wenId, submittedAt, answers, questions } = req.body;

    if (!studentId || !wenId || !submittedAt || !answers || !questions) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '缺少必填字段',
      });
    }

    // R90: 鉴权由路由层 optionalAuthMiddleware（JWT）统一处理，此处不再校验 HMAC 签名

    // 等待所有题目的写入完成（使用子查询保证原子性）
    const results = await Promise.all(
      questions.map((question) => {
        return new Promise((resolve, reject) => {
          const userAnswer = answers[question.id];
          const correctAnswer = question.correctAnswer ?? getCorrectAnswerFromJson(question.id, wenId);

          let score = 0;
          let isCorrect = 0;

          if (correctAnswer !== null) {
            if (compareAnswers(userAnswer, correctAnswer)) {
              score = 100;
              isCorrect = 1;
            }
          }

          // 使用子查询计算 attempt_number，保证并发安全
          const stmt = db.prepare(`
            INSERT INTO answers (
              student_id,
              wen_id,
              question_id,
              user_answer,
              correct_answer,
              submitted_at,
              score,
              is_correct,
              attempt_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (
              SELECT COALESCE(MAX(attempt_number), 0) + 1
              FROM answers
              WHERE student_id = ? AND wen_id = ? AND question_id = ?
            ))
          `);

          stmt.run(
            studentId,
            wenId,
            question.id,
            JSON.stringify(userAnswer),
            correctAnswer !== null ? JSON.stringify(correctAnswer) : null,
            submittedAt,
            score,
            isCorrect,
            studentId,
            wenId,
            question.id,
            (runErr) => {
              stmt.finalize();
              if (runErr) {
                reject(runErr);
              } else {
                // 获取刚插入的 attempt_number
                db.get(
                  'SELECT attempt_number FROM answers WHERE student_id = ? AND wen_id = ? AND question_id = ? ORDER BY id DESC LIMIT 1',
                  [studentId, wenId, question.id],
                  (err, row) => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve({
                        questionId: question.id,
                        score,
                        isCorrect,
                        attemptNumber: row?.attempt_number || 1,
                      });
                    }
                  },
                );
              }
            },
          );
        });
      }),
    );

    // 构造汇总结果
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const correctCount = results.filter((r) => r.isCorrect === 1).length;
    const result = {
      success: true,
      data: {
        studentId,
        wenId,
        submittedAt,
        questionCount: results.length,
        correctCount,
        wrongCount: results.length - correctCount,
        totalScore,
        avgScore: results.length ? Math.round(totalScore / results.length) : 0,
        details: results,
      },
    };

    res.status(200).json({
      success: result.success,
      message: '答案提交成功',
      data: result.data,
    });
  } catch (err) {
    console.error('处理请求失败:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
}

function submitSingleAnswer(req, res) {
  try {
    const { studentId, wenId, questionId, userAnswer, correctAnswer, submittedAt } = req.body;

    if (!studentId || !wenId || !questionId || userAnswer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '缺少必填字段',
      });
    }

    const finalCorrectAnswer = correctAnswer ?? getCorrectAnswerFromJson(questionId, wenId);

    let score = 0;
    let isCorrect = 0;

    if (finalCorrectAnswer !== null) {
      if (compareAnswers(userAnswer, finalCorrectAnswer)) {
        score = 100;
        isCorrect = 1;
      }
    }

    const finalSubmittedAt = submittedAt || new Date().toISOString();

    // 使用子查询计算 attempt_number，保证并发安全
    const stmt = db.prepare(`
      INSERT INTO answers (
        student_id,
        wen_id,
        question_id,
        user_answer,
        correct_answer,
        submitted_at,
        score,
        is_correct,
        attempt_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (
        SELECT COALESCE(MAX(attempt_number), 0) + 1
        FROM answers
        WHERE student_id = ? AND wen_id = ? AND question_id = ?
      ))
    `);

    stmt.run(
      studentId,
      wenId,
      questionId,
      JSON.stringify(userAnswer),
      finalCorrectAnswer !== null ? JSON.stringify(finalCorrectAnswer) : null,
      finalSubmittedAt,
      score,
      isCorrect,
      studentId,
      wenId,
      questionId,
      (err) => {
        stmt.finalize();
        if (err) {
          console.error('数据库操作失败:', err);
          return res.status(500).json({
            success: false,
            error: 'DATABASE_ERROR',
            message: '数据库操作失败: ' + err.message,
          });
        }

        // 获取刚插入的 attempt_number
        db.get(
          'SELECT attempt_number FROM answers WHERE student_id = ? AND wen_id = ? AND question_id = ? ORDER BY id DESC LIMIT 1',
          [studentId, wenId, questionId],
          (getErr, row) => {
            if (getErr) {
              console.error('获取 attempt_number 失败:', getErr);
              return res.status(500).json({
                success: false,
                error: 'DATABASE_ERROR',
                message: '获取答题次数失败',
              });
            }

            res.status(200).json({
              success: true,
              message: '答案提交成功',
              data: {
                studentId,
                wenId,
                questionId,
                userAnswer,
                correctAnswer: finalCorrectAnswer,
                isCorrect,
                score,
                submittedAt: finalSubmittedAt,
                attemptNumber: row?.attempt_number || 1,
              },
            });
          },
        );
      },
    );
  } catch (err) {
    console.error('处理请求失败:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
}

function getAnswersByWenId(req, res) {
  const { wenId } = req.params;

  db.all(
    'SELECT * FROM answers WHERE wen_id = ? ORDER BY submitted_at DESC',
    [wenId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '查询失败: ' + err.message,
        });
      }

      res.status(200).json({
        success: true,
        data: rows.map((row) => ({
          ...row,
          user_answer: JSON.parse(row.user_answer),
          correct_answer: row.correct_answer ? JSON.parse(row.correct_answer) : null,
        })),
      });
    },
  );
}

function getAnswersByStudentId(req, res) {
  const { studentId } = req.params;

  db.all(
    'SELECT * FROM answers WHERE student_id = ? ORDER BY submitted_at DESC',
    [studentId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '查询失败: ' + err.message,
        });
      }

      res.status(200).json({
        success: true,
        data: rows.map((row) => ({
          ...row,
          user_answer: JSON.parse(row.user_answer),
          correct_answer: row.correct_answer ? JSON.parse(row.correct_answer) : null,
        })),
      });
    },
  );
}

module.exports = {
  submitAnswers,
  submitSingleAnswer,
  getAnswersByWenId,
  getAnswersByStudentId,
};