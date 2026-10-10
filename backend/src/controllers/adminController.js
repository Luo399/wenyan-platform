const { db } = require('../config/database')
const { dbGet, dbRun, dbAll, dbTransaction } = require('../utils/dbPromise')
const logger = require('../utils/logger')
const {
  resetStudentPassword,
  resetTeacherPasswordByAdmin,
  hashPassword,
  getDefaultPasswordHash,
} = require('../services/authService')

// 统一格式正则
// 学号：严格 8 位纯数字
const STUDENT_ID_REGEX = /^\d{8}$/

// 班级编码：4 位年级 + 2 位班级序号（01-31）
const CLASS_CODE_REGEX = /^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/

// 安全：查询学生时剔除 password_hash（哈希不应暴露给前端）
const STUDENT_SAFE_COLUMNS =
  'id, student_id, student_name, class_code, school_id, must_reset_password, created_by, created_at, updated_at'

/**
 * 管理员：列出所有教师（附带所教班级与所属学校）
 * GET /api/admin/teachers
 */
async function listTeachers(req, res) {
  try {
    const { status } = req.query
    const conditions = []
    const params = []
    if (status && ['pending', 'active', 'disabled'].includes(status)) {
      conditions.push('t.status = ?')
      params.push(status)
    }
    let sql = `SELECT t.id, t.phone, t.name, t.school_id, t.status,
      t.created_at, s.name AS school_name
      FROM teachers t
      LEFT JOIN schools s ON s.id = t.school_id`
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY t.created_at DESC'
    const teachers = await dbAll(db, sql, params)
    // 附带班级信息
    for (const t of teachers) {
      const classes = await dbAll(
        db,
        `SELECT class_code FROM teacher_classes WHERE teacher_id = ?`,
        [t.id],
      )
      t.class_codes = classes.map((c) => c.class_code)
    }
    res.status(200).json({ success: true, data: teachers })
  } catch (err) {
    logger.error('[admin] 查教师列表失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * 管理员：列出所有学生（全量）
 * GET /api/admin/students?class_code=202409&school_id=1
 */
async function listStudents(req, res) {
  try {
    const { class_code, school_id } = req.query
    const conditions = []
    const params = []
    if (class_code) {
      conditions.push('class_code = ?')
      params.push(class_code)
    }
    if (school_id) {
      conditions.push('school_id = ?')
      params.push(school_id)
    }
    // 安全：剔除 password_hash（哈希不应暴露给前端）
    let sql = `SELECT s.id, s.student_id, s.student_name, s.class_code, s.school_id,
      s.must_reset_password, s.created_by, s.created_at, s.updated_at, sch.name AS school_name
      FROM students s LEFT JOIN schools sch ON sch.id = s.school_id`
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY s.class_code ASC, s.student_id ASC LIMIT 10000'
    const rows = await dbAll(db, sql, params)
    res.status(200).json({ success: true, data: rows })
  } catch (err) {
    logger.error('[admin] 查学生列表失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * 管理员重置学生密码 → 123456
 * POST /api/admin/students/:studentId/reset-password
 */
async function resetStudent(req, res) {
  try {
    const r = await resetStudentPassword(
      req.params.studentId,
      'admin',
      req.user.username,
    )
    if (!r.success) {
      if (r.reason === 'STUDENT_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
      }
      return res.status(500).json({ success: false, error: r.reason, message: '重置失败' })
    }
    res.status(200).json({
      success: true,
      message: '密码已重置为 123456',
      data: { temporary_password: '123456' },
    })
  } catch (err) {
    logger.error('[admin] 重置学生密码失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '重置失败' })
  }
}

/**
 * 管理员重置教师密码 → 10 位随机临时密码
 * POST /api/admin/teachers/:phone/reset-password
 */
async function resetTeacher(req, res) {
  try {
    const r = await resetTeacherPasswordByAdmin(req.params.phone, req.user.username)
    if (!r.success) {
      if (r.reason === 'TEACHER_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
      }
      return res.status(500).json({ success: false, error: r.reason, message: '重置失败' })
    }
    res.status(200).json({
      success: true,
      message: '教师密码已重置为 99999999',
      data: { temporary_password: r.temporaryPassword },
    })
  } catch (err) {
    logger.error('[admin] 重置教师密码失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '重置失败' })
  }
}

/**
 * 管理员：审批待注册教师（将 pending → active，强制首次登录改密）
 * POST /api/admin/teachers/:phone/approve
 */
async function approveTeacher(req, res) {
  try {
    const { phone } = req.params
    const teacher = await dbGet(db, `SELECT id, status FROM teachers WHERE phone = ?`, [phone])
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
    }
    if (teacher.status === 'active') {
      return res.status(400).json({ success: false, error: 'ALREADY_ACTIVE', message: '该教师已激活' })
    }
    await dbRun(db,
      `UPDATE teachers SET status = 'active', must_reset_password = 1, updated_at = ? WHERE phone = ?`,
      [new Date().toISOString(), phone])
    res.status(200).json({ success: true, message: '教师已审批通过，请告知教师首次登录后修改密码' })
  } catch (err) {
    logger.error('[admin] 审批教师失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '审批失败' })
  }
}

/**
 * 管理员：启用 / 禁用教师账号
 * POST /api/admin/teachers/:phone/status  { "status": "disabled" | "active" }
 */
async function setTeacherStatus(req, res) {
  try {
    const status = req.body.status
    if (status !== 'active' && status !== 'disabled') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'status 只能是 active 或 disabled',
      })
    }
    const info = await dbRun(db, `UPDATE teachers SET status = ?, updated_at = ? WHERE phone = ?`, [
      status,
      new Date().toISOString(),
      req.params.phone,
    ])
    if (!info || info.changes === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
    }
    res.status(200).json({ success: true, message: '教师状态已更新' })
  } catch (err) {
    logger.error('[admin] 更新教师状态失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '更新失败' })
  }
}

/**
 * 管理员：列出密码重置审计日志
 * GET /api/admin/password-resets?target_type=student&target_id=xxx
 */
async function listPasswordResets(req, res) {
  try {
    const { target_type, target_id } = req.query
    const conditions = []
    const params = []
    if (target_type) {
      conditions.push('target_type = ?')
      params.push(target_type)
    }
    if (target_id) {
      conditions.push('target_id = ?')
      params.push(target_id)
    }
    let sql = `SELECT * FROM password_resets`
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' ORDER BY reset_at DESC LIMIT 500'
    const rows = await dbAll(db, sql, params)
    res.status(200).json({ success: true, data: rows })
  } catch (err) {
    logger.error('[admin] 查重置日志失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * 管理员：创建教师账号（批量）
 * POST /api/admin/teachers  { phone, name, password, school_id, class_codes }
 *
 * 与公开注册接口的区别：
 * - 不校验手机号格式（允许非手机号用户名）
 * - 需要管理员登录鉴权
 */
async function createTeacher(req, res) {
  try {
    const { phone, name, password, school_id, class_codes } = req.body

    // 参数校验
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'INVALID_PHONE', message: '手机号/用户名必填' })
    }
    if (!name || typeof name !== 'string' || name.length > 20) {
      return res.status(400).json({ success: false, error: 'INVALID_NAME', message: '姓名必填，最长 20 字符' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'INVALID_PASSWORD', message: '密码长度不能少于 6 位' })
    }
    if (!school_id || typeof school_id !== 'number') {
      return res.status(400).json({ success: false, error: 'INVALID_SCHOOL', message: '学校 ID 必填且为数字' })
    }
    if (!Array.isArray(class_codes) || class_codes.length === 0) {
      return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODES', message: '至少选择一个所教班级（6 位数字编码）' })
    }
    for (const cc of class_codes) {
      if (!CLASS_CODE_REGEX.test(cc)) {
        return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODE', message: `班级编码 ${cc} 不是合法的 6 位编码（格式 YYYYCC，CC 范围 01-31）` })
      }
    }

    // 学校是否存在
    const school = await dbGet(db, 'SELECT id FROM schools WHERE id = ?', [school_id])
    if (!school) {
      return res.status(400).json({ success: false, error: 'SCHOOL_NOT_FOUND', message: '所选学校不存在' })
    }

    // 手机号是否已被占用
    const exists = await dbGet(db, 'SELECT 1 FROM teachers WHERE phone = ? LIMIT 1', [phone])
    if (exists) {
      return res.status(409).json({ success: false, error: 'PHONE_ALREADY_REGISTERED', message: '该手机号/用户名已注册' })
    }

    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    await dbTransaction(db, async ({ dbRun: txRun }) => {
      const result = await txRun(
        `INSERT INTO teachers (phone, name, school_id, password_hash, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        [phone, name, school_id, passwordHash, now, now],
      )
      const teacherId = result.lastID
      // 批量写入 teacher_classes（UNIQUE 约束防护）
      for (const cc of class_codes) {
        await txRun(
          `INSERT OR IGNORE INTO teacher_classes (teacher_id, class_code, created_at) VALUES (?, ?, ?)`,
          [teacherId, cc, now],
        )
      }
    })

    res.status(201).json({
      success: true,
      message: '教师账号创建成功',
      data: { phone, name },
    })
  } catch (err) {
    logger.error('[admin] 创建教师失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '创建教师失败' })
  }
}

/**
 * 管理员：查询单个教师（含所教班级）
 * GET /api/admin/teachers/:phone
 */
async function getTeacher(req, res) {
  try {
    const teacher = await dbGet(
      db,
      `SELECT t.id, t.phone, t.name, t.school_id, t.status, t.created_at, t.updated_at,
        s.name AS school_name
       FROM teachers t
       LEFT JOIN schools s ON s.id = t.school_id
       WHERE t.phone = ?`,
      [req.params.phone],
    )
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
    }
    const classes = await dbAll(
      db,
      `SELECT class_code FROM teacher_classes WHERE teacher_id = ?`,
      [teacher.id],
    )
    teacher.class_codes = classes.map((c) => c.class_code)
    res.status(200).json({ success: true, data: teacher })
  } catch (err) {
    logger.error('[admin] 查单个教师失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * 管理员：更新教师账号（姓名 / 学校 / 所教班级 / 状态）
 * PUT /api/admin/teachers/:phone  { name?, school_id?, class_codes?, status? }
 */
async function updateTeacher(req, res) {
  try {
    const { phone } = req.params
    const { name, school_id, class_codes, status } = req.body

    const teacher = await dbGet(db, 'SELECT id FROM teachers WHERE phone = ?', [phone])
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 20)) {
      return res.status(400).json({ success: false, error: 'INVALID_NAME', message: '姓名必填，最长 20 字符' })
    }
    if (status !== undefined && status !== 'active' && status !== 'disabled') {
      return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: 'status 只能是 active 或 disabled' })
    }
    if (school_id !== undefined) {
      const school = await dbGet(db, 'SELECT id FROM schools WHERE id = ?', [school_id])
      if (!school) {
        return res.status(400).json({ success: false, error: 'SCHOOL_NOT_FOUND', message: '所选学校不存在' })
      }
    }
    if (class_codes !== undefined) {
      if (!Array.isArray(class_codes) || class_codes.length === 0) {
        return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODES', message: '至少选择一个所教班级（6 位数字编码）' })
      }
      for (const cc of class_codes) {
        if (!CLASS_CODE_REGEX.test(cc)) {
          return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODE', message: `班级编码 ${cc} 不是合法的 6 位编码（格式 YYYYCC，CC 范围 01-31）` })
        }
      }
    }

    const now = new Date().toISOString()
    await dbTransaction(db, async ({ dbRun: txRun }) => {
      await txRun(
        `UPDATE teachers
         SET name = COALESCE(?, name),
             school_id = COALESCE(?, school_id),
             status = COALESCE(?, status),
             updated_at = ?
         WHERE phone = ?`,
        [name ?? null, school_id ?? null, status ?? null, now, phone],
      )
      if (class_codes !== undefined) {
        await txRun(`DELETE FROM teacher_classes WHERE teacher_id = ?`, [teacher.id])
        for (const cc of class_codes) {
          await txRun(
            `INSERT OR IGNORE INTO teacher_classes (teacher_id, class_code, created_at) VALUES (?, ?, ?)`,
            [teacher.id, cc, now],
          )
        }
      }
    })

    res.status(200).json({ success: true, message: '教师账号已更新' })
  } catch (err) {
    logger.error('[admin] 更新教师失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '更新失败' })
  }
}

/**
 * 管理员：删除教师账号（同时清理所教班级关系）
 * DELETE /api/admin/teachers/:phone
 */
async function deleteTeacher(req, res) {
  try {
    const { phone } = req.params
    const teacher = await dbGet(db, 'SELECT id FROM teachers WHERE phone = ?', [phone])
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
    }
    await dbTransaction(db, async ({ dbRun: txRun }) => {
      await txRun(`DELETE FROM teacher_classes WHERE teacher_id = ?`, [teacher.id])
      await txRun(`DELETE FROM teachers WHERE id = ?`, [teacher.id])
    })
    res.status(200).json({ success: true, message: '教师账号已删除' })
  } catch (err) {
    logger.error('[admin] 删除教师失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '删除失败' })
  }
}

/**
 * 管理员：查询单个学生
 * GET /api/admin/students/:studentId
 */
async function getStudent(req, res) {
  try {
    const student = await dbGet(
      db,
      `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_id = ?`,
      [req.params.studentId],
    )
    if (!student) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    res.status(200).json({ success: true, data: student })
  } catch (err) {
    logger.error('[admin] 查单个学生失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * 管理员：新增学生账号（初始密码 123456）
 * POST /api/admin/students  { student_id, student_name, class_code }
 */
async function createStudent(req, res) {
  try {
    const { student_id, student_name, class_code } = req.body
    if (!student_id || typeof student_id !== 'string' || !STUDENT_ID_REGEX.test(student_id)) {
      return res.status(400).json({ success: false, error: 'INVALID_STUDENT_ID', message: '学号必须为 8 位纯数字（格式 YYYYNNNN）' })
    }
    if (!student_name || typeof student_name !== 'string' || student_name.length > 20) {
      return res.status(400).json({ success: false, error: 'INVALID_NAME', message: '姓名必填，最长 20 字符' })
    }
    const finalClassCode = class_code || student_id.slice(0, 6)
    if (!CLASS_CODE_REGEX.test(String(finalClassCode))) {
      return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODE', message: '班级编码必须为合法的 6 位编码（格式 YYYYCC，CC 范围 01-31）' })
    }

    const exists = await dbGet(db, 'SELECT 1 FROM students WHERE student_id = ? LIMIT 1', [student_id])
    if (exists) {
      return res.status(409).json({ success: false, error: 'STUDENT_ID_EXISTS', message: '该学号已存在' })
    }

    const now = new Date().toISOString()
    const passwordHash = await getDefaultPasswordHash()
    await dbRun(
      db,
      `INSERT INTO students
        (student_id, student_name, class_code, school_id, password_hash,
         must_reset_password, created_by, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, 1, ?, ?, ?)`,
      [student_id, student_name, String(finalClassCode), passwordHash, 'admin:' + req.user.username, now, now],
    )

    res.status(201).json({
      success: true,
      message: '学生账号创建成功，初始密码 123456',
      data: { student_id, class_code: String(finalClassCode), initial_password: '123456' },
    })
  } catch (err) {
    logger.error('[admin] 创建学生失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '创建学生失败' })
  }
}

/**
 * 管理员：更新学生信息（姓名 / 班级 / 学校）
 * PUT /api/admin/students/:studentId  { student_name?, class_code?, school_id? }
 */
async function updateStudent(req, res) {
  try {
    const { studentId } = req.params
    const { student_name, class_code, school_id } = req.body

    const student = await dbGet(db, `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_id = ?`, [studentId])
    if (!student) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    if (student_name !== undefined && (typeof student_name !== 'string' || !student_name.trim() || student_name.length > 20)) {
      return res.status(400).json({ success: false, error: 'INVALID_NAME', message: '姓名必填，最长 20 字符' })
    }
    if (class_code !== undefined && !CLASS_CODE_REGEX.test(String(class_code))) {
      return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODE', message: '班级编码必须为合法的 6 位编码（格式 YYYYCC，CC 范围 01-31）' })
    }
    if (school_id !== undefined && school_id !== null) {
      const school = await dbGet(db, 'SELECT id FROM schools WHERE id = ?', [school_id])
      if (!school) {
        return res.status(400).json({ success: false, error: 'SCHOOL_NOT_FOUND', message: '所选学校不存在' })
      }
    }

    await dbRun(
      db,
      `UPDATE students
       SET student_name = COALESCE(?, student_name),
           class_code = COALESCE(?, class_code),
           school_id = COALESCE(?, school_id),
           updated_at = ?
       WHERE student_id = ?`,
      [student_name ?? null, class_code ?? null, school_id ?? null, new Date().toISOString(), studentId],
    )
    res.status(200).json({ success: true, message: '学生信息已更新' })
  } catch (err) {
    logger.error('[admin] 更新学生失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '更新失败' })
  }
}

/**
 * 管理员：删除学生账号
 * DELETE /api/admin/students/:studentId
 */
async function deleteStudent(req, res) {
  try {
    const info = await dbRun(db, 'DELETE FROM students WHERE student_id = ?', [req.params.studentId])
    if (!info || info.changes === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    res.status(200).json({ success: true, message: '学生账号已删除' })
  } catch (err) {
    logger.error('[admin] 删除学生失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '删除失败' })
  }
}

module.exports = {
  listTeachers,
  getTeacher,
  updateTeacher,
  deleteTeacher,
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudent,
  resetTeacher,
  setTeacherStatus,
  approveTeacher,
  listPasswordResets,
  createTeacher,
}
