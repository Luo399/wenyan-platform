/**
 * 学生服务模块
 * 提供学生相关的业务逻辑
 */

const { db } = require('../config/database');
const { dbGet, dbAll, dbRun, stmtRun } = require('../utils/dbPromise');

/**
 * 获取学生信息
 * @param {string} studentId - 学生ID
 * @returns {Promise<object|null>} - 学生信息
 */
async function getStudentById(studentId) {
  return dbGet(
    db,
    'SELECT student_id, student_name, class, created_at FROM students WHERE student_id = ?',
    [studentId]
  );
}

/**
 * 创建或更新学生
 * @param {string} studentId - 学生ID
 * @param {string} name - 学生姓名
 * @param {number} [studentClass=9] - 班级号
 * @returns {Promise<object>} - 操作结果
 */
async function createOrUpdateStudent(studentId, name, studentClass = 9) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO students (student_id, student_name, class) VALUES (?, ?, ?)'
  );

  try {
    await stmtRun(stmt, studentId, name, studentClass);
  } finally {
    stmt.finalize();
  }

  return { studentId, name, class: studentClass };
}

/**
 * 获取学生列表
 * @param {number} [classNum] - 班级号（可选）
 * @returns {Promise<Array>} - 学生列表
 */
async function getStudentList(classNum) {
  let sql = 'SELECT * FROM students';
  const params = [];

  if (classNum && /^\d+$/.test(String(classNum))) {
    sql += ' WHERE class = ?';
    params.push(parseInt(classNum));
  }

  sql += ' ORDER BY student_id ASC';
  return dbAll(db, sql, params);
}

/**
 * 更新学生信息
 * @param {string} studentId - 学生ID
 * @param {string} name - 学生姓名
 * @param {number} [studentClass] - 班级号（可选）
 * @returns {Promise<object>} - 更新结果
 */
async function updateStudent(studentId, name, studentClass) {
  let updateSql = 'UPDATE students SET student_name = ?';
  const params = [name.trim()];

  if (studentClass !== undefined) {
    updateSql += ', class = ?';
    params.push(studentClass);
  }

  updateSql += ' WHERE student_id = ?';
  params.push(studentId);

  const result = await dbRun(db, updateSql, params);

  if (result.changes === 0) {
    return { success: false, message: '未找到该学生' };
  }

  return {
    success: true,
    message: '学生信息修改成功',
    data: { studentId, name: name.trim(), class: studentClass }
  };
}

/**
 * 删除学生（级联删除答题记录）
 * @param {string} studentId - 学生ID
 * @returns {Promise<object>} - 删除结果
 */
async function deleteStudent(studentId) {
  // 删除答题记录
  const answerResult = await dbRun(
    db,
    'DELETE FROM answers WHERE student_id = ?',
    [studentId]
  );
  const deletedRecordsCount = answerResult.changes || 0;

  // 删除学生
  const result = await dbRun(
    db,
    'DELETE FROM students WHERE student_id = ?',
    [studentId]
  );

  if (result.changes === 0) {
    return { success: false, message: '未找到该学生' };
  }

  return {
    success: true,
    message: `学生删除成功，同时删除了 ${deletedRecordsCount} 条答题记录`,
    data: { studentId, deletedRecordsCount }
  };
}

module.exports = {
  getStudentById,
  createOrUpdateStudent,
  getStudentList,
  updateStudent,
  deleteStudent
};
