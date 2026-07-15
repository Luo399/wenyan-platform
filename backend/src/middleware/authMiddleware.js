/**
 * JWT认证中间件
 * 验证请求中的JWT令牌，保护需要认证的接口
 */

const { verifyToken } = require('../utils/token');

/**
 * 认证中间件
 * 验证请求头中的Authorization令牌
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // 检查是否存在Authorization头
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
  }

  // 提取令牌
  const token = authHeader.substring(7);

  // 验证令牌
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: '无效或已过期的认证令牌',
    });
  }

  // 将解码后的用户信息添加到请求对象
  req.user = decoded;

  // 继续处理请求
  next();
}

/**
 * 可选认证中间件
 * 如果提供了令牌则验证，如果没有提供则跳过（用于兼容旧逻辑）
 */
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 没有提供令牌，跳过认证
    return next();
  }

  // 提取令牌
  const token = authHeader.substring(7);

  // 验证令牌
  const decoded = verifyToken(token);

  if (decoded) {
    // 令牌有效，添加用户信息
    req.user = decoded;
  }

  // 继续处理请求（即使令牌无效也继续，用于兼容）
  next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
};
