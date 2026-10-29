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

/** 单次上报体上限 32KB（防止 analytics 接口被大 payload 拖垮） */
const MAX_PAYLOAD_BYTES = 32 * 1024
/** 事件名长度上限 */
const MAX_EVENT_NAME_LENGTH = 64
/** 允许的埋点时间与服务器时间差（24 小时） */
const MAX_TIMESTAMP_SKEW_MS = 24 * 60 * 60 * 1000

/**
 * 时间戳必须可解析，且与当前时间相差不超过 24 小时
 */
function isValidTimestamp(value) {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return false
  return Math.abs(Date.now() - time) <= MAX_TIMESTAMP_SKEW_MS
}

const trackingEventSchema = z.object({
  event_type: z.enum(ALLOWED_EVENT_TYPES, {
    errorMap: () => ({ message: 'event_type 不在允许列表内' }),
  }),
  // 登录态下 user_id 由服务端注入；未登录时客户端值会被忽略（记匿名）
  user_id: z.string().max(50).optional(),
  session_id: z.string().max(100).optional(),
  step_id: z.string().max(100).optional(),
  page_url: z.string().max(500).optional(),
  timestamp: z
    .string()
    .max(50)
    .refine(isValidTimestamp, { message: 'timestamp 必须是 24 小时内的可解析时间' })
    .optional(),
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
    const rawBody = req.body || {}

    // payload 大小上限（按 UTF-8 字节数计算）
    let payloadBytes = 0
    try {
      payloadBytes = Buffer.byteLength(JSON.stringify(rawBody), 'utf8')
    } catch {
      payloadBytes = Number.POSITIVE_INFINITY
    }
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: `单次上报不能超过 ${MAX_PAYLOAD_BYTES / 1024}KB`,
      })
    }

    let body
    try {
      body = trackBodySchema.parse(rawBody)
    } catch (err) {
      return handleZodError(res, err, '埋点参数校验失败')
    }

    const { events } = body
    const invalidEvent = events.find(
      (event) => typeof event.event_type !== 'string'
        || event.event_type.length > MAX_EVENT_NAME_LENGTH,
    )
    if (invalidEvent) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `event_type 长度不能超过 ${MAX_EVENT_NAME_LENGTH} 字符`,
      })
    }

    // user_id 只信任登录态：有 req.user 用学生学号，否则记匿名（空串）
    const userId = req.user?.student_id || ''
    const normalizedEvents = events.map((event) => ({
      ...event,
      user_id: userId,
      timestamp: event.timestamp
        ? new Date(event.timestamp).toISOString()
        : new Date().toISOString(),
    }))

    const result = await trackEvents(normalizedEvents)

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