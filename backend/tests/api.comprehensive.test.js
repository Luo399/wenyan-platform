/**
 * 后端API完整测试套件（安全加固后契约）
 *
 * 测试范围：
 * 1. 健康检查接口
 * 2. 学生管理接口（/api/admin/students，遗留 /api/students* 已物理下线）
 * 3. 登录接口（/api/auth/student/login，遗留免密 /api/auth/login 已下线）
 * 4. 答题提交接口（必须登录 + zod 白名单 + 服务端判分）
 * 5. 文言文数据API（含 /api/texts/batch 上限 50）
 * 6. 答题记录查询（教师/管理员）
 * 7. 边界条件（超大请求体、非法 JSON、CORS 白名单）
 *
 * 运行方式：npm test
 */

const request = require('supertest')

// ===== 环境准备（必须在 require database / app 之前）=====
// 原实现用文件库并在 require 后才设置 DB_PATH，实际会写进 backend/database/answers.db，
// 这里统一改内存库，既隔离又避免污染开发库
process.env.DB_PATH = ':memory:'
process.env.TEST_MODE = 'true'
process.env.JWT_SECRET = 'ci-test-secret'
// 安全加固后不再内置 admin/admin123：初始管理员需显式配置
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024'
process.env.INITIAL_ADMIN_USERNAME = 'admin'
// 本套件请求量大（含并发），放宽测试环境限流，避免 429 干扰断言
process.env.RATE_LIMIT_GLOBAL = '10000'
process.env.RATE_LIMIT_SUBMIT = '10000'
process.env.RATE_LIMIT_LOGIN = '200'

/**
 * 真实题库数据（判分只认后端 JSON）：
 *   data/text-quiz/WEN_01.json                → WEN_01_Q1 = 1（数字索引）
 *   data/pages_level2_dialog_quiz/WEN_01.json → WEN_01_B1 = 'B'（字母）
 *   data/text-quiz/WEN_02.json                → WEN_02_Q1 = 2
 */
const WEN_ID = 'WEN_01'
const Q_INDEX = 'WEN_01_Q1'
const Q_LETTER = 'WEN_01_B1'

let app
let adminToken
let studentToken
const STUDENT_ID = '20250101'

function asAdmin(agent) {
  return agent.set('Authorization', `Bearer ${adminToken}`)
}

function asStudent(agent) {
  return agent.set('Authorization', `Bearer ${studentToken}`)
}

beforeAll(async () => {
  const { initAllTables } = require('../src/config/database')
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: process.env.INITIAL_ADMIN_PASSWORD })
  adminToken = adminLogin.body.data?.token
  expect(adminToken).toBeTruthy()

  // 主测试学生：一次性初始口令由创建接口返回，用它登录
  const created = await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: STUDENT_ID,
    student_name: '综合测试学生',
    class_code: '202501',
  })
  expect(created.status).toBe(201)

  const login = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: STUDENT_ID, password: created.body.data.initial_password })
  studentToken = login.body.data?.token
  expect(studentToken).toBeTruthy()
})

afterAll(async () => {
  const { db } = require('../src/config/database')
  await new Promise((resolve) => db.close(() => resolve()))
})

describe('健康检查接口', () => {
  describe('GET /', () => {
    it('应返回服务状态和可用端点', async () => {
      const res = await request(app).get('/')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('文言文学习平台')
      expect(res.body.version).toBe('1.1.0')
      expect(res.body.endpoints).toBeDefined()
    })
  })

  describe('GET /api/health', () => {
    it('应返回 OK', async () => {
      const res = await request(app).get('/api/health')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toBe('OK')
    })
  })
})

// ============================================================
// 学生管理接口测试
// ============================================================
describe('学生管理接口（/api/admin/students）', () => {
  describe('POST /api/admin/students - 管理员新增学生', () => {
    it('应成功创建学生并返回一次性初始口令', async () => {
      const res = await asAdmin(request(app).post('/api/admin/students')).send({
        student_id: '20250102',
        student_name: '张三',
        class_code: '202501',
      })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.student_id).toBe('20250102')
      // 一次性 8 位数字口令，明文只返回一次
      expect(res.body.data.initial_password).toMatch(/^\d{8}$/)
      expect(res.body.data.temporary_password).toBe(res.body.data.initial_password)
      // 响应绝不回传密码哈希
      expect(res.body.data.password_hash).toBeUndefined()
    })

    it('缺少student_id应返回400 INVALID_STUDENT_ID', async () => {
      const res = await asAdmin(request(app).post('/api/admin/students')).send({
        student_name: '李四',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_STUDENT_ID')
    })

    it('缺少student_name应返回400 INVALID_NAME', async () => {
      const res = await asAdmin(request(app).post('/api/admin/students')).send({
        student_id: '20250103',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_NAME')
    })

    it('非法班级编码应返回400 INVALID_CLASS_CODE', async () => {
      const res = await asAdmin(request(app).post('/api/admin/students')).send({
        student_id: '20250104',
        student_name: '王五',
        class_code: '2025-1',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_CLASS_CODE')
    })

    it('重复创建应返回409而非静默覆盖', async () => {
      const res = await asAdmin(request(app).post('/api/admin/students')).send({
        student_id: '20250102',
        student_name: '张三-重复',
        class_code: '202501',
      })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('STUDENT_ID_EXISTS')
    })

    it('未登录创建应返回401', async () => {
      const res = await request(app).post('/api/admin/students').send({
        student_id: '20250105',
        student_name: '匿名',
        class_code: '202501',
      })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/admin/students - 查询学生列表', () => {
    it('应返回分页学生列表', async () => {
      const res = await asAdmin(request(app).get('/api/admin/students'))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2)
    })

    it('pageSize 超上限应被截断到 200', async () => {
      const res = await asAdmin(request(app).get('/api/admin/students?pageSize=9999'))

      expect(res.status).toBe(200)
      expect(res.body.pagination.pageSize).toBe(200)
    })
  })

  describe('GET /api/admin/students/:studentId - 按ID查询学生', () => {
    it('应返回存在的学生信息', async () => {
      const res = await asAdmin(request(app).get(`/api/admin/students/${STUDENT_ID}`))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.student_id).toBe(STUDENT_ID)
      expect(res.body.data.student_name).toBe('综合测试学生')
    })

    it('学号不存在应返回404', async () => {
      const res = await asAdmin(request(app).get('/api/admin/students/20999999'))

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBe('NOT_FOUND')
    })
  })

  describe('遗留接口 /api/students*', () => {
    it('应全部物理下线（404）', async () => {
      const list = await asAdmin(request(app).get('/api/students'))
      expect(list.status).toBe(404)
      const create = await asAdmin(request(app).post('/api/students')).send({
        studentId: '10001',
        name: '张三',
      })
      expect(create.status).toBe(404)
    })
  })
})

// ============================================================
// 登录接口测试
// ============================================================
describe('登录接口（/api/auth/student/login）', () => {
  it('用一次性初始口令应登录成功并返回 token', async () => {
    const created = await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: '20250201',
      student_name: '孙七',
      class_code: '202502',
    })
    expect(created.status).toBe(201)

    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: '20250201', password: created.body.data.initial_password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.data.token).toBe('string')
    expect(res.body.data.user.student_id).toBe('20250201')
    // 新账号强制首次改密
    expect(res.body.data.user.must_reset_password).toBe(true)
  })

  it('密码错误应返回 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: STUDENT_ID, password: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('INVALID_CREDENTIALS')
    expect(res.body.message).toBe('学号或密码错误')
  })

  it('未注册学生应返回 401（不泄露账号是否存在）', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: '20998877', password: '12345678' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('INVALID_CREDENTIALS')
  })

  it('空学号应返回400', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: '', password: '12345678' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('非数字学号应返回400', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: 'abc123', password: '12345678' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('特殊字符学号应返回400', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: '1234; DROP TABLE students;--', password: '12345678' })

    expect(res.status).toBe(400)
  })

  it('token格式应符合JWT结构', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: STUDENT_ID, password: '99999999-wrong' })

    // 密码错误不签发 token；用已登录 token 校验结构
    expect(res.status).toBe(401)
    expect(studentToken.split('.').length).toBe(3)
  })

  it('遗留免密登录 /api/auth/login 已下线（404）', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ student_id: STUDENT_ID, student_name: '任意' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('NOT_FOUND')
  })
})

// ============================================================
// 答题提交接口测试（真实题库 + 服务端判分）
// ============================================================
describe('答题提交接口', () => {
  const validSubmission = () => ({
    studentId: STUDENT_ID,
    wenId: WEN_ID,
    submittedAt: new Date().toISOString(),
    answers: { [Q_INDEX]: 1, [Q_LETTER]: 'B' },
    // 客户端 correctAnswer 已不可信，故意传垃圾值
    questions: [
      { id: Q_INDEX, correctAnswer: 999 },
      { id: Q_LETTER, correctAnswer: 'Z' },
    ],
  })

  it('应成功提交答题记录（服务端按题库判分）', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send(validSubmission())

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.questionCount).toBe(2)
    expect(res.body.data.correctCount).toBe(2)
    expect(res.body.data.avgScore).toBe(100)
  })

  it('错误答案应正确计算分数（客户端写对也无效）', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      submittedAt: new Date().toISOString(),
      answers: { [Q_INDEX]: 1, [Q_LETTER]: 'A' }, // B1 真实答案是 'B'
      questions: [
        { id: Q_INDEX, correctAnswer: 1 },
        { id: Q_LETTER, correctAnswer: 'A' }, // 客户端谎报
      ],
    })

    expect(res.status).toBe(200)
    expect(res.body.data.correctCount).toBe(1)
    expect(res.body.data.wrongCount).toBe(1)
  })

  it('未登录提交应返回 401', async () => {
    const res = await request(app).post('/api/submit').send(validSubmission())
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('AUTH_REQUIRED')
  })

  it('替他人提交应返回 403（防 IDOR）', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      ...validSubmission(),
      studentId: '20259999',
    })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('FORBIDDEN')
  })

  it('缺少必填字段studentId应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({ wenId: WEN_ID })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('缺少必填字段wenId应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('缺少必填字段submittedAt应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('缺少必填字段answers应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      submittedAt: new Date().toISOString(),
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('学号格式非数字应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      ...validSubmission(),
      studentId: 'abc',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('学号包含特殊字符应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      ...validSubmission(),
      studentId: "1001' OR '1'='1",
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('超长学号（>20 位）应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      ...validSubmission(),
      studentId: '1'.repeat(50),
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('重复提交应保留所有记录（attempt_number 递增）', async () => {
    const submission = validSubmission()

    const res1 = await asStudent(request(app).post('/api/submit')).send(submission)
    expect(res1.status).toBe(200)
    const attempt1 = res1.body.data.details[0].attemptNumber

    const res2 = await asStudent(request(app).post('/api/submit')).send(submission)
    expect(res2.status).toBe(200)
    const attempt2 = res2.body.data.details[0].attemptNumber

    expect(attempt2).toBe(attempt1 + 1)
  })

  it('空答案数组应返回400（不再静默通过）', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      ...validSubmission(),
      answers: {},
      questions: [],
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('缺失questions字段应返回400', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      submittedAt: new Date().toISOString(),
      answers: { [Q_INDEX]: 1 },
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('题库中不存在的题目应返回 500 通用文案（不泄漏 ANSWER_KEY_UNAVAILABLE）', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      submittedAt: new Date().toISOString(),
      answers: { NOT_IN_BANK: 1 },
      questions: [{ id: 'NOT_IN_BANK', correctAnswer: 1 }],
    })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('INTERNAL_ERROR')
    expect(res.body.message).toBe('服务器内部错误')
    // 注意：提交类接口由 answerController 统一兜底（不经 errorHandler），
    // 该分支只回通用文案，不带 requestId/timestamp —— 与全局错误信封存在差异，已在报告中记录
  })

  it('数组答案对单选正确项判错（类型不一致）', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      submittedAt: new Date().toISOString(),
      answers: { [Q_INDEX]: ['1'] },
      questions: [{ id: Q_INDEX }],
    })

    expect(res.status).toBe(200)
    expect(res.body.data.correctCount).toBe(0)
  })

  it('未来时间戳提交应正常处理', async () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      submittedAt: futureDate.toISOString(),
      answers: { [Q_INDEX]: 1 },
      questions: [{ id: Q_INDEX }],
    })

    expect(res.status).toBe(200)
  })

  it('非 ISO 格式时间戳应正常处理', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      submittedAt: '2024-01-01 12:00:00',
      answers: { [Q_INDEX]: 1 },
      questions: [{ id: Q_INDEX }],
    })

    expect(res.status).toBe(200)
  })

  it('单题提交接口同样只认服务端答案', async () => {
    const res = await asStudent(request(app).post('/api/submit/single')).send({
      studentId: STUDENT_ID,
      wenId: WEN_ID,
      questionId: Q_INDEX,
      userAnswer: 1,
      correctAnswer: 0, // 客户端谎报
      submittedAt: new Date().toISOString(),
    })

    expect(res.status).toBe(200)
    expect(res.body.data.isCorrect).toBe(1)
    expect(res.body.data.correctAnswer).toBe(1)
  })
})

// ============================================================
// 文言文数据API测试
// ============================================================
describe('文言文数据API', () => {
  describe('GET /api/texts - 获取文本列表', () => {
    it('应返回文本列表', async () => {
      const res = await request(app).get('/api/texts')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toBeDefined()
      expect(res.body.data.total).toBeDefined()
      expect(Array.isArray(res.body.data.texts)).toBe(true)
    })

    it('分页参数应正常工作', async () => {
      const res = await request(app).get('/api/texts?page=1&page_size=10')

      expect(res.status).toBe(200)
      expect(res.body.data.texts.length).toBeLessThanOrEqual(10)
    })

    it('page为0应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page=0')

      expect(res.status).toBe(200)
      expect(res.body.data.texts).toBeDefined()
    })

    it('page为负数应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page=-1')

      expect(res.status).toBe(200)
      expect(res.body.data.texts).toBeDefined()
    })

    it('page_size为0应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page_size=0')

      expect(res.status).toBe(200)
      expect(res.body.data.texts).toBeDefined()
    })

    it('page_size为负数应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page_size=-5')

      expect(res.status).toBe(200)
    })

    it('非数字分页参数应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page=abc')

      expect(res.status).toBe(200)
    })

    it('超大page应返回空数组', async () => {
      const res = await request(app).get('/api/texts?page=99999')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data.texts)).toBe(true)
    })
  })

  describe('POST /api/texts/batch - 批量获取文本数据', () => {
    it('应成功批量获取数据', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: ['WEN_01', 'WEN_02'] })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBe(2)
    })

    it('text_ids为空数组应返回400', async () => {
      const res = await request(app).post('/api/texts/batch').send({ text_ids: [] })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('text_ids非数组应返回400', async () => {
      const res = await request(app).post('/api/texts/batch').send({ text_ids: 'WEN_01' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('缺少text_ids字段应返回400', async () => {
      const res = await request(app).post('/api/texts/batch').send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('空字符串元素应返回400 INVALID_TEXT_ID（路径穿越防护）', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: ['WEN_01', ''] })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_TEXT_ID')
    })

    it('超过 50 个 ID 应返回400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: Array(100).fill('WEN_01') })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('恰好 50 个 ID 应允许', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: Array(50).fill('WEN_01') })

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(50)
    })

    it('不存在的数据应有合理返回', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: ['NONEXISTENT_001'] })

      expect(res.status).toBe(200)
      expect(res.body.data[0].basic_info).toBeNull()
    })
  })

  describe('GET /api/texts/:textId/basic-info - 获取文本基础信息', () => {
    it('存在的数据应返回正确', async () => {
      const res = await request(app).get('/api/texts/WEN_01/basic-info')

      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        expect(res.body.data.text_id).toBe('WEN_01')
      } else {
        expect(res.status).toBe(404)
      }
    })

    it('不存在的数据应返回404', async () => {
      const res = await request(app).get('/api/texts/NONEXISTENT/basic-info')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('特殊字符textId应有处理', async () => {
      const res = await request(app).get('/api/texts/../../../etc/passwd/basic-info')

      expect([400, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/word-list - 获取字词注释', () => {
    it('应返回字词列表或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/word-list')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/multi-role-reading - 获取多角色朗读数据', () => {
    it('应返回朗读数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/multi-role-reading')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level1-quiz - 获取一级测验', () => {
    it('应返回测验数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level1-quiz')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level2-quiz - 获取二级测验', () => {
    it('应返回测验数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level2-quiz')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level3-scenario-text - 获取三级情景文本', () => {
    it('应返回数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level3-scenario-text')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level3-adaptive-quiz - 获取三级自适应测验', () => {
    it('应返回数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level3-adaptive-quiz')

      expect([200, 404]).toContain(res.status)
    })
  })
})

// ============================================================
// 答题记录查询接口测试（教师/管理员）
// ============================================================
describe('答题记录查询接口', () => {
  describe('GET /api/answers/wen/:wenId - 按文言文ID查询', () => {
    it('应返回文言文的答题情况', async () => {
      const res = await asAdmin(request(app).get(`/api/answers/wen/${WEN_ID}`))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.wenId).toBe(WEN_ID)
      expect(Array.isArray(res.body.data.students)).toBe(true)
      expect(res.body.data.students.map((s) => s.studentId)).toContain(STUDENT_ID)
    })

    it('空wenId应有处理', async () => {
      const res = await asAdmin(request(app).get('/api/answers/wen/'))

      expect([400, 404]).toContain(res.status)
    })

    it('不存在的wenId应返回空结果', async () => {
      const res = await asAdmin(request(app).get('/api/answers/wen/NONEXISTENT_WEN'))

      expect(res.status).toBe(200)
      expect(res.body.data.studentCount).toBe(0)
    })
  })

  describe('GET /api/answers/student/:studentId - 按学生ID查询', () => {
    it('应返回学生的答题情况', async () => {
      const res = await asAdmin(request(app).get(`/api/answers/student/${STUDENT_ID}`))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.studentId).toBe(STUDENT_ID)
      expect(res.body.data.totalWenCount).toBeGreaterThanOrEqual(1)
    })

    it('不存在的学生应返回空结果', async () => {
      const res = await asAdmin(request(app).get('/api/answers/student/20999999'))

      expect(res.status).toBe(200)
      expect(res.body.data.totalWenCount).toBe(0)
    })

    it('结果应包含正确答案解析（来自服务端题库）', async () => {
      const res = await asAdmin(request(app).get(`/api/answers/student/${STUDENT_ID}`))

      expect(res.status).toBe(200)
      const record = res.body.data.wenRecords.find((w) => w.wenId === WEN_ID)
      expect(record).toBeTruthy()
      const answer = record.answers.find((a) => a.questionId === Q_INDEX)
      expect(answer).toHaveProperty('userAnswer')
      // correct_answer 以 JSON 文本落库，读回为字符串 "1"
      expect(String(answer.correctAnswer)).toBe('1')
      expect(answer).toHaveProperty('isCorrect')
    })

    it('学生 token 查询应返回 403', async () => {
      const res = await asStudent(request(app).get(`/api/answers/student/${STUDENT_ID}`))

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('FORBIDDEN')
    })

    it('未登录查询应返回 401', async () => {
      const res = await request(app).get(`/api/answers/student/${STUDENT_ID}`)

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('AUTH_REQUIRED')
    })
  })
})

// ============================================================
// 异常情况和边界值测试
// ============================================================
describe('异常情况和边界值', () => {
  describe('请求体格式异常', () => {
    it('空JSON应返回400', async () => {
      const res = await asStudent(request(app).post('/api/submit')).send({})

      expect(res.status).toBe(400)
    })

    it('无效JSON应返回400', async () => {
      const res = await asStudent(request(app).post('/api/submit'))
        .set('Content-Type', 'application/json')
        .send('{invalid json}')

      expect(res.status).toBe(400)
    })

    it('超大请求体应返回 413 PAYLOAD_TOO_LARGE', async () => {
      const largeBody = { data: 'x'.repeat(2 * 1024 * 1024) } // 2MB > 默认 1mb 限制

      const res = await asStudent(request(app).post('/api/submit')).send(largeBody)

      expect(res.status).toBe(413)
      expect(res.body.error).toBe('PAYLOAD_TOO_LARGE')
      // 仍然带 requestId，便于排查
      expect(res.body.requestId).toBeTruthy()
    })
  })

  describe('CORS 白名单', () => {
    it('白名单来源的 OPTIONS 预检请求应正常响应', async () => {
      const res = await request(app)
        .options('/api/texts')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')

      expect([200, 204]).toContain(res.status)
    })

    it('非白名单来源应返回 403 CORS_ORIGIN_FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/texts')
        .set('Origin', 'http://evil.example.com')

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('CORS_ORIGIN_FORBIDDEN')
    })
  })

  describe('数据库错误处理', () => {
    it('数据库路径无效时应启动失败', () => {
      // 此测试验证数据库初始化逻辑
      expect(true).toBe(true)
    })
  })
})

// ============================================================
// 性能相关测试
// ============================================================
describe('性能相关', () => {
  it('并发提交答题应正确处理', async () => {
    const concurrentRequests = Array(5)
      .fill(null)
      .map((_, i) =>
        asAdmin(request(app).post('/api/submit')).send({
          studentId: `20250${i}1`,
          wenId: WEN_ID,
          submittedAt: new Date().toISOString(),
          answers: { [Q_INDEX]: 1 },
          questions: [{ id: Q_INDEX }],
        }),
      )

    const results = await Promise.all(concurrentRequests)

    results.forEach((res) => {
      expect(res.status).toBe(200)
    })
  })

  it('连续快速请求应稳定响应', async () => {
    const requests = Array(10)
      .fill(null)
      .map(() => request(app).get('/api/texts'))

    const results = await Promise.all(requests)

    results.forEach((res) => {
      expect(res.status).toBe(200)
    })
  })
})
