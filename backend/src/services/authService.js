const bcrypt = require('bcryptjs')
const { db } = require('../config/database')
const { dbRun, dbGet, dbAll } = require('../utils/dbPromise')

// 为了调用简洁，二次绑定 db 参数
function run(sql, params = []) { return dbRun(db, sql, params) }
function get(sql, params = []) { return dbGet(db, sql, params) }
function all(sql, params = []) { return dbAll(db, sql, params) }

// 学生初始默认密码（所有新建/重置统一用此值）
const DEFAULT_STUDENT_PASSWORD = '123456'

// bcrypt cost factor
const BCRYPT_ROUNDS = 10

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
 * 获取默认初始密码的哈希值（用于迁移脚本批量写入）
 */
async function getDefaultPasswordHash() {
  return hashPassword(DEFAULT_STUDENT_PASSWORD)
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
 * 查询教师所教班级编码集合
 * @param {number} teacherId teachers.id
 */
async function getTeacherClassCodes(teacherId) {
  const rows = await all(
    `SELECT class_code FROM teacher_classes WHERE teacher_id = ?`,
    [teacherId],
  )
  return rows.map((r) => r.class_code)
}

/**
 * 校验教师是否有权管理指定班级的学生
 */
async function teacherCanManageClass(teacherId, classCode) {
  if (!teacherId || !classCode) return false
  const row = await get(
    `SELECT 1 FROM teacher_classes WHERE teacher_id = ? AND class_code = ? LIMIT 1`,
    [teacherId, classCode],
  )
  return !!row
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
 * 重置学生密码为默认初始密码，并记录审计
 * @param {string} studentId 学号
 * @param {'teacher'|'admin'} resetByType
 * @param {string} resetById  教师手机号 或 管理员用户名
 */
async function resetStudentPassword(studentId, resetByType, resetById) {
  const newHash = await getDefaultPasswordHash()
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
  return { success: true }
}

/**
 * 重置教师密码为随机 10 位 + 强制首次改密，并记录审计（管理员操作）
 * @param {string} phone 教师手机号
 * @param {string} resetByAdmin 管理员用户名
 * @returns {Promise<{success:boolean, reason?:string, temporaryPassword?:string}>}
 */
async function resetTeacherPasswordByAdmin(phone, resetByAdmin) {
  const temporaryPassword = generateTemporaryPassword(10)
  const newHash = await hashPassword(temporaryPassword)
  const now = new Date().toISOString()
  const info = await run(
    `UPDATE teachers
        SET password_hash = ?,
            updated_at = ?
      WHERE phone = ?`,
    [newHash, now, phone],
  )
  if (!info || info.changes === 0) {
    return { success: false, reason: 'TEACHER_NOT_FOUND' }
  }
  await recordPasswordReset('teacher', phone, 'admin', resetByAdmin)
  return { success: true, temporaryPassword }
}

/**
 * 生成随机临时密码（不含易混字符 0/O/1/l 等）
 */
function generateTemporaryPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

module.exports = {
  DEFAULT_STUDENT_PASSWORD,
  BCRYPT_ROUNDS,
  hashPassword,
  verifyPassword,
  getDefaultPasswordHash,
  extractClassCode,
  getTeacherClassCodes,
  teacherCanManageClass,
  recordPasswordReset,
  resetStudentPassword,
  resetTeacherPasswordByAdmin,
  generateTemporaryPassword,
}
