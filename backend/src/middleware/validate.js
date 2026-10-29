/**
 * 参数校验工具 —— 集中 zod 错误处理逻辑
 *
 * 5 个 controller（auth / answer / student / ai / tracking / admin / teacher）
 * 原本各自内联或重复定义 handleZodError，统一收敛到此文件。
 */

const { z } = require('zod')
const logger = require('../utils/logger')

/**
 * 从 zod error 提取可展示的用户消息
 * - 单 issue：直接用 message
 * - 多 issue：用中文分号拼接
 */
function extractZodMessage(err) {
  if (!err || !(err instanceof z.ZodError)) return null
  const messages = err.issues.map((i) => i.message)
  // 去重 + 保持顺序
  const unique = [...new Set(messages)]
  return unique.join('；')
}

/**
 * 统一处理 zod 校验错误
 *
 * 用法：
 *   try {
 *     const body = mySchema.parse(req.body)
 *     // ... 业务逻辑
 *   } catch (err) {
 *     return handleZodError(res, err, '创建教师失败')
 *   }
 *
 * @param {object} res - Express Response
 * @param {*} err - catch 到的异常（zod.ZodError | 其他 Error）
 * @param {string} defaultMsg - 非 zod 错误时的上下文描述（用于日志）
 * @returns {object} Express res（已 send 响应）
 */
function handleZodError(res, err, defaultMsg = '参数校验失败') {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: extractZodMessage(err),
    })
  }
  logger.error(defaultMsg + ':', err)
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误',
  })
}

/**
 * 便捷版：直接用 schema 解析 req.body，失败自动回 400
 *
 * 用法：
 *   const body = validateBody(req, mySchema)
 *   if (!body) return  // res 已发送
 *
 * 或直接：
 *   const body = parseWithZod(mySchema, req.body)
 *
 * @param {object} req - Express Request
 * @param {object} res - Express Response
 * @param {import('zod').ZodTypeAny} schema - zod schema
 * @returns {object|null} 解析成功返回 body，失败返回 null（res 已发送）
 */
function validateBody(req, res, schema) {
  try {
    return schema.parse(req.body || {})
  } catch (err) {
    handleZodError(res, err)
    return null
  }
}

/**
 * 抛出版本：用于已经在外层 try/catch 里的场景
 *
 * try {
 *   const body = parseWithZod(mySchema, req.body)
 *   ...
 * } catch (err) {
 *   return handleZodError(res, err, '业务失败')
 * }
 */
function parseWithZod(schema, body) {
  return schema.parse(body)
}

module.exports = {
  handleZodError,
  validateBody,
  parseWithZod,
}
