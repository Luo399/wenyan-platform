/**
 * 错误处理中间件
 * 统一处理应用中的错误
 */

const { logError, logRequest } = require('../utils/logger');

/**
 * 全局错误处理中间件
 * @param {object} err - 错误对象
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {function} next - 下一个中间件
 */
function errorHandler(err, req, res, _next) {
  logError(err, {
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.userId || null,
  });
  
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  
  res.status(statusCode).json({
    success: false,
    error: err.error || 'INTERNAL_ERROR',
    message: message,
    timestamp: new Date().toISOString()
  });
}

/**
 * 404处理中间件
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `未找到路径: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * 请求日志中间件（使用结构化日志）
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {function} next - 下一个中间件
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req, res, duration);
  });
  
  next();
}

module.exports = {
  errorHandler,
  notFoundHandler,
  requestLogger
};