/**
 * 认证控制器模块
 * 处理用户认证相关的HTTP请求
 */

const { generateToken } = require('../utils/token');
const studentService = require('../services/studentService');

/**
 * 学生登录
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { student_id: studentId, student_name: studentName } = req.body;

    // 验证学号
    if (!studentId || !studentId.trim() || !/^\d+$/.test(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_ID',
        message: '请输入有效的数字学号',
      });
    }

    // 查询数据库验证学生
    const student = await studentService.getStudentById(studentId);

    if (!student) {
      // 如果数据库中没有该学生，但提供了姓名，则自动注册
      if (studentName && studentName.trim()) {
        await studentService.createOrUpdateStudent(studentId, studentName);
        
        // 注册成功后生成token
        const token = generateToken(studentId, studentName);
        return res.status(200).json({
          success: true,
          data: {
            token,
            user: {
              id: studentId,
              username: studentName,
              student_id: studentId,
              role: 'student',
            },
          },
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'STUDENT_NOT_FOUND',
          message: `学号 ${studentId} 不存在，请联系管理员注册`,
        });
      }
    } else {
      // 学生存在，生成token
      const name = studentName && studentName.trim() ? studentName : student.name;
      const token = generateToken(studentId, name);
      res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: studentId,
            username: name,
            student_id: studentId,
            role: 'student',
          },
        },
      });
    }
  } catch (err) {
    console.error('处理登录请求失败:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
}

module.exports = {
  login
};