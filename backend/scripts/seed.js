/**
 * 数据种子脚本
 * 从 data/ 目录导入数据到数据库
 * 
 * 使用方法：
 *   node scripts/seed.js
 *   node scripts/seed.js --students-only  仅导入学生数据
 *   node scripts/seed.js --answers-only   仅导入答题记录
 * 
 * 特性：
 *   - 幂等性设计：存在则跳过，不会重复插入
 *   - 支持部分导入
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
// 配置
// ============================================================

// 数据目录
const dataDir = path.join(__dirname, '..', 'data');

// 数据库路径
const defaultDbDir = path.join(__dirname, '..', 'database');
const studentDbPath = process.env.STUDENT_DB_PATH || path.join(defaultDbDir, 'students.db');
const answerDbPath = process.env.ANSWER_DB_PATH || path.join(defaultDbDir, 'answer_records.db');

// 命令行参数
const args = process.argv.slice(2);
const studentsOnly = args.includes('--students-only');
const answersOnly = args.includes('--answers-only');

console.log('========================================');
console.log('数据种子脚本');
console.log('========================================');
console.log(`数据目录: ${dataDir}`);
console.log(`学生数据库: ${studentDbPath}`);
console.log(`答题记录数据库: ${answerDbPath}`);
console.log(`导入模式: ${studentsOnly ? '仅学生' : answersOnly ? '仅答题记录' : '全部'}`);
console.log('========================================');

// ============================================================
// 数据库连接
// ============================================================

function connectDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

// ============================================================
// 学生数据导入
// ============================================================

async function seedStudents(db) {
  const studentsFile = path.join(dataDir, 'students.json');
  
  // 检查文件是否存在
  if (!fs.existsSync(studentsFile)) {
    console.log('⚠️  学生数据文件不存在: students.json');
    return { total: 0, inserted: 0, skipped: 0 };
  }

  // 读取数据
  const rawData = fs.readFileSync(studentsFile, 'utf-8');
  const students = JSON.parse(rawData);

  if (!Array.isArray(students)) {
    console.error('❌ students.json 格式错误：应为数组');
    return { total: 0, inserted: 0, skipped: 0 };
  }

  console.log(`\n导入学生数据 (${students.length} 条)...`);

  // 检查是否已存在
  const checkExists = (studentId) => {
    return new Promise((resolve) => {
      db.get(
        'SELECT student_id FROM students WHERE student_id = ?',
        [studentId],
        (err, row) => {
          resolve(!err && row);
        }
      );
    });
  };

  // 插入数据
  const insertStudent = (student) => {
    return new Promise((resolve) => {
      db.run(
        `INSERT INTO students (student_id, name, class, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          student.student_id,
          student.name,
          student.class || '9',
          student.created_at || new Date().toISOString()
        ],
        (err) => {
          resolve(!err);
        }
      );
    });
  };

  let inserted = 0;
  let skipped = 0;

  for (const student of students) {
    if (!student.student_id || !student.name) {
      console.warn(`⚠️  跳过无效数据: ${JSON.stringify(student)}`);
      skipped++;
      continue;
    }

    const exists = await checkExists(student.student_id);
    if (exists) {
      console.log(`⏭️  已存在，跳过: ${student.student_id} - ${student.name}`);
      skipped++;
    } else {
      const success = await insertStudent(student);
      if (success) {
        console.log(`✅ 插入: ${student.student_id} - ${student.name}`);
        inserted++;
      } else {
        console.warn(`❌ 插入失败: ${student.student_id}`);
        skipped++;
      }
    }
  }

  return { total: students.length, inserted, skipped };
}

// ============================================================
// 答题记录数据导入
// ============================================================

async function seedAnswerRecords(db) {
  const answersFile = path.join(dataDir, 'answer_records.json');
  
  // 检查文件是否存在
  if (!fs.existsSync(answersFile)) {
    console.log('⚠️  答题记录数据文件不存在: answer_records.json');
    return { total: 0, inserted: 0, skipped: 0 };
  }

  // 读取数据
  const rawData = fs.readFileSync(answersFile, 'utf-8');
  const answers = JSON.parse(rawData);

  if (!Array.isArray(answers)) {
    console.error('❌ answer_records.json 格式错误：应为数组');
    return { total: 0, inserted: 0, skipped: 0 };
  }

  console.log(`\n导入答题记录数据 (${answers.length} 条)...`);

  // 检查是否已存在（根据 wen_id + student_id + question_id + submitted_at 组合判断）
  const checkExists = (record) => {
    return new Promise((resolve) => {
      db.get(
        `SELECT id FROM answer_records 
         WHERE wen_id = ? AND student_id = ? AND question_id = ? AND submitted_at = ?`,
        [record.wen_id, record.student_id, record.question_id, record.submitted_at],
        (err, row) => {
          resolve(!err && row);
        }
      );
    });
  };

  // 插入数据
  const insertRecord = (record) => {
    return new Promise((resolve) => {
      db.run(
        `INSERT INTO answer_records 
         (wen_id, student_id, question_id, user_answer, correct_answer, is_correct, score, submitted_at, attempt_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.wen_id,
          record.student_id,
          record.question_id,
          JSON.stringify(record.user_answer ?? null),
          JSON.stringify(record.correct_answer ?? null),
          record.is_correct || 0,
          record.score || 0,
          record.submitted_at,
          record.attempt_number || 1
        ],
        (err) => {
          resolve(!err);
        }
      );
    });
  };

  let inserted = 0;
  let skipped = 0;

  for (const record of answers) {
    if (!record.wen_id || !record.student_id || !record.question_id || !record.submitted_at) {
      console.warn(`⚠️  跳过无效数据: 缺少必要字段`);
      skipped++;
      continue;
    }

    const exists = await checkExists(record);
    if (exists) {
      console.log(`⏭️  已存在，跳过: ${record.wen_id}/${record.student_id}/${record.question_id}`);
      skipped++;
    } else {
      const success = await insertRecord(record);
      if (success) {
        console.log(`✅ 插入: ${record.wen_id}/${record.student_id}/${record.question_id}`);
        inserted++;
      } else {
        console.warn(`❌ 插入失败`);
        skipped++;
      }
    }
  }

  return { total: answers.length, inserted, skipped };
}

// ============================================================
// 主函数
// ============================================================

async function runSeed() {
  try {
    // 检查需要导入的数据库是否存在
    if (!studentsOnly && !fs.existsSync(studentDbPath)) {
      console.error(`❌ 学生数据库不存在: ${studentDbPath}`);
      console.error('请先运行: node scripts/migrate.js');
      process.exit(1);
    }

    if (!answersOnly && !fs.existsSync(answerDbPath)) {
      console.error(`❌ 答题记录数据库不存在: ${answerDbPath}`);
      console.error('请先运行: node scripts/migrate.js');
      process.exit(1);
    }

    // 导入学生数据
    if (!answersOnly) {
      const studentDb = await connectDatabase(studentDbPath);
      const studentResult = await seedStudents(studentDb);
      
      console.log('\n学生数据导入结果:');
      console.log(`  总数: ${studentResult.total}`);
      console.log(`  插入: ${studentResult.inserted}`);
      console.log(`  跳过: ${studentResult.skipped}`);
      
      studentDb.close();
    }

    // 导入答题记录
    if (!studentsOnly) {
      const answerDb = await connectDatabase(answerDbPath);
      const answerResult = await seedAnswerRecords(answerDb);
      
      console.log('\n答题记录导入结果:');
      console.log(`  总数: ${answerResult.total}`);
      console.log(`  插入: ${answerResult.inserted}`);
      console.log(`  跳过: ${answerResult.skipped}`);
      
      answerDb.close();
    }

    console.log('\n========================================');
    console.log('✅ 数据导入完成！');
    console.log('========================================');
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 导入失败:', err);
    process.exit(1);
  }
}

// 执行导入
runSeed();