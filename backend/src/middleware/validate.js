/**
 * 参数校验工具 —— 集中 zod 错误处理逻辑
 *
 * 7 个 controller（auth / answer / student / ai / tracking / admin / teacher）
 * 原本各自内联或重复定义 zod 错误处理，统一收敛到此文件。
 */

const { z } = require('zod')
const logger = require('../utils/logger')

/** 从 zod error 提取可展示的用户消息（中文分号去重拼接） */
function extractZodMessage(err) {
  if (!err || !(err instanceof z.ZodError)) return null
  const messages = err.issues.map((i) => i.message)
  return [...new Set(messages)].join('；')
}

/** 统一处理 zod 校验错误 → 400 VALIDATION_ERROR */
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

/** 便捷版：直接用 schema 解析 body，失败自动回 400 */
function validateBody(req, res, schema) {
  try {
    return schema.parse(req.body || {})
  } catch (err) {
    handleZodError(res, err)
    return null
  }
}

/** 抛出版本：用于已经在外层 try/catch 里的场景 */
function parseWithZod(schema, body) {
  return schema.parse(body)
}

module.exports = {
  handleZodError,
  validateBody,
  parseWithZod,
}