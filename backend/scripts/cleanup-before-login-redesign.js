/**
 * 登录改造前一次性清理脚本
 *
 * 做两件事：
 *   1. 预览 / 删除所有 length(student_id) != 8 或非全数字的学生
 *   2. 重置所有教师密码为 hash('99999999')
 *
 * 使用：
 *   node scripts/cleanup-before-login-redesign.js              # 默认 dry-run
 *   node scripts/cleanup-before-login-redesign.js --execute     # 真正执行
 *
 * 环境变量：
 *   DB_PATH=... 可指定数据库路径，默认走 backend/src/config/database.js 的解析逻辑
 */

require('dotenv').config()

const { dbReady, initAllTables } = require('../src/config/database')
const { dbRun, dbAll } = require('../src/utils/dbPromise')
const { hashPassword, DEFAULT_TEACHER_PASSWORD } = require('../src/services/authService')

async function main() {
  const isDryRun = !process.argv.includes('--execute')
  const modeTag = isDryRun ? '[DRY RUN]' : '[EXECUTE]'

  console.log('========================================')
  console.log('登录改造前清理脚本')
  console.log(`模式: ${modeTag}`)
  console.log('========================================')

  // 等数据库就绪 + 幂等初始化（确保表结构是最新的）
  await dbReady
  await initAllTables()
  const { db } = require('../src/config/database')

  // ========== 1. 预览/清理不合格学生 ==========
  const badStudents = await dbAll(
    db,
    `SELECT student_id, student_name FROM students
     WHERE length(student_id) != 8 OR student_id NOT GLOB '[0-9]*'`,
  )

  console.log(`\n${modeTag} 不符合 8 位纯数字学号的学生：${badStudents.length} 条`)
  badStudents.forEach((s) =>
    console.log(`  - ${s.student_id}  ${s.student_name || ''}`),
  )

  if (isDryRun) {
    console.log(`\n${modeTag} 未做任何修改。加 --execute 真正执行。`)
    process.exit(0)
  }

  if (badStudents.length > 0) {
    const delInfo = await dbRun(
      db,
      `DELETE FROM students
       WHERE length(student_id) != 8 OR student_id NOT GLOB '[0-9]*'`,
    )
    console.log(`已删除 ${delInfo.changes} 条不合格学生记录`)
  } else {
    console.log('没有需要清理的学生记录，跳过')
  }

  // ========== 2. 重置教师密码 ==========
  const tc = await dbAll(db, `SELECT COUNT(*) AS c FROM teachers`)
  const newHash = await hashPassword(DEFAULT_TEACHER_PASSWORD)
  const updateInfo = await dbRun(
    db,
    `UPDATE teachers SET password_hash = ?, updated_at = datetime('now')`,
    [newHash],
  )
  console.log(
    `\n已将 ${updateInfo.changes} 位教师密码重置为 ${DEFAULT_TEACHER_PASSWORD}`,
  )
  console.log(`（teachers 表当前共 ${tc[0].c} 条）`)

  console.log('\n清理完成')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ 执行失败:', err)
  process.exit(1)
})
