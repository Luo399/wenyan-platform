/**
 * 错误处理中间件
 * 统一处理应用中的错误
 */

const { logError, logRequest } = require('../utils/logger');

/**
 * 请求日志中间件
 * 记录每个 HTTP 请求的方法、路径、状态码和耗时
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {function} next - 下一个中间件
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  // 响应结束时记录日志
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logRequest(req, res, duration);
  });
  next();
}

/**
 * 全局错误处理中间件
 * @param {object} err - 错误对象
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {function} _next - 下一个中间件（未使用）
 */
function errorHandler(err, req, res, _next) {
  logError(err, {
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.userId || null,
  });

  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let errorCode = err.error || 'INTERNAL_ERROR';

  // 请求体过大错误处理
  if (err.name === 'PayloadTooLargeError') {
    statusCode = 413;
    message = '请求体超过大小限制';
    errorCode = 'PAYLOAD_TOO_LARGE';
  }

  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message: message,
    timestamp: new Date().toISOString(),
  });
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
  });
}

module.exports = {
  requestLogger,
  notFoundHandler,
  errorHandler,
};
