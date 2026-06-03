/**
 * 答题控制器模块
 * 处理答题相关的HTTP请求
 */

const answerService = require('../services/answerService');

/**
 * 提交答题记录
 * POST /api/submit
 */
async function submitAnswers(req, res) {
  try {
    const { studentId, studentName, wenId, submittedAt, answers, questions = [] } = req.body;

    // 验证必填字段
    if (!studentId || !wenId || !submittedAt || !answers) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段',
      });
    }

    // 验证学号（非空且仅包含数字）
    if (!studentId.trim() || !/^\d+$/.test(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_ID',
        message: '学号格式不正确，请输入有效的数字学号',
      });
    }

    const result = await answerService.submitAnswers({
      studentId,
      studentName,
      wenId,
      submittedAt,
      answers,
      questions,
    });

    res.status(200).json({
      success: true,
      message: '答案提交成功',
      data: result,
    });
  } catch (err) {
    console.error('数据库操作失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '数据库操作失败: ' + err.message,
    });
  }
}

/**
 * 按文言文ID查询答题情况
 * GET /api/answers/wen/:wenId
 */
async function getAnswersByWenId(req, res) {
  try {
    const { wenId } = req.params;

    if (!wenId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_WEN_ID',
        message: '缺少文言文ID',
      });
    }

    const result = await answerService.getAnswersByWenId(wenId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('查询失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '查询失败: ' + err.message,
    });
  }
}

/**
 * 按学生ID查询答题情况
 * GET /api/answers/student/:studentId
 */
async function getAnswersByStudentId(req, res) {
  try {
    const { studentId } = req.params;

    // 验证学号格式（非空且仅包含数字）
    if (!studentId.trim() || !/^\d+$/.test(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_ID',
        message: '学号格式不正确，请输入有效的数字学号',
      });
    }

    const result = await answerService.getAnswersByStudentId(studentId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('查询失败:', err);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '查询失败: ' + err.message,
    });
  }
}

module.exports = {
  submitAnswers,
  getAnswersByWenId,
  getAnswersByStudentId
};