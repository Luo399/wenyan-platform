const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// ============================================================
// 安全护栏
// 1) 生产环境一律拒绝：本脚本在 --force 下会删除并重建数据库。
// 2) 默认只做 CREATE TABLE IF NOT EXISTS，不删任何数据。
// 3) 必须显式 --force 才允许删除，且删除前自动备份（保留最近 3 份）。
// ============================================================
if (process.env.NODE_ENV === 'production') {
  console.error('拒绝执行：NODE_ENV=production 时禁止运行 init_db.js（可能清空线上答题数据）。');
  console.error('生产库的初始化/迁移请走备份 + 人工确认流程。');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'answers.db');
const dbExisted = fs.existsSync(dbPath);
let shouldSeed = !dbExisted;

if (dbExisted && !FORCE) {
  console.log('检测到已存在的数据库，默认不删除，仅执行 CREATE TABLE IF NOT EXISTS。');
  console.log('如需重建（会先自动备份），请显式执行: node init_db.js --force');
}

if (dbExisted && FORCE) {
  const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const backupPath = `${dbPath}.bak-${ts}`;
  fs.copyFileSync(dbPath, backupPath);
  // WAL/SHM 可能含未 checkpoint 的最新数据，一并备份
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(`${dbPath}${ext}`)) {
      fs.copyFileSync(`${dbPath}${ext}`, `${backupPath}${ext}`);
    }
  }
  console.log(`已备份旧数据库: ${backupPath}`);

  // 只保留最近 3 份备份（WAL/SHM 随对应主备份一起清理）
  const backups = fs
    .readdirSync(dbDir)
    .filter((name) => /^answers\.db\.bak-\d{14}$/.test(name))
    .sort()
    .reverse();
  backups.slice(3).forEach((name) => {
    const base = path.join(dbDir, name);
    for (const f of [base, `${base}-wal`, `${base}-shm`]) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    }
    console.log(`已清理旧备份: ${name}`);
  });

  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(`${dbPath}${ext}`)) {
      fs.unlinkSync(`${dbPath}${ext}`);
    }
  }
  fs.unlinkSync(dbPath);
  console.log('已删除旧数据库（--force）');
  shouldSeed = true;
}

// 创建新数据库连接
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    process.exit(1);
  }
  console.log('数据库连接成功');

  // 设置编码
  db.run("PRAGMA encoding = 'UTF-8'", (err) => {
    if (err) {
      console.error('设置编码失败:', err);
      db.close(() => process.exit(1));
      return;
    }
    console.log('编码设置为 UTF-8');

    createTables();
  });
});

function createTables() {
  // 创建学生表
  db.run(`CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('创建学生表失败:', err);
      db.close(() => process.exit(1));
      return;
    }
    console.log('学生表创建成功');

    // 创建答题记录表
    db.run(`CREATE TABLE IF NOT EXISTS answer_records (
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
    )`, (err) => {
      if (err) {
        console.error('创建答题记录表失败:', err);
        db.close(() => process.exit(1));
        return;
      }
      console.log('答题记录表创建成功');

      createIndexes();
    });
  });
}

function createIndexes() {
  db.run('CREATE INDEX IF NOT EXISTS idx_wen_id ON answer_records(wen_id)', (err) => {
    if (err) {
      console.error('创建索引失败:', err);
      db.close(() => process.exit(1));
      return;
    }
    db.run('CREATE INDEX IF NOT EXISTS idx_student_id ON answer_records(student_id)', (err) => {
      if (err) {
        console.error('创建索引失败:', err);
        db.close(() => process.exit(1));
        return;
      }
      db.run('CREATE INDEX IF NOT EXISTS idx_wen_student ON answer_records(wen_id, student_id)', (err) => {
        if (err) {
          console.error('创建索引失败:', err);
          db.close(() => process.exit(1));
          return;
        }
        console.log('索引创建成功');
        insertStudents();
      });
    });
  });
}

function insertStudents() {
  // 已有数据库默认不写入示例学生，避免重复主键报错与污染真实数据
  if (!shouldSeed) {
    console.log('保留现有数据，跳过示例学生写入');
    db.close();
    console.log('数据库初始化完成');
    return;
  }

  const students = [
    ['1001', '张三'],
    ['1002', '李四'],
    ['1003', '王五'],
    ['1004', '赵六'],
    ['1005', '钱七'],
    ['9632', '测试学生'],
    ['2024001', '学生A'],
    ['2024002', '学生B'],
    ['2024003', '学生C'],
    ['2024004', '学生D'],
  ];

  let completed = 0;
  students.forEach(([id, name]) => {
    db.run('INSERT INTO students (student_id, name) VALUES (?, ?)', [id, name], (err) => {
      if (err) {
        console.error('插入失败:', id, err);
      } else {
        console.log(`插入学生: ${id} - ${name}`);
      }
      completed++;
      if (completed === students.length) {
        console.log('所有学生数据插入完成');
        db.close();
        console.log('数据库初始化完成');
      }
    });
  });
}
