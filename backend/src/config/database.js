/**
 * 数据库配置模块
 * 负责数据库连接和表初始化
 * 
 * 数据库分离策略：
 * - students.db: 学生信息表
 * - answer_records.db: 答题记录表
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 确定数据库目录（支持测试模式）
const dbDir = process.env.TEST_MODE 
  ? path.join(__dirname, '../..') 
  : path.join(__dirname, '../../database');

// 确保 database 目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ==================== 学生数据库 ====================
const studentDbPath = process.env.STUDENT_DB_PATH || path.join(dbDir, 'students.db');
const studentDb = new sqlite3.Database(studentDbPath, (err) => {
  if (err) {
    console.error('学生数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('成功连接到学生数据库');
});

// ==================== 答题记录数据库 ====================
const answerDbPath = process.env.ANSWER_DB_PATH || path.join(dbDir, 'answer_records.db');
const answerDb = new sqlite3.Database(answerDbPath, (err) => {
  if (err) {
    console.error('答题记录数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('成功连接到答题记录数据库');
});

/**
 * 初始化学生数据库表
 */
function initStudentTables() {
  return new Promise((resolve, reject) => {
    studentDb.run(
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
        console.log('学生表初始化完成');
        resolve();
      }
    );
  });
}

/**
 * 初始化答题记录数据库表
 */
function initAnswerTables() {
  return new Promise((resolve, reject) => {
    answerDb.run(
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
        
        // 创建索引
        answerDb.run(`CREATE INDEX IF NOT EXISTS idx_wen_id ON answer_records(wen_id)`);
        answerDb.run(`CREATE INDEX IF NOT EXISTS idx_student_id ON answer_records(student_id)`);
        answerDb.run(`CREATE INDEX IF NOT EXISTS idx_wen_student ON answer_records(wen_id, student_id)`);
        
        console.log('答题记录表初始化完成');
        resolve();
      }
    );
  });
}

/**
 * 初始化所有数据库
 */
async function initAllTables() {
  await initStudentTables();
  await initAnswerTables();
}

/**
 * 关闭所有数据库连接
 */
function closeAllDatabases() {
  studentDb.close((err) => {
    if (err) console.error('关闭学生数据库失败:', err.message);
  });
  answerDb.close((err) => {
    if (err) console.error('关闭答题记录数据库失败:', err.message);
  });
}

module.exports = {
  // 数据库连接
  studentDb,
  answerDb,
  
  // 数据库路径
  studentDbPath,
  answerDbPath,
  
  // 初始化函数
  initStudentTables,
  initAnswerTables,
  initAllTables,
  
  // 关闭连接
  closeAllDatabases
};
