/**
 * 学生登录链路回归测试（R104）
 *
 * 覆盖：
 * 1. 测试账号 99999999 / 123456 登录成功
 * 2. 密码错误返回 401 INVALID_CREDENTIALS（错误码与文案由后端定义，前端不再统一改写为"登录已过期"）
 * 3. 公开姓名接口 /api/students/:id/name 无需鉴权即可返回姓名
 * 4. 公开姓名接口对不存在的学号返回 404 NOT_FOUND
 * 5. 遗留接口 /api/students/:id 仍必须鉴权（无 token → 401）
 *
 * 运行方式：npm test（已纳入 CI backend-check）
 */

const request = require('supertest')

// 必须在 require database 之前设置：内存库，避免污染工作区
process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

let app

beforeAll(async () => {
  process.env.TEST_MODE = 'true'

  const { initAllTables } = require('../src/config/database')
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()
})

describe('学生登录', () => {
  it('测试账号 99999999 / 123456 应登录成功', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: '99999999', password: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.data.token).toBe('string')
    expect(res.body.data.user.student_id).toBe('99999999')
    expect(res.body.data.user.role).toBe('student')
  })

  it('密码错误应返回 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: '99999999', password: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('INVALID_CREDENTIALS')
    expect(res.body.message).toBe('学号或密码错误')
  })
})

describe('公开姓名查询接口', () => {
  it('无需鉴权即可按学号返回学生姓名', async () => {
    const res = await request(app).get('/api/students/99999999/name')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('测试学生')
    // 敏感字段不得泄漏
    expect(res.body.data.class_code).toBeUndefined()
    expect(res.body.data.password_hash).toBeUndefined()
  })

  it('学号不存在应返回 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/students/88888888/name')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('NOT_FOUND')
  })
})

describe('遗留学生接口鉴权', () => {
  it('无 token 访问 /api/students/:id 应返回 401', async () => {
    const res = await request(app).get('/api/students/99999999')

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})
