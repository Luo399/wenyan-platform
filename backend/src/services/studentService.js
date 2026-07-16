/**
 * 学生服务模块（兼容层）
 * 注意：新的教师学生管理请使用 teacherStudentController
 */

const { db } = require('../config/database');
const { dbGet, dbAll, dbRun, dbPrepareRun, dbSerialize } = require('../utils/dbPromise');
const { hashDefaultPassword } = require('../utils/password');

async function getStudentById(studentId) {
  const row = await dbGet(
    db,
    'SELECT student_id, student_name, created_at, updated_at FROM students WHERE student_id = ?',
    [studentId]
  );
  return row || null;
}

async function createOrUpdateStudent(studentId, name) {
  const existing = await dbGet(db, 'SELECT id FROM students WHERE student_id = ?', [studentId]);
  const defaultHash = await hashDefaultPassword();

  if (existing) {
    await dbRun(
      db,
      'UPDATE students SET student_name = ?, updated_at = ? WHERE student_id = ?',
      [name, new Date().toISOString(), studentId]
    );
  } else {
    await dbRun(
      db,
      'INSERT INTO students (student_id, student_name, password_hash, password_changed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [studentId, name, defaultHash, 0, new Date().toISOString(), new Date().toISOString()]
    );
  }

  return { studentId, name };
}

async function getStudentList(classPrefix) {
  let query = 'SELECT id, student_id, student_name, created_at, updated_at FROM students';
  let params = [];

  if (classPrefix && /^\d{6}$/.test(String(classPrefix))) {
    query += ' WHERE student_id LIKE ?';
    params.push(`${classPrefix}%`);
  }

  query += ' ORDER BY student_id ASC';

  return dbAll(db, query, params);
}

async function updateStudent(studentId, name) {
  const { changes } = await dbRun(
    db,
    'UPDATE students SET student_name = ?, updated_at = ? WHERE student_id = ?',
    [name.trim(), new Date().toISOString(), studentId]
  );

  if (changes === 0) {
    return { success: false, message: '未找到该学生' };
  }

  return {
    success: true,
    message: '学生信息修改成功',
    data: { studentId, name: name.trim() }
  };
}

async function deleteStudent(studentId) {
  return dbSerialize(db, async () => {
    const { changes: deletedRecordsCount } = await dbRun(
      db,
      'DELETE FROM answers WHERE student_id = ?',
      [studentId]
    );

    const { changes } = await dbRun(
      db,
      'DELETE FROM students WHERE student_id = ?',
      [studentId]
    );

    if (changes === 0) {
      return { success: false, message: '未找到该学生' };
    }

    return {
      success: true,
      message: `学生删除成功，同时删除了 ${deletedRecordsCount} 条答题记录`,
      data: { studentId, deletedRecordsCount }
    };
  });
}

module.exports = {
  getStudentById,
  createOrUpdateStudent,
  getStudentList,
  updateStudent,
  deleteStudent
};
