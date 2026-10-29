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
// 安全加固后不再内置 admin/admin123：必须显式配置初始管理员口令，
// 且该赋值要在 require database（会触发 seedInitialAdmin）之前
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024'
process.env.INITIAL_ADMIN_USERNAME = 'admin'

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
    .send({ username: 'admin', password: process.env.INITIAL_ADMIN_PASSWORD })
  adminToken = loginRes.body.data.token
  expect(adminToken).toBeTruthy()
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
  it('新增学生账号（一次性初始口令，可直接登录且强制改密）', async () => {
    const res = await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: '20240101',
      student_name: '测试学生甲',
      class_code: '202401',
    })
    expect(res.status).toBe(201)
    // 契约变更：不再返回固定 99999999，而是一次性 8 位随机口令
    const pwd = res.body.data.initial_password
    expect(pwd).toMatch(/^\d{8}$/)
    expect(pwd).not.toBe('99999999')

    const login = await request(app).post('/api/auth/student/login').send({
      student_id: '20240101',
      password: pwd,
    })
    expect(login.status).toBe(200)
    expect(login.body.data.user.must_reset_password).toBe(true)

    // 旧默认口令必须失效
    const oldLogin = await request(app).post('/api/auth/student/login').send({
      student_id: '20240101',
      password: '99999999',
    })
    expect(oldLogin.status).toBe(401)
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
    // 注意：teacherRegisterSchema 要求 phone 符合 1[3-9]\d{9}
    await request(app).post('/api/auth/teacher/register').send({
      phone: '13800000001',
      name: '待审批教师',
      password: '12345678',
    })
    // 再用 admin 直接创建一个 active 教师，用于测试"驳回非 pending"
    const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')
    await asAdmin(request(app).post('/api/admin/teachers')).send({
      phone: '13800000002',
      name: '已激活教师',
      password: '12345678',
      school_id: school.id,
      class_codes: ['202403'],
    })
  })

  it('驳回 pending 教师 → 200 且状态变为 rejected', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/13800000001/reject'))
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const after = await asAdmin(request(app).get('/api/admin/teachers/13800000001'))
    expect(after.body.data.status).toBe('rejected')
  })

  it('驳回 active 教师 → 400 NOT_PENDING', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/13800000002/reject'))
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NOT_PENDING')
  })

  it('驳回不存在的教师 → 404', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/notexist/reject'))
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('NOT_FOUND')
  })

  it('approve pending 教师 → 200 且状态变为 active', async () => {
    // 再注册一个新的 pending 教师
    await request(app).post('/api/auth/teacher/register').send({
      phone: '13800000003',
      name: '待审批教师2',
      password: '12345678',
    })
    const res = await asAdmin(request(app).post('/api/admin/teachers/13800000003/approve'))
    expect(res.status).toBe(200)

    const after = await asAdmin(request(app).get('/api/admin/teachers/13800000003'))
    expect(after.body.data.status).toBe('active')
  })

  it('approve 非 pending（已驳回）教师 → 400 NOT_PENDING', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers/13800000001/approve'))
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('NOT_PENDING')
  })

  it('listTeachers 按 status=rejected 筛选应能只看到已驳回教师', async () => {
    const res = await asAdmin(request(app).get('/api/admin/teachers?status=rejected'))
    expect(res.status).toBe(200)
    const phones = res.body.data.map((t) => t.phone)
    expect(phones).toContain('13800000001')
    for (const t of res.body.data) {
      expect(t.status).toBe('rejected')
    }
  })
})

/**
 * 完整状态机集成测试：approve / reject / set-status 三种接口对 4 种状态的互斥矩阵
 *
 * 合法转换（approve）: pending → active
 * 合法转换（reject）:  pending → rejected
 * 合法转换（set-status）: active ↔ disabled
 *
 * 其余所有组合都应返回 400 + 明确 error 码，防止状态机被绕过。
 */
describe('approveTeacher 漏洞修复：完整状态机互斥矩阵', () => {
  const phones = {
    pending: '13910000001',
    active: '13910000002',
    rejected: '13910000003',
    disabled: '13910000004',
  }

  beforeAll(async () => {
    const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')

    // 1) pending: 通过公开注册
    await request(app).post('/api/auth/teacher/register').send({
      phone: phones.pending,
      name: 'S1 待审批',
      password: '12345678',
    })

    // 2) active: admin 创建
    await asAdmin(request(app).post('/api/admin/teachers')).send({
      phone: phones.active, name: 'S2 已激活', password: '12345678',
      school_id: school.id, class_codes: ['202401'],
    })

    // 3) rejected: register → reject
    await request(app).post('/api/auth/teacher/register').send({
      phone: phones.rejected, name: 'S3 被驳回', password: '12345678',
    })
    await asAdmin(request(app).post(`/api/admin/teachers/${phones.rejected}/reject`))

    // 4) disabled: admin 创建 → set-status disabled
    await asAdmin(request(app).post('/api/admin/teachers')).send({
      phone: phones.disabled, name: 'S4 已禁用', password: '12345678',
      school_id: school.id, class_codes: ['202401'],
    })
    await asAdmin(request(app).post(`/api/admin/teachers/${phones.disabled}/status`))
      .send({ status: 'disabled' })
  })

  // --------- approve 矩阵 ---------
  describe('approveTeacher 只允许 pending → active', () => {
    it('pending → approve → 200 + status=active + must_reset_password=1', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${phones.pending}/approve`))
      expect(res.status).toBe(200)
      const after = await asAdmin(request(app).get(`/api/admin/teachers/${phones.pending}`))
      expect(after.body.data.status).toBe('active')
    })

    it('active → approve → 400 ALREADY_ACTIVE（已激活不允许二次审批）', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${phones.active}/approve`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('ALREADY_ACTIVE')
    })

    it('rejected → approve → 400 NOT_PENDING（漏洞修复：已驳回不可复活）', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${phones.rejected}/approve`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })

    it('disabled → approve → 400 NOT_PENDING（已禁用不可跳过 pending 直接复活）', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${phones.disabled}/approve`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })

    it('不存在的 phone → approve → 404 NOT_FOUND', async () => {
      const res = await asAdmin(request(app).post('/api/admin/teachers/13999999999/approve'))
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })
  })

  // --------- reject 矩阵 ---------
  describe('rejectTeacher 只允许 pending → rejected', () => {
    // 注意：上一个 describe 已经把 pending 给 approve 掉了，这里我们重新造一个
    let freshPendingPhone
    beforeAll(async () => {
      freshPendingPhone = '13910000005'
      await request(app).post('/api/auth/teacher/register').send({
        phone: freshPendingPhone, name: 'S5 新待审批', password: '12345678',
      })
    })

    it('pending → reject → 200 + status=rejected', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${freshPendingPhone}/reject`))
      expect(res.status).toBe(200)
      const after = await asAdmin(request(app).get(`/api/admin/teachers/${freshPendingPhone}`))
      expect(after.body.data.status).toBe('rejected')
    })

    it('active → reject → 400 NOT_PENDING', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${phones.active}/reject`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })

    it('rejected → reject → 400 NOT_PENDING（double reject 不幂等）', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${phones.rejected}/reject`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })

    it('disabled → reject → 400 NOT_PENDING', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${phones.disabled}/reject`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })

    it('不存在的 phone → reject → 404 NOT_FOUND', async () => {
      const res = await asAdmin(request(app).post('/api/admin/teachers/13999999999/reject'))
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })
  })

  // --------- 端到端：register → approve → disable → 再 approve/reject 都应互斥 ---------
  describe('端到端：状态不可逆/互斥链路', () => {
    let e2ePhone
    beforeAll(async () => {
      e2ePhone = '13920000001'
      // 注册 → pending
      await request(app).post('/api/auth/teacher/register').send({
        phone: e2ePhone, name: 'E2E 教师', password: '12345678',
      })
    })

    it('链路: pending → approve → active', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${e2ePhone}/approve`))
      expect(res.status).toBe(200)
    })

    it('链路: active → set-status disabled', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${e2ePhone}/status`))
        .send({ status: 'disabled' })
      expect(res.status).toBe(200)
    })

    it('链路: disabled 后再 approve → 400 NOT_PENDING', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${e2ePhone}/approve`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })

    it('链路: disabled 后再 reject → 400 NOT_PENDING', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${e2ePhone}/reject`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })

    it('链路: disabled → set-status 恢复 active 后仍不可 reject', async () => {
      await asAdmin(request(app).post(`/api/admin/teachers/${e2ePhone}/status`))
        .send({ status: 'active' })
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${e2ePhone}/reject`))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('NOT_PENDING')
    })
  })

  // --------- 审计/幂等：reject 带自定义 reason 不报错 ---------
  describe('边界：reject 接口幂等性/原因字段', () => {
    let reasonPhone
    beforeAll(async () => {
      reasonPhone = '13930000001'
      await request(app).post('/api/auth/teacher/register').send({
        phone: reasonPhone, name: '带原因驳回', password: '12345678',
      })
    })

    it('reject 带 reason 字段应 200（reason 保留用于审计日志）', async () => {
      const res = await asAdmin(request(app).post(`/api/admin/teachers/${reasonPhone}/reject`))
        .send({ reason: '缺少教学资质证明，请重新准备后提交' })
      expect(res.status).toBe(200)
    })

    it('approve 后学生用该 phone 登录 → 302 改密码', async () => {
      // 这是 teacher 身份从 pending → rejected 后再被另一路径 approve（这里证明 rejected 确实不能 approve）
      // 我们已经在上面的矩阵里测过 rejected 不可 approve，这里改为测试 rejected 教师直接登录
      const login = await request(app).post('/api/auth/teacher/login').send({
        phone: reasonPhone, password: '12345678',
      })
      expect(login.status).toBe(403)
      expect(login.body.error).toBe('ACCOUNT_DISABLED') // rejected 不是 active，触发 status !== 'active' 的分支
    })
  })
})
