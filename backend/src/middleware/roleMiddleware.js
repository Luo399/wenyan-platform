/**
 * 角色权限中间件
 */

function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: '需要登录',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '权限不足',
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
};
