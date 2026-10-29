/**
 * 教师查看学生完成情况集成测试
 *
 * 覆盖 teacherController.getStudentsCompletion：
 * - 返回所教班级学生名单与真实统计字段（metrics_ready=true，answers 聚合口径）
 * - 班级过滤：非本班 class_code → 403
 * - 无 token → 401
 * - 无答题记录时统计字段为 0
 *
 * 运行方式：npm test（已纳入 CI backend-check）
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'
// 安全加固后不再内置 admin/admin123，初始管理员需显式配置（require database 前）
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024'
process.env.INITIAL_ADMIN_USERNAME = 'admin'

const { db, initAllTables } = require('../src/config/database')
const { dbGet } = require('../src/utils/dbPromise')

let app
let adminToken
let teacherToken
let student2601Token
let student2602Token

function asAdmin(agent) {
  return agent.set('Authorization', `Bearer ${adminToken}`)
}

function asTeacher(agent) {
  return agent.set('Authorization', `Bearer ${teacherToken}`)
}

function asStudent2601(agent) {
  return agent.set('Authorization', `Bearer ${student2601Token}`)
}

function asStudent2602(agent) {
  return agent.set('Authorization', `Bearer ${student2602Token}`)
}

beforeAll(async () => {
  process.env.TEST_MODE = 'true'
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: process.env.INITIAL_ADMIN_PASSWORD })
  adminToken = adminLogin.body.data.token
  expect(adminToken).toBeTruthy()

  const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')

  await asAdmin(request(app).post('/api/admin/teachers')).send({
    phone: 't9201',
    name: '完成情况教师',
    password: '12345678',
    school_id: school.id,
    class_codes: ['202601'],
  })
  const teacherLogin = await request(app)
    .post('/api/auth/teacher/login')
    .send({ phone: 't9201', password: '12345678' })
  teacherToken = teacherLogin.body.data.token

  // 本班学生 2 名（一次性初始口令由创建接口返回，仅此处可拿到明文）
  const created1 = await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: '20260101',
    student_name: '框架学生甲',
    class_code: '202601',
  })
  const created2 = await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: '20260102',
    student_name: '框架学生乙',
    class_code: '202601',
  })
  expect(created1.status).toBe(201)
  expect(created2.status).toBe(201)
  // 他班学生 1 名（用于越权过滤断言）
  await asAdmin(request(app).post('/api/admin/students')).send({
    student_id: '20260201',
    student_name: '他班学生',
    class_code: '202602',
  })

  // 本班学生登录，拿到 token 用于 submit
  const s1 = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: '20260101', password: created1.body.data.initial_password })
  student2601Token = s1.body.data.token
  const s2 = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: '20260102', password: created2.body.data.initial_password })
  student2602Token = s2.body.data.token
  expect(student2601Token).toBeTruthy()
  expect(student2602Token).toBeTruthy()
})

afterAll((done) => {
  db.close(() => done())
})

describe('教师查看学生完成情况', () => {
  it('应返回本班学生名单与真实统计字段（metrics_ready=true）', async () => {
    const res = await asTeacher(request(app).get('/api/teacher/completion/students'))
    expect(res.status).toBe(200)
    expect(res.body.data.metrics_ready).toBe(true)
    expect(res.body.data.summary.student_count).toBe(2)

    const ids = res.body.data.students.map((s) => s.student_id).sort()
    expect(ids).toEqual(['20260101', '20260102'])
    // 无答题记录时，已答题数/正确率/最近提交均为初始值
    expect(res.body.data.students[0]).toHaveProperty('answered_questions', 0)
    expect(res.body.data.students[0]).toHaveProperty('accuracy', 0)
    expect(res.body.data.students[0]).toHaveProperty('last_submitted_at', null)
    // 不泄漏密码哈希
    expect(res.body.data.students[0].password_hash).toBeUndefined()
  })

  it('按本班 class_code 过滤应 200', async () => {
    const res = await asTeacher(
      request(app).get('/api/teacher/completion/students?class_code=202601'),
    )
    expect(res.status).toBe(200)
    expect(res.body.data.summary.student_count).toBe(2)
  })

  it('按非本班 class_code 过滤应 403', async () => {
    const res = await asTeacher(
      request(app).get('/api/teacher/completion/students?class_code=202602'),
    )
    expect(res.status).toBe(403)
  })

  it('未登录访问应 401', async () => {
    const res = await request(app).get('/api/teacher/completion/students')
    expect(res.status).toBe(401)
  })

  it('学生提交答题后 completion 统计应真实反映（metrics_ready=true）', async () => {
    // 先查一次，应 0
    const before = await asTeacher(request(app).get('/api/teacher/completion/students'))
    expect(before.body.data.students[0].answered_questions).toBe(0)

    // 提交两道题（一道对一道错），题目与答案均来自真实题库：
    //   data/text-quiz/WEN_01.json            → WEN_01_Q1 正确答案 1
    //   data/pages_level2_dialog_quiz/WEN_01.json → WEN_01_B1 正确答案 'B'
    await asStudent2601(request(app).post('/api/submit/single')).send({
      studentId: '20260101',
      wenId: 'WEN_01',
      questionId: 'WEN_01_Q1',
      userAnswer: 1,
      submittedAt: new Date().toISOString(),
    })
    await asStudent2601(request(app).post('/api/submit/single')).send({
      studentId: '20260101',
      wenId: 'WEN_01',
      questionId: 'WEN_01_B1',
      userAnswer: 'A',
      submittedAt: new Date().toISOString(),
    })

    const after = await asTeacher(request(app).get('/api/teacher/completion/students'))
    const s = after.body.data.students.find((x) => x.student_id === '20260101')
    expect(s).toBeTruthy()
    expect(s.answered_questions).toBe(2)
    expect(s.correct_count).toBe(1)
    expect(s.accuracy).toBeCloseTo(50.0, 0)
    expect(s.last_submitted_at).not.toBeNull()
  })

  it('多次 attempt 同一道题应取最后一次结果判定（attempt_number 最大）', async () => {
    // 同一道题（WEN_01_Q1，正确答案 1）先答错再答对
    await asStudent2602(request(app).post('/api/submit/single')).send({
      studentId: '20260102',
      wenId: 'WEN_01',
      questionId: 'WEN_01_Q1',
      userAnswer: 0,
      submittedAt: new Date().toISOString(),
    })
    await asStudent2602(request(app).post('/api/submit/single')).send({
      studentId: '20260102',
      wenId: 'WEN_01',
      questionId: 'WEN_01_Q1',
      userAnswer: 1,
      submittedAt: new Date().toISOString(),
    })

    const res = await asTeacher(request(app).get('/api/teacher/completion/students'))
    const s = res.body.data.students.find((x) => x.student_id === '20260102')
    expect(s).toBeTruthy()
    // 只有 1 道唯一题（qX），但最终 is_correct=1
    expect(s.answered_questions).toBe(1)
    expect(s.correct_count).toBe(1)
  })
})
