/**
 * 添加测试学生脚本
 * 手动插入测试学号 99999999，初始密码 123456
 *
 * 使用方法:
 *   node scripts/add-test-student.js
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// 数据库路径
const dbDir = path.join(__dirname, '..', 'database');
const dbPath = process.env.DB_PATH || path.join(dbDir, 'answers.db');

// 密码相关常量
const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = '123456';

console.log('========================================');
console.log('添加测试学生');
console.log('========================================');
console.log(`数据库路径: ${dbPath}`);
console.log('========================================');

// 连接数据库
function connectDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

// 初始化表结构（与 server 启动时一致）
function initTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');

      // schools 表
      db.run(
        `CREATE TABLE IF NOT EXISTS schools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
        )`
      );

      // students 表（新版本带 password_hash）
      db.run(
        `CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT NOT NULL UNIQUE,
          student_name TEXT NOT NULL,
          class_code TEXT NOT NULL,
          school_id INTEGER,
          password_hash TEXT NOT NULL,
          must_reset_password INTEGER NOT NULL DEFAULT 1,
          created_by TEXT,
          created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
          updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
          FOREIGN KEY (school_id) REFERENCES schools(id)
        )`,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  });
}

// 确保存在默认学校
function ensureDefaultSchool(db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM schools LIMIT 1', (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row.id);
      // 插入默认学校
      db.run(
        `INSERT INTO schools (code, name) VALUES (?, ?)`,
        ['DEFAULT-SCHOOL-001', '默认学校'],
        function(insertErr) {
          if (insertErr) return reject(insertErr);
          console.log('✓ 已插入默认学校 (ID: ' + this.lastID + ')');
          resolve(this.lastID);
        }
      );
    });
  });
}

// 检查学生是否已存在
function checkStudentExists(db, studentId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM students WHERE student_id = ?',
      [studentId],
      (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      }
    );
  });
}

// 插入学生
function insertStudent(db, studentId, studentName, classCode, schoolId, passwordHash) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO students (
        student_id, student_name, class_code, school_id,
        password_hash, must_reset_password, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [studentId, studentName, classCode, schoolId, passwordHash, 'manual', now, now],
      function(err) {
        if (err) return reject(err);
        resolve({ lastId: this.lastID });
      }
    );
  });
}

// 主函数
async function run() {
  const studentId = '99999999';
  const studentName = '测试学生';

  try {
    const db = await connectDatabase();
    console.log('✓ 成功连接数据库');

    // 初始化表结构
    console.log('正在初始化表结构...');
    await initTables(db);
    console.log('✓ 表结构就绪');

    // 确认默认学校存在
    const schoolId = await ensureDefaultSchool(db);
    console.log(`✓ 使用学校 ID: ${schoolId}`);

    // 提取班级编码（前 6 位）
    const classCode = studentId.slice(0, 6); // '999999'

    // 检查是否已存在
    const exists = await checkStudentExists(db, studentId);
    if (exists) {
      console.log(`⚠️  学生 ${studentId} 已存在，无需重复插入`);
      db.close();
      process.exit(0);
    }

    // 生成密码哈希
    console.log(`正在生成密码哈希 (密码: ${DEFAULT_PASSWORD})...`);
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
    console.log('✓ 密码哈希生成完成');

    // 插入学生
    const result = await insertStudent(
      db,
      studentId,
      studentName,
      classCode,
      schoolId,
      passwordHash
    );

    console.log('');
    console.log('✅ 插入成功！');
    console.log(`  学号: ${studentId}`);
    console.log(`  姓名: ${studentName}`);
    console.log(`  班级编码: ${classCode}`);
    console.log(`  初始密码: ${DEFAULT_PASSWORD}`);
    console.log(`  强制改密: 是 (must_reset_password = 1)`);
    console.log(`  记录 ID: ${result.lastId}`);

    db.close();
    console.log('\n========================================');
    console.log('完成！可以使用以下信息登录：');
    console.log(`  学号: ${studentId}`);
    console.log(`  密码: ${DEFAULT_PASSWORD}`);
    console.log('========================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 失败:', err.message);
    process.exit(1);
  }
}

// 执行
run();