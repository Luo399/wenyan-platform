const { ZodError } = require('zod')
const logger = require('../utils/logger')

/**
 * 统一参数校验错误处理
 *
 * 契约：
 * - ZodError → 400 VALIDATION_ERROR，message 取首条 issue.message（缺省用 fallbackMessage）
 * - 其它异常 → 500 INTERNAL_ERROR，只记录日志，绝不把 err.message 回传给客户端
 *
 * 注意：controller 中的 catch 多为"整段兜底"（DB 异常也会走到这里），
 * 因此非 ZodError 必须是 500，不能误报成 400 参数错误。
 *
 * @param {import('express').Response} res
 * @param {Error} err
 * @param {string} [fallbackMessage] 兜底文案（同时用于日志上下文）
 */
function handleZodError(res, err, fallbackMessage) {
  if (err instanceof ZodError) {
    const firstIssue = err.issues && err.issues[0]
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: (firstIssue && firstIssue.message) || fallbackMessage || '参数校验失败',
    })
  }

  logger.error(`[validate] ${fallbackMessage || '请求处理失败'}`, {
    message: err && err.message,
    stack: err && err.stack,
  })

  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: fallbackMessage || '服务器内部错误',
  })
}

module.exports = {
  handleZodError,
}
