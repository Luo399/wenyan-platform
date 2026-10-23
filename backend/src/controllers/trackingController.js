/**
 * 用户行为埋点 Controller
 * 轻量设计：不校验用户身份（未登录用户也要收集），仅做 zod 格式校验。
 */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { trackEvents } = require('../services/trackingService')
const logger = require('../utils/logger')

// 与前端 composables/useTracking.ts 发送的事件类型保持对齐
const ALLOWED_EVENT_TYPES = [
  'step_enter', 'step_exit', 'page_view',
  'page_show', 'page_hide', 'session_end',
  'interaction', 'search_word', 'quiz_submit',
  'ai_chat', 'ai_quota_check', 'ai_error',
]

const trackingEventSchema = z.object({
  event_type: z.enum(ALLOWED_EVENT_TYPES, { errorMap: () => ({ message: 'event_type 不在允许列表内' }) }),
  user_id: z.string().max(50).optional(),
  session_id: z.string().max(100).optional(),
  step_id: z.string().max(100).optional(),
  page_url: z.string().max(500).optional(),
  timestamp: z.string().max(50).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
})

const trackBodySchema = z.object({
  events: z.array(trackingEventSchema).min(1, 'events 至少包含一个事件').max(200, '单次上报最多 200 个事件'),
})

async function track(req, res) {
  try {
    const body = trackBodySchema.parse(req.body || {})
    const result = await trackEvents(body.events)
    res.status(200).json({ success: true, message: '埋点事件已接收', data: result })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return handleZodError(res, err)
    }
    logger.error('处理埋点事件失败', { error: err.message, stack: err.stack })
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' })
  }
}

module.exports = { track }
