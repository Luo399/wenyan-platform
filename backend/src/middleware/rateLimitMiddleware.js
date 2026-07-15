const rateLimit = require('express-rate-limit');
const config = require('../config/app');

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.globalWindowMs || 15 * 60 * 1000,
  max: config.rateLimit.globalRequests || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  }
});

const submitRateLimit = rateLimit({
  windowMs: config.rateLimit.submitWindowMs || 60 * 1000,
  max: config.rateLimit.submitRequests || 10,
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

module.exports = {
  globalLimiter,
  submitRateLimit,
  queryRateLimit,
};