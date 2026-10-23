/** Auth Controller — zod 统一校验 + handleZodError 收敛 */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { loginStudent, registerTeacher, loginTeacher, loginAdmin, refreshAccessToken, changePassword, teacherChangePassword } = require('../services/authService')
const logger = require('../utils/logger')

const studentLoginSchema = z.object({ studentId: z.string().regex(/^\d{8}$/, '学号必须为 8 位数字'), password: z.string().min(1, '密码必填').max(100) })
const teacherRegisterSchema = z.object({ email: z.string().email('邮箱格式不正确'), password: z.string().min(6, '密码至少 6 位').max(100), name: z.string().min(1).max(50), can_view_all: z.boolean().optional(), class_codes: z.array(z.string().regex(/^\d{6}$/, '班级编码格式不正确（应为 4 位年级 + 2 位班级序号）')).optional() })
const teacherLoginSchema = z.object({ email: z.string().email('邮箱格式不正确'), password: z.string().min(1).max(100) })
const adminLoginSchema = z.object({ email: z.string().email('邮箱格式不正确'), password: z.string().min(1).max(100) })
const refreshTokenSchema = z.object({ refreshToken: z.string().min(1, 'refreshToken 必填').max(1000) })
const changePasswordSchema = z.object({ oldPassword: z.string().min(1).max(100), newPassword: z.string().min(6, '新密码至少 6 位').max(100) })
const teacherChangePasswordSchema = z.object({ oldPassword: z.string().min(1).max(100), newPassword: z.string().min(6, '新密码至少 6 位').max(100) })

function tryParse(schema, body) {
  return schema.parse(body || {})
}

async function studentLogin(req, res) {
  try {
    const body = tryParse(studentLoginSchema, req.body)
    const result = await loginStudent(body.studentId, body.password)
    if (result.token) return res.status(200).json({ success: true, message: '登录成功', data: result })
    return res.status(401).json({ success: false, message: result.error || '登录失败' })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('学生登录失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' }) }
}

async function teacherRegister(req, res) {
  try {
    const body = tryParse(teacherRegisterSchema, req.body)
    const result = await registerTeacher(body.email, body.password, body.name, { can_view_all: body.can_view_all, class_codes: body.class_codes })
    if (result.success) return res.status(201).json({ success: true, message: result.message })
    return res.status(400).json({ success: false, message: result.error })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('教师注册失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' }) }
}

async function teacherLogin(req, res) {
  try {
    const body = tryParse(teacherLoginSchema, req.body)
    const result = await loginTeacher(body.email, body.password)
    if (result.token) return res.status(200).json({ success: true, message: '登录成功', data: result })
    return res.status(401).json({ success: false, message: result.error || '登录失败' })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('教师登录失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' }) }
}

async function adminLogin(req, res) {
  try {
    const body = tryParse(adminLoginSchema, req.body)
    const result = await loginAdmin(body.email, body.password)
    if (result.token) return res.status(200).json({ success: true, message: '登录成功', data: result })
    return res.status(401).json({ success: false, message: result.error || '登录失败' })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('管理员登录失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' }) }
}

async function refreshToken(req, res) {
  try {
    const body = tryParse(refreshTokenSchema, req.body)
    const result = await refreshAccessToken(body.refreshToken)
    if (result.success) return res.json({ success: true, data: result.data })
    return res.status(401).json({ success: false, message: result.error })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('刷新 token 失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' }) }
}

async function changePassword(req, res) {
  try {
    const body = tryParse(changePasswordSchema, req.body)
    const { student_id } = req.user
    const result = await changePassword(student_id, body.oldPassword, body.newPassword)
    if (result.success) return res.json({ success: true, message: '密码修改成功' })
    return res.status(400).json({ success: false, message: result.error })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('修改密码失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' }) }
}

async function teacherChangePassword(req, res) {
  try {
    const body = tryParse(teacherChangePasswordSchema, req.body)
    const { teacher_id } = req.user
    const result = await teacherChangePassword(teacher_id, body.oldPassword, body.newPassword)
    if (result.success) return res.json({ success: true, message: '密码修改成功' })
    return res.status(400).json({ success: false, message: result.error })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('教师修改密码失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' }) }
}

module.exports = { studentLogin, teacherRegister, teacherLogin, adminLogin, refreshToken, changePassword, teacherChangePassword }