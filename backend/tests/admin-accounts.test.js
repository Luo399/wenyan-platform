/**
 * 管理员账号管理（教师/学生 CRUD）集成测试（R105）
 *
 * 覆盖 adminController 新增能力：
 * - 教师：查单个 / 更新（姓名+班级）/ 删除
 * - 学生：新增 / 查单个 / 更新 / 删除
 * - 未登录访问 admin 接口 → 401
 *
 * 运行方式：npm test（已纳入 CI backend-check）
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

const { db, initAllTables } = require('../src/config/database')
const { dbGet } = require('../src/utils/dbPromise')

let app
let adminToken

function asAdmin(agent) {
  return agent.set('Authorization', `Bearer ${adminToken}`)
}

beforeAll(async () => {
  process.env.TEST_MODE = 'true'
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  const loginRes = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: 'admin123' })
  adminToken = loginRes.body.data.token
})

afterAll((done) => {
  db.close(() => done())
})

describe('管理员：教师账号 CRUD', () => {
  let schoolId

  beforeAll(async () => {
    const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')
    schoolId = school.id
  })

  it('创建教师账号', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers')).send({
      phone: 't9001',
      name: '测试教师',
      password: '12345678',
      school_id: schoolId,
      class_codes: ['202401'],
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })

  it('查询单个教师应返回所教班级', async () => {
    const res = await asAdmin(request(app).get('/api/admin/teachers/t9001'))
    expect(res.status).toBe(200)
    expect(res.body.data.phone).toBe('t9001')
    expect(res.body.data.class_codes).toEqual(['202401'])
  })

  it('更新教师姓名与所教班级', async () => {
    const res = await asAdmin(request(app).put('/api/admin/teachers/t9001')).send({
      name: '改名教师',
      class_codes: ['202401', '202402'],
    })
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/teachers/t9001'))
    expect(after.body.data.name).toBe('改名教师')
    expect(after.body.data.class_codes.sort()).toEqual(['202401', '202402'])
  })

  it('删除教师账号后查询应返回 404', async () => {
    const res = await asAdmin(request(app).delete('/api/admin/teachers/t9001'))
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/teachers/t9001'))
    expect(after.status).toBe(404)
  })
})

describe('管理员：学生账号 CRUD', () => {
  it('新增学生账号', async () => {
    const res = await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: '2024010001',
      student_name: '测试学生甲',
      class_code: '202401',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.initial_password).toBe('123456')
  })

  it('查询单个学生应不返回密码哈希', async () => {
    const res = await asAdmin(request(app).get('/api/admin/students/2024010001'))
    expect(res.status).toBe(200)
    expect(res.body.data.student_name).toBe('测试学生甲')
    expect(res.body.data.password_hash).toBeUndefined()
  })

  it('更新学生信息', async () => {
    const res = await asAdmin(request(app).put('/api/admin/students/2024010001')).send({
      student_name: '测试学生乙',
    })
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/students/2024010001'))
    expect(after.body.data.student_name).toBe('测试学生乙')
  })

  it('删除学生账号后查询应返回 404', async () => {
    const res = await asAdmin(request(app).delete('/api/admin/students/2024010001'))
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/students/2024010001'))
    expect(after.status).toBe(404)
  })
})

describe('管理员接口鉴权', () => {
  it('无 token 访问教师列表应返回 401', async () => {
    const res = await request(app).get('/api/admin/teachers')
    expect(res.status).toBe(401)
  })
})
