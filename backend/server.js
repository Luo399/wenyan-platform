/**
 * 文言文预习平台后端服务
 *
 * 功能说明：
 * - 处理答题数据的接收和存储
 * - 使用 SQLite 数据库存储用户答案
 * - 提供 RESTful API 接口
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')

const app = express()
const PORT = process.env.PORT || 3000

// ============================================================
// 中间件配置
// ============================================================

// CORS 配置
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
)

// JSON 请求体解析，设置最大 10MB
app.use(express.json({ limit: '10mb' }))

// 静态文件服务
app.use(express.static('public'))

// ============================================================
// 数据库连接配置
// ============================================================

// 确保 database 目录存在
const dbDir = './database'
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// 创建数据库连接
const db = new sqlite3.Database('./database/answers.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message)
    process.exit(1)
  }
  console.log('成功连接到 SQLite 数据库')
})

// 确保表存在 - 学生表
db.run(
  `
  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`,
  (err) => {
    if (err) {
      console.error('创建学生表失败:', err.message)
    }
  },
)

// 确保表存在 - 答题情况表
db.run(
  `
  CREATE TABLE IF NOT EXISTS answer_records (
    wen_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT,
    is_correct INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    submitted_at TEXT NOT NULL,
    PRIMARY KEY (wen_id, student_id, question_id)
  )
`,
  (err) => {
    if (err) {
      console.error('创建答题情况表失败:', err.message)
    }
  },
)

// 创建索引优化查询性能
db.run(`CREATE INDEX IF NOT EXISTS idx_wen_id ON answer_records(wen_id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_student_id ON answer_records(student_id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_wen_student ON answer_records(wen_id, student_id)`)

// ============================================================
// API 路由
// ============================================================

/**
 * 学生注册接口
 * POST /api/students
 *
 * 请求体格式：
 * {
 *   studentId: string,        // 学生ID（学号）
 *   name: string              // 学生姓名
 * }
 */
app.post('/api/students', (req, res) => {
  try {
    const { studentId, name } = req.body

    if (!studentId || !name) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段',
      })
    }

    // 插入或更新学生信息
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO students (student_id, name) VALUES (?, ?)
    `)

    stmt.run(studentId, name, (err) => {
      stmt.finalize()
      if (err) {
        console.error('学生注册失败:', err)
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '学生注册失败',
        })
      }

      res.status(200).json({
        success: true,
        message: '学生注册成功',
        data: { studentId, name },
      })
    })
  } catch (err) {
    console.error('处理请求失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
})

/**
 * 提交答案接口
 * POST /api/submit
 *
 * 请求体格式：
 * {
 *   studentId: string,        // 学生ID（学号）
 *   studentName: string,      // 学生姓名（可选，用于自动注册）
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
    const { studentId, studentName, wenId, submittedAt, answers, questions } = req.body

    // 验证必填字段
    if (!studentId || !wenId || !submittedAt || !answers) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段',
      })
    }

    // 验证学号格式（4位数字）
    if (!/^\d{4}$/.test(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_ID',
        message: '学号格式不正确，必须为4位数字',
      })
    }

    // 如果提供了学生姓名，自动注册或更新学生信息
    if (studentName) {
      const studentStmt = db.prepare(`
        INSERT OR REPLACE INTO students (student_id, name) VALUES (?, ?)
      `)
      studentStmt.run(studentId, studentName, (err) => {
        studentStmt.finalize()
        if (err) {
          console.warn('学生信息更新失败:', err)
        }
      })
    }

    // 计算得分并准备插入数据
    const insertPromises = questions.map((question) => {
      return new Promise((resolve, reject) => {
        const userAnswer = answers[question.id]
        const correctAnswer = question.correctAnswer

        // 计算得分和是否正确
        let score = 0
        let isCorrect = 0

        if (Array.isArray(correctAnswer)) {
          // 多选答案比较
          if (Array.isArray(userAnswer)) {
            const sortedCorrect = [...correctAnswer].sort()
            const sortedUser = [...userAnswer].sort()
            if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
              score = 100
              isCorrect = 1
            }
          }
        } else {
          // 单选答案比较
          if (userAnswer === correctAnswer) {
            score = 100
            isCorrect = 1
          }
        }

        // 插入或更新记录到 answer_records 表
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO answer_records (
            wen_id,
            student_id,
            question_id,
            user_answer,
            correct_answer,
            is_correct,
            score,
            submitted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)

        stmt.run(
          wenId,
          studentId,
          question.id,
          JSON.stringify(userAnswer),
          JSON.stringify(correctAnswer),
          isCorrect,
          score,
          submittedAt,
          (err) => {
            stmt.finalize()
            if (err) {
              reject(err)
            } else {
              resolve({ questionId: question.id, score, isCorrect })
            }
          },
        )
      })
    })

    // 执行所有插入操作
    Promise.all(insertPromises)
      .then((results) => {
        const totalScore = results.reduce((sum, r) => sum + r.score, 0)
        const correctCount = results.filter((r) => r.isCorrect === 1).length
        const avgScore = Math.round(totalScore / results.length)

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
        })
      })
      .catch((err) => {
        console.error('数据库操作失败:', err)
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '数据库操作失败: ' + err.message,
        })
      })
  } catch (err) {
    console.error('处理请求失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
})

/**
 * 按文言文ID查询答题情况接口
 * GET /api/answers/wen/:wenId
 *
 * 获取该文言文下所有学生的答题情况
 */
app.get('/api/answers/wen/:wenId', (req, res) => {
  const { wenId } = req.params

  if (!wenId) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_WEN_ID',
      message: '缺少文言文ID',
    })
  }

  db.all(
    `
      SELECT ar.*, s.name as student_name
      FROM answer_records ar
      LEFT JOIN students s ON ar.student_id = s.student_id
      WHERE ar.wen_id = ?
      ORDER BY ar.submitted_at DESC
    `,
    [wenId],
    (err, rows) => {
      if (err) {
        console.error('查询失败:', err)
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '查询失败: ' + err.message,
        })
      }

      // 按学生分组统计
      const studentStats = {}
      rows.forEach((row) => {
        if (!studentStats[row.student_id]) {
          studentStats[row.student_id] = {
            studentId: row.student_id,
            studentName: row.student_name,
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
        stat.answers.push({
          questionId: row.question_id,
          userAnswer: JSON.parse(row.user_answer),
          correctAnswer: row.correct_answer ? JSON.parse(row.correct_answer) : null,
          isCorrect: row.is_correct === 1,
          score: row.score,
          submittedAt: row.submitted_at,
        })
      })

      // 计算平均分
      Object.values(studentStats).forEach((stat) => {
        stat.avgScore =
          stat.totalQuestions > 0 ? Math.round(stat.totalScore / stat.totalQuestions) : 0
      })

      res.status(200).json({
        success: true,
        data: {
          wenId,
          studentCount: Object.keys(studentStats).length,
          students: Object.values(studentStats),
        },
      })
    },
  )
})

/**
 * 按学生ID查询答题情况接口
 * GET /api/answers/student/:studentId
 *
 * 获取该学生所有文言文的答题情况
 */
app.get('/api/answers/student/:studentId', (req, res) => {
  const { studentId } = req.params

  if (!/^\d{4}$/.test(studentId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STUDENT_ID',
      message: '学号格式不正确',
    })
  }

  db.all(
    `
      SELECT ar.*, s.name as student_name
      FROM answer_records ar
      LEFT JOIN students s ON ar.student_id = s.student_id
      WHERE ar.student_id = ?
      ORDER BY ar.wen_id, ar.submitted_at DESC
    `,
    [studentId],
    (err, rows) => {
      if (err) {
        console.error('查询失败:', err)
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '查询失败: ' + err.message,
        })
      }

      // 按文言文分组统计
      const wenStats = {}
      rows.forEach((row) => {
        if (!wenStats[row.wen_id]) {
          wenStats[row.wen_id] = {
            studentId: row.student_id,
            studentName: row.student_name,
            wenId: row.wen_id,
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
        stat.answers.push({
          questionId: row.question_id,
          userAnswer: JSON.parse(row.user_answer),
          correctAnswer: row.correct_answer ? JSON.parse(row.correct_answer) : null,
          isCorrect: row.is_correct === 1,
          score: row.score,
          submittedAt: row.submitted_at,
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

      res.status(200).json({
        success: true,
        data: {
          studentId,
          studentName: rows.length > 0 ? rows[0].student_name : null,
          totalWenCount: Object.keys(wenStats).length,
          totalAllQuestions,
          totalAllCorrect,
          totalAllWrong: totalAllQuestions - totalAllCorrect,
          overallAvgScore:
            totalAllQuestions > 0 ? Math.round(totalAllScore / totalAllQuestions) : 0,
          wenRecords: Object.values(wenStats),
        },
      })
    },
  )
})

/**
 * 查询所有学生列表接口
 * GET /api/students
 */
app.get('/api/students', (req, res) => {
  db.all('SELECT * FROM students ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('查询失败:', err)
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '查询失败: ' + err.message,
      })
    }

    res.status(200).json({
      success: true,
      data: rows,
    })
  })
})

// ============================================================
// 服务器启动
// ============================================================

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
})

// 优雅关闭
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接失败:', err.message)
    } else {
      console.log('数据库连接已关闭')
    }
    process.exit(0)
  })
})
