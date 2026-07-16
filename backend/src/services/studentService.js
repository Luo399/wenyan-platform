/**
 * 学生服务模块
 * 提供学生相关的业务逻辑
 */

const { studentDb, answerDb } = require('../config/database');
const { dbGet, dbAll, dbRun, dbPrepareRun, dbSerialize } = require('../utils/dbPromise');

/**
 * 获取学生信息
 * @param {string} studentId - 学生ID
 * @returns {Promise<object|null>} - 学生信息
 */
async function getStudentById(studentId) {
  const row = await dbGet(
    studentDb,
    'SELECT student_id, name, class, created_at FROM students WHERE student_id = ?',
    [studentId]
  );
  return row || null;
}

/**
 * 创建或更新学生
 * @param {string} studentId - 学生ID
 * @param {string} name - 学生姓名
 * @param {number} [studentClass=9] - 班级号
 * @returns {Promise<object>} - 操作结果
 */
async function createOrUpdateStudent(studentId, name, studentClass = 9) {
  await dbPrepareRun(
    studentDb,
    'INSERT OR REPLACE INTO students (student_id, name, class) VALUES (?, ?, ?)',
    [studentId, name, studentClass]
  );
  return { studentId, name, class: studentClass };
}

/**
 * 获取学生列表
 * @param {number} [classNum] - 班级号（可选）
 * @returns {Promise<Array>} - 学生列表
 */
async function getStudentList(classNum) {
  let query = 'SELECT * FROM students';
  let params = [];

  if (classNum && /^\d+$/.test(String(classNum))) {
    query += ' WHERE class = ?';
    params.push(parseInt(classNum));
  }

  query += ' ORDER BY student_id ASC';

  return dbAll(studentDb, query, params);
}

/**
 * 更新学生信息
 * @param {string} studentId - 学生ID
 * @param {string} name - 学生姓名
 * @param {number} [studentClass] - 班级号（可选）
 * @returns {Promise<object>} - 更新结果
 */
async function updateStudent(studentId, name, studentClass) {
  let updateSql = 'UPDATE students SET name = ?';
  let params = [name.trim()];

  if (studentClass !== undefined) {
    updateSql += ', class = ?';
    params.push(studentClass);
  }

  updateSql += ' WHERE student_id = ?';
  params.push(studentId);

  const { changes } = await dbRun(studentDb, updateSql, params);

  if (changes === 0) {
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
  return dbSerialize(studentDb, async () => {
    const { changes: deletedRecordsCount } = await dbRun(
      answerDb,
      'DELETE FROM answer_records WHERE student_id = ?',
      [studentId]
    );

    const { changes } = await dbRun(
      studentDb,
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
