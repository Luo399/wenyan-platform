/**
 * JWT令牌工具模块
 * 提供令牌生成和验证功能
 */

const crypto = require('crypto');
const config = require('../config/app');

/**
 * 生成JWT token
 * @param {string} studentId - 学生ID
 * @param {string} username - 用户名
 * @returns {string} - JWT令牌
 */
function generateToken(studentId, username) {
  const payload = {
    sub: studentId,
    username: username,
    exp: Math.floor(Date.now() / 1000) + config.jwt.expiresIn,
    role: 'student',
  };

  const secret = config.jwt.secret;

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const data = `${header}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * 验证JWT token
 * @param {string} token - JWT令牌
 * @returns {object|null} - 解码后的payload，验证失败返回null
 */
function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [header, payload, signature] = parts;
    const secret = config.jwt.secret;

    // 验证签名
    const data = `${header}.${payload}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    // 解码payload
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());

    // 检查过期时间
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      return null;
    }

    return decodedPayload;
  } catch (err) {
    console.error('Token验证失败:', err);
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};