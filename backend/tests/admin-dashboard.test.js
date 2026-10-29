/**
 * 管理员数据看板集成测试
 *
 * 覆盖 /api/admin/dashboard/*：
 * - 鉴权：无 token 401；学生 token 403（角色不匹配）；admin 通过
 * - 概览：账号结构、激活率、待审批数、DAU/WAU/MAU、默认密码待改人数
 * - 趋势：按日序列长度 = days、空日补 0、新增学生计入窗口
 * - 分布：class / grade / school 三种维度与 usage_rate 口径、非法维度 400
 *
 * 管理员看板是平台级口径，先摘掉 initAllTables 播种的测试学生 99999999
 * （见 removeSeededTestStudent），否则结构类断言要凭空多算一条无关名册。
 *
 * 运行方式：cd backend && npm test
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'
// 安全加固后不再内置 admin/admin123：初始管理员需显式配置（必须在 require database 之前）
process.env.INITIAL_ADMIN_USERNAME = 'admin'
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024'

const { db, initAllTables } = require('../src/config/database')
const { dbGet, dbRun } = require('../src/utils/dbPromise')
const inventory = require('../src/utils/questionInventory')

let app
let adminToken
let studentToken

const DAY_MS = 24 * 60 * 60 * 1000
const iso = (offsetDays = 0) => new Date(Date.now() - offsetDays * DAY_MS).toISOString()

function insertAnswer({ studentId, wenId, questionId, correct, submittedAt = iso(0), attempt = 1 }) {
  return dbRun(
    db,
    `INSERT INTO answers (student_id, wen_id, question_id, user_answer, correct_answer, submitted_at, score, is_correct, attempt_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, wenId, questionId, correct ? 'A' : 'B', 'A', submittedAt, correct ? 100 : 0, correct ? 1 : 0, attempt],
  )
}

/**
 * 摘掉 initAllTables 播种的「测试学生 99999999 / 班级 999999」。
 *
 * 管理员看板是平台级口径，非生产环境必播的这条种子数据会一起进统计：
 * student_total 变 4、class_count 变 3、多出一个「9999 级」分组、未覆盖班级
 * 多出 999999。删掉之后断言才只反映本文件插入的名册。
 */
async function removeSeededTestStudent() {
  await dbRun(db, `DELETE FROM answers WHERE student_id = '99999999'`)
  await dbRun(db, `DELETE FROM students WHERE student_id = '99999999'`)
}

beforeAll(async () => {
  process.env.TEST_MODE = 'true'
  await initAllTables()
  await removeSeededTestStudent()

  const { createApp } = require('../src/app')
  app = createApp()

  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: process.env.INITIAL_ADMIN_PASSWORD })
  adminToken = adminLogin.body.data.token

  const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')
  const bcrypt = require('bcryptjs')
  const teacherHash = await bcrypt.hash('pw12345678', 10)

  // supertest 的 .set() 只能挂在动词之后：request(app).post(url).set(...)
  // 安全加固后新建学生拿到的是**一次性随机口令**（data.initial_password），不再是固定 99999999，
  // 所以这里把口令接住，供下面的学生登录用。
  const createStudent = (studentId, name, classCode) =>
    request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ student_id: studentId, student_name: name, class_code: classCode })
      .then((res) => res.body?.data?.initial_password)
  const studentPassword = await createStudent('20260101', '甲', '202601')
  await createStudent('20260102', '乙', '202601')
  await createStudent('20260301', '丁', '202603')

  // 一名待审批教师 + 一名正常教师
  await dbRun(
    db,
    `INSERT INTO teachers (phone, name, school_id, password_hash, status) VALUES ('t9401', '待审批教师', ?, ?, 'pending')`,
    [school.id, teacherHash],
  )
  await dbRun(
    db,
    `INSERT INTO teachers (phone, name, school_id, password_hash, status) VALUES ('t9402', '在岗教师', ?, ?, 'active')`,
    [school.id, teacherHash],
  )

  const studentLogin = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: '20260101', password: studentPassword })
  studentToken = studentLogin.body.data.token

  const wen = inventory.buildInventory(true).texts[0].wen_id
  // 甲：今天答 2 题（1 对 1 错）；乙：8 天前答 1 题；丁：零提交
  await insertAnswer({ studentId: '20260101', wenId: wen, questionId: `${wen}_A1`, correct: true, submittedAt: iso(0) })
  await insertAnswer({ studentId: '20260101', wenId: wen, questionId: `${wen}_A2`, correct: false, submittedAt: iso(0) })
  await insertAnswer({ studentId: '20260102', wenId: wen, questionId: `${wen}_B1`, correct: true, submittedAt: iso(8) })
})

afterAll((done) => {
  db.close(() => done())
})

describe('管理员看板：鉴权', () => {
  it('未登录应 401，学生 token 应 403', async () => {
    const anonymous = await request(app).get('/api/admin/dashboard/overview')
    expect(anonymous.status).toBe(401)

    const asStudent = await request(app)
      .get('/api/admin/dashboard/overview')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(asStudent.status).toBe(403)
  })
})

describe('管理员看板：运营概览', () => {
  it('应返回账号结构、待办与使用总量', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const { accounts, usage, activity, submissions, todos } = res.body.data

    expect(accounts.teacher_total).toBe(2)
    expect(accounts.teacher_status.pending).toBe(1)
    expect(accounts.teacher_status.active).toBe(1)
    expect(accounts.pending_teacher_count).toBe(1)
    expect(accounts.student_total).toBe(3)
    // 去重班级：202601、202603
    expect(accounts.class_count).toBe(2)
    expect(accounts.school_count).toBeGreaterThanOrEqual(1)

    expect(usage.student_total).toBe(3)
    expect(usage.answered_student_count).toBe(2)
    expect(usage.untouched_student_count).toBe(1)
    expect(usage.activation_rate).toBeCloseTo(66.7, 1)
    expect(usage.total_questions_per_student).toBe(inventory.getPlatformTotals().total)
    // 按题次汇总：3 个去重题次里 2 次答对（甲 A1 对 / 甲 A2 错 / 乙 B1 对）
    expect(usage.overall_accuracy).toBeCloseTo((2 / 3) * 100, 1)

    expect(submissions.total).toBe(3)
    expect(submissions.last_7_days).toBe(2)
    expect(activity.dau).toBe(1)
    expect(activity.wau).toBe(1)
    expect(activity.mau).toBe(2)

    expect(todos.pending_teacher_count).toBe(1)
    expect(todos.students_on_default_password).toBe(3)
  })
})

describe('管理员看板：趋势', () => {
  it('序列长度等于 days 且总量含窗口内新增学生', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/trends?days=14')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.days).toBe(14)
    expect(res.body.data.series).toHaveLength(14)
    expect(res.body.data.totals.new_students).toBe(3)
    expect(res.body.data.totals.submissions).toBe(3)
    const today = res.body.data.series[res.body.data.series.length - 1]
    expect(today.submissions).toBe(2)
    expect(today.active_students).toBe(1)
  })

  it('非法 days 应 400', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/trends?days=abc')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })
})

describe('管理员看板：结构分布', () => {
  it('按班级分组给出使用率，并把零提交班级列入 uncovered', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/distribution?dimension=class&window_days=7')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.dimension).toBe('class')
    const byClass = Object.fromEntries(res.body.data.groups.map((g) => [g.key, g]))

    expect(byClass['202601'].student_count).toBe(2)
    expect(byClass['202601'].answered_student_count).toBe(2)
    // 窗口 7 天：只有甲活跃，乙最后一次提交在 8 天前
    expect(byClass['202601'].active_student_count).toBe(1)
    expect(byClass['202601'].usage_rate).toBeCloseTo(50, 1)
    expect(byClass['202603'].student_count).toBe(1)
    expect(byClass['202603'].answered_student_count).toBe(0)
    expect(res.body.data.uncovered).toEqual(['202603'])
  })

  it('年级维度取班级编码前 4 位，学校维度给出学校名', async () => {
    const grade = await request(app)
      .get('/api/admin/dashboard/distribution?dimension=grade')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(grade.body.data.groups).toHaveLength(1)
    expect(grade.body.data.groups[0].key).toBe('2026')
    expect(grade.body.data.groups[0].label).toBe('2026 级')
    expect(grade.body.data.groups[0].student_count).toBe(3)

    const school = await request(app)
      .get('/api/admin/dashboard/distribution?dimension=school')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(school.body.data.groups[0].student_count).toBe(3)
    expect(school.body.data.groups[0].label.length).toBeGreaterThan(0)
  })

  it('非法 dimension 应 400', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/distribution?dimension=password_hash')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })
})
