/** AI 聊天 Controller */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { chat } = require('../services/aiService')
const logger = require('../utils/logger')

const MAX_MESSAGE_LEN = 2000

const aiChatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['system', 'user']), content: z.string().min(1).max(MAX_MESSAGE_LEN) })).min(1, 'messages 不能为空').max(50, '最多 50 条消息'),
  wenId: z.string().min(1, 'wenId 必填').max(100),
  userId: z.string().min(1, 'userId 必填').max(50),
  sessionId: z.string().min(1, 'sessionId 必填').max(100),
  aiRole: z.string().min(1).max(500).optional(),
  roleName: z.string().min(1).max(100).optional(),
  roleDesc: z.string().min(1).max(2000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(4000).optional(),
})

async function chatHandler(req, res) {
  try {
    const body = aiChatSchema.parse(req.body || {})
    if (body.messages.length > 0 && body.messages[0].role === 'system') {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'system 角色由服务端控制，前端禁止传入' })
    }
    const result = await chat(body)
    if (result.quotaExceeded) return res.status(429).json({ success: false, error: 'QUOTA_EXCEEDED', message: result.message })
    res.json({ success: true, data: result })
  } catch (err) { if (err instanceof z.ZodError) return handleZodError(res, err, 'AI 聊天参数校验失败'); logger.error('AI 聊天失败:', err); res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'AI 服务暂时不可用，请稍后重试' }) }
}

module.exports = { chat: chatHandler }