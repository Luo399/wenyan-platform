const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')
const logger = require('../utils/logger')

/**
 * 数据库文件路径解析：
 *  - 优先读 process.env.DB_PATH（测试可用 ':memory:' 或自定义路径）
 *  - 默认 backend/database/answers.db
 *  - ':memory:' 直接传给 sqlite3
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

// 数据库连接就绪 Promise（仅连接，不包括建表）
let _dbReadyResolve, _dbReadyReject
const dbReady = new Promise((resolve, reject) => {
  _dbReadyResolve = resolve
  _dbReadyReject = reject
})

// 数据库实例（模块级变量，恢复后重新赋值）
let db

/**
 * 数据库损坏后自动恢复：备份损坏文件
 * 返回 true 表示备份成功，false 表示失败
 */
function recoverFromCorruption() {
  logger.error('数据库文件损坏，尝试自动恢复...')
  const backupPath = `${dbPath}.corrupted.${Date.now()}`
  try {
    fs.renameSync(dbPath, backupPath)
    logger.info(`已备份损坏的数据库文件到: ${backupPath}`)
    return true
  } catch (backupErr) {
    console.error('备份损坏数据库文件失败:', backupErr.message)
    return false
  }
}

/**
 * 连接到数据库（首次连接或损坏恢复后重连）
 * 返回一个 Promise，连接完成后 resolve
 */
function connectToDatabase() {
  return new Promise((resolve) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        // 检测 SQLITE_CORRUPT：数据库文件损坏
        if (err.message && err.message.includes('SQLITE_CORRUPT')) {
          if (recoverFromCorruption()) {
            resolve(connectToDatabase()) // 递归重试
          } else {
            _dbReadyReject(err)
            resolve()
          }
          return
        }
        console.error('数据库连接失败:', err.message)
        _dbReadyReject(err)
        resolve()
        return
      }
      console.log('成功连接到 SQLite 数据库:', dbPath)
      db.run('PRAGMA journal_mode = WAL', (pragmaErr) => {
        if (pragmaErr) console.error('设置 WAL 模式失败:', pragmaErr.message)
      })
      db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
        if (pragmaErr) console.error('启用外键约束失败:', pragmaErr.message)
      })
      _dbReadyResolve(db)
      resolve()
    })
  })
}

// 首次连接
connectToDatabase()

/**
 * 顺序串行执行若干条 SQL，方便在 Promise 链里使用
 */
function runSql(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

/**
 * B07: 迁移旧版 answers 表
 * 旧版含 UNIQUE(student_id, question_id) 约束，与 attempt_number 多次作答矛盾。
 * 通过"旧表改名 → 建新表 → 数据迁移 → 删旧表"完成升级。
 */
function migrateAnswersTableIfNeeded() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA index_list('answers')", (err, indexes) => {
      if (err) return reject(err)

      const uniqueIdx = (indexes || []).find(
        (idx) => idx.origin === 'u' && idx.tbl_name === 'answers',
      )

      if (!uniqueIdx) {
        return resolve()
      }

      logger.info('[database] 检测到旧版 answers 表 UNIQUE 约束，开始迁移...')

      db.run('ALTER TABLE answers RENAME TO answers_old', (renameErr) => {
        if (renameErr) return reject(renameErr)

        runSql(
          `CREATE TABLE answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            wen_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            user_answer TEXT NOT NULL,
            correct_answer TEXT,
            submitted_at TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            is_correct INTEGER DEFAULT 0,
            attempt_number INTEGER DEFAULT 1
          )`,
        )
          .then(() =>
            runSql(
              `INSERT INTO answers (id, student_id, wen_id, question_id, user_answer, correct_answer, submitted_at, score, is_correct, attempt_number)
               SELECT id, student_id, wen_id, question_id, user_answer, correct_answer, submitted_at, score, is_correct, attempt_number
               FROM answers_old`,
            ),
          )
          .then(() => runSql('DROP TABLE answers_old'))
          .then(() => {
            logger.info('[database] answers 表迁移完成')
            resolve()
          })
          .catch(reject)
      })
    })
  })
}

// 数据库初始化状态追踪
let _initStarted = false
let _initPromise = null

/**
 * 执行建表 SQL 链（不含 dbReady 等待，由外层调用者保证连接已就绪）
 */
function buildInitChain() {
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
      // 2. 管理员表
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
      // 4. 学生表
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
      // 7. answers 答题记录表
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
            attempt_number INTEGER DEFAULT 1
          )`,
        ),
      )
      // B07 迁移：旧版 answers 表去 UNIQUE 约束
      .then(() => migrateAnswersTableIfNeeded())
      // 8. tracking_events 用户行为埋点表
      .then(() =>
        runSql(
          `CREATE TABLE IF NOT EXISTS tracking_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT '',
            session_id TEXT NOT NULL DEFAULT '',
            event_type TEXT NOT NULL,
            step_id TEXT NOT NULL DEFAULT '',
            properties TEXT NOT NULL DEFAULT '{}',
            page_url TEXT NOT NULL DEFAULT '',
            timestamp TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
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
          runSql('CREATE INDEX IF NOT EXISTS idx_answers_student_wen_q ON answers(student_id, wen_id, question_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_answers_submitted_at ON answers(submitted_at)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_tracking_event_type ON tracking_events(event_type)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_tracking_user_id ON tracking_events(user_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_tracking_session_id ON tracking_events(session_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_tracking_step_id ON tracking_events(step_id)'),
          runSql('CREATE INDEX IF NOT EXISTS idx_tracking_timestamp ON tracking_events(timestamp)'),
        ]),
      )
      // 9. 种子数据：默认学校（若 schools 为空）
      .then(() => seedDefaultSchool())
      // 10. 种子数据：默认管理员 admin/admin123（若 admins 为空）
      .then(() => seedDefaultAdmin())
      // 11. 种子数据：测试学生 99999999 / 123456
      .then(() => seedTestStudent())
      .then(() => {
        logger.info('[database] 所有表初始化/升级完成')
      })
  )
}

/**
 * 尝试执行初始化，若 SQLITE_CORRUPT 则恢复后重试（最多 3 次）
 */
function initAllTables() {
  if (_initStarted) return _initPromise
  _initStarted = true

  _initPromise = dbReady
    .then(() => buildInitChain())
    .catch((err) => {
      // 检测 SQLITE_CORRUPT
      const errMsg = String(err && err.message || err || '')
      if (errMsg.includes('SQLITE_CORRUPT') || errMsg.includes('database disk image is malformed')) {
        logger.error('初始化过程中检测到数据库损坏，尝试恢复...')
        if (recoverFromCorruption()) {
          // 重置幂等标记，允许重试
          _initStarted = false
          _initPromise = null
          // 等新连接建立后再重试
          return connectToDatabase().then(() => initAllTables())
        }
      }
      throw err
    })

  return _initPromise
}

/**
 * 检查并升级 students 表结构
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
        return resolve()
      }

      // 旧结构：先改名为 students_old 再建新表
      runSql('ALTER TABLE students RENAME TO students_old')
        .then(() => createNew())
        .then(() => {
          logger.info('[database] students 表已升级为新 schema，旧数据保存在 students_old')
          resolve()
        })
        .catch((err) => {
          const msg = String((err && err.message) || '')
          if (msg.includes('already exists') || msg.includes('students')) {
            return resolve()
          }
          reject(err)
        })
    })
  })
}

/**
 * 种子数据：若 schools 表为空，插入默认学校
 */
function seedDefaultSchool() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM schools LIMIT 1', (err, row) => {
      if (err) return reject(err)
      if (row) {
        logger.debug('[database] schools 已有数据，跳过默认学校初始化')
        return resolve()
      }
      db.run(
        `INSERT INTO schools (code, name) VALUES (?, ?)`,
        ['DEFAULT-SCHOOL-001', '默认学校（请在管理后台修改）'],
        (insertErr) => {
          if (insertErr) return reject(insertErr)
          logger.info('[database] 已插入默认学校')
          resolve()
        },
      )
    })
  })
}

/**
 * 种子数据：若 admins 表为空，插入默认管理员 admin / admin123
 */
function seedDefaultAdmin() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM admins LIMIT 1', (err, row) => {
      if (err) return reject(err)
      if (row) {
        logger.debug('[database] admins 已有数据，跳过默认管理员初始化')
        return resolve()
      }
      bcrypt.hash('admin123', 10, (hashErr, hash) => {
        if (hashErr) return reject(hashErr)
        db.run(
          `INSERT INTO admins (username, name, password_hash, role) VALUES (?, ?, ?, 'super_admin')`,
          ['admin', '超级管理员', hash],
          (insertErr) => {
            if (insertErr) return reject(insertErr)
            logger.info('[database] 已插入默认管理员  username=admin  password=admin123')
            resolve()
          },
        )
      })
    })
  })
}

/**
 * 种子数据：测试学生 99999999 / 123456（仅开发/测试环境）
 * 判断条件：students 表为空，且当前不是生产环境
 */
function seedTestStudent() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM students WHERE student_id = ?', ['99999999'], (err, row) => {
      if (err) return reject(err)
      if (row) {
        logger.debug('[database] 测试学生 99999999 已存在，跳过')
        return resolve()
      }
      // 获取默认学校 ID
      db.get('SELECT id FROM schools LIMIT 1', (err2, school) => {
        if (err2) return reject(err2)
        const schoolId = school ? school.id : 1
        const now = new Date().toISOString()
        bcrypt.hash('123456', 10, (hashErr, hash) => {
          if (hashErr) return reject(hashErr)
          db.run(
            `INSERT INTO students
              (student_id, student_name, class_code, school_id,
               password_hash, must_reset_password, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            ['99999999', '测试学生', '999999', schoolId, hash, 'system', now, now],
            (insertErr) => {
              if (insertErr) return reject(insertErr)
              logger.info('[database] 已插入测试学生  student_id=99999999  password=123456')
              resolve()
            },
          )
        })
      })
    })
  })
}

module.exports = {
  get db() { return db },
  dbReady,
  initAllTables,
}
