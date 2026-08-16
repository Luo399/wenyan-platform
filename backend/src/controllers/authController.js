const jwt = require('jsonwebtoken')
const { z } = require('zod')
const config = require('../config/app')
const { db } = require('../config/database')
const { dbGet, dbRun, dbAll, dbTransaction } = require('../utils/dbPromise')
const logger = require('../utils/logger')
const {
  hashPassword,
  verifyPassword,
  getDefaultPasswordHash,
  extractClassCode,
} = require('../services/authService')

/**
 * 生成统一格式的 JWT
 * @param {object} payload  自定义字段，必须包含 role
 */
function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
}

// ===== Zod 参数校验 Schema =====
const studentLoginSchema = z.object({
  student_id: z
    .string()
    .regex(/^\d+$/, '学号必须为纯数字')
    .min(4, '学号长度不能少于 4 位'),
  password: z.string().min(1, '密码必填'),
})

const teacherRegisterSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  name: z.string().min(1, '姓名必填').max(20, '姓名长度不能超过 20'),
  school_id: z.number().int().positive('请选择学校'),
  password: z.string().min(6, '密码长度不能少于 6 位'),
  class_codes: z
    .array(z.string().regex(/^\d{6}$/, '班级编码必须为 6 位数字'))
    .min(1, '至少选择一个所教班级'),
})

const teacherLoginSchema = z.object({
  phone: z.string().min(1, '手机号/用户名必填'),
  password: z.string().min(1, '密码必填'),
})

const adminLoginSchema = z.object({
  username: z.string().min(1, '用户名必填'),
  password: z.string().min(1, '密码必填'),
})

const changePasswordSchema = z.object({
  old_password: z.string().min(1, '原密码必填'),
  new_password: z.string().min(6, '新密码长度不能少于 6 位'),
})

// ===== 各角色登录 =====

async function studentLogin(req, res) {
  try {
    const body = studentLoginSchema.parse(req.body)
    const student = await dbGet(db, 'SELECT * FROM students WHERE student_id = ?', [
      body.student_id,
    ])
    if (!student) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '学号或密码错误',
      })
    }
    const ok = await verifyPassword(body.password, student.password_hash)
    if (!ok) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '学号或密码错误',
      })
    }
    const token = signToken({
      role: 'student',
      student_id: student.student_id,
    })
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: student.student_id,
          username: student.student_id,
          student_id: student.student_id,
          student_name: student.student_name,
          class_code: student.class_code,
          must_reset_password: !!student.must_reset_password,
          role: 'student',
        },
      },
    })
  } catch (err) {
    return handleAuthError(res, err, '学生登录失败')
  }
}

async function teacherRegister(req, res) {
  try {
    const body = teacherRegisterSchema.parse(req.body)

    // 学校是否存在
    const school = await dbGet(db, 'SELECT id FROM schools WHERE id = ?', [body.school_id])
    if (!school) {
      return res.status(400).json({
        success: false,
        error: 'SCHOOL_NOT_FOUND',
        message: '所选学校不存在',
      })
    }
    // 手机号是否已被占用
    const exists = await dbGet(db, 'SELECT 1 FROM teachers WHERE phone = ? LIMIT 1', [
      body.phone,
    ])
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'PHONE_ALREADY_REGISTERED',
        message: '该手机号已注册',
      })
    }

    const passwordHash = await hashPassword(body.password)
    const now = new Date().toISOString()

    await dbTransaction(db, async ({ dbRun }) => {
      const result = await dbRun(
        `INSERT INTO teachers (phone, name, school_id, password_hash, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        [body.phone, body.name, body.school_id, passwordHash, now, now],
      )
      const teacherId = result.lastID
      // 批量写 teacher_classes（UNIQUE 冲突由表约束防护，但这里按幂等处理）
      const classStmt = await new Promise((resolve, reject) => {
        const s = db.prepare(
          `INSERT OR IGNORE INTO teacher_classes (teacher_id, class_code, created_at)
           VALUES (?, ?, ?)`,
          (e) => (e ? reject(e) : resolve(s)),
        )
      })
      for (const cc of body.class_codes) {
        await new Promise((resolve, reject) =>
          classStmt.run([teacherId, cc, now], (e) => (e ? reject(e) : resolve())),
        )
      }
      await new Promise((resolve, reject) =>
        classStmt.finalize((e) => (e ? reject(e) : resolve())),
      )
    })

    // 注册成功直接给 token，让教师进入工作台
    const token = signToken({ role: 'teacher', phone: body.phone })
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: body.phone,
          username: body.phone,
          phone: body.phone,
          name: body.name,
          school_id: body.school_id,
          class_codes: body.class_codes,
          role: 'teacher',
        },
      },
    })
  } catch (err) {
    return handleAuthError(res, err, '教师注册失败')
  }
}

async function teacherLogin(req, res) {
  try {
    const body = teacherLoginSchema.parse(req.body)
    const teacher = await dbGet(db, 'SELECT * FROM teachers WHERE phone = ?', [body.phone])
    if (!teacher) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '手机号或密码错误',
      })
    }
    if (teacher.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: '账号已被禁用',
      })
    }
    const ok = await verifyPassword(body.password, teacher.password_hash)
    if (!ok) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '手机号或密码错误',
      })
    }
    // 记录最后登录时间
    await dbRun(db, `UPDATE teachers SET updated_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      teacher.id,
    ])
    const classCodes = await dbAll(
      db,
      `SELECT class_code FROM teacher_classes WHERE teacher_id = ?`,
      [teacher.id],
    ).then((rows) => rows.map((r) => r.class_code))

    const token = signToken({
      role: 'teacher',
      phone: teacher.phone,
    })
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: teacher.phone,
          username: teacher.phone,
          phone: teacher.phone,
          name: teacher.name,
          school_id: teacher.school_id,
          class_codes: classCodes,
          role: 'teacher',
        },
      },
    })
  } catch (err) {
    return handleAuthError(res, err, '教师登录失败')
  }
}

async function adminLogin(req, res) {
  try {
    const body = adminLoginSchema.parse(req.body)
    const admin = await dbGet(db, 'SELECT * FROM admins WHERE username = ?', [body.username])
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      })
    }
    const ok = await verifyPassword(body.password, admin.password_hash)
    if (!ok) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      })
    }
    await dbRun(db, `UPDATE admins SET last_login_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      admin.id,
    ])
    const token = signToken({
      role: admin.role || 'admin',
      username: admin.username,
    })
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: admin.username,
          username: admin.username,
          name: admin.name,
          role: admin.role || 'admin',
        },
      },
    })
  } catch (err) {
    return handleAuthError(res, err, '管理员登录失败')
  }
}

// ===== 自助改密 =====

/**
 * 登录态自己修改自己密码
 * 支持 student / teacher / admin 三个角色
 */
async function changePassword(req, res) {
  try {
    const body = changePasswordSchema.parse(req.body)
    const user = req.user
    if (!user || !user.role) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }

    let row = null
    let idKey = null
    let idValue = null
    let tableName = null

    switch (user.role) {
      case 'student':
        row = await dbGet(db, `SELECT * FROM students WHERE student_id = ?`, [user.student_id])
        idKey = 'student_id'
        idValue = user.student_id
        tableName = 'students'
        break
      case 'teacher':
        row = await dbGet(db, `SELECT * FROM teachers WHERE phone = ?`, [user.phone])
        idKey = 'phone'
        idValue = user.phone
        tableName = 'teachers'
        break
      case 'admin':
      case 'super_admin':
        row = await dbGet(db, `SELECT * FROM admins WHERE username = ?`, [user.username])
        idKey = 'username'
        idValue = user.username
        tableName = 'admins'
        break
      default:
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: '未知角色' })
    }

    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: '账号不存在',
      })
    }

    const match = await verifyPassword(body.old_password, row.password_hash)
    if (!match) {
      return res.status(400).json({
        success: false,
        error: 'OLD_PASSWORD_WRONG',
        message: '原密码错误',
      })
    }

    const newHash = await hashPassword(body.new_password)
    const now = new Date().toISOString()

    // 学生改密后，解除首次登录强制改密标记
    if (user.role === 'student') {
      await dbRun(
        db,
        `UPDATE students SET password_hash = ?, must_reset_password = 0, updated_at = ? WHERE student_id = ?`,
        [newHash, now, idValue],
      )
    } else {
      await dbRun(
        db,
        `UPDATE ${tableName} SET password_hash = ?, updated_at = ? WHERE ${idKey} = ?`,
        [newHash, now, idValue],
      )
    }

    res.status(200).json({ success: true, message: '密码修改成功' })
  } catch (err) {
    return handleAuthError(res, err, '密码修改失败')
  }
}

// ===== 工具：统一错误处理 =====
function handleAuthError(res, err, defaultMsg) {
  if (err && err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: err.issues.map((i) => i.message).join('；'),
    })
  }
  logger.error(defaultMsg + ':', err)
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误',
  })
}

module.exports = {
  studentLogin,
  teacherRegister,
  teacherLogin,
  adminLogin,
  changePassword,
}
