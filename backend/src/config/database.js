const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const path = require('path')
const { hashDefaultPassword } = require('../utils/password')

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

/**
 * 检查表是否存在
 */
function tableExists(tableName) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName],
      (err, row) => {
        if (err) return reject(err)
        resolve(!!row)
      }
    )
  })
}

/**
 * 获取表的所有列名
 */
function getTableColumns(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) return reject(err)
      resolve(rows.map(r => r.name))
    })
  })
}

/**
 * 创建 answers 表
 */
function createAnswersTable() {
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
        if (err) return reject(err)
        resolve()
      }
    )
  })
}

/**
 * 迁移旧 students 表数据到新的 8 位学号格式
 */
async function migrateOldStudents() {
  return new Promise((resolve, reject) => {
    db.all('SELECT student_id, student_name FROM students_old', async (err, rows) => {
      if (err) return reject(err)
      if (!rows || rows.length === 0) {
        console.log('旧 students 表无数据，无需迁移')
        return resolve()
      }

      console.log(`发现 ${rows.length} 条旧学生记录，开始迁移...`)
      const defaultHash = await hashDefaultPassword()
      const now = new Date().toISOString()

      const insertStmt = db.prepare(
        `INSERT OR IGNORE INTO students (student_id, student_name, password_hash, password_changed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )

      let migrated = 0
      for (const row of rows) {
        const oldId = String(row.student_id).trim()
        // 旧学号补零到 8 位
        const newId = oldId.padStart(8, '0')
        insertStmt.run(
          newId,
          row.student_name || null,
          defaultHash,
          0,
          now,
          now
        )
        migrated++
      }

      insertStmt.finalize((err) => {
        if (err) return reject(err)
        console.log(`成功迁移 ${migrated} 条学生记录`)
        resolve()
      })
    })
  })
}

/**
 * 创建新的 students 表（支持密码等字段）
 * 如果旧表存在且无 password_hash 列，则先迁移数据
 */
async function createStudentsTable() {
  const exists = await tableExists('students')
  const columns = exists ? await getTableColumns('students') : []
  const isOldTable = exists && !columns.includes('password_hash')

  if (isOldTable) {
    // 旧表存在且无密码字段，先改名备份
    console.log('检测到旧 students 表，开始数据迁移...')
    await new Promise((resolve, reject) => {
      db.run('ALTER TABLE students RENAME TO students_old', (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  // 创建新表
  await new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT NOT NULL UNIQUE,
        student_name TEXT,
        password_hash TEXT NOT NULL,
        password_changed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) return reject(err)
        resolve()
      }
    )
  })

  // 如果有旧表，迁移数据
  if (isOldTable) {
    await migrateOldStudents()
    // 删除旧表
    await new Promise((resolve, reject) => {
      db.run('DROP TABLE IF EXISTS students_old', (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

/**
 * 创建 teachers 表
 */
async function createTeachersTable() {
  await new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        school TEXT,
        classes TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_changed INTEGER DEFAULT 0,
        role TEXT DEFAULT 'teacher',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) return reject(err)
        resolve()
      }
    )
  })
}

/**
 * 创建默认管理员账号
 */
async function createDefaultAdmin() {
  const { hashPassword } = require('../utils/password')
  const defaultHash = await hashPassword('admin123')
  const now = new Date().toISOString()

  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM teachers WHERE role = 'admin' LIMIT 1", async (err, row) => {
      if (err) return reject(err)
      if (row) {
        console.log('管理员账号已存在，跳过创建')
        return resolve()
      }

      db.run(
        `INSERT INTO teachers (name, phone, school, classes, password_hash, password_changed, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['系统管理员', '13800000000', '系统', '[]', defaultHash, 0, 'admin', now, now],
        (err) => {
          if (err) return reject(err)
          console.log('默认管理员账号创建成功（手机号: 13800000000, 密码: admin123）')
          resolve()
        }
      )
    })
  })
}

/**
 * 初始化所有表
 */
async function initAllTables() {
  try {
    await createAnswersTable()
    await createStudentsTable()
    await createTeachersTable()
    await createDefaultAdmin()
    console.log('数据库初始化完成')
  } catch (err) {
    console.error('数据库初始化失败:', err.message)
    throw err
  }
}

module.exports = {
  db,
  initAllTables,
}
