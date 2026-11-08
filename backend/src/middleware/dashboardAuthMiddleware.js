/**
 * 数据看板密码验证中间件
 *
 * 验证方式：
 * - 请求头 Authorization: Bearer <password>
 * - 密码通过环境变量 DASHBOARD_PASSWORD 配置
 * - fail-closed：未配置 DASHBOARD_PASSWORD 时一律 503，禁止匿名放行
 * - 比较使用 crypto.timingSafeEqual（先比长度），错误响应不回显密码
 */
const crypto = require('crypto')
const logger = require('../utils/logger')

/**
 * 恒定时间字符串比较（长度不同直接返回 false，避免 timingSafeEqual 抛错）
 */
function safeEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8')
  const right = Buffer.from(String(b), 'utf8')
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function dashboardAuthMiddleware(req, res, next) {
  const dashboardPassword = process.env.DASHBOARD_PASSWORD

  // fail-closed：未配置密码时拒绝访问，避免看板数据匿名裸奔
  if (!dashboardPassword) {
    logger.warn('[dashboard] DASHBOARD_PASSWORD 未配置，拒绝访问看板接口', { path: req.path })
    return res.status(503).json({
      success: false,
      error: 'DASHBOARD_AUTH_NOT_CONFIGURED',
      message: '看板访问密码未配置，请联系管理员',
    })
  }

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'DASHBOARD_AUTH_REQUIRED',
      message: '需要访问密码',
    })
  }

  const token = authHeader.slice('Bearer '.length)

  if (!safeEqual(token, dashboardPassword)) {
    logger.warn('看板密码验证失败, IP:', req.ip)
    return res.status(401).json({
      success: false,
      error: 'DASHBOARD_AUTH_FAILED',
      message: '访问密码错误',
    })
  }

  next()
}

module.exports = {
  dashboardAuthMiddleware,
}
