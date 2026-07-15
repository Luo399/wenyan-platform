function requestLogger(req, res, next) {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: '接口不存在',
  });
}

function errorHandler(err, req, res, next) {
  console.error('服务器错误:', err);
  res.status(err.status || 500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: err.message || '服务器内部错误',
  });
}

module.exports = {
  requestLogger,
  notFoundHandler,
  errorHandler,
};