const { db } = require('../config/database');
const { hashDefaultPassword } = require('../utils/password');

function getStudentList(req, res) {
  db.all('SELECT id, student_id, student_name, password_changed, created_at, updated_at FROM students ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '查询失败: ' + err.message,
      });
    }

    res.status(200).json({
      success: true,
      data: rows,
    });
  });
}

function getStudent(req, res) {
  const { studentId } = req.params;

  db.get('SELECT id, student_id, student_name, password_changed, created_at, updated_at FROM students WHERE student_id = ?', [studentId], (err, row) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '查询失败: ' + err.message,
      });
    }

    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '学生不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: row,
    });
  });
}

function createStudent(req, res) {
  const { student_id, student_name } = req.body;

  if (!student_id) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'student_id 是必填字段',
    });
  }

  const now = new Date().toISOString();

  db.get('SELECT id FROM students WHERE student_id = ?', [student_id], async (err, row) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '查询失败: ' + err.message,
      });
    }

    if (row) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE',
        message: '该学号已存在',
      });
    }

    try {
      const defaultHash = await hashDefaultPassword();
      const stmt = db.prepare(`
        INSERT INTO students (student_id, student_name, password_hash, password_changed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(student_id, student_name || null, defaultHash, 0, now, now, (err) => {
        stmt.finalize();
        if (err) {
          return res.status(500).json({
            success: false,
            error: 'DATABASE_ERROR',
            message: '创建失败: ' + err.message,
          });
        }

        res.status(201).json({
          success: true,
          message: '学生创建成功',
        });
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '创建失败',
      });
    }
  });
}

function updateStudent(req, res) {
  const { studentId } = req.params;
  const { student_name } = req.body;

  const stmt = db.prepare(`
    UPDATE students SET student_name = ?, updated_at = ? WHERE student_id = ?
  `);

  stmt.run(student_name || null, new Date().toISOString(), studentId, (err) => {
    stmt.finalize();
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '更新失败: ' + err.message,
      });
    }

    res.status(200).json({
      success: true,
      message: '学生信息更新成功',
    });
  });
}

function deleteStudent(req, res) {
  const { studentId } = req.params;

  const stmt = db.prepare('DELETE FROM students WHERE student_id = ?');

  stmt.run(studentId, (err) => {
    stmt.finalize();
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '删除失败: ' + err.message,
      });
    }

    res.status(200).json({
      success: true,
      message: '学生删除成功',
    });
  });
}

module.exports = {
  getStudentList,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
};
