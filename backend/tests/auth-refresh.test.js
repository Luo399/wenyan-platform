/**
 * 令牌刷新接口 /api/auth/refresh（F-004）
 *
 * 回归背景：前端 src/stores/auth.ts 一直调用 /api/auth/refresh，
 * 但后端从未注册该路由（返回 404），导致 refreshToken() 是死代码、
 * 会话无法续期，用户每到令牌有效期就被强制登出（F-001）。
 */

const request = require('supertest')
const jwt = require('jsonwebtoken')

process.env.DB_PATH = ':memory:'

let app
let config

beforeAll(async () => {
  process.env.TEST_MODE = 'true'
  const { initAllTables } = require('../src/config/database')
  await initAllTables()
  const { createApp } = require('../src/app')
  app = createApp()
  config = require('../src/config/app')
})

describe('POST /api/auth/refresh', () => {
  it('路由已注册：无 token 返回 401 而不是 404', async () => {
    const res = await request(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('AUTH_REQUIRED')
  })

  it('无效 token 返回 401 AUTH_FAILED', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('AUTH_FAILED')
  })

  it('token 有效但账号不存在时拒绝续期', async () => {
    const token = jwt.sign({ role: 'student', student_id: '00000000' }, config.jwt.secret, {
      expiresIn: 60,
    })
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('AUTH_FAILED')
  })

  it('JWT_EXPIRES_IN 默认值为 3600 秒', () => {
    expect(config.jwt.expiresIn).toBe(3600)
  })
})
