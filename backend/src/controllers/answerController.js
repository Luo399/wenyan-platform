const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { submitAnswers: serviceSubmitAnswers, submitSingleAnswer: serviceSubmitSingleAnswer, getAnswersByWenId: serviceGetByWenId, getAnswersByStudentId: serviceGetByStudentId } = require('../services/answerService')
const { db } = require('../config/database')
const { dbGet, dbAll } = require('../utils/dbPromise')
const { teacherCanManageClass, getTeacherClassCodes } = require('../services/authService')
const logger = require('../utils/logger')

// ===== P0 安全修复：提交请求体 zod 白名单校验 =====
const answerValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const submitAnswersSchema = z.object({
  studentId: z.string().regex(/^\d{8}$/, '学号必须为 8 位纯数字'),
  wenId: z.string().min(1, 'wenId 必填').max(100),
  submittedAt: z.string().min(1).max(40).optional(),
  answers: z.array(z.object({ questionId: z.string(), userAnswer: answerValueSchema })).max(500),
  questions: z.array(z.unknown()).max(500).optional(),
})

const submitSingleAnswerSchema = z.object({
  studentId: z.string().regex(/^\d{8}$/, '学号必须为 8 位纯数字'),
  wenId: z.string().min(1).max(100),
  questionId: z.string().min(1).max(100),
  userAnswer: answerValueSchema,
  correctAnswer: answerValueSchema.optional(),
  submittedAt: z.string().min(1).max(40).optional(),
})

async function submitAnswers(req, res) {
  try {
    const body = submitAnswersSchema.parse(req.body || {})
    const result = await serviceSubmitAnswers({ studentId: body.studentId, studentName: req.user?.student_name || null, wenId: body.wenId, submittedAt: body.submittedAt, answers: body.answers, questions: body.questions })
    res.status(200).json({ success: result.success, message: '答案提交成功', data: result.data })
  } catch (err) {
    if (err instanceof z.ZodError) { return handleZodError(res, err) }
    logger.error('处理答题批量提交请求失败', { error: err.message, stack: err.stack, body: req.body })
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' })
  }
}

async function submitSingleAnswer(req, res) {
  try {
    const body = submitSingleAnswerSchema.parse(req.body || {})
    const result = await serviceSubmitSingleAnswer({ studentId: body.studentId, studentName: req.user?.student_name || null, wenId: body.wenId, questionId: body.questionId, userAnswer: body.userAnswer, correctAnswer: body.correctAnswer, submittedAt: body.submittedAt || new Date().toISOString() })
    res.status(200).json({ success: true, message: '答案提交成功', data: result })
  } catch (err) {
    if (err instanceof z.ZodError) { return handleZodError(res, err) }
    logger.error('处理单题提交请求失败', { error: err.message, stack: err.stack, body: req.body })
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' })
  }
}

async function getAnswersByWenId(req, res) {
  try {
    const { wenId } = req.params
    let data = await serviceGetByWenId(wenId)
    if (req.user?.role === 'teacher') {
      const classCodes = await getTeacherClassCodes(req.user.teacher_id)
      data = data.filter((row) => classCodes.includes(row.class_code))
    }
    res.json({ success: true, data })
  } catch (err) { logger.error('查询答题失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '查询失败' }) }
}

async function getAnswersByStudentId(req, res) {
  try {
    const { studentId } = req.params
    let data = await serviceGetByStudentId(studentId)
    if (req.user?.role === 'teacher') {
      const classCodes = await getTeacherClassCodes(req.user.teacher_id)
      data = data.filter((row) => classCodes.includes(row.class_code))
    }
    res.json({ success: true, data })
  } catch (err) { logger.error('查询答题失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '查询失败' }) }
}

module.exports = { submitAnswers, submitSingleAnswer, getAnswersByWenId, getAnswersByStudentId }