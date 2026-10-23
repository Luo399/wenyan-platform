/** 参数校验工具 —— 集中 zod 错误处理逻辑 */

const { z } = require('zod')
const logger = require('../utils/logger')

function extractZodMessage(err) {
  if (!err || !(err instanceof z.ZodError)) return null
  const messages = err.issues.map((i) => i.message)
  return [...new Set(messages)].join('；')
}

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

function validateBody(req, res, schema) {
  try { return schema.parse(req.body || {}) } catch (err) {
    handleZodError(res, err); return null
  }
}

function parseWithZod(schema, body) { return schema.parse(body) }

module.exports = { handleZodError, validateBody, parseWithZod }