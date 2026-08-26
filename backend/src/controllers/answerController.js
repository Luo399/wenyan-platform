const { z } = require('zod')
const {
  submitAnswers: serviceSubmitAnswers,
  submitSingleAnswer: serviceSubmitSingleAnswer,
  getAnswersByWenId: serviceGetByWenId,
  getAnswersByStudentId: serviceGetByStudentId,
} = require('../services/answerService')
const logger = require('../utils/logger')

// ===== P0 安全修复：提交请求体 zod 白名单校验 =====
// 仅接受以下五个字段，多余字段由 zod 默认 strip 丢弃；
// 逐字段校验类型与长度，避免异常 payload 进入业务层。

const answerValueSchema = z.union([
  z.string().max(2000, '答案长度不能超过 2000 字符'),
  z.number(),
  z.array(z.union([z.string().max(2000), z.number()])).max(100, '答案选项数量不能超过 100'),
  z.null(),
])

const studentIdSchema = z
  .string('学号必须为字符串')
  .regex(/^\d+$/, '学号必须为纯数字')
  .min(4, '学号长度不能少于 4 位')
  .max(20, '学号长度不能超过 20 位')

/** 批量提交白名单：{ studentId, wenId, submittedAt, answers, questions } */
const submitAnswersSchema = z.object({
  studentId: studentIdSchema,
  wenId: z.string().min(1, '课文ID必填').max(100, '课文ID长度不能超过 100'),
  submittedAt: z.string().min(1, '提交时间必填').max(40, '提交时间长度异常'),
  answers: z.record(z.string().min(1).max(100), answerValueSchema),
  questions: z
    .array(
      z.object({
        id: z.string().min(1, '题目ID必填').max(100, '题目ID长度不能超过 100'),
        // 兼容后端 JSON 数据源回退：允许 correctAnswer 缺失
        correctAnswer: answerValueSchema.optional(),
      }),
    )
    .max(500, '单次提交题目数量不能超过 500'),
})

/** 单题提交白名单：{ studentId, wenId, questionId, userAnswer, correctAnswer?, submittedAt? } */
const submitSingleAnswerSchema = z.object({
  studentId: studentIdSchema,
  wenId: z.string().min(1, '课文ID必填').max(100, '课文ID长度不能超过 100'),
  questionId: z.string().min(1, '题目ID必填').max(100, '题目ID长度不能超过 100'),
  userAnswer: answerValueSchema,
  correctAnswer: answerValueSchema.optional(),
  submittedAt: z.string().min(1, '提交时间必填').max(40, '提交时间长度异常').optional(),
})

/** 统一解析 zod 校验错误，转换为 400 VALIDATION_ERROR */
function parseWithZod(schema, body) {
  try {
    return schema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues?.[0]?.message || '参数校验失败'
      const error = new Error(message)
      error.validationFailed = true
      throw error
    }
    throw err
  }
}

// R90 已移除 HMAC 签名校验（AUTH_SECRET/AUTH_ENABLED/generateHmacSignature/verifyHmacSignature）
// P0: 提交鉴权由路由层 requireAuthMiddleware（JWT Bearer token）强制，禁止匿名提交
// 旧实现的问题：前端从不发送 signature 字段，导致 AUTH_SECRET 非空时 /api/submit 直接 401
// 客户端密钥无法安全存储，HMAC 签名方案已被 JWT 取代

// B05: controller 改为薄层，所有业务逻辑下沉到 answerService
// B06: submitAnswers 与 submitSingleAnswer 的公共流程已在 service 层统一

async function submitAnswers(req, res) {
  try {
    // P0: zod 白名单校验，多余字段自动丢弃，校验失败抛 validationFailed
    const body = parseWithZod(submitAnswersSchema, req.body)

    const result = await serviceSubmitAnswers({
      studentId: body.studentId,
      studentName: req.user?.student_name || null,
      wenId: body.wenId,
      submittedAt: body.submittedAt,
      answers: body.answers,
      questions: body.questions,
    })

    res.status(200).json({
      success: result.success,
      message: '答案提交成功',
      data: result.data,
    })
  } catch (err) {
    // P0: 校验类错误返回 400，避免被误判为服务端异常
    if (err.validationFailed) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: err.message || '参数校验失败',
      })
    }
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
    // P0: zod 白名单校验，多余字段自动丢弃，校验失败抛 validationFailed
    const body = parseWithZod(submitSingleAnswerSchema, req.body)

    const result = await serviceSubmitSingleAnswer({
      studentId: body.studentId,
      studentName: req.user?.student_name || null,
      wenId: body.wenId,
      questionId: body.questionId,
      userAnswer: body.userAnswer,
      correctAnswer: body.correctAnswer,
      submittedAt: body.submittedAt || new Date().toISOString(),
    })

    res.status(200).json({
      success: true,
      message: '答案提交成功',
      data: result,
    })
  } catch (err) {
    // P0: 校验类错误返回 400，避免被误判为服务端异常
    if (err.validationFailed) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: err.message || '参数校验失败',
      })
    }
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
