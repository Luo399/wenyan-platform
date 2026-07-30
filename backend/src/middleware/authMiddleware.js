const jwt = require('jsonwebtoken')
const config = require('../config/app')
const { dbGet } = require('../utils/dbPromise')
const { db } = require('../config/database')

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
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    next()
  } catch (err) {
    req.user = null
    next()
  }
}

/**
 * 必须鉴权：无 token 或过期直接返回 401
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
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    next()
  } catch (err) {
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
      } catch (err) {
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
