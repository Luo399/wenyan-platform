/**
 * AI 对话控制器
 * POST /api/ai/chat —— 发送 AI 对话
 * GET  /api/ai/quota —— 查询当前配额
 */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const logger = require('../utils/logger')
const aiService = require('../services/aiService')
const aiAlerts = require('../services/aiAlerts')

const INJECTION_KEYWORDS = [
  '忽略之前的提示', 'ignore previous', '你现在是', '现在你是', 'system prompt',
  '忽略所有', '你是管理员', '请忘记之前', 'disregard all', 'jailbreak', '绕过',
]

const aiChatSchema = z.object({
  wenId: z.string().min(1, 'wenId 必填').max(100, 'wenId 长度不能超过 100'),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant'], { errorMap: () => ({ message: '仅允许 role 为 user 或 assistant' }) }),
      content: z.string().min(1, 'content 不能为空字符串').max(2000, '单条 content 最长 2000 字符'),
    }),
  ).min(1, 'messages 必须是非空数组').max(20, 'messages 最多 20 条'),
})

function detectInjection(messages) {
  const lowerKeywords = INJECTION_KEYWORDS.map((k) => k.toLowerCase())
  for (const msg of messages) {
    const content = String(msg.content || '').toLowerCase()
    if (lowerKeywords.some((kw) => content.includes(kw))) return true
  }
  return false
}

async function chat(req, res) {
  // 1. 角色二次断言
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: '仅学生可使用 AI 对话' })
  }
  const studentId = req.user.student_id

  // 2. 请求体 zod 校验
  let body
  try {
    body = aiChatSchema.parse(req.body || {})
  } catch (err) {
    return handleZodError(res, err, 'AI 聊天参数校验失败')
  }
  const { wenId, messages } = body

  // 2.5 system role 专属拦截（zod 只允许 user/assistant，system 由服务端注入，需专属错误码）
  // 注：zod enum 已排除 system，此处仅保留为防御性检查 + 兼容历史错误码
  for (const msg of messages) {
    if (msg.role === 'system') {
      return res.status(400).json({ success: false, error: 'SYSTEM_ROLE_FORBIDDEN', message: '禁止在 messages 中指定 system 角色' })
    }
  }

  // 3. Prompt injection 检测
  if (detectInjection(messages)) {
    logger.warn('[aiController] Prompt injection 拦截', { studentId })
    return res.status(400).json({ success: false, error: 'INJECTION_BLOCKED', message: '检测到可疑指令，已拒绝请求' })
  }

  // 5. 并发控制
  if (!aiService.enterConcurrent(studentId)) {
    return res.status(503).json({ success: false, error: 'CONCURRENCY_LIMITED', message: '并发请求过多，请稍后重试' })
  }

  try {
    // 6. 注入 system prompt
    let systemMessages
    try {
      const systemPrompt = aiService.buildSystemPrompt(wenId)
      systemMessages = [{ role: 'system', content: systemPrompt }]
    } catch (err) {
      aiService.leaveConcurrent(studentId)
      if (err.message === 'TEXT_NOT_FOUND') return res.status(404).json({ success: false, error: 'TEXT_NOT_FOUND', message: '课文不存在' })
      logger.error('[aiController] buildSystemPrompt 异常', { error: err.message })
      return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '构造 prompt 失败' })
    }

    const finalMessages = [...systemMessages, ...messages]

    // 7. 配额预检
    const preQuota = await aiService.checkQuotaOnly(studentId)
    aiAlerts.checkQuotaAlert(studentId, preQuota)
    const estimatedTokens = messages.reduce((sum, m) => sum + Math.ceil(String(m.content).length / 2), 0)
    const dailyRemaining = preQuota.daily.limit - preQuota.daily.used
    const weeklyRemaining = preQuota.weekly.limit - preQuota.weekly.used
    const monthlyRemaining = preQuota.monthly.limit - preQuota.monthly.used
    const maxLimit = Math.min(dailyRemaining, weeklyRemaining, monthlyRemaining)
    if (estimatedTokens > maxLimit) {
      aiService.leaveConcurrent(studentId)
      return res.status(429).json({ success: false, error: 'QUOTA_EXCEEDED', message: '配额不足，请稍后再试', quota: preQuota })
    }

    // 8. 调用 DeepSeek
    let resp
    try {
      resp = await aiService.callDeepSeek(finalMessages)
      aiAlerts.resetDownstreamErrorCount()
    } catch (err) {
      if (err.message !== 'AI_UNAVAILABLE') aiAlerts.trackDownstreamError()
      aiService.leaveConcurrent(studentId)
      logger.error('[aiController] DeepSeek 调用失败', { error: err.message })
      if (err.message === 'AI_UNAVAILABLE') return res.status(503).json({ success: false, error: 'AI_UNAVAILABLE', message: 'AI 服务未配置，请联系管理员' })
      return res.status(502).json({ success: false, error: err.message === 'DEEPSEEK_TIMEOUT' ? 'DEEPSEEK_TIMEOUT' : 'DEEPSEEK_DOWNSTREAM_ERROR', message: 'AI 服务暂时不可用，请稍后重试' })
    }

    // 9. 取 usage
    const usage = resp.usage || {}
    const promptTokens = usage.prompt_tokens || 0
    const completionTokens = usage.completion_tokens || 0
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens)

    // 10. 扣配额
    const quotaResult = await aiService.checkAndConsumeQuota(studentId, totalTokens)
    if (!quotaResult.ok) {
      aiService.leaveConcurrent(studentId)
      return res.status(429).json({ success: false, error: 'QUOTA_EXCEEDED', message: '配额不足，请稍后再试', quota: { daily: quotaResult.daily, weekly: quotaResult.weekly, monthly: quotaResult.monthly } })
    }

    // 11. 记录 usage（fire-and-forget）
    aiService.logAiUsage({ studentId, wenId, promptTokens, completionTokens, totalTokens })

    // 12. 处理回复
    const rawReply = resp.choices?.[0]?.message?.content || ''
    const sanitizedReply = aiService.sanitizeAiReply(rawReply)
    const moderation = aiService.checkModeration(rawReply)
    let finalReply = sanitizedReply
    if (!moderation.passed) {
      logger.warn('[aiController] AI 回复触发二次审核', { studentId, matched: moderation.matched })
      finalReply = 'AI 回复包含不适当内容，已被过滤。请换一种方式提问。'
    }

    aiService.leaveConcurrent(studentId)
    return res.json({ success: true, data: { reply: finalReply, usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens }, quota: { daily: quotaResult.daily, weekly: quotaResult.weekly, monthly: quotaResult.monthly }, streaming: false } })
  } catch (err) {
    aiService.leaveConcurrent(studentId)
    logger.error('[aiController] chat 异常', { error: err.message, stack: err.stack })
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' })
  }
}

async function getQuota(req, res) {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: '仅学生可查询配额' })
  }
  try {
    const quota = await aiService.checkQuotaOnly(req.user.student_id)
    return res.json({ success: true, data: quota })
  } catch (err) {
    logger.error('[aiController] getQuota 异常', { error: err.message })
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' })
  }
}

module.exports = { chat, getQuota }
