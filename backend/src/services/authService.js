const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { db } = require('../config/database')
const { dbRun, dbGet, dbAll } = require('../utils/dbPromise')

// 为了调用简洁，二次绑定 db 参数
function run(sql, params = []) { return dbRun(db, sql, params) }
function get(sql, params = []) { return dbGet(db, sql, params) }
function all(sql, params = []) { return dbAll(db, sql, params) }

// 历史默认口令：仅保留常量供旧脚本/旧测试引用，新建与重置流程已改用一次性随机口令
const DEFAULT_STUDENT_PASSWORD = '99999999'

// 教师初始默认密码（历史常量，重置流程已改用一次性随机口令）
const DEFAULT_TEACHER_PASSWORD = '99999999'

// bcrypt cost factor（12 提升离线爆破成本，单次校验约 200~300ms）
const BCRYPT_ROUNDS = 12

// 一次性口令固定 8 位纯数字
const TEMP_PASSWORD_LENGTH = 8

// 易猜口令黑名单（连号/重复/常见弱口令）
const WEAK_TEMP_PASSWORDS = new Set([
  '00000000',
  '11111111',
  '22222222',
  '33333333',
  '44444444',
  '55555555',
  '66666666',
  '77777777',
  '88888888',
  '99999999',
  '12345678',
  '23456789',
  '87654321',
  '98765432',
  '12121212',
  '12341234',
  '11223344',
])

/**
 * 判断 8 位数字是否为连续递增/递减序列（如 12345678 / 98765432）
 */
function isSequentialDigits(digits) {
  let ascending = true
  let descending = true
  for (let i = 1; i < digits.length; i++) {
    const diff = digits.charCodeAt(i) - digits.charCodeAt(i - 1)
    if (diff !== 1) ascending = false
    if (diff !== -1) descending = false
  }
  return ascending || descending
}

/**
 * 生成一次性临时口令
 *
 * 使用 crypto.randomInt 生成 8 位纯数字，并避开全同、连号、常见弱口令；
 * 明文只返回给调用方一次（管理员/教师当面告知用户），数据库仅保存 bcrypt 哈希。
 *
 * @returns {string} 8 位数字明文
 */
function generateTempPassword() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let candidate = ''
    for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
      candidate += crypto.randomInt(0, 10)
    }
    if (WEAK_TEMP_PASSWORDS.has(candidate)) continue
    if (/^(\d)\1+$/.test(candidate)) continue
    if (isSequentialDigits(candidate)) continue
    return candidate
  }
  // 理论上到不了这里；兜底仍返回 8 位随机数字（不含固定值）
  return String(crypto.randomInt(10_000_000, 100_000_000))
}

/**
 * 历史工具：生成指定长度的随机字母数字口令
 * 仅供旧脚本/旧测试使用；账号重置与新建请使用 generateTempPassword
 * @param {number} length
 * @returns {string}
 */
function generateTemporaryPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars.charAt(crypto.randomInt(0, chars.length))
  }
  return out
}

/**
 * 明文密码 -> bcrypt 哈希
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

/**
 * 校验明文密码与哈希是否匹配
 */
async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false
  return bcrypt.compare(plain, hash)
}

/**
 * 获取默认初始密码的哈希值
 * 仅保留给 migrate_auth.js 等历史迁移脚本；新流程请用 generateTempPassword
 */
async function getDefaultPasswordHash() {
  return hashPassword(DEFAULT_STUDENT_PASSWORD)
}

// 账号不存在时用于"陪跑"的哈希，避免通过响应耗时枚举账号
let dummyHashPromise = null
function getDummyPasswordHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomBytes(16).toString('hex'))
  }
  return dummyHashPromise
}

/**
 * 从学号中提取班级编码（前 6 位）
 * 学号长度至少为 6 位（推荐 8 位：前 6 = 班级编码，后 2 = 序号）
 */
function extractClassCode(studentId) {
  if (!studentId || typeof studentId !== 'string' || studentId.length < 6) return null
  return studentId.slice(0, 6)
}

/**
 * 查询教师班级范围：{ all, codes }
 * all=true 表示 can_view_all=1（可访问所有班级），此时 codes 可能为空
 */
async function getTeacherClassScope(teacherId) {
  const [fullRow, rows] = await Promise.all([
    get(`SELECT can_view_all FROM teachers WHERE id = ?`, [teacherId]),
    all(`SELECT class_code FROM teacher_classes WHERE teacher_id = ?`, [teacherId]),
  ])
  return {
    all: !!(fullRow && fullRow.can_view_all === 1),
    codes: rows.map((r) => r.class_code),
  }
}

/**
 * 查询教师所教班级编码集合（兼容旧调用方）
 *
 * 注意：can_view_all=1 时返回 ['*']，只能用于"是否全权限"的判断，
 * 禁止直接拼进 SQL 的 IN (...)（会查不到数据）。新代码请用 getTeacherClassScope。
 */
async function getTeacherClassCodes(teacherId) {
  const scope = await getTeacherClassScope(teacherId)
  return scope.all ? ['*'] : scope.codes
}

/**
 * 校验教师是否有权管理指定班级的学生
 * can_view_all=1 时放行所有班级
 */
async function teacherCanManageClass(teacherId, classCode) {
  if (!teacherId || !classCode) return false
  // 全权限快速放行
  const row = await get(
    `SELECT 1 FROM teachers WHERE id = ? AND can_view_all = 1 LIMIT 1`,
    [teacherId],
  )
  if (row) return true
  // 具体班级匹配
  const match = await get(
    `SELECT 1 FROM teacher_classes WHERE teacher_id = ? AND class_code = ? LIMIT 1`,
    [teacherId, classCode],
  )
  return !!match
}

/**
 * 记录一次密码重置审计（教师/管理员重置都走这里）
 */
async function recordPasswordReset(targetType, targetId, resetByType, resetById) {
  await run(
    `INSERT INTO password_resets (target_type, target_id, reset_by_type, reset_by_id)
     VALUES (?, ?, ?, ?)`,
    [targetType, targetId, resetByType, resetById],
  )
}

/**
 * 重置学生密码为一次性随机口令，并记录审计
 * 明文只返回给调用方一次，数据库仅存哈希
 * @param {string} studentId 学号
 * @param {'teacher'|'admin'} resetByType
 * @param {string} resetById  教师手机号 或 管理员用户名
 * @returns {Promise<{success:boolean, reason?:string, temporary_password?:string}>}
 */
async function resetStudentPassword(studentId, resetByType, resetById) {
  const temporaryPassword = generateTempPassword()
  const newHash = await hashPassword(temporaryPassword)
  const now = new Date().toISOString()
  const info = await run(
    `UPDATE students
        SET password_hash = ?,
            must_reset_password = 1,
            updated_at = ?
      WHERE student_id = ?`,
    [newHash, now, studentId],
  )
  if (!info || info.changes === 0) {
    return { success: false, reason: 'STUDENT_NOT_FOUND' }
  }
  await recordPasswordReset('student', studentId, resetByType, resetById)
  return { success: true, temporary_password: temporaryPassword }
}

/**
 * 重置教师密码为一次性随机口令 + 强制首次改密，并记录审计（管理员操作）
 * @param {string} phone 教师手机号
 * @param {string} resetByAdmin 管理员用户名
 * @returns {Promise<{success:boolean, reason?:string, temporary_password?:string}>}
 */
async function resetTeacherPasswordByAdmin(phone, resetByAdmin) {
  const temporaryPassword = generateTempPassword()
  const newHash = await hashPassword(temporaryPassword)
  const now = new Date().toISOString()
  const info = await run(
    `UPDATE teachers
        SET password_hash = ?,
            must_reset_password = 1,
            updated_at = ?
      WHERE phone = ?`,
    [newHash, now, phone],
  )
  if (!info || info.changes === 0) {
    return { success: false, reason: 'TEACHER_NOT_FOUND' }
  }
  await recordPasswordReset('teacher', phone, 'admin', resetByAdmin)
  return { success: true, temporary_password: temporaryPassword }
}

module.exports = {
  DEFAULT_STUDENT_PASSWORD,
  DEFAULT_TEACHER_PASSWORD,
  BCRYPT_ROUNDS,
  hashPassword,
  verifyPassword,
  getDefaultPasswordHash,
  getDummyPasswordHash,
  generateTempPassword,
  generateTemporaryPassword,
  extractClassCode,
  getTeacherClassScope,
  getTeacherClassCodes,
  teacherCanManageClass,
  recordPasswordReset,
  resetStudentPassword,
  resetTeacherPasswordByAdmin,
}
