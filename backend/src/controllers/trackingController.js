/**
 * 用户行为埋点 Controller
 *
 * 接收前端发送的埋点事件，批量写入 tracking_events 表。
 * 轻量设计：不校验用户身份（未登录用户也要收集），仅做基本格式校验。
 */

const { trackEvents } = require('../services/trackingService')
const logger = require('../utils/logger')

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
    const { events } = req.body

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'events 必须是包含至少一个元素的数组',
      })
    }

    // 校验每个事件的基本格式
    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      if (!event || !event.event_type) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `events[${i}] 缺少 event_type`,
        })
      }
      if (typeof event.event_type !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `events[${i}].event_type 必须是字符串`,
        })
      }
    }

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