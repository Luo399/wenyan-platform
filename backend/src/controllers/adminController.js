/** Admin Controller */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { adminLogin, registerTeacher, adminUpdateTeacherStatus } = require('../services/authService')
const { listTeachers, getTeacherById, deleteTeacher } = require('../services/teacherSync')
const { syncStudentsFromXlsx, syncStudentsFromExcelUrl, importStudents } = require('../services/studentSync')
const { getTeachers } = require('../services/teacherSync')
const logger = require('../utils/logger')

const CLASS_CODE_REGEX = /^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/

const createTeacherSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位').max(100),
  name: z.string().min(1).max(50),
  can_view_all: z.boolean().default(false),
  class_codes: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.can_view_all) return
  if (!data.class_codes || data.class_codes.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'can_view_all=false 时必须提供 class_codes' }); return
  }
  for (const cc of data.class_codes) {
    if (!CLASS_CODE_REGEX.test(cc)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `班级编码 ${cc} 格式不正确（应为 4 位年级 + 2 位班级序号）` })
  }
})

const adminLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
const updateTeacherStatusSchema = z.object({ status: z.enum(['active', 'inactive', 'pending']), password: z.string().min(6).max(100).optional() })
const importXlsxSchema = z.object({ url: z.string().url('Excel URL 格式不正确'), target_class: z.string().min(1).max(50).optional() })
const importDataSchema = z.object({ data: z.array(z.object({ student_id: z.string().min(1), student_name: z.string().min(1) })).min(1).max(5000), target_class: z.string().min(1).max(50).optional(), dryRun: z.boolean().default(false) })

async function createTeacher(req, res) {
  try {
    const body = createTeacherSchema.parse(req.body || {})
    const result = await registerTeacher(body.email, body.password, body.name, { can_view_all: body.can_view_all, class_codes: body.class_codes }, true)
    if (result.success) return res.status(201).json({ success: true, message: result.message, data: { teacher_id: result.teacher_id } })
    return res.status(400).json({ success: false, message: result.error })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err, '创建教师参数校验失败'); logger.error('创建教师失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '创建教师失败' }) }
}

async function adminLoginHandler(req, res) {
  try {
    const body = adminLoginSchema.parse(req.body || {})
    const result = await adminLogin(body.email, body.password)
    if (result.token) return res.status(200).json({ success: true, data: result })
    return res.status(401).json({ success: false, message: result.error || '登录失败' })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err, '管理员登录参数校验失败'); logger.error('管理员登录失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '登录失败' }) }
}

async function listAllTeachers(req, res) {
  try { const result = await getTeachers(); res.json({ success: true, data: result }) } catch (err) { logger.error('获取教师列表失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取教师列表失败' }) }
}

async function adminUpdateTeacherStatus(req, res) {
  try {
    const { teacherId } = req.params
    const body = updateTeacherStatusSchema.parse(req.body || {})
    const result = await adminUpdateTeacherStatus(teacherId, body.status, body.password)
    if (result.success) return res.json({ success: true, message: result.message })
    return res.status(400).json({ success: false, message: result.error })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('更新教师状态失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '更新教师状态失败' }) }
}

async function deleteTeacherHandler(req, res) {
  try {
    const { teacherId } = req.params
    const result = await deleteTeacher(teacherId)
    if (result.success) return res.json({ success: true, message: '教师删除成功' })
    return res.status(400).json({ success: false, message: result.error })
  } catch (err) { logger.error('删除教师失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '删除教师失败' }) }
}

async function importStudentsFromXlsx(req, res) {
  try {
    const body = importXlsxSchema.parse(req.body || {})
    const result = await syncStudentsFromExcelUrl(body.url, body.target_class)
    return res.json({ success: true, message: '导入成功', data: result })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('导入学生失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '导入失败' }) }
}

async function importStudentsData(req, res) {
  try {
    const body = importDataSchema.parse(req.body || {})
    const result = await importStudents(body.data, body.target_class, body.dryRun)
    return res.json({ success: true, message: body.dryRun ? '预览成功' : '导入成功', data: result })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err); logger.error('导入学生数据失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '导入失败' }) }
}

module.exports = { createTeacher, adminLoginHandler, listAllTeachers, adminUpdateTeacherStatus, deleteTeacher: deleteTeacherHandler, importStudentsFromXlsx, importStudentsData }