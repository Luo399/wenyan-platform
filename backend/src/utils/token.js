/**
 * JWT令牌工具模块
 * 提供令牌生成和验证功能
 */

const jwt = require('jsonwebtoken');
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
    role: 'student',
  };

  const secret = config.jwt.secret;
  const expiresIn = config.jwt.expiresIn;

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * 验证JWT token
 * @param {string} token - JWT令牌
 * @returns {object|null} - 解码后的payload，验证失败返回null
 */
function verifyToken(token) {
  try {
    const secret = config.jwt.secret;
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};
