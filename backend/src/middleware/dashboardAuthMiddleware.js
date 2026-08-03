/**
 * 数据看板密码验证中间件
 *
 * 验证方式：
 * - 请求头 Authorization: Bearer <password>
 * - 密码通过环境变量 DASHBOARD_PASSWORD 配置
 * - 若 DASHBOARD_PASSWORD 未设置，则放行（开发/测试环境）
 * - 验证失败返回 401
 */
const logger = require('../utils/logger')

function dashboardAuthMiddleware(req, res, next) {
  const dashboardPassword = process.env.DASHBOARD_PASSWORD

  // 未设置密码则放行（开发环境）
  if (!dashboardPassword) {
    return next()
  }

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'DASHBOARD_AUTH_REQUIRED',
      message: '需要访问密码',
    })
  }

  const token = authHeader.split(' ')[1]

  if (token !== dashboardPassword) {
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