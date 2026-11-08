/**
 * 错误处理中间件
 * 统一处理应用中的错误
 */

const crypto = require('crypto')
const { logError, logRequest } = require('../utils/logger')

/**
 * 请求日志中间件
 * 记录每个 HTTP 请求的方法、路径、状态码和耗时
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {function} next - 下一个中间件
 */
function requestLogger(req, res, next) {
  const startTime = Date.now()
  // 响应结束时记录日志
  res.on('finish', () => {
    const duration = Date.now() - startTime
    logRequest(req, res, duration)
  })
  next()
}

/**
 * 全局错误处理中间件
 * 客户端只拿到通用提示 + requestId，详细错误（堆栈/SQL/路径）只写日志
 * @param {object} err - 错误对象
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {function} next - 下一个中间件
 */
function errorHandler(err, req, res, next) {
  // 响应已发出（如流式/已 send）时交给 Express 默认处理，避免二次写头
  if (res.headersSent) {
    return next(err)
  }

  const requestId = req.id || crypto.randomUUID()
  req.id = requestId
  if (typeof res.setHeader === 'function') {
    res.setHeader('X-Request-Id', requestId)
  }

  logError(err, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userId:
      req.user?.student_id || req.user?.phone || req.user?.username || req.user?.userId || null,
  })

  let statusCode = Number(err.statusCode) || 500
  let message = '服务器内部错误'
  let errorCode = 'INTERNAL_ERROR'

  // 4xx 属于可预期的业务错误，message 是安全的；5xx 一律返回通用文案
  if (statusCode < 500) {
    message = err.message || '请求处理失败'
    errorCode = err.error || 'BAD_REQUEST'
  }

  // 请求体过大错误处理
  if (err.name === 'PayloadTooLargeError' || err.type === 'entity.too.large') {
    statusCode = 413
    message = '请求体超过大小限制'
    errorCode = 'PAYLOAD_TOO_LARGE'
  }

  // multer 上传错误：文件超过大小上限 → 413；其余（字段/文件数超限等）→ 400。
  // 此前 MulterError 没有 statusCode，会被当成 500 内部错误，客户端拿不到可行动的信息。
  if (err.name === 'MulterError') {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE'
    statusCode = isTooLarge ? 413 : 400
    message = isTooLarge ? '上传文件超过大小限制' : '上传文件不符合要求'
    errorCode = isTooLarge ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD'
  }

  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message,
    requestId,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 404 处理中间件
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: '接口不存在',
  })
}

module.exports = {
  requestLogger,
  notFoundHandler,
  errorHandler,
}
