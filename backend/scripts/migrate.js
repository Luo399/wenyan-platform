/**
 * 数据库迁移脚本
 * 从零开始创建完整的数据库表结构
 * 
 * 使用方法：
 *   node scripts/migrate.js
 * 
 * 环境变量（在 .env 中配置）：
 *   STUDENT_DB_PATH - 学生数据库文件路径
 *   ANSWER_DB_PATH - 答题记录数据库文件路径
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// ============================================================
// 数据库路径配置
// ============================================================

// 默认数据库目录
const defaultDbDir = path.join(__dirname, '..', 'database');

// 从环境变量获取数据库路径，或使用默认值
const studentDbPath = process.env.STUDENT_DB_PATH || path.join(defaultDbDir, 'students.db');
const answerDbPath = process.env.ANSWER_DB_PATH || path.join(defaultDbDir, 'answer_records.db');

console.log('========================================');
console.log('数据库迁移脚本');
console.log('========================================');
console.log(`学生数据库路径: ${studentDbPath}`);
console.log(`答题记录数据库路径: ${answerDbPath}`);
console.log('========================================');

// ============================================================
// 创建数据库目录
// ============================================================

function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ 创建目录: ${dir}`);
  }
}

// ============================================================
// 学生数据库表结构
// ============================================================

const STUDENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class TEXT DEFAULT '9',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

const STUDENTS_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_students_class ON students(class)',
];

// ============================================================
// 答题记录数据库表结构
// ============================================================

const ANSWER_RECORDS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS answer_records (
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
)
`;

const ANSWER_RECORDS_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_answer_wen_id ON answer_records(wen_id)',
  'CREATE INDEX IF NOT EXISTS idx_answer_student_id ON answer_records(student_id)',
  'CREATE INDEX IF NOT EXISTS idx_answer_wen_student ON answer_records(wen_id, student_id)',
  'CREATE INDEX IF NOT EXISTS idx_answer_submitted_at ON answer_records(submitted_at)',
];

// ============================================================
// 迁移函数
// ============================================================

async function migrateDatabase(dbPath, tableName, tableSql, indexes) {
  return new Promise((resolve, reject) => {
    // 确保目录存在
    ensureDirectoryExists(dbPath);
    
    // 连接数据库
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error(`❌ 连接数据库失败: ${dbPath}`, err.message);
        return reject(err);
      }
      console.log(`✅ 连接数据库: ${dbPath}`);
    });

    // 创建表
    db.run(tableSql, (err) => {
      if (err) {
        console.error(`❌ 创建表 ${tableName} 失败:`, err.message);
        db.close();
        return reject(err);
      }
      console.log(`✅ 创建表: ${tableName}`);

      // 创建索引
      const indexPromises = indexes.map((indexSql) => {
        return new Promise((res, rej) => {
          db.run(indexSql, (err) => {
            if (err) {
              console.error(`❌ 创建索引失败:`, err.message);
              rej(err);
            } else {
              console.log(`✅ 创建索引: ${indexSql.match(/idx_\w+/)?.[0] || 'unknown'}`);
              res();
            }
          });
        });
      });

      Promise.all(indexPromises)
        .then(() => {
          db.close((err) => {
            if (err) console.error('关闭数据库失败:', err.message);
          });
          resolve();
        })
        .catch((err) => {
          db.close((closeErr) => {
            reject(err || closeErr);
          });
        });
    });
  });
}

// ============================================================
// 主函数
// ============================================================

async function runMigration() {
  try {
    console.log('\n开始迁移学生数据库...');
    await migrateDatabase(studentDbPath, 'students', STUDENTS_TABLE_SQL, STUDENTS_INDEXES);

    console.log('\n开始迁移答题记录数据库...');
    await migrateDatabase(answerDbPath, 'answer_records', ANSWER_RECORDS_TABLE_SQL, ANSWER_RECORDS_INDEXES);

    console.log('\n========================================');
    console.log('✅ 数据库迁移完成！');
    console.log('========================================');
    console.log('\n下一步：运行 node scripts/seed.js 导入数据');
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 迁移失败:', err);
    process.exit(1);
  }
}

// 执行迁移
runMigration();