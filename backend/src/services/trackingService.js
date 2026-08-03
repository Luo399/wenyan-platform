/**
 * 用户行为埋点服务模块
 *
 * 支持的事件类型：
 * - step_enter: 进入某步（step_id, from_back_button）
 * - step_exit: 离开某步（step_id, duration, next_step_id）
 * - interaction: 模块交互（module_type, action, cost_time）
 * - search_word: 字词查询（step_id, word, is_audio）
 * - quiz_submit: 闯关提交（step_id, score, wrong_answers）
 */

const { db } = require('../config/database')
const { logOperation } = require('../utils/logger')

/**
 * 批量提交埋点事件
 * 前端可能因网络抖动一次发送多个事件，服务端批量写入
 * @param {Array<{event_type: string, user_id: string, session_id: string, step_id: string, properties: object, page_url: string, timestamp: string}>} events
 * @returns {Promise<{count: number}>}
 */
async function trackEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { count: 0 }
  }

  const stmt = db.prepare(`
    INSERT INTO tracking_events (user_id, session_id, event_type, step_id, properties, page_url, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (const event of events) {
    const { event_type, user_id = '', session_id = '', step_id = '', properties = {}, page_url = '', timestamp } = event

    await new Promise((resolve, reject) => {
      stmt.run(
        user_id,
        session_id,
        event_type,
        step_id,
        JSON.stringify(properties),
        page_url,
        timestamp || new Date().toISOString(),
        function (err) {
          if (err) reject(err)
          else resolve()
        },
      )
    })
  }

  stmt.finalize()

  logOperation('埋点事件批量写入', { count: events.length })

  return { count: events.length }
}

/**
 * 按事件类型查询埋点数据
 * @param {string} eventType - 事件类型
 * @param {object} options - 查询选项
 * @returns {Promise<Array>}
 */
async function getEventsByType(eventType, options = {}) {
  const { limit = 100, offset = 0, startDate, endDate } = options

  let sql = 'SELECT * FROM tracking_events WHERE event_type = ?'
  const params = [eventType]

  if (startDate) {
    sql += ' AND timestamp >= ?'
    params.push(startDate)
  }
  if (endDate) {
    sql += ' AND timestamp <= ?'
    params.push(endDate)
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(
        (rows || []).map((row) => ({
          ...row,
          properties: safeParseJson(row.properties),
        })),
      )
    })
  })
}

/**
 * 按 session_id 查询完整用户路径
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
async function getEventsBySession(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM tracking_events WHERE session_id = ? ORDER BY id ASC',
      [sessionId],
      (err, rows) => {
        if (err) return reject(err)
        resolve(
          (rows || []).map((row) => ({
            ...row,
            properties: safeParseJson(row.properties),
          })),
        )
      },
    )
  })
}

/**
 * 安全解析 JSON 字符串
 */
function safeParseJson(str) {
  if (!str) return {}
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}

module.exports = {
  trackEvents,
  getEventsByType,
  getEventsBySession,
}