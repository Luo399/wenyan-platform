/**
 * 资产同步鉴权中间件（Figma 插件 → 后端上传）
 *
 * 校验请求头 X-API-Key 是否与服务器环境变量 ASSET_SYNC_TOKEN 一致。
 * - 未配置 ASSET_SYNC_TOKEN 时：仅放行本机回环地址（localhost / 127.0.0.1），
 *   便于本地开发调试，生产环境必须配置令牌。
 * - 令牌不一致：返回 401，阻断上传。
 */

const logger = require('../utils/logger')

module.exports = function assetAuthMiddleware(req, res, next) {
  const expected = process.env.ASSET_SYNC_TOKEN

  // 未配置令牌：仅允许本机调试访问，其他来源一律拒绝
  if (!expected) {
    const host = req.ip || req.socket?.remoteAddress || ''
    const isLocal =
      host === '::1' || host === '127.0.0.1' || host === '::ffff:127.0.0.1' || host === 'localhost'
    if (!isLocal) {
      logger.warn('[AssetAuth] ASSET_SYNC_TOKEN 未配置，拒绝非本机上传来源', { ip: host })
      return res.status(401).json({
        success: false,
        error: 'AUTH_NOT_CONFIGURED',
        message: '服务器未配置同步令牌，拒绝上传',
      })
    }
    logger.warn('[AssetAuth] ASSET_SYNC_TOKEN 未配置，仅本机调试可用')
    return next()
  }

  // 恒定时间比较，避免时序攻击
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
 * 恒定时间字符串比较（长度不同直接短路）
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return Buffer.compare(bufA, bufB) === 0
}
