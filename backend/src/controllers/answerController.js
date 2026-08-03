const {
  submitAnswers: serviceSubmitAnswers,
  submitSingleAnswer: serviceSubmitSingleAnswer,
  getAnswersByWenId: serviceGetByWenId,
  getAnswersByStudentId: serviceGetByStudentId,
} = require('../services/answerService')
const logger = require('../utils/logger')

// R90 已移除 HMAC 签名校验（AUTH_SECRET/AUTH_ENABLED/generateHmacSignature/verifyHmacSignature）
// 鉴权完全交给路由层的 optionalAuthMiddleware（JWT Bearer token）
// 旧实现的问题：前端从不发送 signature 字段，导致 AUTH_SECRET 非空时 /api/submit 直接 401
// 客户端密钥无法安全存储，HMAC 签名方案已被 JWT 取代

// B05: controller 改为薄层，所有业务逻辑下沉到 answerService
// B06: submitAnswers 与 submitSingleAnswer 的公共流程已在 service 层统一

async function submitAnswers(req, res) {
  try {
    const { studentId, wenId, submittedAt, answers, questions } = req.body

    if (!studentId || !wenId || !submittedAt || !answers || !questions) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '缺少必填字段',
      })
    }

    const result = await serviceSubmitAnswers({
      studentId,
      studentName: req.user?.student_name || null,
      wenId,
      submittedAt,
      answers,
      questions,
    })

    res.status(200).json({
      success: result.success,
      message: '答案提交成功',
      data: result.data,
    })
  } catch (err) {
    logger.error('处理答题批量提交请求失败', {
      error: err.message,
      stack: err.stack,
      body: req.body,
    })
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

async function submitSingleAnswer(req, res) {
  try {
    const { studentId, wenId, questionId, userAnswer, correctAnswer, submittedAt } = req.body

    if (!studentId || !wenId || !questionId || userAnswer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '缺少必填字段',
      })
    }

    const result = await serviceSubmitSingleAnswer({
      studentId,
      studentName: req.user?.student_name || null,
      wenId,
      questionId,
      userAnswer,
      correctAnswer,
      submittedAt: submittedAt || new Date().toISOString(),
    })

    res.status(200).json({
      success: true,
      message: '答案提交成功',
      data: result,
    })
  } catch (err) {
    logger.error('处理单题提交请求失败', {
      error: err.message,
      stack: err.stack,
      body: req.body,
    })
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

async function getAnswersByWenId(req, res) {
  try {
    const { wenId } = req.params
    const data = await serviceGetByWenId(wenId)
    res.status(200).json({ success: true, data })
  } catch (err) {
    logger.error('按文言文ID查询答题记录失败', {
      error: err.message,
      stack: err.stack,
      wenId: req.params.wenId,
    })
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '查询失败: ' + err.message,
    })
  }
}

async function getAnswersByStudentId(req, res) {
  try {
    const { studentId } = req.params
    const data = await serviceGetByStudentId(studentId)
    res.status(200).json({ success: true, data })
  } catch (err) {
    logger.error('按学生ID查询答题记录失败', {
      error: err.message,
      stack: err.stack,
      studentId: req.params.studentId,
    })
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: '查询失败: ' + err.message,
    })
  }
}

module.exports = {
  submitAnswers,
  submitSingleAnswer,
  getAnswersByWenId,
  getAnswersByStudentId,
}
