const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'answers.db');

// 删除旧数据库
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('已删除旧数据库');
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
      return;
    }
    db.run('CREATE INDEX IF NOT EXISTS idx_student_id ON answer_records(student_id)', (err) => {
      if (err) {
        console.error('创建索引失败:', err);
        return;
      }
      db.run('CREATE INDEX IF NOT EXISTS idx_wen_student ON answer_records(wen_id, student_id)', (err) => {
        if (err) {
          console.error('创建索引失败:', err);
          return;
        }
        console.log('索引创建成功');
        insertStudents();
      });
    });
  });
}

function insertStudents() {
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
