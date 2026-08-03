/**
 * 用户行为埋点分析 Controller
 *
 * 提供对 tracking_events 表的聚合查询，供前端看板展示。
 * 所有查询默认按时间范围过滤，支持 startDate / endDate 参数。
 */
const { db } = require('../config/database')
const logger = require('../utils/logger')

/**
 * 安全解析日期参数，返回 ISO 日期字符串或 null
 */
function parseDateParam(raw) {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * 执行 SQL 查询并返回 Promise
 */
function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows || [])
    })
  })
}

/**
 * 步骤漏斗分析
 * GET /api/tracking/funnel?startDate=&endDate=
 *
 * 返回每个 step_id 的：
 * - enter_count: 进入次数
 * - exit_count: 退出次数（有 step_exit 且无后续 step_enter 的同 session）
 * - exit_rate: 退出率 = exit_count / enter_count
 * - avg_duration: 平均停留时长（ms）
 */
async function getFunnel(req, res, next) {
  try {
    const startDate = parseDateParam(req.query.startDate)
    const endDate = parseDateParam(req.query.endDate)

    let enterSql = 'SELECT step_id, COUNT(*) AS enter_count FROM tracking_events WHERE event_type = ?'
    let exitSql = `
      SELECT e.step_id, COUNT(*) AS exit_count
      FROM tracking_events e
      WHERE e.event_type = ? AND NOT EXISTS (
        SELECT 1 FROM tracking_events e2
        WHERE e2.session_id = e.session_id
          AND e2.event_type = 'step_enter'
          AND e2.id > e.id
      )`
    let durationSql = `
      SELECT step_id, AVG(CAST(JSON_EXTRACT(properties, '$.duration') AS INTEGER)) AS avg_duration
      FROM tracking_events
      WHERE event_type = ? AND JSON_EXTRACT(properties, '$.duration') IS NOT NULL`

    const enterParams = ['step_enter']
    const exitParams = ['step_exit']
    const durationParams = ['step_exit']

    if (startDate) {
      const clause = ' AND timestamp >= ?'
      enterSql += clause; enterParams.push(startDate)
      exitSql += clause; exitParams.push(startDate)
      durationSql += clause; durationParams.push(startDate)
    }
    if (endDate) {
      const clause = ' AND timestamp <= ?'
      enterSql += clause; enterParams.push(endDate)
      exitSql += clause; exitParams.push(endDate)
      durationSql += clause; durationParams.push(endDate)
    }

    enterSql += ' GROUP BY step_id ORDER BY enter_count DESC'
    exitSql += ' GROUP BY e.step_id'
    durationSql += ' GROUP BY step_id'

    const [enterRows, exitRows, durationRows] = await Promise.all([
      queryDb(enterSql, enterParams),
      queryDb(exitSql, exitParams),
      queryDb(durationSql, durationParams),
    ])

    const exitMap = {}
    for (const r of exitRows) exitMap[r.step_id] = r.exit_count

    const durationMap = {}
    for (const r of durationRows) durationMap[r.step_id] = Math.round(r.avg_duration || 0)

    const funnel = enterRows.map((r) => ({
      stepId: r.step_id,
      enterCount: r.enter_count,
      exitCount: exitMap[r.step_id] || 0,
      exitRate: r.enter_count > 0 ? Math.round(((exitMap[r.step_id] || 0) / r.enter_count) * 100) : 0,
      avgDuration: durationMap[r.step_id] || 0,
    }))

    res.json({ success: true, data: funnel })
  } catch (err) {
    logger.error('获取漏斗分析失败:', err)
    next(err)
  }
}

/**
 * 模块交互渗透率统计
 * GET /api/tracking/interaction?startDate=&endDate=
 *
 * 按 step_id + module_type 分组统计 interaction 事件
 */
async function getInteractionStats(req, res, next) {
  try {
    const startDate = parseDateParam(req.query.startDate)
    const endDate = parseDateParam(req.query.endDate)

    let sql = `
      SELECT
        step_id,
        JSON_EXTRACT(properties, '$.module_type') AS module_type,
        JSON_EXTRACT(properties, '$.action') AS action,
        COUNT(*) AS action_count
      FROM tracking_events
      WHERE event_type = 'interaction'`
    const params = []

    if (startDate) { sql += ' AND timestamp >= ?'; params.push(startDate) }
    if (endDate) { sql += ' AND timestamp <= ?'; params.push(endDate) }

    sql += ' GROUP BY step_id, module_type, action ORDER BY action_count DESC'

    const rows = await queryDb(sql, params)

    // 按 step_id 聚合
    const byStep = {}
    for (const r of rows) {
      if (!byStep[r.step_id]) byStep[r.step_id] = { stepId: r.step_id, modules: [] }
      byStep[r.step_id].modules.push({
        moduleType: r.module_type || '',
        action: r.action || '',
        count: r.action_count,
      })
    }

    res.json({ success: true, data: Object.values(byStep) })
  } catch (err) {
    logger.error('获取交互统计失败:', err)
    next(err)
  }
}

/**
 * 字词查询趋势
 * GET /api/tracking/search-trend?startDate=&endDate=&limit=20
 *
 * 按 step_id + word 统计 search_word 事件次数，
 * 支持异常检测（超过均值 + 3 倍标准差标记为异常）
 */
async function getSearchTrend(req, res, next) {
  try {
    const startDate = parseDateParam(req.query.startDate)
    const endDate = parseDateParam(req.query.endDate)
    const limit = parseInt(req.query.limit, 10) || 20

    let sql = `
      SELECT
        step_id,
        JSON_EXTRACT(properties, '$.word') AS word,
        COUNT(*) AS query_count
      FROM tracking_events
      WHERE event_type = 'search_word'`
    const params = []

    if (startDate) { sql += ' AND timestamp >= ?'; params.push(startDate) }
    if (endDate) { sql += ' AND timestamp <= ?'; params.push(endDate) }

    sql += ' GROUP BY step_id, word ORDER BY query_count DESC LIMIT ?'
    params.push(limit)

    const rows = await queryDb(sql, params)

    // 计算均值 + 标准差，标记异常值
    const counts = rows.map((r) => r.query_count)
    const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
    const variance = counts.length > 0
      ? counts.reduce((sum, c) => sum + (c - avg) ** 2, 0) / counts.length
      : 0
    const stddev = Math.sqrt(variance)
    const threshold = avg + 3 * stddev

    const data = rows.map((r) => ({
      stepId: r.step_id,
      word: r.word || '',
      queryCount: r.query_count,
      isAnomaly: r.query_count > threshold,
    }))

    res.json({ success: true, data, meta: { avg: Math.round(avg), stddev: Math.round(stddev), threshold: Math.round(threshold) } })
  } catch (err) {
    logger.error('获取字词查询趋势失败:', err)
    next(err)
  }
}

/**
 * 闯关成绩分布
 * GET /api/tracking/quiz-performance?startDate=&endDate=&stepId=
 *
 * 按 step_id 统计 quiz_submit 的得分分布
 */
async function getQuizPerformance(req, res, next) {
  try {
    const startDate = parseDateParam(req.query.startDate)
    const endDate = parseDateParam(req.query.endDate)
    const stepIdFilter = req.query.stepId

    let sql = `
      SELECT
        step_id,
        CAST(JSON_EXTRACT(properties, '$.score') AS INTEGER) AS score
      FROM tracking_events
      WHERE event_type = 'quiz_submit'
        AND JSON_EXTRACT(properties, '$.score') IS NOT NULL`
    const params = []

    if (startDate) { sql += ' AND timestamp >= ?'; params.push(startDate) }
    if (endDate) { sql += ' AND timestamp <= ?'; params.push(endDate) }
    if (stepIdFilter) { sql += ' AND step_id = ?'; params.push(stepIdFilter) }

    sql += ' ORDER BY timestamp DESC'

    const rows = await queryDb(sql, params)

    // 按 step_id 分组计算统计
    const byStep = {}
    for (const r of rows) {
      if (!byStep[r.step_id]) {
        byStep[r.step_id] = { stepId: r.step_id, scores: [], count: 0, totalScore: 0 }
      }
      byStep[r.step_id].scores.push(r.score)
      byStep[r.step_id].count++
      byStep[r.step_id].totalScore += r.score
    }

    const result = Object.values(byStep).map((s) => {
      const sorted = [...s.scores].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length > 0
        ? (sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid])
        : 0

      // 分布区间：0-59, 60-79, 80-100
      const distribution = { fail: 0, pass: 0, excellent: 0 }
      for (const score of s.scores) {
        if (score < 60) distribution.fail++
        else if (score < 80) distribution.pass++
        else distribution.excellent++
      }

      return {
        stepId: s.stepId,
        totalCount: s.count,
        avgScore: s.count > 0 ? Math.round(s.totalScore / s.count) : 0,
        medianScore: Math.round(median),
        distribution,
      }
    })

    res.json({ success: true, data: result })
  } catch (err) {
    logger.error('获取闯关成绩分布失败:', err)
    next(err)
  }
}

/**
 * 会话路径分析
 * GET /api/tracking/session-path?startDate=&endDate=&limit=100
 *
 * 按 session_id 聚合 step_enter 事件序列，统计后退次数
 */
async function getSessionPath(req, res, next) {
  try {
    const startDate = parseDateParam(req.query.startDate)
    const endDate = parseDateParam(req.query.endDate)
    const limit = parseInt(req.query.limit, 10) || 100

    let sql = `
      SELECT session_id, step_id, timestamp, JSON_EXTRACT(properties, '$.from_back_button') AS from_back
      FROM tracking_events
      WHERE event_type = 'step_enter'`
    const params = []

    if (startDate) { sql += ' AND timestamp >= ?'; params.push(startDate) }
    if (endDate) { sql += ' AND timestamp <= ?'; params.push(endDate) }

    sql += ' ORDER BY session_id, id ASC'

    const rows = await queryDb(sql, params)

    // 按 session_id 聚合
    const sessionMap = {}
    for (const r of rows) {
      if (!sessionMap[r.session_id]) {
        sessionMap[r.session_id] = { sessionId: r.session_id, steps: [], backCount: 0 }
      }
      sessionMap[r.session_id].steps.push({
        stepId: r.step_id,
        timestamp: r.timestamp,
      })
      if (r.from_back === 'true' || r.from_back === true) {
        sessionMap[r.session_id].backCount++
      }
    }

    // 取最近 limit 条 session
    const sessions = Object.values(sessionMap)
      .sort((a, b) => {
        const aLast = a.steps[a.steps.length - 1]?.timestamp || ''
        const bLast = b.steps[b.steps.length - 1]?.timestamp || ''
        return bLast.localeCompare(aLast)
      })
      .slice(0, limit)

    // 为每个 session 生成路径字符串
    const data = sessions.map((s) => ({
      sessionId: s.sessionId,
      path: s.steps.map((st) => st.stepId).join(' → '),
      stepCount: s.steps.length,
      backCount: s.backCount,
      firstStep: s.steps[0]?.stepId || '',
      lastStep: s.steps[s.steps.length - 1]?.stepId || '',
      startTime: s.steps[0]?.timestamp || '',
      endTime: s.steps[s.steps.length - 1]?.timestamp || '',
    }))

    res.json({ success: true, data })
  } catch (err) {
    logger.error('获取会话路径失败:', err)
    next(err)
  }
}

/**
 * 活跃用户统计
 * GET /api/tracking/active-users?startDate=&endDate=
 *
 * 按 user_id 去重统计日活/周活
 */
async function getActiveUsers(req, res, next) {
  try {
    const startDate = parseDateParam(req.query.startDate)
    const endDate = parseDateParam(req.query.endDate)

    let dailySql = `
      SELECT DATE(timestamp) AS date, COUNT(DISTINCT user_id) AS dau
      FROM tracking_events
      WHERE event_type = 'step_enter'
        AND user_id != ''`
    let weeklySql = `
      SELECT strftime('%Y-%W', timestamp) AS week, COUNT(DISTINCT user_id) AS wau
      FROM tracking_events
      WHERE event_type = 'step_enter'
        AND user_id != ''`
    const dailyParams = []
    const weeklyParams = []

    if (startDate) {
      dailySql += ' AND timestamp >= ?'; dailyParams.push(startDate)
      weeklySql += ' AND timestamp >= ?'; weeklyParams.push(startDate)
    }
    if (endDate) {
      dailySql += ' AND timestamp <= ?'; dailyParams.push(endDate)
      weeklySql += ' AND timestamp <= ?'; weeklyParams.push(endDate)
    }

    dailySql += ' GROUP BY date ORDER BY date DESC LIMIT 30'
    weeklySql += ' GROUP BY week ORDER BY week DESC LIMIT 12'

    const [dailyRows, weeklyRows, totalActive] = await Promise.all([
      queryDb(dailySql, dailyParams),
      queryDb(weeklySql, weeklyParams),
      queryDb(
        "SELECT COUNT(DISTINCT user_id) AS total FROM tracking_events WHERE event_type = 'step_enter' AND user_id != ''",
      ),
    ])

    res.json({
      success: true,
      data: {
        totalActiveUsers: totalActive[0]?.total || 0,
        daily: dailyRows.map((r) => ({ date: r.date, dau: r.dau })),
        weekly: weeklyRows.map((r) => ({ week: r.week, wau: r.wau })),
      },
    })
  } catch (err) {
    logger.error('获取活跃用户统计失败:', err)
    next(err)
  }
}

module.exports = {
  getFunnel,
  getInteractionStats,
  getSearchTrend,
  getQuizPerformance,
  getSessionPath,
  getActiveUsers,
}