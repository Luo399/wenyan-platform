/**
 * AI 对话相关表迁移脚本（幂等）
 *
 * 用途：
 *  1. 创建 ai_usage           —— AI 对话调用记录
 *  2. 创建 ai_quota_daily     —— 日配额
 *  3. 创建 ai_quota_weekly    —— 周配额
 *  4. 创建 ai_quota_monthly   —— 月配额
 *
 * 运行：
 *   node backend/scripts/migrate_ai.js
 *
 * 启动时也会由 backend/src/app.js 中的 migrateAiTablesIfNeeded 自动调用一次。
 * 所有语句使用 CREATE TABLE IF NOT EXISTS，可重复执行。
 */

const path = require('path')
const { db, initAllTables } = require(path.join(__dirname, '../src/config/database'))
const { dbRun } = require(path.join(__dirname, '../src/utils/dbPromise'))

async function migrateAiTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      wen_id TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ai_quota_daily (
      student_id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      used_tokens INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ai_quota_weekly (
      student_id TEXT PRIMARY KEY,
      week TEXT NOT NULL,
      used_tokens INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ai_quota_monthly (
      student_id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      used_tokens INTEGER NOT NULL DEFAULT 0
    )`,
    // 常用索引
    `CREATE INDEX IF NOT EXISTS idx_ai_usage_student ON ai_usage(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_usage_wen ON ai_usage(wen_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at)`,
  ]

  for (const sql of tables) {
    await dbRun(db, sql)
  }

  console.log('[migrate_ai] AI 相关表已就绪（ai_usage / ai_quota_daily / ai_quota_weekly / ai_quota_monthly）')
}

// 允许作为独立脚本运行
if (require.main === module) {
  ;(async () => {
    try {
      await initAllTables()
      await migrateAiTables()
      process.exit(0)
    } catch (err) {
      console.error('[migrate_ai] 失败:', err.message)
      process.exit(1)
    }
  })()
}

module.exports = {
  migrateAiTables,
}
