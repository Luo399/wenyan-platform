/**
 * 密码哈希工具模块
 */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = '123456';

/**
 * 哈希密码
 * @param {string} password - 明文密码
 * @returns {Promise<string>} - bcrypt 哈希值
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - bcrypt 哈希值
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * 生成默认密码哈希
 * @returns {Promise<string>}
 */
async function hashDefaultPassword() {
  return hashPassword(DEFAULT_PASSWORD);
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashDefaultPassword,
  DEFAULT_PASSWORD,
};
