const jwt = require('jsonwebtoken');
const config = require('../config/app');

function login(req, res) {
  try {
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'student_id 是必填字段',
      });
    }

    if (!/^\d{4}$/.test(student_id)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '学号必须为4位数字',
      });
    }

    const token = jwt.sign(
      { student_id, role: 'student' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: student_id,
          username: student_id,
          student_id,
          role: 'student',
        },
      },
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
}

module.exports = {
  login,
};