/**
 * 用户行为埋点 Controller
 *
 * 接收前端发送的埋点事件，批量写入 tracking_events 表。
 * 轻量设计：不校验用户身份（未登录用户也要收集），仅做基本格式校验。
 */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { trackEvents } = require('../services/trackingService')
const logger = require('../utils/logger')

// ===== Zod 参数校验 Schema =====
// 枚举前端实际发送的所有事件类型——与前端 utils/tracking.ts + useTracking.ts 对齐
const ALLOWED_EVENT_TYPES = [
  // 页面级
  'step_enter', 'step_exit', 'page_view',
  // 应用生命周期
  'page_show', 'page_hide', 'session_end',
  // 业务交互
  'interaction', 'search_word', 'quiz_submit',
  // AI 对话
  'ai_chat', 'ai_quota_check', 'ai_error',
]

const trackingEventSchema = z.object({
  event_type: z.enum(ALLOWED_EVENT_TYPES, {
    errorMap: () => ({ message: 'event_type 不在允许列表内' }),
  }),
  user_id: z.string().max(50).optional(),
  session_id: z.string().max(100).optional(),
  step_id: z.string().max(100).optional(),
  page_url: z.string().max(500).optional(),
  timestamp: z.string().max(50).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
})

const trackBodySchema = z.object({
  events: z
    .array(trackingEventSchema)
    .min(1, 'events 至少包含一个事件')
    .max(200, '单次上报最多 200 个事件'),
})

// handleZodError 已收敛到 ../middleware/validate.js

/**
 * POST /api/track
 * 批量提交埋点事件
 *
 * Body:
 * {
 *   events: [
 *     {
 *       event_type: 'step_enter' | 'step_exit' | 'interaction' | 'search_word' | 'quiz_submit',
 *       user_id: string,
 *       session_id: string,
 *       step_id: string,
 *       properties: object,
 *       page_url: string,
 *       timestamp: string (ISO 8601)
 *     }
 *   ]
 * }
 */
async function track(req, res) {
  try {
    let body
    try {
      body = trackBodySchema.parse(req.body || {})
    } catch (err) {
      return handleZodError(res, err, '埋点参数校验失败')
    }

    const { events } = body
    const result = await trackEvents(events)

    res.status(200).json({
      success: true,
      message: '埋点事件已接收',
      data: result,
    })
  } catch (err) {
    logger.error('处理埋点事件失败', {
      error: err.message,
      stack: err.stack,
    })
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  }
}

module.exports = {
  track,
}