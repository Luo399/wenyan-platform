const { db } = require('../config/database')
const { dbGet, dbRun, dbAll, dbTransaction } = require('../utils/dbPromise')
const logger = require('../utils/logger')
const {
  resetStudentPassword,
  resetTeacherPasswordByAdmin,
  hashPassword,
} = require('../services/authService')

/**
 * 管理员：列出所有教师（附带所教班级与所属学校）
 * GET /api/admin/teachers
 */
async function listTeachers(req, res) {
  try {
    const teachers = await dbAll(db, `SELECT t.id, t.phone, t.name, t.school_id, t.status,
      t.created_at, s.name AS school_name
      FROM teachers t
      LEFT JOIN schools s ON s.id = t.school_id
      ORDER BY t.created_at DESC`)
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
      message: '教师密码已重置，请将临时密码告知教师，首次登录后可自助改密',
      data: { temporary_password: r.temporaryPassword },
    })
  } catch (err) {
    logger.error('[admin] 重置教师密码失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '重置失败' })
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
      if (!/^\d{6}$/.test(cc)) {
        return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODE', message: `班级编码 ${cc} 不是 6 位数字` })
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

module.exports = {
  listTeachers,
  listStudents,
  resetStudent,
  resetTeacher,
  setTeacherStatus,
  listPasswordResets,
  createTeacher,
}
