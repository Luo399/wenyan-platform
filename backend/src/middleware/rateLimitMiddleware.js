/**
 * 限流中间件
 * 防止恶意请求和频繁调用，保护API接口
 */

const config = require('../config/app');
const { warn, info } = require('../utils/logger');

/**
 * 限流存储（内存存储，生产环境可使用Redis）
 */
const rateLimitStore = {
  submit: new Map(),
  global: new Map(),
};

/**
 * 清理过期记录
 */
function cleanupExpired(store, windowMs) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.timestamp > windowMs) {
      store.delete(key);
    }
  }
}

/**
 * 限流中间件工厂
 * @param {object} options - 限流配置
 * @param {number} options.max - 时间窗口内最大请求数
 * @param {number} options.windowMs - 时间窗口（毫秒）
 * @param {string} options.storeKey - 存储键名
 * @param {string} options.message - 限流提示消息
 */
function createRateLimitMiddleware({ max, windowMs, storeKey, message }) {
  return (req, res, next) => {
    // 测试模式下禁用限流
    if (config.testMode) {
      return next();
    }
    
    const now = Date.now();
    
    // 获取客户端标识（优先使用用户ID，其次使用IP）
    const clientId = req.user?.studentId || req.user?.userId || req.ip || req.connection?.remoteAddress;
    
    // 获取存储
    const store = rateLimitStore[storeKey] || rateLimitStore.global;
    
    // 清理过期记录
    cleanupExpired(store, windowMs);
    
    // 获取当前客户端的请求记录
    let entry = store.get(clientId);
    if (!entry) {
      entry = { count: 0, timestamp: now };
    }
    
    // 更新请求计数
    entry.count++;
    entry.timestamp = now;
    store.set(clientId, entry);
    
    // 检查是否超过限制
    if (entry.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - entry.timestamp)) / 1000);
      
      warn('请求被限流', {
        clientId,
        storeKey,
        count: entry.count,
        max,
        retryAfter,
        path: req.path,
        method: req.method,
      });
      
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMITED',
        message: message,
        retryAfter,
        timestamp: new Date().toISOString(),
      });
    }
    
    // 记录正常请求（DEBUG级别）
    info('限流检查通过', {
      clientId,
      storeKey,
      count: entry.count,
      max,
      path: req.path,
      method: req.method,
    });
    
    next();
  };
}

/**
 * 答题提交接口限流中间件
 * 限制：每分钟最多10次提交
 */
const submitRateLimit = createRateLimitMiddleware({
  max: parseInt(config.rateLimit.submitRequests),
  windowMs: parseInt(config.rateLimit.submitWindowMs),
  storeKey: 'submit',
  message: '提交过于频繁，请稍后再试',
});

/**
 * 全局限流中间件
 * 限制：每分钟最多100次请求（针对单个客户端）
 */
const globalRateLimit = createRateLimitMiddleware({
  max: parseInt(config.rateLimit.globalRequests),
  windowMs: parseInt(config.rateLimit.globalWindowMs),
  storeKey: 'global',
  message: '请求过于频繁，请稍后再试',
});

/**
 * 获取限流状态（用于监控）
 */
function getRateLimitStatus() {
  return {
    submit: {
      totalClients: rateLimitStore.submit.size,
      activeEntries: Array.from(rateLimitStore.submit.entries()).map(([key, entry]) => ({
        clientId: key,
        count: entry.count,
        timestamp: entry.timestamp,
      })),
    },
    global: {
      totalClients: rateLimitStore.global.size,
      activeEntries: Array.from(rateLimitStore.global.entries()).map(([key, entry]) => ({
        clientId: key,
        count: entry.count,
        timestamp: entry.timestamp,
      })),
    },
  };
}

module.exports = {
  submitRateLimit,
  globalRateLimit,
  getRateLimitStatus,
  createRateLimitMiddleware,
};
