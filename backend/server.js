/**
 * 文言文预习平台后端服务
 *
 * 功能说明：
 * - 处理答题数据的接收和存储
 * - 使用 SQLite 数据库存储用户答案
 * - 提供 RESTful API 接口
 * 
 * 安全特性：
 * - CORS 白名单校验
 * - 速率限制防护
 * - 请求体白名单校验
 * - HMAC 签名鉴权（可选）
 * - 安全响应头
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const crypto = require('crypto')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { z } = require('zod')

const app = express()
const PORT = process.env.PORT || 3000

// ============================================================
// 安全配置
// ============================================================

/**
 * CORS 白名单配置
 * 从环境变量读取，支持逗号分隔的多个域名
 */
const corsWhitelist = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const corsOptions = {
  origin: function (origin, callback) {
    // 允许无 origin 的请求（如移动端 native、服务端调用）
    if (!origin) return callback(null, true)
    
    // 白名单匹配
    if (corsWhitelist.length === 0 || corsWhitelist.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 预检请求缓存 24 小时
}

/**
 * 速率限制配置
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 最多 100 次请求
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  }
})

const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 每个 IP 最多 10 次提交
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '提交过于频繁，请稍后再试'
  }
})

const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 30, // 每个 IP 最多 30 次查询
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '查询过于频繁，请稍后再试'
  }
})

/**
 * HMAC 鉴权密钥（可选）
 * 如果设置了 AUTH_SECRET，则启用签名校验
 */
const AUTH_SECRET = process.env.AUTH_SECRET || ''
const AUTH_ENABLED = AUTH_SECRET.length > 0

/**
 * 生成 HMAC 签名
 * @param {string} studentId - 学号
 * @param {string} timestamp - 时间戳（ISO 格式）
 * @returns {string} HMAC 签名
 */
function generateHmacSignature(studentId, timestamp) {
  const payload = `${studentId}:${timestamp}`
  return crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payload)
    .digest('hex')
}

/**
 * 验证 HMAC 签名
 * @param {string} studentId - 学号
 * @param {string} timestamp - 时间戳（ISO 格式）
 * @param {string} signature - 待验证的签名
 * @param {number} toleranceMs - 时间容差（毫秒），默认 5 分钟
 * @returns {{ valid: boolean, error?: string }}
 */
function verifyHmacSignature(studentId, timestamp, signature, toleranceMs = 5 * 60 * 1000) {
  if (!AUTH_ENABLED) {
    return { valid: true } // 未启用鉴权时直接通过
  }

  if (!signature) {
    return { valid: false, error: '缺少签名' }
  }

  // 检查时间戳是否在容差范围内
  const requestTime = new Date(timestamp).getTime()
  const now = Date.now()
  if (isNaN(requestTime) || Math.abs(now - requestTime) > toleranceMs) {
    return { valid: false, error: '签名已过期' }
  }

  const expectedSignature = generateHmacSignature(studentId, timestamp)
  
  if (signature !== expectedSignature) {
    return { valid: false, error: '签名无效' }
  }

  return { valid: true }
}

// ============================================================
// 中间件配置
// ============================================================

// 安全响应头
app.use(helmet({
  contentSecurityPolicy: false, // 暂时禁用 CSP，由 nginx 层配置
  crossOriginEmbedderPolicy: false,
}))

// CORS 配置
app.use(cors(corsOptions))

// 全局速率限制
app.use(globalLimiter)

// JSON 请求体解析，设置最大 1MB（安全限制）
app.use(express.json({ limit: '1mb' }))

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

// 确保表存在
db.run(
  `CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    wen_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT,
    submitted_at TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    UNIQUE(student_id, question_id)
  )`,
  (err) => {
    if (err) {
      console.error('创建表失败:', err.message)
    }
  },
)

// ============================================================
// 请求体验证 Schema
// ============================================================

const submitAnswerSchema = z.object({
  studentId: z.string().regex(/^\d{4}$/, '学号必须为4位数字'),
  wenId: z.string().min(1).max(20),
  submittedAt: z.string().datetime({ local: true }),
  answers: z.record(z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])),
  questions: z.array(z.object({
    id: z.string().min(1),
    correctAnswer: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])
  })).min(1).max(50),
  signature: z.string().optional(), // HMAC 签名（可选）
})

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
 *   }>,
 *   signature?: string        // HMAC 签名（可选）
 * }
 */
app.post('/api/submit', submitLimiter, (req, res) => {
  try {
    // 请求体验证
    const parseResult = submitAnswerSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0]?.message || '请求体格式错误',
      })
    }

    const { studentId, wenId, submittedAt, answers, questions, signature } = parseResult.data

    // HMAC 签名验证（如果启用）
    if (AUTH_ENABLED) {
      const verifyResult = verifyHmacSignature(studentId, submittedAt, signature)
      if (!verifyResult.valid) {
        return res.status(401).json({
          success: false,
          error: 'AUTH_FAILED',
          message: verifyResult.error,
        })
      }
    }

    // 计算得分并准备插入数据
    const insertPromises = questions.map((question) => {
      return new Promise((resolve, reject) => {
        const userAnswer = answers[question.id]
        const correctAnswer = question.correctAnswer

        // 计算得分（简单比较）
        let score = 0
        if (Array.isArray(correctAnswer)) {
          // 多选答案比较
          if (Array.isArray(userAnswer)) {
            const sortedCorrect = [...correctAnswer].sort()
            const sortedUser = [...userAnswer].sort()
            if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
              score = 100
            }
          }
        } else {
          // 单选答案比较
          if (userAnswer === correctAnswer) {
            score = 100
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
        `)

        stmt.run(
          studentId,
          wenId,
          question.id,
          JSON.stringify(userAnswer),
          JSON.stringify(correctAnswer),
          submittedAt,
          score,
          (err) => {
            stmt.finalize()
            if (err) {
              reject(err)
            } else {
              resolve({ questionId: question.id, score })
            }
          },
        )
      })
    })

    // 执行所有插入操作
    Promise.all(insertPromises)
      .then((results) => {
        const totalScore = results.reduce((sum, r) => sum + r.score, 0)
        const avgScore = Math.round(totalScore / results.length)

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
 * 查询学生答题记录接口
 * GET /api/answers/:studentId
 */
app.get('/api/answers/:studentId', queryLimiter, (req, res) => {
  const { studentId } = req.params

  if (!/^\d{4}$/.test(studentId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STUDENT_ID',
      message: '学号格式不正确',
    })
  }

  db.all(
    'SELECT * FROM answers WHERE student_id = ? ORDER BY submitted_at DESC',
    [studentId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '查询失败: ' + err.message,
        })
      }

      res.status(200).json({
        success: true,
        data: rows.map((row) => ({
          ...row,
          user_answer: JSON.parse(row.user_answer),
          correct_answer: row.correct_answer ? JSON.parse(row.correct_answer) : null,
        })),
      })
    },
  )
})

/**
 * 健康检查接口
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OK',
    timestamp: new Date().toISOString(),
    authEnabled: AUTH_ENABLED,
  })
})

// ============================================================
// 服务器启动
// ============================================================

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
  console.log(`CORS 白名单: ${corsWhitelist.length > 0 ? corsWhitelist.join(', ') : '允许所有来源'}`)
  console.log(`鉴权状态: ${AUTH_ENABLED ? '已启用' : '未启用'}`)
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

module.exports = { generateHmacSignature, verifyHmacSignature }