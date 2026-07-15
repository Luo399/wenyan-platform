/**
 * 数据导出脚本
 * 从现有数据库导出数据到 data/ 目录下的 JSON 文件
 * 
 * 使用方法：
 *   node scripts/export.js
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 数据目录
const dataDir = path.join(__dirname, '..', 'data');

// 数据库路径（支持环境变量配置）
const defaultDbDir = path.join(__dirname, '..', 'database');
const studentDbPath = process.env.STUDENT_DB_PATH || path.join(defaultDbDir, 'students.db');
const answerDbPath = process.env.ANSWER_DB_PATH || path.join(defaultDbDir, 'answer_records.db');

// 确保 data 目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('========================================');
console.log('数据导出脚本');
console.log('========================================');

// ============================================================
// 导出学生数据
// ============================================================

async function exportStudents() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(studentDbPath)) {
      console.log('⚠️  学生数据库不存在，跳过导出');
      resolve([]);
      return;
    }

    const db = new sqlite3.Database(studentDbPath, (err) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }
    });

    db.all('SELECT * FROM students ORDER BY student_id', (err, rows) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      // 写入 JSON 文件
      const outputPath = path.join(dataDir, 'students.json');
      fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2), 'utf-8');
      
      console.log(`✅ 导出学生数据: ${rows.length} 条 -> ${outputPath}`);
      db.close();
      resolve(rows);
    });
  });
}

// ============================================================
// 导出答题记录数据
// ============================================================

async function exportAnswerRecords() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(answerDbPath)) {
      console.log('⚠️  答题记录数据库不存在，跳过导出');
      resolve([]);
      return;
    }

    const db = new sqlite3.Database(answerDbPath, (err) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }
    });

    db.all('SELECT * FROM answer_records ORDER BY submitted_at DESC', (err, rows) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      // 处理数据：解析 JSON 字段（带异常处理）
      const parseJson = (str) => {
        try { 
          return JSON.parse(str || 'null'); 
        } catch { 
          return str; 
        }
      };
      
      const processedRows = rows.map((row) => ({
        ...row,
        user_answer: parseJson(row.user_answer),
        correct_answer: parseJson(row.correct_answer)
      }));

      // 写入 JSON 文件
      const outputPath = path.join(dataDir, 'answer_records.json');
      fs.writeFileSync(outputPath, JSON.stringify(processedRows, null, 2), 'utf-8');
      
      console.log(`✅ 导出答题记录数据: ${rows.length} 条 -> ${outputPath}`);
      db.close();
      resolve(rows);
    });
  });
}

// ============================================================
// 主函数
// ============================================================

async function runExport() {
  try {
    await exportStudents();
    await exportAnswerRecords();

    console.log('\n========================================');
    console.log('✅ 数据导出完成！');
    console.log('========================================');
    console.log('\n导出的文件：');
    console.log(`  - ${path.join(dataDir, 'students.json')}`);
    console.log(`  - ${path.join(dataDir, 'answer_records.json')}`);
    console.log('\n这些文件可以提交到 Git 进行版本管理');
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 导出失败:', err);
    process.exit(1);
  }
}

runExport();