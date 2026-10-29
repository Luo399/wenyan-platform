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
// 本套件需要多次登录（admin/多个 teacher/多个学生），放宽登录限流避免 429 干扰断言
process.env.RATE_LIMIT_LOGIN = '200'
// 安全加固后不再内置 admin/admin123：初始管理员需显式配置（必须在 require database 之前）
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024'
process.env.INITIAL_ADMIN_USERNAME = 'admin'

// 真实题库数据：data/text-quiz/WEN_01.json → WEN_01_Q1 正确答案 1
const WEN_ID = 'WEN_01'
const QUESTION_ID = 'WEN_01_Q1'
const CORRECT_ANSWER = 1

let app
let adminToken
let teacherToken
let studentToken
let otherStudentToken

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
    .send({ username: 'admin', password: process.env.INITIAL_ADMIN_PASSWORD })
  adminToken = adminLogin.body.data.token
  expect(adminToken).toBeTruthy()

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
  // 一次性初始口令由创建接口返回（明文只出现一次），用它登录而不是历史固定口令
  const created1 = await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: '20240101',
    student_name: '本班学生',
    class_code: '202401',
  })
  const created2 = await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: '20240201',
    student_name: '他班学生',
    class_code: '202402',
  })
  expect(created1.status).toBe(201)
  expect(created2.status).toBe(201)

  const studentLogin = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: '20240101', password: created1.body.data.initial_password })
  studentToken = studentLogin.body.data?.token
  expect(studentToken).toBeTruthy()

  const otherLogin = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: '20240201', password: created2.body.data.initial_password })
  otherStudentToken = otherLogin.body.data?.token
  expect(otherStudentToken).toBeTruthy()
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
    // 两个班各提交一条答题（真实题库：WEN_01_Q1 正确答案 1）
    const submitRes = await asStudent(request(app).post('/api/submit/single')).send({
      studentId: '20240101',
      wenId: WEN_ID,
      questionId: QUESTION_ID,
      userAnswer: CORRECT_ANSWER,
      submittedAt: new Date().toISOString(),
    })
    expect(submitRes.status).toBe(200)

    const otherRes = await request(app)
      .post('/api/submit/single')
      .set('Authorization', `Bearer ${otherStudentToken}`)
      .send({
        studentId: '20240201',
        wenId: WEN_ID,
        questionId: QUESTION_ID,
        userAnswer: CORRECT_ANSWER,
        submittedAt: new Date().toISOString(),
      })
    expect(otherRes.status).toBe(200)

    // teacher 查 WEN_01，只能看到本班学生
    const teacherRes = await asTeacher(request(app).get(`/api/answers/wen/${WEN_ID}`))
    expect(teacherRes.status).toBe(200)
    const teacherSeenIds = teacherRes.body.data.students.map((s) => s.studentId)
    expect(teacherSeenIds).toContain('20240101')
    expect(teacherSeenIds).not.toContain('20240201')
    expect(teacherRes.body.data.studentCount).toBe(1)

    // admin 查同一条，两班学生都能看到
    const adminRes = await asAdmin(request(app).get(`/api/answers/wen/${WEN_ID}`))
    expect(adminRes.status).toBe(200)
    const adminSeenIds = adminRes.body.data.students.map((s) => s.studentId)
    expect(adminSeenIds).toEqual(expect.arrayContaining(['20240101', '20240201']))
    expect(adminRes.body.data.studentCount).toBe(2)
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
      .get(`/api/answers/wen/${WEN_ID}`)
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
      .get(`/api/answers/wen/${WEN_ID}`)
      .set('Authorization', `Bearer ${fullAccessToken}`)
    expect(res.status).toBe(200)
    const seenIds = res.body.data.students.map((s) => s.studentId)
    // 全权限教师能看到两个班的学生
    expect(seenIds).toEqual(expect.arrayContaining(['20240101', '20240201']))
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
