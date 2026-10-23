/** 用户行为埋点 Controller */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { trackEvents } = require('../services/trackingService')
const logger = require('../utils/logger')

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

// handleZodError 已收敛到 ../middleware/validate.js

async function track(req, res) {
  try {
    let body
    try { body = trackBodySchema.parse(req.body || {}) } catch (err) { return handleZodError(res, err, '埋点参数校验失败') }
    const { events } = body
    const result = await trackEvents(events)
    res.json({ success: true, data: result })
  } catch (err) {
    logger.error('埋点上报失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器内部错误' })
  }
}

module.exports = { track }