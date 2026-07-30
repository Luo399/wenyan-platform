const { db } = require('../config/database')
const { dbGet, dbRun, dbAll } = require('../utils/dbPromise')
const {
  resetStudentPassword,
  resetTeacherPasswordByAdmin,
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
    console.error('[admin] 查教师列表失败:', err)
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
    let sql = `SELECT s.*, sch.name AS school_name
      FROM students s LEFT JOIN schools sch ON sch.id = s.school_id`
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY s.class_code ASC, s.student_id ASC LIMIT 10000'
    const rows = await dbAll(db, sql, params)
    res.status(200).json({ success: true, data: rows })
  } catch (err) {
    console.error('[admin] 查学生列表失败:', err)
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
    console.error('[admin] 重置学生密码失败:', err)
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
    console.error('[admin] 重置教师密码失败:', err)
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
    console.error('[admin] 更新教师状态失败:', err)
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
    console.error('[admin] 查重置日志失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

module.exports = {
  listTeachers,
  listStudents,
  resetStudent,
  resetTeacher,
  setTeacherStatus,
  listPasswordResets,
}
