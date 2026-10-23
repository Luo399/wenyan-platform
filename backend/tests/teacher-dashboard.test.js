/**
 * 教师数据看板集成测试
 *
 * 覆盖 /api/teacher/dashboard/* 的权限口径与统计口径：
 * - 班级范围来自 token，前端 class_code 只能收窄，越权 403，非法格式 400
 * - 概览/明细/篇目矩阵/薄弱题/活跃趋势的数值与手工插入的答题事实一致
 * - 全权限教师（can_view_all=1）走「不加班级过滤」分支
 *
 * 答题数据直接写库（可控 submitted_at，且绕开 submitRateLimit），
 * 但学生名册与账号仍通过真实接口创建，保持与生产链路一致。
 *
 * 运行方式：cd backend && npm test
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

const { db, initAllTables } = require('../src/config/database')
const { dbGet, dbRun } = require('../src/utils/dbPromise')
const inventory = require('../src/utils/questionInventory')

let app
let adminToken
let teacherToken
let fullAccessTeacherToken

const DAY_MS = 24 * 60 * 60 * 1000
const iso = (offsetDays = 0) => new Date(Date.now() - offsetDays * DAY_MS).toISOString()

/** 写一条答题事实（每题每次尝试一行） */
function insertAnswer({ studentId, wenId, questionId, correct, submittedAt = iso(0), attempt = 1 }) {
  return dbRun(
    db,
    `INSERT INTO answers (student_id, wen_id, question_id, user_answer, correct_answer, submitted_at, score, is_correct, attempt_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      studentId,
      wenId,
      questionId,
      correct ? 'A' : 'B',
      'A',
      submittedAt,
      correct ? 100 : 0,
      correct ? 1 : 0,
      attempt,
    ],
  )
}

async function createTeacher(phone, name, classCodes) {
  const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')
  await dbRun(
    db,
    `INSERT INTO teachers (phone, name, school_id, password_hash, status) VALUES (?, ?, ?, ?, 'active')`,
    [phone, name, school.id, 'invalid-hash-not-used'],
  )
  const teacher = await dbGet(db, 'SELECT id FROM teachers WHERE phone = ?', [phone])
  for (const classCode of classCodes) {
    await dbRun(db, `INSERT INTO teacher_classes (teacher_id, class_code) VALUES (?, ?)`, [
      teacher.id,
      classCode,
    ])
  }
  return teacher.id
}

beforeAll(async () => {
  process.env.TEST_MODE = 'true'
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  const bcrypt = require('bcryptjs')
  const hash = await bcrypt.hash('pw12345678', 10)

  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: 'admin123' })
  adminToken = adminLogin.body.data.token

  // 普通教师：只教 202601；全权限教师：can_view_all=1
  await createTeacher('t9301', '看板教师', ['202601'])
  const fullId = await createTeacher('t9302', '全权限教师', [])
  await dbRun(db, `UPDATE teachers SET can_view_all = 1, password_hash = ? WHERE id = ?`, [hash, fullId])
  await dbRun(db, `UPDATE teachers SET password_hash = ? WHERE phone = 't9301'`, [hash])

  // 学生名册走真实接口（管理员创建，初始密码 99999999）
  const admin = () => request(app).set('Authorization', `Bearer ${adminToken}`)
  await admin().post('/api/admin/students').send({ student_id: '20260101', student_name: '甲', class_code: '202601' })
  await admin().post('/api/admin/students').send({ student_id: '20260102', student_name: '乙', class_code: '202601' })
  await admin().post('/api/admin/students').send({ student_id: '20260201', student_name: '丙', class_code: '202602' })

  const teacherLogin = await request(app)
    .post('/api/auth/teacher/login')
    .send({ phone: 't9301', password: 'pw12345678' })
  teacherToken = teacherLogin.body.data.token

  const fullLogin = await request(app)
    .post('/api/auth/teacher/login')
    .send({ phone: 't9302', password: 'pw12345678' })
  fullAccessTeacherToken = fullLogin.body.data.token

  // 答题事实：20260101 答了 4 题（3 对 1 错，含一次重做），20260102 零提交
  const wen = inventory.buildInventory(true).texts[0].wen_id
  await insertAnswer({ studentId: '20260101', wenId: wen, questionId: `${wen}_A1`, correct: true, submittedAt: iso(0) })
  await insertAnswer({ studentId: '20260101', wenId: wen, questionId: `${wen}_A2`, correct: false, submittedAt: iso(1) })
  await insertAnswer({ studentId: '20260101', wenId: wen, questionId: `${wen}_A2`, correct: false, submittedAt: iso(0), attempt: 2 })
  await insertAnswer({ studentId: '20260101', wenId: wen, questionId: `${wen}_B1`, correct: true, submittedAt: iso(2) })
  // 他班学生的提交不应进入本班统计
  await insertAnswer({ studentId: '20260201', wenId: wen, questionId: `${wen}_C1`, correct: true, submittedAt: iso(0) })
})

afterAll((done) => {
  db.close(() => done())
})

describe('教师看板：概览', () => {
  it('未登录访问应 401', async () => {
    const res = await request(app).get('/api/teacher/dashboard/overview')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('AUTH_REQUIRED')
  })

  it('应只统计所教班级并给出真实概览指标', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/overview')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const { scope, summary } = res.body.data
    expect(scope.all_access).toBe(false)
    expect(scope.class_codes).toEqual(['202601'])

    expect(summary.student_count).toBe(2)
    expect(summary.class_count).toBe(1)
    expect(summary.answered_student_count).toBe(1)
    expect(summary.untouched_student_count).toBe(1)
    expect(summary.active_students_7d).toBe(1)
    // 202601 本班提交 4 行（含重做），他班 1 行不计入
    expect(summary.submissions_total).toBe(4)
    expect(summary.total_questions).toBe(inventory.getPlatformTotals().total)
    expect(summary.text_count).toBeGreaterThan(0)
    // 平均正确率只按已作答学生计：甲 2/3 → 66.7
    expect(summary.avg_accuracy).toBeCloseTo(66.7, 0)
    // 完成率 = 3 道去重题 / 平台总题量
    expect(summary.avg_completion_rate).toBeCloseTo(
      (3 / inventory.getPlatformTotals().total) * 100 / 2,
      1,
    )
  })

  it('班级汇总应逐班给出人数与拖后人数', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/overview')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.body.data.classes).toEqual([
      expect.objectContaining({
        class_code: '202601',
        student_count: 2,
        answered_student_count: 1,
        untouched_student_count: 1,
        active_students_7d: 1,
      }),
    ])
  })

  it('越权班级编码应 403，非法格式应 400', async () => {
    const forbidden = await request(app)
      .get('/api/teacher/dashboard/overview?class_code=202602')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(forbidden.status).toBe(403)
    expect(forbidden.body.error).toBe('FORBIDDEN')

    const invalid = await request(app)
      .get('/api/teacher/dashboard/overview?class_code=abc')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(invalid.status).toBe(400)
    expect(invalid.body.error).toBe('VALIDATION_ERROR')
  })

  it('空 class_code 等价于全部所教班级', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/overview?class_code=')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.summary.student_count).toBe(2)
  })

  it('全权限教师不加班级过滤，能看到所有班级', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/overview')
      .set('Authorization', `Bearer ${fullAccessTeacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.scope.all_access).toBe(true)
    expect(res.body.data.summary.student_count).toBe(3)
    expect(res.body.data.summary.class_count).toBe(2)
  })

  it('全权限教师仍可按单个班级收窄', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/overview?class_code=202602')
      .set('Authorization', `Bearer ${fullAccessTeacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.summary.student_count).toBe(1)
    expect(res.body.data.scope.requested_class_code).toBe('202602')
  })
})

describe('教师看板：学生明细', () => {
  it('应给出三关进度、停滞天数，且不泄漏密码哈希', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/students')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const { students, pagination, summary } = res.body.data
    expect(students).toHaveLength(2)
    expect(pagination.total).toBe(2)
    expect(summary.untouched_student_count).toBe(1)

    const first = students.find((s) => s.student_id === '20260101')
    expect(first.password_hash).toBeUndefined()
    expect(first.answered_questions).toBe(3)
    expect(first.correct_questions).toBe(2)
    expect(first.accuracy).toBeCloseTo(66.7, 0)
    expect(first.never_started).toBe(false)
    expect(first.stalled_days).toBe(0)
    expect(first.is_active_7d).toBe(true)
    // A 关 2 道（1 对），B 关 1 道（1 对）
    expect(first.levels.A.answered).toBe(2)
    expect(first.levels.A.correct).toBe(1)
    expect(first.levels.B.answered).toBe(1)
    expect(first.levels.B.correct).toBe(1)
    expect(first.levels.C.answered).toBe(0)

    const untouched = students.find((s) => s.student_id === '20260102')
    expect(untouched.never_started).toBe(true)
    expect(untouched.answered_questions).toBe(0)
    expect(untouched.stalled_days).toBeNull()
    expect(untouched.is_active_7d).toBe(false)
  })

  it('keyword 过滤与按正确率倒序排列应生效', async () => {
    const filtered = await request(app)
      .get('/api/teacher/dashboard/students?keyword=20260101')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(filtered.body.data.students).toHaveLength(1)

    const sorted = await request(app)
      .get('/api/teacher/dashboard/students?sort=accuracy&order=desc')
      .set('Authorization', `Bearer ${teacherToken}`)
    const ids = sorted.body.data.students.map((s) => s.student_id)
    expect(ids[0]).toBe('20260101')
    expect(ids[1]).toBe('20260102')
  })

  it('非法 sort 应 400，超出范围的分页参数应 400', async () => {
    const badSort = await request(app)
      .get('/api/teacher/dashboard/students?sort=password_hash')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(badSort.status).toBe(400)

    const badPage = await request(app)
      .get('/api/teacher/dashboard/students?page_size=5000')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(badPage.status).toBe(400)
  })
})

describe('教师看板：篇目矩阵与薄弱题', () => {
  it('矩阵每行对应一篇文言文，单元格含开始/完成人数与色深', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/texts')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const { classes, rows } = res.body.data
    expect(classes).toEqual(['202601'])
    expect(rows).toHaveLength(inventory.buildInventory().texts.length)

    const wen = inventory.buildInventory(true).texts[0]
    const row = rows.find((r) => r.wen_id === wen.wen_id)
    expect(row.title).toBe(wen.title)
    expect(row.total_questions).toBe(wen.total)
    const cell = row.cells[0]
    expect(cell.student_count).toBe(2)
    expect(cell.answered_students).toBe(1)
    // 3 题 < 该篇总题量 → 没有学生完成整篇
    expect(cell.completed_students).toBe(0)
    expect(cell.started_rate).toBeCloseTo(50, 1)
    expect(cell.accuracy).toBeCloseTo(66.7, 0)
    expect(cell.avg_progress).toBeGreaterThan(0)
    expect(cell.avg_progress).toBeLessThan(100)
  })

  it('薄弱题按答对率升序，并给出错误选项分布', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/weak-questions?min_students=1&limit=5')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const wen = inventory.buildInventory(true).texts[0].wen_id
    const questions = res.body.data.questions
    expect(questions.length).toBeGreaterThan(0)
    const weakest = questions.find((item) => item.question_id === `${wen}_A2`)
    expect(weakest).toBeTruthy()
    expect(weakest.attempted_students).toBe(1)
    expect(weakest.correct_students).toBe(0)
    expect(weakest.accuracy).toBe(0)
    expect(weakest.level).toBe('A')
    expect(weakest.top_wrong_answers[0]).toEqual({ answer: 'B', count: 1 })
    // 升序：最弱的排在答对率 100 的题之前
    expect(questions[0].accuracy).toBeLessThanOrEqual(questions[questions.length - 1].accuracy)
  })

  it('min_students 过滤掉覆盖不足的题，越权班级应 403', async () => {
    const filtered = await request(app)
      .get('/api/teacher/dashboard/weak-questions?min_students=5')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(filtered.body.data.questions).toEqual([])

    const forbidden = await request(app)
      .get('/api/teacher/dashboard/weak-questions?class_code=202602')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(forbidden.status).toBe(403)
  })
})

describe('教师看板：活跃趋势', () => {
  it('按日趋势补齐空日，小时分布总量与窗口内提交数一致', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/activity?days=7')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const { daily, hourly, totals } = res.body.data
    expect(daily).toHaveLength(7)
    expect(totals.submissions).toBe(4)
    expect(daily.reduce((sum, d) => sum + d.submissions, 0)).toBe(4)
    expect(hourly).toHaveLength(24)
    expect(hourly.reduce((sum, h) => sum + h.submissions, 0)).toBe(4)
    expect(totals.peak_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('非法 days 应 400', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard/activity?days=0')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(400)
  })
})
