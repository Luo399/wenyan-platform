const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { db } = require('../config/database')
const logger = require('../utils/logger')

// ===== Zod 校验 Schema =====
const STUDENT_ID_REGEX = /^\d{8}$/

const createStudentSchema = z.object({
  student_id: z.string().regex(STUDENT_ID_REGEX, '学号必须为 8 位纯数字（格式 YYYYNNNN）'),
  student_name: z.string().min(1, '姓名必填').max(20, '姓名长度不能超过 20').nullable().optional(),
})

const updateStudentSchema = z.object({
  student_name: z.string().min(1, '姓名必填').max(20, '姓名长度不能超过 20').nullable().optional(),
})

// handleZodError 已收敛到 ../middleware/validate.js

const STUDENT_SAFE_COLUMNS = 'id, student_id, student_name, class_code, school_id, must_reset_password, created_by, created_at, updated_at'

function createStudent(req, res) {
  let body
  try {
    body = createStudentSchema.parse(req.body || {})
  } catch (err) {
    return handleZodError(res, err, '创建学生参数校验失败')
  }
  const stmt = db.prepare('INSERT OR IGNORE INTO students (student_id, student_name, created_at, updated_at) VALUES (?, ?, ?, ?)')
  const now = new Date().toISOString()
  stmt.run(body.student_id, body.student_name || null, now, now, (err) => {
    if (err) { logger.error('创建学生失败:', err); return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '创建学生失败' }) }
    res.status(201).json({ success: true, message: '学生创建成功', data: { student_id: body.student_id } })
  })
}

function updateStudent(req, res) {
  const { studentId } = req.params
  let body
  try {
    body = updateStudentSchema.parse(req.body || {})
  } catch (err) {
    return handleZodError(res, err, '更新学生参数校验失败')
  }
  const stmt = db.prepare('UPDATE students SET student_name = ?, updated_at = ? WHERE student_id = ?')
  stmt.run(body.student_name || null, new Date().toISOString(), studentId, (err) => {
    if (err) { logger.error('更新学生失败:', err); return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '更新学生失败' }) }
    res.status(200).json({ success: true, message: '学生信息更新成功' })
  })
}

function getStudentByName(req, res) {
  const { name } = req.query
  if (!name) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', message: '缺少 name 查询参数' })
  const rows = db.prepare(`SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_name LIKE ? LIMIT 50`).all(`%${name}%`)
  res.json({ success: true, data: rows })
}

module.exports = { createStudent, updateStudent, getStudentByName }