const jwt = require('jsonwebtoken')
const config = require('../config/app')
const { dbGet } = require('../utils/dbPromise')
const { db } = require('../config/database')

// 固定允许的签名算法，防止算法混淆（alg=none / 非对称算法替换）
const JWT_ALGORITHMS = ['HS256']

// 若 payload 带令牌类型字段，则必须是 access 令牌
const TOKEN_TYPE_KEYS = ['type', 'token_type', 'tokenType']

/**
 * 校验 JWT payload 结构
 * - 有 token 类型字段：必须是 access
 * - 无类型字段：至少要有 sub 或 role（兼容历史 token 结构）
 */
function isValidTokenPayload(decoded) {
  if (!decoded || typeof decoded !== 'object') return false
  const typeKey = TOKEN_TYPE_KEYS.find((key) => decoded[key] !== undefined)
  if (typeKey) return decoded[typeKey] === 'access'
  return Boolean(decoded.sub || decoded.role)
}

/**
 * 可选鉴权：有 token 则解析，没 token 放行，req.user = null
 */
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null
    return next()
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: JWT_ALGORITHMS })
    req.user = isValidTokenPayload(decoded) ? decoded : null
  } catch {
    req.user = null
  }
  next()
}

/**
 * 必须鉴权：无 token、签名/算法非法、payload 结构异常直接返回 401
 */
function requireAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: '需要登录',
    })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: JWT_ALGORITHMS })
    if (!isValidTokenPayload(decoded)) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_FAILED',
        message: '登录已过期，请重新登录',
      })
    }
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({
      success: false,
      error: 'AUTH_FAILED',
      message: '登录已过期，请重新登录',
    })
  }
}

/**
 * 角色权限校验：允许传入一个或多个合法角色
 * 例：requireRole('teacher')  requireRole(['teacher', 'admin'])
 *
 * 使用方式：app.post('/x', requireAuthMiddleware, requireRole('teacher'), handler)
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return async function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: '需要登录',
      })
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '无权访问该资源',
      })
    }

    // 教师需要额外检查账号状态（禁用的直接 403）
    if (req.user.role === 'teacher') {
      try {
        const row = await dbGet(db, `SELECT status FROM teachers WHERE phone = ?`, [
          req.user.phone,
        ])
        if (!row || row.status !== 'active') {
          return res.status(403).json({
            success: false,
            error: 'ACCOUNT_DISABLED',
            message: '账号已被禁用',
          })
        }
      } catch {
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: '账号校验失败',
        })
      }
    }
    next()
  }
}

module.exports = {
  optionalAuthMiddleware,
  requireAuthMiddleware,
  requireRole,
}
