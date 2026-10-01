/**
 * 种子数据环境隔离测试（R104）
 *
 * 验证：NODE_ENV=production 时，seedTestStudent 不会向 students 表播种弱口令测试账号。
 *
 * 注意：NODE_ENV 必须在 require database 之前设置，且本文件独立于其他测试文件
 * （Jest 每个测试文件拥有独立模块注册表），不会污染其它测试。
 */

const request = require('supertest')

// 保存原 NODE_ENV，测试结束后还原，避免同 worker 内其它测试文件受影响
const ORIGINAL_NODE_ENV = process.env.NODE_ENV

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'
process.env.NODE_ENV = 'production'

const { db, initAllTables } = require('../src/config/database')
const { dbGet } = require('../src/utils/dbPromise')

beforeAll(async () => {
  await initAllTables()
})

afterAll((done) => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  }
  db.close(() => done())
})

describe('生产环境种子隔离', () => {
  it('生产环境不应播种测试学生 99999999', async () => {
    const row = await dbGet(db, 'SELECT id FROM students WHERE student_id = ?', ['99999999'])
    expect(row).toBeNull()
  })

  it('生产环境下测试账号登录应失败（账号不存在）', async () => {
    const { createApp } = require('../src/app')
    const app = createApp()

    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: '99999999', password: '123456' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('INVALID_CREDENTIALS')
  })
})
