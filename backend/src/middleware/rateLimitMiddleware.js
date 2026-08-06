const rateLimit = require('express-rate-limit');
const config = require('../config/app');

// S10: config.rateLimit.* 已由 config/app.js 统一 Number() 转换，此处无需再兜底字符串

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.globalWindowMs,
  max: config.rateLimit.globalRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  }
});

const submitRateLimit = rateLimit({
  windowMs: config.rateLimit.submitWindowMs,
  max: config.rateLimit.submitRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '提交过于频繁，请稍后再试'
  }
});

const queryRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '查询过于频繁，请稍后再试'
  }
});

// S05: 登录接口专用限流，防暴力破解（默认 5 次/分钟/IP）
const loginRateLimit = rateLimit({
  windowMs: config.rateLimit.loginWindowMs,
  max: config.rateLimit.loginRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '登录尝试过于频繁，请稍后再试'
  }
});

module.exports = {
  globalLimiter,
  submitRateLimit,
  queryRateLimit,
  loginRateLimit,
};