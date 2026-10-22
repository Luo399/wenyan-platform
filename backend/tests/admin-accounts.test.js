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
      student_id: '20240101',
      student_name: '测试学生甲',
      class_code: '202401',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.initial_password).toBe('99999999')
  })

  it('查询单个学生应不返回密码哈希', async () => {
    const res = await asAdmin(request(app).get('/api/admin/students/20240101'))
    expect(res.status).toBe(200)
    expect(res.body.data.student_name).toBe('测试学生甲')
    expect(res.body.data.password_hash).toBeUndefined()
  })

  it('更新学生信息', async () => {
    const res = await asAdmin(request(app).put('/api/admin/students/20240101')).send({
      student_name: '测试学生乙',
    })
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/students/20240101'))
    expect(after.body.data.student_name).toBe('测试学生乙')
  })

  it('删除学生账号后查询应返回 404', async () => {
    const res = await asAdmin(request(app).delete('/api/admin/students/20240101'))
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/students/20240101'))
    expect(after.status).toBe(404)
  })
})

describe('管理员接口鉴权', () => {
  it('无 token 访问教师列表应返回 401', async () => {
    const res = await request(app).get('/api/admin/teachers')
    expect(res.status).toBe(401)
  })
})

describe('管理员：教师审批 / 驳回', () => {
  beforeAll(async () => {
    // 通过公开注册接口创建 1 个 pending 教师（模拟真实注册流程）
    await request(app).post('/api/auth/teacher/register').send({
      phone: 'tpending',
      name: '待审批教师',
      password: '12345678',
    })
    // 再用 admin 直接创建一个 active 教师，用于测试"驳回非 pending"
    const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')
    await asAdmin(request(app).post('/api/admin/teachers')).send({
      phone: 'tactive',
      name: '已激活教师',
      password: '12345678',
      school_id: school.id,
      class_codes: ['202403'],
    })
  })

  it('驳回 pending 教师 → 200 且状态变为 rejected', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/tpending/reject'))
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const after = await asAdmin(request(app).get('/api/admin/teachers/tpending'))
    expect(after.body.data.status).toBe('rejected')
  })

  it('驳回 active 教师 → 400 NOT_PENDING', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/tactive/reject'))
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NOT_PENDING')
  })

  it('驳回不存在的教师 → 404', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/notexist/reject'))
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('NOT_FOUND')
  })

  it('approve pending 教师 → 200 且 must_reset_password=1', async () => {
    // 再注册一个新的 pending 教师
    await request(app).post('/api/auth/teacher/register').send({
      phone: 'tpending2',
      name: '待审批教师2',
      password: '12345678',
    })
    const res = await asAdmin(request(app).post('/api/admin/teachers/tpending2/approve'))
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/teachers/tpending2'))
    expect(after.body.data.status).toBe('active')
    expect(after.body.data.must_reset_password).toBe(1)
  })

  it('approve 非 pending（已驳回）教师 → 400 ALREADY_ACTIVE 或其他错误', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/tpending/approve'))
    // tpending 已被驳回，不是 pending 了
    expect(res.status).toBe(400)
  })

  it('listTeachers 按 status=rejected 筛选应能只看到已驳回教师', async () => {
    const res = await asAdmin(request(app).get('/api/admin/teachers?status=rejected'))
    expect(res.status).toBe(200)
    const phones = res.body.data.map((t) => t.phone)
    expect(phones).toContain('tpending')
    // 不应该混入 active / pending
    for (const t of res.body.data) {
      expect(t.status).toBe('rejected')
    }
  })
})
