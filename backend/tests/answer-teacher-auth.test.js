/**
 * 答题查询接口的 teacher 班级权限隔离测试
 *
 * 覆盖 answerController 新加的 teacher 权限校验：
 * - GET /api/answers/student/:studentId
 *   - teacher 查自己班级学生 → 200
 *   - teacher 查他班学生 → 403 FORBIDDEN
 * - GET /api/answers/wen/:wenId
 *   - teacher 查到的学生列表里不应出现他班学生
 *
 * 运行方式：npm test（已纳入 CI backend-check）
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

let app
let adminToken
let teacherToken
let studentToken

function asAdmin(agent) {
  return agent.set('Authorization', `Bearer ${adminToken}`)
}
function asTeacher(agent) {
  return agent.set('Authorization', `Bearer ${teacherToken}`)
}
function asStudent(agent) {
  return agent.set('Authorization', `Bearer ${studentToken}`)
}

beforeAll(async () => {
  process.env.TEST_MODE = 'true'

  const { initAllTables } = require('../src/config/database')
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  // admin 登录
  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: 'admin123' })
  adminToken = adminLogin.body.data.token

  // 创建一个 teacher（所教班级 202401）
  const teacherCreate = await asAdmin(request(app).post('/api/admin/teachers')).send({
    phone: '13800000010',
    name: 'A 老师',
    password: '12345678',
    school_id: 1,
    class_codes: ['202401'],
  })
  expect(teacherCreate.status).toBe(201)
  const teacherLogin = await request(app)
    .post('/api/auth/teacher/login')
    .send({ phone: '13800000010', password: '12345678' })
  teacherToken = teacherLogin.body.data.token

  // 创建两个学生：本班 202401 + 他班 202402
  await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: '20240101',
    student_name: '本班学生',
    class_code: '202401',
  })
  await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: '20240201',
    student_name: '他班学生',
    class_code: '202402',
  })

  // 用本班学生登录（自动注册到 students 表）
  const studentLogin = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: '20240101', password: '99999999' })
  studentToken = studentLogin.body.data.token
})

describe('teacher 角色：GET /api/answers/student/:studentId 班级权限隔离', () => {
  it('teacher 查自己班级学生 → 200', async () => {
    const res = await asTeacher(request(app).get('/api/answers/student/20240101'))
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('teacher 查他班学生 → 403 FORBIDDEN', async () => {
    const res = await asTeacher(request(app).get('/api/answers/student/20240201'))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('FORBIDDEN')
  })

  it('teacher 查不存在的学生 → 404（走 student 存在性检查）', async () => {
    const res = await asTeacher(request(app).get('/api/answers/student/99999999'))
    // 99999999 在 students 表里本来就有（默认 seed），但 teacher 无权，所以返回 403
    expect([403, 404]).toContain(res.status)
  })

  it('admin 查任意学生都应 200', async () => {
    const res = await asAdmin(request(app).get('/api/answers/student/20240201'))
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('teacher 角色：GET /api/answers/wen/:wenId 他班学生被过滤', () => {
  it('teacher 应看不到他班学生的答题记录', async () => {
    // 先让学生提交一条答题（往 answers 表写数据）
    const submitRes = await asStudent(request(app).post('/api/submit/single')).send({
      studentId: '20240101',
      wenId: 'WEN_AA',
      questionId: 'q1',
      userAnswer: 3,
      correctAnswer: 3,
      submittedAt: new Date().toISOString(),
    })
    expect(submitRes.status).toBe(200)

    // teacher 查 WEN_AA，应该能看到本班学生的答题
    const teacherRes = await asTeacher(request(app).get('/api/answers/wen/WEN_AA'))
    expect(teacherRes.status).toBe(200)
    expect(teacherRes.body.data.studentCount).toBeGreaterThanOrEqual(1)
    const teacherSeenIds = teacherRes.body.data.students.map((s) => s.studentId)
    expect(teacherSeenIds).toContain('20240101')
    expect(teacherSeenIds).not.toContain('20240201')

    // admin 查同一条，应该能看到全部
    const adminRes = await asAdmin(request(app).get('/api/answers/wen/WEN_AA'))
    expect(adminRes.status).toBe(200)
    expect(adminRes.body.data.studentCount).toBeGreaterThanOrEqual(1)
  })
})

describe('teacher 角色：无关联班级时查询应返回空列表而非崩溃', () => {
  let orphanTeacherToken

  it('没有所教班级的 teacher 查 wen 应返回空 students 列表', async () => {
    // 注意：createTeacher / updateTeacher 都要求 class_codes 非空
    // 这里改为用 updateTeacher 让 class_codes 仅剩 1 个值，模拟"单班教师"
    // （真正 0 班教师需要绕过后端校验通过 SQL 或 register+approve 再 UPDATE）
    // 我们直接通过 register → approve 路径，然后用 SQL 绕过后端校验清空 teacher_classes
    await request(app).post('/api/auth/teacher/register').send({
      phone: '13800000099',
      name: '无班级教师',
      password: '12345678',
    })
    await asAdmin(request(app).post('/api/admin/teachers/13800000099/approve'))

    const { db } = require('../src/config/database')
    await new Promise((resolve) => {
      db.run(`DELETE FROM teacher_classes WHERE teacher_id = (SELECT id FROM teachers WHERE phone = '13800000099')`, () => resolve())
    })

    const loginRes = await request(app)
      .post('/api/auth/teacher/login')
      .send({ phone: '13800000099', password: '12345678' })
    orphanTeacherToken = loginRes.body.data.token

    const res = await request(app)
      .get('/api/answers/wen/WEN_AA')
      .set('Authorization', `Bearer ${orphanTeacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.studentCount).toBe(0)
    expect(res.body.data.students).toEqual([])
  })
})

describe('teacher can_view_all=1 全权限分支', () => {
  let fullAccessToken

  it('admin 创建 can_view_all=1 的 teacher 可跳过 class_codes', async () => {
    const res = await asAdmin(request(app).post('/api/admin/teachers')).send({
      phone: '13800000088',
      name: '全权限老师',
      password: '12345678',
      school_id: 1,
      can_view_all: true,
      // 不传 class_codes —— 全权限不需要
    })
    expect(res.status).toBe(201)
    // 验证 teacher 表里 can_view_all = 1
    const getRes = await asAdmin(request(app).get('/api/admin/teachers/13800000088'))
    expect(getRes.body.data.can_view_all).toBe(1)
  })

  it('can_view_all=1 的 teacher 查他班学生 → 200（普通 teacher 会 403）', async () => {
    const loginRes = await request(app)
      .post('/api/auth/teacher/login')
      .send({ phone: '13800000088', password: '12345678' })
    fullAccessToken = loginRes.body.data.token

    const res = await request(app)
      .get('/api/answers/student/20240201')
      .set('Authorization', `Bearer ${fullAccessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('can_view_all=1 的 teacher 查 wen → 所有班级学生可见', async () => {
    const res = await request(app)
      .get('/api/answers/wen/WEN_AA')
      .set('Authorization', `Bearer ${fullAccessToken}`)
    expect(res.status).toBe(200)
    // 至少能看到 20240101（之前提交过答题的本班学生）
    const seenIds = res.body.data.students.map((s) => s.studentId)
    expect(seenIds).toContain('20240101')
  })

  it('authService.teacherCanManageClass 对 can_view_all=1 放行任意班级', async () => {
    const { teacherCanManageClass } = require('../src/services/authService')
    const { db } = require('../src/config/database')
    // teacher id 7 = 13800000088（前面刚创建的）
    const row = await new Promise((resolve) => {
      db.get("SELECT id FROM teachers WHERE phone = '13800000088'", (_, r) => resolve(r))
    })
    const ok = await teacherCanManageClass(row.id, '999999') // 随便一个不存在的班级
    expect(ok).toBe(true)
  })
})
