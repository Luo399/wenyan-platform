/**
 * 教师学生管理控制器
 * 教师只能管理自己所教班级的学生
 */

const { db } = require('../config/database')
const { dbGet, dbAll, dbRun, dbSerialize } = require('../utils/dbPromise')
const { hashDefaultPassword } = require('../utils/password')

/**
 * 检查教师是否有权限操作该学生
 * @param {object} teacher - 教师信息（来自 token）
 * @param {string} studentId - 学号
 * @returns {boolean}
 */
function canManageStudent(teacher, studentId) {
  if (teacher.role === 'admin') return true
  if (teacher.role !== 'teacher') return false
  const prefix = String(studentId).substring(0, 6)
  const classes = teacher.classes || []
  return classes.includes(prefix)
}

/**
 * 获取教师所教班级的学生列表
 */
async function getMyStudents(req, res) {
  try {
    const teacher = req.user

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    let query = 'SELECT id, student_id, student_name, created_at, updated_at FROM students'
    let params = []

    if (teacher.role === 'teacher') {
      const classes = teacher.classes || []
      if (classes.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
        })
      }
      const conditions = classes.map(() => 'student_id LIKE ?').join(' OR ')
      query += ` WHERE ${conditions}`
      params = classes.map(c => `${c}%`)
    }

    query += ' ORDER BY student_id ASC'

    const rows = await dbAll(db, query, params)

    res.status(200).json({
      success: true,
      data: rows,
    })
  } catch (err) {
    console.error('获取学生列表失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

/**
 * 创建学生
 */
async function createStudent(req, res) {
  try {
    const teacher = req.user
    const { student_id, student_name } = req.body

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    if (!student_id || !student_name) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '学号和姓名是必填字段',
      })
    }

    if (!/^\d{8}$/.test(student_id)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '学号必须为8位数字',
      })
    }

    if (!canManageStudent(teacher, student_id)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '您没有教授此班级',
      })
    }

    // 检查学号是否已存在
    const existing = await dbGet(db, 'SELECT id FROM students WHERE student_id = ?', [student_id])
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_STUDENT_ID',
        message: '该学号已存在',
      })
    }

    const defaultHash = await hashDefaultPassword()
    const now = new Date().toISOString()

    const result = await dbRun(
      db,
      'INSERT INTO students (student_id, student_name, password_hash, password_changed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [student_id, student_name.trim(), defaultHash, 0, now, now]
    )

    res.status(201).json({
      success: true,
      message: '学生创建成功',
      data: {
        id: result.lastID,
        student_id,
        student_name: student_name.trim(),
      },
    })
  } catch (err) {
    console.error('创建学生失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

/**
 * 更新学生信息
 */
async function updateStudent(req, res) {
  try {
    const teacher = req.user
    const { studentId } = req.params
    const { student_name, new_student_id } = req.body

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    // 检查原学生权限
    if (!canManageStudent(teacher, studentId)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '您没有教授此班级',
      })
    }

    // 如果修改了学号，检查新学号权限和重复
    if (new_student_id && new_student_id !== studentId) {
      if (!/^\d{8}$/.test(new_student_id)) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: '学号必须为8位数字',
        })
      }

      if (!canManageStudent(teacher, new_student_id)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '您没有教授此班级',
        })
      }

      const existing = await dbGet(db, 'SELECT id FROM students WHERE student_id = ? AND student_id != ?', [new_student_id, studentId])
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_STUDENT_ID',
          message: '该学号已存在',
        })
      }
    }

    const now = new Date().toISOString()
    const updateId = new_student_id || studentId
    const updateName = student_name ? student_name.trim() : undefined

    let sql = 'UPDATE students SET updated_at = ?'
    let params = [now]

    if (updateName !== undefined) {
      sql += ', student_name = ?'
      params.push(updateName)
    }

    if (new_student_id && new_student_id !== studentId) {
      sql += ', student_id = ?'
      params.push(new_student_id)
    }

    sql += ' WHERE student_id = ?'
    params.push(studentId)

    const result = await dbRun(db, sql, params)

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '学生不存在',
      })
    }

    res.status(200).json({
      success: true,
      message: '学生信息更新成功',
      data: {
        student_id: updateId,
        student_name: updateName,
      },
    })
  } catch (err) {
    console.error('更新学生失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

/**
 * 删除学生（级联删除答题记录）
 */
async function deleteStudent(req, res) {
  try {
    const teacher = req.user
    const { studentId } = req.params

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    if (!canManageStudent(teacher, studentId)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '您没有教授此班级',
      })
    }

    await dbSerialize(db, async () => {
      const { changes: deletedRecords } = await dbRun(
        db,
        'DELETE FROM answers WHERE student_id = ?',
        [studentId]
      )

      const { changes } = await dbRun(
        db,
        'DELETE FROM students WHERE student_id = ?',
        [studentId]
      )

      if (changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '学生不存在',
        })
      }

      return res.status(200).json({
        success: true,
        message: `学生删除成功，同时删除了 ${deletedRecords} 条答题记录`,
      })
    })
  } catch (err) {
    console.error('删除学生失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

/**
 * 获取单个学生信息
 */
async function getStudent(req, res) {
  try {
    const teacher = req.user
    const { studentId } = req.params

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    if (!canManageStudent(teacher, studentId)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '您没有教授此班级',
      })
    }

    const student = await dbGet(
      db,
      'SELECT id, student_id, student_name, created_at, updated_at FROM students WHERE student_id = ?',
      [studentId]
    )

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '学生不存在',
      })
    }

    res.status(200).json({
      success: true,
      data: student,
    })
  } catch (err) {
    console.error('获取学生信息失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

/**
 * 获取所有教师列表（管理员用）
 */
async function getTeacherList(req, res) {
  try {
    const admin = req.user

    if (admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      })
    }

    const rows = await dbAll(
      db,
      "SELECT id, name, phone, school, classes, role, created_at FROM teachers WHERE role != 'admin' ORDER BY created_at DESC",
      []
    )

    res.status(200).json({
      success: true,
      data: rows.map(t => ({
        ...t,
        classes: JSON.parse(t.classes || '[]'),
      })),
    })
  } catch (err) {
    console.error('获取教师列表失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

module.exports = {
  getMyStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudent,
  getTeacherList,
}
