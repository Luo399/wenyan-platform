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
const crypto = require('crypto')

const app = express()
const PORT = process.env.PORT || 3000

/**
 * 安全解析JSON的辅助函数
 */
function safeParse(str) {
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

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

// 设置 UTF-8 响应头，解决中文乱码问题
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  next()
})

// 静态文件服务
app.use(express.static('public'))

// ============================================================
// 数据库连接配置
// ============================================================

// 确定数据库路径（支持测试模式）
const path = require('path')
const dbDir = process.env.TEST_MODE ? __dirname : path.join(__dirname, 'database')
const dbPath = process.env.DB_PATH || path.join(dbDir, 'answers.db')

// 确保 database 目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message)
    process.exit(1)
  }
  console.log('成功连接到 SQLite 数据库')
})

// 创建索引优化查询性能
function createIndexes() {
  db.run(`CREATE INDEX IF NOT EXISTS idx_wen_id ON answer_records(wen_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_student_id ON answer_records(student_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_wen_student ON answer_records(wen_id, student_id)`)
}

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

// 确保表存在 - 答题情况表（创建成功后创建索引）
db.run(
  `
  CREATE TABLE IF NOT EXISTS answer_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wen_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT,
    is_correct INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    submitted_at TEXT NOT NULL,
    attempt_number INTEGER DEFAULT 1
  )
`,
  (err) => {
    if (err) {
      console.error('创建答题情况表失败:', err.message)
    } else {
      createIndexes()
    }
  },
)

// ============================================================
// API 路由
// ============================================================

/**
 * 健康检查接口
 * GET /
 */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '文言文学习平台后端服务运行正常',
    version: '1.0.0',
    endpoints: {
      'POST /api/students': '学生注册',
      'POST /api/submit': '提交答案',
      'GET /api/students': '查询所有学生',
      'GET /api/students/:studentId': '按学生ID查询学生信息',
      'GET /api/answers/wen/:wenId': '按文言文ID查询答题情况',
      'GET /api/answers/student/:studentId': '按学生ID查询答题情况',
      'GET /api/texts/:textId/basic-info': '获取文本基础信息',
      'GET /api/texts/:textId/word-list': '获取字词注释',
      'GET /api/texts/:textId/multi-role-reading': '获取多角色朗读数据',
      'GET /api/texts/:textId/level1-quiz': '获取一级测验数据',
      'GET /api/texts/:textId/level2-dialog': '获取二级对话数据',
      'GET /api/texts/:textId/level2-quiz': '获取二级测验数据',
      'GET /api/texts/:textId/level3-scenario-text': '获取三级情景文本',
      'GET /api/texts/:textId/level3-adaptive-quiz': '获取三级自适应测验',
      'GET /api/texts': '获取文本列表',
      'POST /api/texts/batch': '批量获取文本数据',
    },
  })
})

// ============================================================
// 数据获取 API
// ============================================================

/**
 * 辅助函数：从JSON文件读取数据
 */
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    }
    return null
  } catch (err) {
    console.error(`读取文件失败 ${filePath}:`, err)
    return null
  }
}

/**
 * 辅助函数：根据题目ID和课文ID从JSON文件获取正确答案
 * 支持多个测验目录的查找
 */
function getCorrectAnswerFromJson(questionId, wenId) {
  const possibleDirs = ['level1_quiz', 'level2_quiz', 'level3_adaptive_quiz']

  for (const dir of possibleDirs) {
    const filePath = `./public/data/${dir}/${wenId}.json`
    const data = readJsonFile(filePath)

    if (data) {
      // 尝试在 questions 数组中查找
      if (data.questions && Array.isArray(data.questions)) {
        const question = data.questions.find(
          (q) => q.id === questionId || q.questionId === questionId,
        )
        if (
          question &&
          (question.correctAnswer !== undefined || question.correct_answer !== undefined)
        ) {
          return question.correctAnswer ?? question.correct_answer
        }
      }

      // 尝试在 blocks 中查找 quiz 块
      if (data.blocks && Array.isArray(data.blocks)) {
        for (const block of data.blocks) {
          if (block.type === 'quiz' && block.data && block.data.questions) {
            const question = block.data.questions.find(
              (q) => q.id === questionId || q.questionId === questionId,
            )
            if (
              question &&
              (question.correctAnswer !== undefined || question.correct_answer !== undefined)
            ) {
              return question.correctAnswer ?? question.correct_answer
            }
          }
        }
      }

      // 尝试在 quiz 数组中查找（扁平结构）
      if (data.quiz && Array.isArray(data.quiz)) {
        const question = data.quiz.find((q) => q.id === questionId || q.questionId === questionId)
        if (
          question &&
          (question.correctAnswer !== undefined || question.correct_answer !== undefined)
        ) {
          return question.correctAnswer ?? question.correct_answer
        }
      }
    }
  }

  // 如果在测验文件中找不到，尝试从页面配置文件中查找
  const pageConfigs = [
    `./public/data/pages_level2_dialog_quiz/${wenId}.json`,
    `./public/data/pages_level3_adaptive_quiz/${wenId}.json`,
  ]

  for (const filePath of pageConfigs) {
    const data = readJsonFile(filePath)
    if (data && data.blocks && Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        if (block.type === 'quiz' && block.data && block.data.questions) {
          const question = block.data.questions.find(
            (q) => q.id === questionId || q.questionId === questionId,
          )
          if (
            question &&
            (question.correctAnswer !== undefined || question.correct_answer !== undefined)
          ) {
            return question.correctAnswer ?? question.correct_answer
          }
        }
      }
    }
  }

  return null
}

/**
 * 辅助函数：处理答案值，确保格式正确
 */
function processAnswerValue(value) {
  if (value === null || value === undefined) return null
  if (value === 'unknown') return null
  if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

/**
 * 获取文本基础信息
 * GET /api/texts/:textId/basic-info
 */
app.get('/api/texts/:textId/basic-info', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/text_basic_info/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `文本基础信息不存在: ${textId}`,
    })
  }
})

/**
 * 获取字词注释
 * GET /api/texts/:textId/word-list
 */
app.get('/api/texts/:textId/word-list', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/word_list/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `字词注释不存在: ${textId}`,
    })
  }
})

/**
 * 获取多角色朗读数据
 * GET /api/texts/:textId/multi-role-reading
 */
app.get('/api/texts/:textId/multi-role-reading', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/multi_role_reading/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `多角色朗读数据不存在: ${textId}`,
    })
  }
})

/**
 * 获取一级测验数据
 * GET /api/texts/:textId/level1-quiz
 */
app.get('/api/texts/:textId/level1-quiz', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/level1_quiz/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `一级测验数据不存在: ${textId}`,
    })
  }
})

/**
 * 获取二级对话数据
 * GET /api/texts/:textId/level2-dialog
 */
app.get('/api/texts/:textId/level2-dialog', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/level2_dialog/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `二级对话数据不存在: ${textId}`,
    })
  }
})

/**
 * 获取二级测验数据
 * GET /api/texts/:textId/level2-quiz
 */
app.get('/api/texts/:textId/level2-quiz', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/level2_quiz/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `二级测验数据不存在: ${textId}`,
    })
  }
})

/**
 * 获取三级情景文本数据
 * GET /api/texts/:textId/level3-scenario-text
 */
app.get('/api/texts/:textId/level3-scenario-text', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/level3_scenario_text/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `三级情景文本不存在: ${textId}`,
    })
  }
})

/**
 * 获取三级自适应测验数据
 * GET /api/texts/:textId/level3-adaptive-quiz
 */
app.get('/api/texts/:textId/level3-adaptive-quiz', (req, res) => {
  const { textId } = req.params
  const filePath = `./public/data/level3_adaptive_quiz/${textId}.json`
  const data = readJsonFile(filePath)

  if (data) {
    res.json({ success: true, data })
  } else {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `三级自适应测验数据不存在: ${textId}`,
    })
  }
})

/**
 * 获取文本列表
 * GET /api/texts?page=1&page_size=20
 */
app.get('/api/texts', (req, res) => {
  const page = isNaN(parseInt(req.query.page)) ? 1 : Math.max(1, Math.abs(parseInt(req.query.page)))
  const pageSize = isNaN(parseInt(req.query.page_size))
    ? 20
    : Math.min(100, Math.max(1, Math.abs(parseInt(req.query.page_size))))

  // 扫描text_basic_info目录，获取所有可用文本
  const texts = []
  const basicInfoDir = './public/data/text_basic_info'

  if (fs.existsSync(basicInfoDir)) {
    const files = fs.readdirSync(basicInfoDir)
    files.forEach((file) => {
      if (file.endsWith('.json')) {
        const filePath = `${basicInfoDir}/${file}`
        const data = readJsonFile(filePath)
        if (data && data.text_id) {
          texts.push({
            text_id: data.text_id,
            title: data.title,
            author: data.author,
            dynasty: data.dynasty,
          })
        }
      }
    })
  }

  // 分页处理
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTexts = texts.slice(startIndex, endIndex)

  res.json({
    success: true,
    data: {
      total: texts.length,
      texts: paginatedTexts,
    },
  })
})

/**
 * 批量获取文本数据
 * POST /api/texts/batch
 *
 * 请求体格式：
 * { text_ids: ['WEN_01', 'WEN_02'] }
 */
app.post('/api/texts/batch', (req, res) => {
  try {
    const { text_ids } = req.body

    if (!Array.isArray(text_ids) || text_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'text_ids 必须是非空数组',
      })
    }

    const results = text_ids.map((textId) => {
      const basicInfoPath = `./public/data/text_basic_info/${textId}.json`
      const wordListPath = `./public/data/word_list/${textId}.json`
      const basicInfo = readJsonFile(basicInfoPath)
      const wordList = readJsonFile(wordListPath)

      return {
        text_id: textId,
        basic_info: basicInfo,
        word_list: wordList || [],
      }
    })

    res.json({ success: true, data: results })
  } catch (err) {
    console.error('批量获取文本数据失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
})

/**
 * 按学生ID查询学生信息接口
 * GET /api/students/:studentId
 *
 * 返回学生的基本信息（学号、姓名）
 */
app.get('/api/students/:studentId', (req, res) => {
  try {
    const { studentId } = req.params

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生ID不能为空',
      })
    }

    db.get(
      'SELECT student_id, name, created_at FROM students WHERE student_id = ?',
      [studentId],
      (err, row) => {
        if (err) {
          console.error('查询学生信息失败:', err)
          return res.status(500).json({
            success: false,
            error: 'DATABASE_ERROR',
            message: '查询学生信息失败',
          })
        }

        if (row) {
          res.json({
            success: true,
            data: {
              student_id: row.student_id,
              name: row.name,
              created_at: row.created_at,
            },
          })
        } else {
          res.status(404).json({
            success: false,
            error: 'STUDENT_NOT_FOUND',
            message: `未找到学号为 ${studentId} 的学生`,
          })
        }
      },
    )
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
 * 学生注册接口
 * POST /api/students
 *
 * 请求体格式：
 * {
 *   studentId: string,        // 学生ID（学号）
 *   name: string,             // 学生姓名
 *   class: number             // 班级号（可选，默认9）
 * }
 */
app.post('/api/students', (req, res) => {
  try {
    const { studentId, name, class: studentClass = 9 } = req.body

    if (!studentId || !name) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段',
      })
    }

    // 插入或更新学生信息
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO students (student_id, name, class) VALUES (?, ?, ?)
    `)

    stmt.run(studentId, name, studentClass, (err) => {
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
        data: { studentId, name, class: studentClass },
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
    const { studentId, studentName, wenId, submittedAt, answers, questions = [] } = req.body

    // 验证必填字段
    if (!studentId || !wenId || !submittedAt || !answers) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段',
      })
    }

    // 验证学号（非空且仅包含数字）
    if (!studentId.trim() || !/^\d+$/.test(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_ID',
        message: '学号格式不正确，请输入有效的数字学号',
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

        // 查询当前题目已答题次数
        db.get(
          `SELECT COUNT(*) as count FROM answer_records WHERE wen_id = ? AND student_id = ? AND question_id = ?`,
          [wenId, studentId, question.id],
          (countErr, countRow) => {
            if (countErr) {
              reject(countErr)
              return
            }

            const attemptNumber = (countRow?.count || 0) + 1

            // 插入新记录（不覆盖，保留每次答题记录）
            const stmt = db.prepare(`
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
            `)

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
                stmt.finalize()
                if (err) {
                  reject(err)
                } else {
                  resolve({ questionId: question.id, score, isCorrect, attemptNumber })
                }
              },
            )
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

        // 处理答案值：如果是 'unknown' 或 null，从 JSON 文件获取正确答案
        let correctAnswerValue = processAnswerValue(row.correct_answer)
        if (correctAnswerValue === null || correctAnswerValue === 'unknown') {
          correctAnswerValue = getCorrectAnswerFromJson(row.question_id, row.wen_id)
        }

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

  // 验证学号格式（非空且仅包含数字，不限制长度）
  if (!studentId.trim() || !/^\d+$/.test(studentId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STUDENT_ID',
      message: '学号格式不正确，请输入有效的数字学号',
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

        // 处理答案值：如果是 'unknown' 或 null，从 JSON 文件获取正确答案
        let correctAnswerValue = processAnswerValue(row.correct_answer)
        if (correctAnswerValue === null || correctAnswerValue === 'unknown') {
          correctAnswerValue = getCorrectAnswerFromJson(row.question_id, row.wen_id)
        }

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
 * 查询学生列表接口
 * GET /api/students
 *
 * 查询参数：
 * - class: 班级编号（可选）
 */
app.get('/api/students', (req, res) => {
  const { class: classNum } = req.query

  let query = 'SELECT * FROM students'
  let params = []

  if (classNum && /^\d+$/.test(String(classNum))) {
    query += ' WHERE class = ?'
    params.push(parseInt(classNum))
  }

  query += ' ORDER BY student_id ASC'

  db.all(query, params, (err, rows) => {
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

/**
 * 登录接口
 * POST /api/auth/login
 *
 * 请求体格式：
 * {
 *   student_id: string,    // 学号
 *   student_name?: string  // 学生姓名（可选）
 * }
 *
 * 返回格式：
 * {
 *   success: true,
 *   data: {
 *     token: string,
 *     user: {
 *       id: string,
 *       username: string,
 *       student_id: string,
 *       role: string
 *     }
 *   }
 * }
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { student_id: studentId, student_name: studentName } = req.body

    // 验证学号
    if (!studentId || !studentId.trim() || !/^\d+$/.test(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_ID',
        message: '请输入有效的数字学号',
      })
    }

    // 查询数据库验证学生
    db.get(
      'SELECT student_id, name, created_at FROM students WHERE student_id = ?',
      [studentId],
      (err, row) => {
        if (err) {
          console.error('查询学生信息失败:', err)
          return res.status(500).json({
            success: false,
            error: 'DATABASE_ERROR',
            message: '登录失败，请重试',
          })
        }

        if (!row) {
          // 如果数据库中没有该学生，但提供了姓名，则自动注册
          if (studentName && studentName.trim()) {
            db.run(
              'INSERT INTO students (student_id, name, class) VALUES (?, ?, 9)',
              [studentId, studentName],
              (insertErr) => {
                if (insertErr) {
                  console.error('自动注册学生失败:', insertErr)
                  return res.status(500).json({
                    success: false,
                    error: 'REGISTER_FAILED',
                    message: '自动注册失败，请联系管理员',
                  })
                }

                // 注册成功后生成token
                const token = generateToken(studentId, studentName)
                res.status(200).json({
                  success: true,
                  data: {
                    token,
                    user: {
                      id: studentId,
                      username: studentName,
                      student_id: studentId,
                      role: 'student',
                    },
                  },
                })
              },
            )
          } else {
            return res.status(401).json({
              success: false,
              error: 'STUDENT_NOT_FOUND',
              message: `学号 ${studentId} 不存在，请联系管理员注册`,
            })
          }
        } else {
          // 学生存在，生成token
          const name = studentName && studentName.trim() ? studentName : row.name
          const token = generateToken(studentId, name)
          res.status(200).json({
            success: true,
            data: {
              token,
              user: {
                id: studentId,
                username: name,
                student_id: studentId,
                role: 'student',
              },
            },
          })
        }
      },
    )
  } catch (err) {
    console.error('处理登录请求失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
})

/**
 * 生成JWT token（简化版）
 */
function generateToken(studentId, username) {
  const payload = {
    sub: studentId,
    username: username,
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'student',
  }

  const secret = process.env.JWT_SECRET || 'wenyan_platform_2026_secret_key'

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')

  const data = `${header}.${encodedPayload}`
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url')

  return `${header}.${encodedPayload}.${signature}`
}

/**
 * 修改学生信息接口
 * PUT /api/students/:studentId
 *
 * 请求体格式：
 * {
 *   name: string,             // 学生姓名
 *   class: number             // 班级号（可选）
 * }
 */
app.put('/api/students/:studentId', (req, res) => {
  try {
    const { studentId } = req.params
    const { name, class: studentClass } = req.body

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生ID不能为空',
      })
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生姓名不能为空',
      })
    }

    // 构建更新语句
    let updateSql = 'UPDATE students SET name = ?'
    let params = [name.trim()]

    if (studentClass !== undefined) {
      updateSql += ', class = ?'
      params.push(studentClass)
    }

    updateSql += ' WHERE student_id = ?'
    params.push(studentId)

    db.run(updateSql, params, function (err) {
      if (err) {
        console.error('修改学生信息失败:', err)
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '修改学生信息失败',
        })
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'STUDENT_NOT_FOUND',
          message: `未找到学号为 ${studentId} 的学生`,
        })
      }

      res.status(200).json({
        success: true,
        message: '学生信息修改成功',
        data: { studentId, name: name.trim(), class: studentClass },
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
 * 删除学生接口
 * DELETE /api/students/:studentId
 */
app.delete('/api/students/:studentId', (req, res) => {
  try {
    const { studentId } = req.params

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生ID不能为空',
      })
    }

    db.run('DELETE FROM students WHERE student_id = ?', [studentId], function (err) {
      if (err) {
        console.error('删除学生失败:', err)
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '删除学生失败',
        })
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'STUDENT_NOT_FOUND',
          message: `未找到学号为 ${studentId} 的学生`,
        })
      }

      res.status(200).json({
        success: true,
        message: '学生删除成功',
        data: { studentId },
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

// ============================================================
// 服务器启动
// ============================================================

// 仅在非测试模式下启动服务器
if (!process.env.TEST_MODE) {
  const server = app.listen(PORT, () => {
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
}

// 导出app和db用于测试
module.exports = { app, db }
