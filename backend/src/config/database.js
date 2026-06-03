/**
 * 数据库配置模块
 * 负责数据库连接和表初始化
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 确定数据库路径（支持测试模式）
const dbDir = process.env.TEST_MODE 
  ? path.join(__dirname, '../..') 
  : path.join(__dirname, '../../database');

const dbPath = process.env.DB_PATH || path.join(dbDir, 'answers.db');

// 确保 database 目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('成功连接到 SQLite 数据库');
});

/**
 * 创建索引优化查询性能
 */
function createIndexes() {
  db.run(`CREATE INDEX IF NOT EXISTS idx_wen_id ON answer_records(wen_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_student_id ON answer_records(student_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_wen_student ON answer_records(wen_id, student_id)`);
}

/**
 * 初始化数据库表
 */
function initTables() {
  return new Promise((resolve, reject) => {
    // 学生表
    db.run(
      `CREATE TABLE IF NOT EXISTS students (
        student_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        class INTEGER DEFAULT 9,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) {
          console.error('创建学生表失败:', err.message);
          return reject(err);
        }
        
        // 答题情况表
        db.run(
          `CREATE TABLE IF NOT EXISTS answer_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wen_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            user_answer TEXT NOT NULL,
            correct_answer TEXT,
            is_correct INTEGER DEFAULT 0,
            score INTEGER DEFAULT 0,
            submitted_at TEXT NOT NULL,
            attempt_number INTEGER DEFAULT 1
          )`,
          (err) => {
            if (err) {
              console.error('创建答题情况表失败:', err.message);
              return reject(err);
            }
            createIndexes();
            resolve();
          }
        );
      }
    );
  });
}

module.exports = {
  db,
  dbPath,
  initTables
};