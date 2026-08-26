/**
 * P0 安全修复回归测试
 *
 * 覆盖：
 * 1. 提交接口必须鉴权（无 token → 401）
 * 2. zod 白名单：非法字段类型/格式 → 400 VALIDATION_ERROR，多余字段自动丢弃
 * 3. 答题查询接口：学生 403，管理员可访问，无 token 401
 *
 * 运行方式：npm test（已纳入 CI backend-check）
 */

const request = require('supertest')

// 必须在 require database 之前设置：内存库，避免污染工作区
process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

let app
let studentToken
let adminToken

/** 登录并返回 Bearer token */
async function loginToken(emailBody, path) {
  const res = await request(app).post(path).send(emailBody)
  expect(res.status).toBe(200)
  const token = res.body.data?.token
  expect(typeof token).toBe('string')
  return token
}

/** 构造带学生鉴权的 supertest 请求（默认 method 为 POST） */
function asStudent(agent) {
  return agent.set('Authorization', `Bearer ${studentToken}`)
}

/** 构造带管理员鉴权的 supertest 请求 */
function asAdmin(agent) {
  return agent.set('Authorization', `Bearer ${adminToken}`)
}

beforeAll(async () => {
  process.env.TEST_MODE = 'true'

  const { initAllTables } = require('../src/config/database')
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  // 提前登录并复用 token，避免触发 loginRateLimit（5 次/分钟/IP）
  studentToken = await loginToken(
    { student_id: '99999999', password: '123456' },
    '/api/auth/student/login',
  )
  adminToken = await loginToken(
    { username: 'admin', password: 'admin123' },
    '/api/auth/admin/login',
  )
})

describe('P0 安全修复：提交接口必鉴权', () => {
  const validSubmission = {
    studentId: '99999999',
    wenId: 'WEN_P0',
    submittedAt: new Date().toISOString(),
    answers: { q1: 1, q2: 2 },
    questions: [
      { id: 'q1', correctAnswer: 1 },
      { id: 'q2', correctAnswer: 2 },
    ],
  }

  it('POST /api/submit 无 token 应返回 401', async () => {
    const res = await request(app).post('/api/submit').send(validSubmission)
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('AUTH_REQUIRED')
  })

  it('POST /api/submit/single 无 token 应返回 401', async () => {
    const res = await request(app)
      .post('/api/submit/single')
      .send({
        studentId: '99999999',
        wenId: 'WEN_P0',
        questionId: 'q1',
        userAnswer: 1,
      })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('AUTH_REQUIRED')
  })

  it('学生登录后批量提交应成功，多余字段被丢弃', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      ...validSubmission,
      extraField: 'should-be-dropped',
      answer2: null,
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // zod strip 后多余字段不影响业务
    expect(res.body.data.questionCount).toBe(2)
  })

  it('学生登录后单题提交应成功', async () => {
    const res = await asStudent(request(app).post('/api/submit/single')).send({
      studentId: '99999999',
      wenId: 'WEN_P0',
      questionId: 'q3',
      userAnswer: 5,
      correctAnswer: 5,
      submittedAt: new Date().toISOString(),
    })
    expect(res.status).toBe(200)
    expect(res.body.data.isCorrect).toBe(1)
  })
})

describe('P0 安全修复：zod 白名单校验', () => {
  it('学号非纯数字应返回 400 VALIDATION_ERROR', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: 'abc',
      wenId: 'WEN_P0',
      submittedAt: new Date().toISOString(),
      answers: { q1: 1 },
      questions: [{ id: 'q1', correctAnswer: 1 }],
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('缺少必填字段应返回 400 VALIDATION_ERROR', async () => {
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: '99999999',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('题目数量超限（>500）应返回 400', async () => {
    const questions = Array.from({ length: 501 }, (_, i) => ({
      id: `q${i}`,
      correctAnswer: 1,
    }))
    const res = await asStudent(request(app).post('/api/submit')).send({
      studentId: '99999999',
      wenId: 'WEN_P0',
      submittedAt: new Date().toISOString(),
      answers: questions.reduce((acc, q) => ({ ...acc, [q.id]: 1 }), {}),
      questions,
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })
})

describe('P0 安全修复：答题查询接口角色校验', () => {
  it('GET /api/answers/wen/:wenId 无 token 应返回 401', async () => {
    const res = await request(app).get('/api/answers/wen/WEN_P0')
    expect(res.status).toBe(401)
  })

  it('学生 token 查询应返回 403', async () => {
    const res = await asStudent(request(app).get('/api/answers/wen/WEN_P0'))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('FORBIDDEN')
  })

  it('管理员 token 查询应成功', async () => {
    const res = await asAdmin(request(app).get('/api/answers/wen/WEN_P0'))
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})