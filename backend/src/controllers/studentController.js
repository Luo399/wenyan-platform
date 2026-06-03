/**
 * 学生控制器模块
 * 处理学生相关的HTTP请求
 */

const studentService = require('../services/studentService');

/**
 * 获取单个学生信息
 * GET /api/students/:studentId
 */
async function getStudent(req, res) {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生ID不能为空',
      });
    }

    const student = await studentService.getStudentById(studentId);

    if (student) {
      res.json({
        success: true,
        data: {
          student_id: student.student_id,
          name: student.name,
          created_at: student.created_at,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'STUDENT_NOT_FOUND',
        message: `未找到学号为 ${studentId} 的学生`,
      });
    }
  } catch (err) {
    console.error('查询学生信息失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '查询学生信息失败',
    });
  }
}

/**
 * 获取学生列表
 * GET /api/students
 */
async function getStudentList(req, res) {
  try {
    const { class: classNum } = req.query;
    const students = await studentService.getStudentList(classNum);
    res.status(200).json({
      success: true,
      data: students,
    });
  } catch (err) {
    console.error('查询学生列表失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '查询失败: ' + err.message,
    });
  }
}

/**
 * 学生注册
 * POST /api/students
 */
async function createStudent(req, res) {
  try {
    const { studentId, name, class: studentClass = 9 } = req.body;

    if (!studentId || !name) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段',
      });
    }

    const result = await studentService.createOrUpdateStudent(studentId, name, studentClass);

    res.status(200).json({
      success: true,
      message: '学生注册成功',
      data: result,
    });
  } catch (err) {
    console.error('学生注册失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '学生注册失败',
    });
  }
}

/**
 * 更新学生信息
 * PUT /api/students/:studentId
 */
async function updateStudent(req, res) {
  try {
    const { studentId } = req.params;
    const { name, class: studentClass } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生ID不能为空',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生姓名不能为空',
      });
    }

    const result = await studentService.updateStudent(studentId, name, studentClass);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (err) {
    console.error('修改学生信息失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '修改学生信息失败',
    });
  }
}

/**
 * 删除学生
 * DELETE /api/students/:studentId
 */
async function deleteStudent(req, res) {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '学生ID不能为空',
      });
    }

    const result = await studentService.deleteStudent(studentId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (err) {
    console.error('删除学生失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '删除学生失败',
    });
  }
}

module.exports = {
  getStudent,
  getStudentList,
  createStudent,
  updateStudent,
  deleteStudent
};