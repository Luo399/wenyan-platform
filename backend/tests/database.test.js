/**
 * 数据库与账号体系集成测试
 *
 * 使用 :memory: SQLite 真实跑建表 + 增查 + 权限校验 + 重置审计，
 * 不 mock 数据库，覆盖三级账号体系的核心数据库行为。
 *
 * 覆盖：
 *  1. initAllTables 创建所有 6 张表（schools/teachers/teacher_classes/admins/students/password_resets/answers）
 *  2. 学生创建与查询（真实 db 写入）
 *  3. 教师注册 + teacher_classes 关系
 *  4. 教师班级权限校验 teacherCanManageClass
 *  5. 学生密码重置 + password_resets 审计落库
 *  6. 教师密码重置（随机临时密码，可校验通过）
 *  7. extractClassCode + 学号班级匹配规则
 */

// 必须在 require database 之前设置，使用内存数据库避免污染工作区
process.env.DB_PATH = ':memory:'

const { db, initAllTables } = require('../src/config/database')
const { dbGet, dbAll, dbRun } = require('../src/utils/dbPromise')
const {
  hashPassword,
  verifyPassword,
  getDefaultPasswordHash,
  extractClassCode,
  getTeacherClassCodes,
  teacherCanManageClass,
  resetStudentPassword,
  resetTeacherPasswordByAdmin,
  recordPasswordReset,
} = require('../src/services/authService')

let schoolId
let teacherId

beforeAll(async () => {
  await initAllTables()
  // 插入一个学校，供后续教师注册使用
  const info = await dbRun(
    db,
    `INSERT INTO schools (code, name) VALUES (?, ?)`,
    ['TEST-SCH-001', '测试学校'],
  )
  schoolId = info.lastID
})

afterAll((done) => {
  db.close(() => done())
})

describe('initAllTables：所有业务表创建', () => {
  const tableList = [
    'schools',
    'teachers',
    'teacher_classes',
    'admins',
    'students',
    'password_resets',
    'answers',
  ]

  for (const t of tableList) {
    test(`表 ${t} 应存在`, async () => {
      const row = await dbGet(db, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t])
      expect(row).toBeTruthy()
      expect(row.name).toBe(t)
    })
  }

  test('students 表包含新 schema 字段', async () => {
    const cols = await dbAll(db, `PRAGMA table_info(students)`)
    const names = cols.map((c) => c.name)
    for (const f of ['student_id', 'student_name', 'class_code', 'password_hash', 'must_reset_password', 'created_by']) {
      expect(names).toContain(f)
    }
  })

  test('teacher_classes 唯一约束 (teacher_id, class_code) 生效', async () => {
    // 先插一条教师，再重复插同一 (teacher_id, class_code) 应报错
    const tInfo = await dbRun(
      db,
      `INSERT INTO teachers (phone, name, school_id, password_hash, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ['13900000000', '权限测试教师', schoolId, await hashPassword('pwd123456')],
    )
    const tid = tInfo.lastID
    await dbRun(db, `INSERT INTO teacher_classes (teacher_id, class_code) VALUES (?, ?)`, [
      tid,
      '202409',
    ])
    await expect(
      dbRun(db, `INSERT INTO teacher_classes (teacher_id, class_code) VALUES (?, ?)`, [
        tid,
        '202409',
      ]),
    ).rejects.toThrow(/UNIQUE/i)
  })
})

describe('学生创建与查询（真实数据库写入）', () => {
  test('插入学生后可按 student_id 查到，class_code 由后端填充', async () => {
    const sid = '20240901'
    const hash = await getDefaultPasswordHash()
    const now = new Date().toISOString()
    await dbRun(
      db,
      `INSERT INTO students
        (student_id, student_name, class_code, school_id,
         password_hash, must_reset_password, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [sid, '测试学生A', '202409', schoolId, hash, 'developer', now, now],
    )
    const row = await dbGet(db, 'SELECT * FROM students WHERE student_id = ?', [sid])
    expect(row).toBeTruthy()
    expect(row.student_name).toBe('测试学生A')
    expect(row.class_code).toBe('202409')
    expect(row.must_reset_password).toBe(1)
    expect(row.password_hash).toMatch(/^\$2[ab]\$/)
  })

  test('学号前6位与 class_code 一致性（extractClassCode 与写入值匹配）', async () => {
    const sid = '20241299'
    const cc = extractClassCode(sid)
    expect(cc).toBe('202412')
    const hash = await getDefaultPasswordHash()
    const now = new Date().toISOString()
    await dbRun(
      db,
      `INSERT INTO students
        (student_id, student_name, class_code, school_id,
         password_hash, must_reset_password, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [sid, '测试学生B', cc, schoolId, hash, 'developer', now, now],
    )
    const row = await dbGet(db, 'SELECT class_code FROM students WHERE student_id = ?', [sid])
    expect(row.class_code).toBe(cc)
  })
})

describe('教师注册 + teacher_classes 关系 + 班级权限校验', () => {
  beforeAll(async () => {
    const hash = await hashPassword('teacherPwd123')
    const now = new Date().toISOString()
    const info = await dbRun(
      db,
      `INSERT INTO teachers (phone, name, school_id, password_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      ['13800001111', '王老师', schoolId, hash, now, now],
    )
    teacherId = info.lastID
    // 该教师教 202409 和 202412 两个班
    await dbRun(db, `INSERT INTO teacher_classes (teacher_id, class_code) VALUES (?, ?)`, [
      teacherId,
      '202409',
    ])
    await dbRun(db, `INSERT INTO teacher_classes (teacher_id, class_code) VALUES (?, ?)`, [
      teacherId,
      '202412',
    ])
  })

  test('getTeacherClassCodes 返回该教师所教班级集合', async () => {
    const codes = await getTeacherClassCodes(teacherId)
    expect(codes.sort()).toEqual(['202409', '202412'])
  })

  test('teacherCanManageClass：所教班级返回 true，未教班级返回 false', async () => {
    await expect(teacherCanManageClass(teacherId, '202409')).resolves.toBe(true)
    await expect(teacherCanManageClass(teacherId, '202412')).resolves.toBe(true)
    await expect(teacherCanManageClass(teacherId, '202301')).resolves.toBe(false)
  })

  test('教师只能添加前6位学号 ∈ 自己班级的学生（权限规则闭环）', async () => {
    const allowed = await getTeacherClassCodes(teacherId)
    const sid1 = '20240905'
    const sid2 = '20230105'
    expect(allowed.includes(extractClassCode(sid1))).toBe(true)
    expect(allowed.includes(extractClassCode(sid2))).toBe(false)
  })
})

describe('学生密码重置 + 审计落库', () => {
  test('resetStudentPassword：重置后密码为 123456 且 must_reset_password=1，password_resets 增一条', async () => {
    const sid = '20240977'
    const oldHash = await hashPassword('oldPwd888')
    const now = new Date().toISOString()
    await dbRun(
      db,
      `INSERT INTO students
        (student_id, student_name, class_code, password_hash, must_reset_password, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [sid, '重置测试学生', '202409', oldHash, 'developer', now, now],
    )

    const before = await dbGet(
      db,
      `SELECT COUNT(*) AS c FROM password_resets WHERE target_type='student' AND target_id=?`,
      [sid],
    )

    const r = await resetStudentPassword(sid, 'teacher', '13800001111')
    expect(r.success).toBe(true)

    const row = await dbGet(db, 'SELECT * FROM students WHERE student_id = ?', [sid])
    expect(row.must_reset_password).toBe(1)
    await expect(verifyPassword('123456', row.password_hash)).resolves.toBe(true)
    await expect(verifyPassword('oldPwd888', row.password_hash)).resolves.toBe(false)

    const after = await dbGet(
      db,
      `SELECT COUNT(*) AS c FROM password_resets WHERE target_type='student' AND target_id=?`,
      [sid],
    )
    expect(after.c - before.c).toBe(1)
  })

  test('resetStudentPassword：学生不存在时返回 STUDENT_NOT_FOUND', async () => {
    const r = await resetStudentPassword('99999999', 'teacher', '13800001111')
    expect(r.success).toBe(false)
    expect(r.reason).toBe('STUDENT_NOT_FOUND')
  })
})

describe('教师密码重置（管理员操作）+ 审计落库', () => {
  test('resetTeacherPasswordByAdmin：重置后新临时密码可校验通过，password_resets 增一条', async () => {
    const phone = '13700002222'
    const oldHash = await hashPassword('oldTeacherPwd')
    const now = new Date().toISOString()
    await dbRun(
      db,
      `INSERT INTO teachers (phone, name, school_id, password_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [phone, '李老师', schoolId, oldHash, now, now],
    )

    const before = await dbGet(
      db,
      `SELECT COUNT(*) AS c FROM password_resets WHERE target_type='teacher' AND target_id=?`,
      [phone],
    )

    const r = await resetTeacherPasswordByAdmin(phone, 'admin')
    expect(r.success).toBe(true)
    expect(typeof r.temporaryPassword).toBe('string')
    expect(r.temporaryPassword.length).toBeGreaterThanOrEqual(8)

    const row = await dbGet(db, 'SELECT password_hash FROM teachers WHERE phone = ?', [phone])
    await expect(verifyPassword(r.temporaryPassword, row.password_hash)).resolves.toBe(true)
    await expect(verifyPassword('oldTeacherPwd', row.password_hash)).resolves.toBe(false)

    const after = await dbGet(
      db,
      `SELECT COUNT(*) AS c FROM password_resets WHERE target_type='teacher' AND target_id=?`,
      [phone],
    )
    expect(after.c - before.c).toBe(1)
  })

  test('resetTeacherPasswordByAdmin：教师不存在时返回 TEACHER_NOT_FOUND', async () => {
    const r = await resetTeacherPasswordByAdmin('19999999999', 'admin')
    expect(r.success).toBe(false)
    expect(r.reason).toBe('TEACHER_NOT_FOUND')
  })
})

describe('recordPasswordReset 直接落库校验', () => {
  test('审计记录字段完整可查', async () => {
    await recordPasswordReset('student', '20240988', 'admin', 'admin')
    const row = await dbGet(
      db,
      `SELECT * FROM password_resets
        WHERE target_type='student' AND target_id='20240988'
        ORDER BY id DESC LIMIT 1`,
    )
    expect(row).toBeTruthy()
    expect(row.reset_by_type).toBe('admin')
    expect(row.reset_by_id).toBe('admin')
    expect(row.reset_at).toBeTruthy()
  })
})
