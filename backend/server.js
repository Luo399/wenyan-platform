/**
 * 文言文预习平台后端服务
 * 
 * 功能说明：
 * - 处理答题数据的接收和存储
 * - 使用 SQLite 数据库存储用户答案
 * - 提供 RESTful API 接口
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 中间件配置
// ============================================================

// CORS 配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// JSON 请求体解析，设置最大 10MB
app.use(express.json({ limit: '10mb' }));

// ============================================================
// 数据库连接配置
// ============================================================

// 确保 database 目录存在
const dbDir = './database';
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接
const db = new sqlite3.Database('./database/answers.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('成功连接到 SQLite 数据库');
});

// 确保表存在
db.run(`
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    wen_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT,
    submitted_at TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    UNIQUE(student_id, question_id)
  )
`, (err) => {
  if (err) {
    console.error('创建表失败:', err.message);
  }
});

// ============================================================
// API 路由
// ============================================================

/**
 * 提交答案接口
 * POST /api/submit
 * 
 * 请求体格式：
 * {
 *   studentId: string,        // 学生ID（学号）
 *   wenId: string,            // 课文ID
 *   submittedAt: string,      // 提交时间 ISO 格式
 *   answers: {
 *     [questionId]: string | number | (string | number)[]
 *   },
 *   questions: Array<{
 *     id: string,
 *     correctAnswer: string | number | (string | number)[]
 *   }>
 * }
 */
app.post('/api/submit', (req, res) => {
  try {
    const { studentId, wenId, submittedAt, answers, questions } = req.body;

    // 验证必填字段
    if (!studentId || !wenId || !submittedAt || !answers) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段'
      });
    }

    // 验证学号格式（4位数字）
    if (!/^\d{4}$/.test(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_ID',
        message: '学号格式不正确，必须为4位数字'
      });
    }

    // 计算得分并准备插入数据
    const insertPromises = questions.map((question) => {
      return new Promise((resolve, reject) => {
        const userAnswer = answers[question.id];
        const correctAnswer = question.correctAnswer;
        
        // 计算得分（简单比较）
        let score = 0;
        if (Array.isArray(correctAnswer)) {
          // 多选答案比较
          if (Array.isArray(userAnswer)) {
            const sortedCorrect = [...correctAnswer].sort();
            const sortedUser = [...userAnswer].sort();
            if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
              score = 100;
            }
          }
        } else {
          // 单选答案比较
          if (userAnswer === correctAnswer) {
            score = 100;
          }
        }

        // 插入或更新记录
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO answers (
            student_id,
            wen_id,
            question_id,
            user_answer,
            correct_answer,
            submitted_at,
            score
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          studentId,
          wenId,
          question.id,
          JSON.stringify(userAnswer),
          JSON.stringify(correctAnswer),
          submittedAt,
          score,
          (err) => {
            stmt.finalize();
            if (err) {
              reject(err);
            } else {
              resolve({ questionId: question.id, score });
            }
          }
        );
      });
    });

    // 执行所有插入操作
    Promise.all(insertPromises)
      .then((results) => {
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const avgScore = Math.round(totalScore / results.length);

        res.status(200).json({
          success: true,
          message: '答案提交成功',
          data: {
            studentId,
            wenId,
            submittedAt,
            questionCount: results.length,
            totalScore,
            avgScore,
            details: results
          }
        });
      })
      .catch((err) => {
        console.error('数据库操作失败:', err);
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '数据库操作失败: ' + err.message
        });
      });

  } catch (err) {
    console.error('处理请求失败:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    });
  }
});

/**
 * 查询学生答题记录接口
 * GET /api/answers/:studentId
 */
app.get('/api/answers/:studentId', (req, res) => {
  const { studentId } = req.params;

  if (!/^\d{4}$/.test(studentId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STUDENT_ID',
      message: '学号格式不正确'
    });
  }

  db.all(
    'SELECT * FROM answers WHERE student_id = ? ORDER BY submitted_at DESC',
    [studentId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '查询失败: ' + err.message
        });
      }

      res.status(200).json({
        success: true,
        data: rows.map(row => ({
          ...row,
          user_answer: JSON.parse(row.user_answer),
          correct_answer: row.correct_answer ? JSON.parse(row.correct_answer) : null
        }))
      });
    }
  );
});

// ============================================================
// 服务器启动
// ============================================================

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接失败:', err.message);
    } else {
      console.log('数据库连接已关闭');
    }
    process.exit(0);
  });
});
