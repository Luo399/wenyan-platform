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

// AI 对话专用限流（每分钟 15 次）
// keyGenerator 绑定 student_id，而非纯 IP，防同一机器多学生共享限流桶（S5）
const aiChatRateLimit = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const sid = req.user?.student_id
    if (sid) return `ai_student:${sid}`
    // 兜底：无 student_id（异常链路）时退回 IP
    const ip = req.ip || req.connection?.remoteAddress || 'unknown'
    return `ai_ip:${ip}`
  },
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'AI 对话请求过于频繁（每分钟上限 15 次）'
  }
});

module.exports = {
  globalLimiter,
  submitRateLimit,
  queryRateLimit,
  loginRateLimit,
  aiChatRateLimit,
};