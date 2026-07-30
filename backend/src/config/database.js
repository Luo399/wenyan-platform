const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const path = require('path')

/**
 * 数据库文件路径解析：
 *  - 优先读 process.env.DB_PATH（测试可用 ':memory:' 或自定义路径）
 *  - 默认 backend/database/answers.db
 *  - ':memory:' 直接传给 sqlite3，不 join 目录，否则 path.join 拼出 'database/:memory:' 就不是内存库了
 */
function resolveDbPath() {
  const envPath = process.env.DB_PATH
  if (envPath && envPath.trim() !== '') {
    if (envPath === ':memory:') return ':memory:'
    return envPath
  }
  const dbDir = path.join(__dirname, '../../database')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  return path.join(dbDir, 'answers.db')
}

const dbPath = resolveDbPath()
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message)
    process.exit(1)
  }
  console.log('成功连接到 SQLite 数据库:', dbPath)
})

// 顺序串行执行若干条 DDL，方便在 Promise 链里使用
function runSql(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

/**
 * 初始化所有业务表
 *
 * 注意：SQLite 的 ALTER TABLE 支持有限（不能加带 DEFAULT 或列排序规则等），
 * 因此 students 表使用"旧表改名 -> 新表重建 -> 数据迁移"的方式升级。
 * 迁移逻辑由单独脚本 scripts/migrate_auth.js 负责。
 */
function initAllTables() {
  return (
    Promise.resolve()
      // 1. 学校字典表
      .then(() =>
        runSql(
          `CREATE TABLE IF NOT EXISTS schools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
          )`,
        ),
      )
      // 2. 管理员表（先建，与其它表互不依赖）
      .then(() =>
        runSql(
          `CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            last_login_at TEXT,
            created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
          )`,
        ),
      )
      // 3. 教师表
      .then(() =>
        runSql(
          `CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            school_id INTEGER NOT NULL,
            password_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
            updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
            FOREIGN KEY (school_id) REFERENCES schools(id)
          )`,
        ),
      )
      // 4. 学生表（如果旧表还在则重命名为 students_old，再重建新 students）
      .then(() => checkAndUpgradeStudentsTable())
      // 5. 教师-班级关系
      .then(() =>
        runSql(
          `CREATE TABLE IF NOT EXISTS teacher_classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            class_code TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
            UNIQUE(teacher_id, class_code),
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
          )`,
        ),
      )
      // 6. 密码重置审计
      .then(() =>
        runSql(
          `CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            reset_by_type TEXT NOT NULL,
            reset_by_id TEXT NOT NULL,
            reset_at TEXT NOT NULL DEFAULT (DATETIME('now'))
          )`,
        ),
      )
      // 7. answers 答题记录表（沿用原 schema）
      .then(() =>
        runSql(
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
        ),
      )
      // 索引
      .then(() =>
        Promise.all([
          runSql('CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_code)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_tc_class ON teacher_classes(class_code)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_pr_target ON password_resets(target_type, target_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_answers_wen_id ON answers(wen_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_answers_student_id ON answers(student_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_answers_wen_student ON answers(wen_id, student_id)'),
        ]),
      )
      .then(() => {
        console.log('[database] 所有表初始化/升级完成')
      })
  )
}

/**
 * 如果存在"旧版 students 表"（含 student_name/class 老字段且无 password_hash/must_reset_password），
 * 则改名为 students_old，再按新 schema 重建 students 表。
 * 真正的数据迁移由 scripts/migrate_auth.js 负责。
 *
 * 判断依据：SQLite PRAGMA table_info(students) 中若不包含 password_hash 列即视为旧结构。
 */
function checkAndUpgradeStudentsTable() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(students)", (err, columns) => {
      if (err) return reject(err)

      const columnNames = (columns || []).map((c) => c.name)
      const hasNewColumns =
        columnNames.includes('password_hash') &&
        columnNames.includes('must_reset_password') &&
        columnNames.includes('class_code')

      const createNew = () =>
        runSql(
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
        )
          .then(resolve)
          .catch(reject)

      // 新库直接创建
      if (columnNames.length === 0) return createNew()
      if (hasNewColumns) {
        // 已是新结构，直接 resolve
        return resolve()
      }

      // 旧结构：先改名为 students_old 再建新表
      runSql('ALTER TABLE students RENAME TO students_old')
        .then(() => createNew())
        .then(() => {
          console.log('[database] students 表已升级为新 schema，旧数据保存在 students_old')
          resolve()
        })
        .catch((err) => {
          // 若重命名失败但新表已创建，忽略该错误可接受
          const msg = String((err && err.message) || '')
          if (msg.includes('already exists') || msg.includes('students')) {
            return resolve()
          }
          reject(err)
        })
    })
  })
}

module.exports = {
  db,
  initAllTables,
}
