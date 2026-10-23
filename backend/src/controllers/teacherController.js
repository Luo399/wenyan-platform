/** Teacher Controller */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { getTeacherClassCodes } = require('../services/authService')
const { getAnswersByTeacherClass } = require('../services/answerService')
const logger = require('../utils/logger')

const teacherQuerySchema = z.object({ wenId: z.string().min(1).max(100).optional() })

async function getMyStudents(req, res) {
  try {
    const teacherId = req.user.teacher_id
    const classCodes = await getTeacherClassCodes(teacherId)
    res.json({ success: true, data: classCodes })
  } catch (err) { logger.error('获取班级失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取班级失败' }) }
}

async function getAnswers(req, res) {
  try {
    let body
    try { body = teacherQuerySchema.parse(req.body || {}) } catch (err) { return handleZodError(res, err) }
    const teacherId = req.user.teacher_id
    const classCodes = await getTeacherClassCodes(teacherId)
    const data = await getAnswersByTeacherClass(classCodes, body.wenId)
    res.json({ success: true, data })
  } catch (err) { logger.error('查询答案失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '查询失败' }) }
}

module.exports = { getMyStudents, getAnswers }