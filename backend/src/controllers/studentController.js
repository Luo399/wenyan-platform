const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { db } = require('../config/database');
const logger = require('../utils/logger')

const STUDENT_SAFE_COLUMNS =
  'id, student_id, student_name, class_code, school_id, must_reset_password, created_by, created_at, updated_at';

const createStudentSchema = z.object({
  student_id: z.string().regex(/^\d{8}$/, '学号必须为 8 位纯数字（格式 YYYYNNNN）'),
  student_name: z.string().min(1, '姓名必填').max(20, '姓名长度不能超过 20').nullable().optional(),
})

const updateStudentSchema = z.object({
  student_name: z.string().min(1, '姓名必填').max(20, '姓名长度不能超过 20').nullable().optional(),
})

function getStudentList(req, res) {
  db.all(`SELECT ${STUDENT_SAFE_COLUMNS} FROM students ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败: ' + err.message })
    res.status(200).json({ success: true, data: rows })
  })
}

function getStudent(req, res) {
  const { studentId } = req.params;
  db.get(`SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_id = ?`, [studentId], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败: ' + err.message })
    if (!row) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    res.status(200).json({ success: true, data: { ...row, name: row.student_name } })
  })
}

function getStudentPublicName(req, res) {
  const { studentId } = req.params;
  db.get('SELECT student_id, student_name FROM students WHERE student_id = ?', [studentId], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败: ' + err.message })
    if (!row) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    res.status(200).json({ success: true, data: { student_id: row.student_id, name: row.student_name } })
  })
}

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
    stmt.finalize()
    if (err) {
      logger.error('创建学生失败:', err)
      return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '创建失败: ' + err.message })
    }
    res.status(201).json({ success: true, message: '学生创建成功' })
  })
}

function updateStudent(req, res) {
  const { studentId } = req.params;
  let body
  try {
    body = updateStudentSchema.parse(req.body || {})
  } catch (err) {
    return handleZodError(res, err, '更新学生参数校验失败')
  }
  const stmt = db.prepare('UPDATE students SET student_name = ?, updated_at = ? WHERE student_id = ?')
  stmt.run(body.student_name || null, new Date().toISOString(), studentId, (err) => {
    stmt.finalize()
    if (err) {
      logger.error('更新学生失败:', err)
      return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '更新失败: ' + err.message })
    }
    res.status(200).json({ success: true, message: '学生信息更新成功' })
  })
}

function deleteStudent(req, res) {
  const { studentId } = req.params;
  const stmt = db.prepare('DELETE FROM students WHERE student_id = ?')
  stmt.run(studentId, (err) => {
    stmt.finalize()
    if (err) return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '删除失败: ' + err.message })
    res.status(200).json({ success: true, message: '学生删除成功' })
  })
}

module.exports = {
  getStudentList,
  getStudent,
  getStudentPublicName,
  createStudent,
  updateStudent,
  deleteStudent,
};
