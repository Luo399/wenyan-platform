/**
 * 资产同步鉴权中间件（Figma 插件 → 后端上传）
 *
 * 校验请求头 X-API-Key 是否与服务器环境变量 ASSET_SYNC_TOKEN 一致。
 * - 未配置 ASSET_SYNC_TOKEN 时：一律拒绝（503 ASSET_SYNC_DISABLED），不放开回环地址
 * - 令牌不一致：返回 401，阻断上传
 * - 令牌比较使用恒定时间算法，避免时序攻击
 */

const crypto = require('crypto')
const logger = require('../utils/logger')

module.exports = function assetAuthMiddleware(req, res, next) {
  const expected = process.env.ASSET_SYNC_TOKEN

  // 未配置令牌：资产同步视为关闭，任何来源（含本机）都不放行
  if (!expected) {
    logger.warn('[AssetAuth] ASSET_SYNC_TOKEN 未配置，拒绝所有资产同步请求')
    return res.status(503).json({
      success: false,
      error: 'ASSET_SYNC_DISABLED',
      message: '资产同步未启用（服务器未配置 ASSET_SYNC_TOKEN）',
    })
  }

  const token = req.headers['x-api-key']
  if (!token || !safeEqual(token, expected)) {
    logger.warn('[AssetAuth] 同步令牌校验失败', { ip: req.ip })
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '无效的同步令牌',
    })
  }

  next()
}

/**
 * 恒定时间字符串比较
 * 先做 SHA-256 摘要，等长后再 timingSafeEqual，避免长度差异泄露
 */
function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest()
  const hashB = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}
