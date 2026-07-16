const jwt = require('jsonwebtoken')
const config = require('../config/app')
const { db } = require('../config/database')
const { verifyPassword, hashPassword, hashDefaultPassword } = require('../utils/password')
const { dbGet, dbRun } = require('../utils/dbPromise')

const JWT_SECRET = config.jwt.secret
const JWT_EXPIRES_IN = config.jwt.expiresIn || '7d'

// ============================================================
// 学生登录
// ============================================================
async function studentLogin(req, res) {
  try {
    const { student_id, password } = req.body

    if (!student_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '学号和密码是必填字段',
      })
    }

    if (!/^\d{8}$/.test(student_id)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '学号必须为8位数字',
      })
    }

    const student = await dbGet(
      db,
      'SELECT id, student_id, student_name, password_hash, password_changed FROM students WHERE student_id = ?',
      [student_id]
    )

    if (!student) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_FAILED',
        message: '学号或密码错误',
      })
    }

    const valid = await verifyPassword(password, student.password_hash)
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_FAILED',
        message: '学号或密码错误',
      })
    }

    const token = jwt.sign(
      {
        id: student.id,
        student_id: student.student_id,
        name: student.student_name,
        role: 'student',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: student.id,
          student_id: student.student_id,
          name: student.student_name,
          role: 'student',
          password_changed: !!student.password_changed,
        },
      },
    })
  } catch (err) {
    console.error('学生登录失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

// ============================================================
// 教师登录
// ============================================================
async function teacherLogin(req, res) {
  try {
    const { phone, password } = req.body

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '手机号和密码是必填字段',
      })
    }

    const teacher = await dbGet(
      db,
      'SELECT id, name, phone, school, classes, password_hash, password_changed, role FROM teachers WHERE phone = ?',
      [phone]
    )

    if (!teacher) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_FAILED',
        message: '手机号或密码错误',
      })
    }

    const valid = await verifyPassword(password, teacher.password_hash)
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_FAILED',
        message: '手机号或密码错误',
      })
    }

    const token = jwt.sign(
      {
        id: teacher.id,
        phone: teacher.phone,
        name: teacher.name,
        role: teacher.role || 'teacher',
        classes: JSON.parse(teacher.classes || '[]'),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: teacher.id,
          phone: teacher.phone,
          name: teacher.name,
          school: teacher.school,
          classes: JSON.parse(teacher.classes || '[]'),
          role: teacher.role || 'teacher',
          password_changed: !!teacher.password_changed,
        },
      },
    })
  } catch (err) {
    console.error('教师登录失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

// ============================================================
// 教师注册
// ============================================================
async function teacherRegister(req, res) {
  try {
    const { name, phone, school, classes, password } = req.body

    if (!name || !phone || !classes || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '姓名、手机号、所教班级和密码是必填字段',
      })
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '手机号格式不正确',
      })
    }

    // 验证班级格式（6位数字数组）
    let classList = classes
    if (typeof classes === 'string') {
      try { classList = JSON.parse(classes) } catch { classList = [classes] }
    }
    if (!Array.isArray(classList) || classList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '至少选择一个班级',
      })
    }
    for (const cls of classList) {
      if (!/^\d{6}$/.test(String(cls))) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `班级格式错误：${cls}，应为6位数字（如202409）`,
        })
      }
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '密码长度至少6位',
      })
    }

    // 检查手机号是否已注册
    const existing = await dbGet(db, 'SELECT id FROM teachers WHERE phone = ?', [phone])
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_PHONE',
        message: '该手机号已被注册',
      })
    }

    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    const result = await dbRun(
      db,
      `INSERT INTO teachers (name, phone, school, classes, password_hash, password_changed, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, school || null, JSON.stringify(classList), passwordHash, 1, 'teacher', now, now]
    )

    const token = jwt.sign(
      {
        id: result.lastID,
        phone,
        name,
        role: 'teacher',
        classes: classList,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: result.lastID,
          phone,
          name,
          school: school || null,
          classes: classList,
          role: 'teacher',
          password_changed: true,
        },
      },
    })
  } catch (err) {
    console.error('教师注册失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

// ============================================================
// 修改密码（通用，学生/教师均可）
// ============================================================
async function changePassword(req, res) {
  try {
    const { old_password, new_password, confirm_password } = req.body
    const user = req.user

    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '原密码、新密码和确认密码均为必填',
      })
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '两次输入的新密码不一致',
      })
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '新密码长度至少6位',
      })
    }

    let table, idField, nameField
    if (user.role === 'student') {
      table = 'students'
      idField = 'student_id'
      nameField = 'student_name'
    } else {
      table = 'teachers'
      idField = 'phone'
      nameField = 'phone'
    }

    const record = await dbGet(
      db,
      `SELECT password_hash FROM ${table} WHERE ${user.role === 'student' ? 'student_id' : 'phone'} = ?`,
      [user.role === 'student' ? user.student_id : user.phone]
    )

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '用户不存在',
      })
    }

    const valid = await verifyPassword(old_password, record.password_hash)
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_FAILED',
        message: '原密码错误',
      })
    }

    const newHash = await hashPassword(new_password)
    const now = new Date().toISOString()

    await dbRun(
      db,
      `UPDATE ${table} SET password_hash = ?, password_changed = ?, updated_at = ? WHERE ${user.role === 'student' ? 'student_id' : 'phone'} = ?`,
      [newHash, 1, now, user.role === 'student' ? user.student_id : user.phone]
    )

    res.status(200).json({
      success: true,
      message: '密码修改成功',
    })
  } catch (err) {
    console.error('修改密码失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

// ============================================================
// 教师重置学生密码
// ============================================================
async function resetStudentPassword(req, res) {
  try {
    const { student_id } = req.body
    const teacher = req.user

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    if (!student_id) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '学号是必填字段',
      })
    }

    // 教师只能重置自己所教班级的学生
    if (teacher.role === 'teacher') {
      const studentPrefix = String(student_id).substring(0, 6)
      const teacherClasses = teacher.classes || []
      if (!teacherClasses.includes(studentPrefix)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '您没有教授此班级',
        })
      }
    }

    const defaultHash = await hashDefaultPassword()
    const now = new Date().toISOString()

    const result = await dbRun(
      db,
      'UPDATE students SET password_hash = ?, password_changed = ?, updated_at = ? WHERE student_id = ?',
      [defaultHash, 0, now, student_id]
    )

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '学生不存在',
      })
    }

    res.status(200).json({
      success: true,
      message: '密码已重置为 123456',
    })
  } catch (err) {
    console.error('重置学生密码失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

// ============================================================
// 管理员重置教师密码
// ============================================================
async function resetTeacherPassword(req, res) {
  try {
    const { phone } = req.body
    const admin = req.user

    if (admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '手机号是必填字段',
      })
    }

    const defaultHash = await hashDefaultPassword()
    const now = new Date().toISOString()

    const result = await dbRun(
      db,
      'UPDATE teachers SET password_hash = ?, password_changed = ?, updated_at = ? WHERE phone = ? AND role != ?',
      [defaultHash, 0, now, phone, 'admin']
    )

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '教师不存在或为管理员账号',
      })
    }

    res.status(200).json({
      success: true,
      message: '密码已重置为 123456',
    })
  } catch (err) {
    console.error('重置教师密码失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

// ============================================================
// 获取当前登录用户信息
// ============================================================
async function getMe(req, res) {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: '需要登录',
      })
    }

    if (user.role === 'student') {
      const student = await dbGet(
        db,
        'SELECT id, student_id, student_name, password_changed FROM students WHERE student_id = ?',
        [user.student_id]
      )
      if (!student) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
      }
      return res.status(200).json({
        success: true,
        data: {
          id: student.id,
          student_id: student.student_id,
          name: student.student_name,
          role: 'student',
          password_changed: !!student.password_changed,
        },
      })
    }

    const teacher = await dbGet(
      db,
      'SELECT id, name, phone, school, classes, role, password_changed FROM teachers WHERE phone = ?',
      [user.phone]
    )
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
    }
    return res.status(200).json({
      success: true,
      data: {
        id: teacher.id,
        phone: teacher.phone,
        name: teacher.name,
        school: teacher.school,
        classes: JSON.parse(teacher.classes || '[]'),
        role: teacher.role,
        password_changed: !!teacher.password_changed,
      },
    })
  } catch (err) {
    console.error('获取用户信息失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

// ============================================================
// 兼容旧登录（仅学号，无密码）— 保留一段时间做兼容
// ============================================================
function legacyLogin(req, res) {
  try {
    const { student_id } = req.body

    if (!student_id) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'student_id 是必填字段',
      })
    }

    const token = jwt.sign(
      { student_id, role: 'student' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: student_id,
          student_id,
          role: 'student',
        },
      },
    })
  } catch (err) {
    console.error('登录失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

module.exports = {
  studentLogin,
  teacherLogin,
  teacherRegister,
  changePassword,
  resetStudentPassword,
  resetTeacherPassword,
  getMe,
  legacyLogin,
}
