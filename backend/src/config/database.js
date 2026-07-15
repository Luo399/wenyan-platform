const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const path = require('path')

const dbDir = path.join(__dirname, '../../database')

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new sqlite3.Database(path.join(dbDir, 'answers.db'), (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message)
    process.exit(1)
  }
  console.log('成功连接到 SQLite 数据库')
})

function initAllTables() {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT NOT NULL,
        wen_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        user_answer TEXT NOT NULL,
        correct_answer TEXT,
        submitted_at TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        is_correct INTEGER DEFAULT 0,
        attempt_number INTEGER DEFAULT 1,
        UNIQUE(student_id, question_id)
      )`,
      (err) => {
        if (err) {
          console.error('创建answers表失败:', err.message)
          return reject(err)
        }

        db.run(
          `CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL UNIQUE,
            student_name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          (err) => {
            if (err) {
              console.error('创建students表失败:', err.message)
              return reject(err)
            }
            resolve()
          }
        )
      }
    )
  })
}

module.exports = {
  db,
  initAllTables,
}