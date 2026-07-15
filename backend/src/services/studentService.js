/**
 * 学生服务模块
 * 提供学生相关的业务逻辑
 */

const { studentDb, answerDb } = require('../config/database');

/**
 * 获取学生信息
 * @param {string} studentId - 学生ID
 * @returns {Promise<object|null>} - 学生信息
 */
function getStudentById(studentId) {
  return new Promise((resolve, reject) => {
    studentDb.get(
      'SELECT student_id, name, class, created_at FROM students WHERE student_id = ?',
      [studentId],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row || null);
      }
    );
  });
}

/**
 * 创建或更新学生
 * @param {string} studentId - 学生ID
 * @param {string} name - 学生姓名
 * @param {number} [studentClass=9] - 班级号
 * @returns {Promise<object>} - 操作结果
 */
function createOrUpdateStudent(studentId, name, studentClass = 9) {
  return new Promise((resolve, reject) => {
    const stmt = studentDb.prepare(
      'INSERT OR REPLACE INTO students (student_id, name, class) VALUES (?, ?, ?)'
    );

    stmt.run(studentId, name, studentClass, (err) => {
      stmt.finalize();
      if (err) {
        return reject(err);
      }
      resolve({ studentId, name, class: studentClass });
    });
  });
}

/**
 * 获取学生列表
 * @param {number} [classNum] - 班级号（可选）
 * @returns {Promise<Array>} - 学生列表
 */
function getStudentList(classNum) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM students';
    let params = [];

    if (classNum && /^\d+$/.test(String(classNum))) {
      query += ' WHERE class = ?';
      params.push(parseInt(classNum));
    }

    query += ' ORDER BY student_id ASC';

    studentDb.all(query, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

/**
 * 更新学生信息
 * @param {string} studentId - 学生ID
 * @param {string} name - 学生姓名
 * @param {number} [studentClass] - 班级号（可选）
 * @returns {Promise<object>} - 更新结果
 */
function updateStudent(studentId, name, studentClass) {
  return new Promise((resolve, reject) => {
    let updateSql = 'UPDATE students SET name = ?';
    let params = [name.trim()];

    if (studentClass !== undefined) {
      updateSql += ', class = ?';
      params.push(studentClass);
    }

    updateSql += ' WHERE student_id = ?';
    params.push(studentId);

    studentDb.run(updateSql, params, function (err) {
      if (err) {
        return reject(err);
      }

      if (this.changes === 0) {
        return resolve({ success: false, message: '未找到该学生' });
      }

      resolve({
        success: true,
        message: '学生信息修改成功',
        data: { studentId, name: name.trim(), class: studentClass }
      });
    });
  });
}

/**
 * 删除学生（级联删除答题记录）
 * @param {string} studentId - 学生ID
 * @returns {Promise<object>} - 删除结果
 */
function deleteStudent(studentId) {
  return new Promise((resolve, reject) => {
    studentDb.serialize(() => {
      let deletedRecordsCount = 0;

      answerDb.run(
        'DELETE FROM answer_records WHERE student_id = ?',
        [studentId],
        function (err) {
          if (err) {
            return reject(err);
          }
          deletedRecordsCount = this.changes || 0;

          studentDb.run(
            'DELETE FROM students WHERE student_id = ?',
            [studentId],
            function (err) {
              if (err) {
                return reject(err);
              }

              if (this.changes === 0) {
                return resolve({ success: false, message: '未找到该学生' });
              }

              resolve({
                success: true,
                message: `学生删除成功，同时删除了 ${deletedRecordsCount} 条答题记录`,
                data: { studentId, deletedRecordsCount }
              });
            }
          );
        }
      );
    });
  });
}

module.exports = {
  getStudentById,
  createOrUpdateStudent,
  getStudentList,
  updateStudent,
  deleteStudent
};