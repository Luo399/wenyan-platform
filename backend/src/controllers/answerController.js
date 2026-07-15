const { db } = require('../config/database');
const { getCorrectAnswerFromJson } = require('../utils/jsonReader');
const crypto = require('crypto');
const config = require('../config/app');

const AUTH_SECRET = config.auth.secret;
const AUTH_ENABLED = AUTH_SECRET.length > 0;

function generateHmacSignature(studentId, timestamp) {
  const payload = `${studentId}:${timestamp}`;
  return crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payload)
    .digest('hex');
}

function verifyHmacSignature(studentId, timestamp, signature, toleranceMs = 5 * 60 * 1000) {
  if (!AUTH_ENABLED) {
    return { valid: true };
  }

  if (!signature) {
    return { valid: false, error: '缺少签名' };
  }

  const requestTime = new Date(timestamp).getTime();
  const now = Date.now();
  if (isNaN(requestTime) || Math.abs(now - requestTime) > toleranceMs) {
    return { valid: false, error: '签名已过期' };
  }

  const expectedSignature = generateHmacSignature(studentId, timestamp);
  
  if (signature !== expectedSignature) {
    return { valid: false, error: '签名无效' };
  }

  return { valid: true };
}

function compareAnswers(userAnswer, correctAnswer) {
  if (Array.isArray(correctAnswer)) {
    if (Array.isArray(userAnswer)) {
      const sortedCorrect = [...correctAnswer].sort();
      const sortedUser = [...userAnswer].sort();
      return JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser);
    }
    return false;
  } else {
    return userAnswer === correctAnswer;
  }
}

function submitAnswers(req, res) {
  try {
    const { studentId, wenId, submittedAt, answers, questions, signature } = req.body;

    if (!studentId || !wenId || !submittedAt || !answers || !questions) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '缺少必填字段',
      });
    }

    if (AUTH_ENABLED) {
      const verifyResult = verifyHmacSignature(studentId, submittedAt, signature);
      if (!verifyResult.valid) {
        return res.status(401).json({
          success: false,
          error: 'AUTH_FAILED',
          message: verifyResult.error,
        });
      }
    }

    const insertPromises = questions.map((question) => {
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

        db.get(
          'SELECT attempt_number FROM answers WHERE student_id = ? AND question_id = ?',
          [studentId, question.id],
          (err, row) => {
            const attemptNumber = row ? row.attempt_number + 1 : 1;

            const stmt = db.prepare(`
              INSERT OR REPLACE INTO answers (
                student_id,
                wen_id,
                question_id,
                user_answer,
                correct_answer,
                submitted_at,
                score,
                is_correct,
                attempt_number
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              attemptNumber,
              (err) => {
                stmt.finalize();
                if (err) {
                  reject(err);
                } else {
                  resolve({ questionId: question.id, score, isCorrect, attemptNumber });
                }
              },
            );
          }
        );
      });
    });

    Promise.all(insertPromises)
      .then((results) => {
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const correctCount = results.filter((r) => r.isCorrect === 1).length;
        const avgScore = Math.round(totalScore / results.length);

        res.status(200).json({
          success: true,
          message: '答案提交成功',
          data: {
            studentId,
            wenId,
            submittedAt,
            questionCount: results.length,
            correctCount,
            wrongCount: results.length - correctCount,
            totalScore,
            avgScore,
            details: results,
          },
        });
      })
      .catch((err) => {
        console.error('数据库操作失败:', err);
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '数据库操作失败: ' + err.message,
        });
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

    db.get(
      'SELECT attempt_number FROM answers WHERE student_id = ? AND question_id = ?',
      [studentId, questionId],
      (err, row) => {
        const attemptNumber = row ? row.attempt_number + 1 : 1;

        const stmt = db.prepare(`
          INSERT OR REPLACE INTO answers (
            student_id,
            wen_id,
            question_id,
            user_answer,
            correct_answer,
            submitted_at,
            score,
            is_correct,
            attempt_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          studentId,
          wenId,
          questionId,
          JSON.stringify(userAnswer),
          finalCorrectAnswer !== null ? JSON.stringify(finalCorrectAnswer) : null,
          submittedAt || new Date().toISOString(),
          score,
          isCorrect,
          attemptNumber,
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
                submittedAt: submittedAt || new Date().toISOString(),
                attemptNumber,
              },
            });
          },
        );
      }
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