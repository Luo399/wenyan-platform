/**
 * 数据导出 Controller
 *
 * 提供埋点数据和答题数据的导出功能。
 * 输出 CSV（UTF-8 带 BOM，Excel 双击可直接打开），不再依赖 xlsx 包：
 * - xlsx@0.18.5 在 npm 上已无修复版本（原型污染 / ReDoS），而导出内容正是
 *   学生姓名与答案，继续挂着这个依赖收益为零；
 * - 导出的用途是「下载后自己看/再加工」，CSV 足够，且没有解析器攻击面。
 */

const { db } = require('../config/database')
const logger = require('../utils/logger')

/** 执行 SQL 查询并返回 Promise */
function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows || [])
    })
  })
}

/** UTF-8 BOM：不加的话 Excel 打开中文会乱码 */
const CSV_BOM = '\uFEFF'

/**
 * 转义单个 CSV 单元格
 * 含逗号/引号/换行的值必须整体加引号，内部引号翻倍（RFC 4180）
 */
function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** 把一张表序列化为 CSV 文本（含表头） */
function toCsv(headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','))
  }
  return lines.join('\r\n')
}

/**
 * 将一或多张表写入响应
 *
 * CSV 没有多 sheet 概念，多表时追加 sheet 列并用空行分隔，
 * 保持「一个请求一个文件」的既有下载行为。
 *
 * @param {object} res - Express 响应对象
 * @param {Array<{ name: string, rows: object[], headers: string[] }>} sheets
 * @param {string} filename - 下载文件名（不含扩展名）
 */
function writeCsvResponse(res, sheets, filename) {
  let csv
  if (sheets.length === 1) {
    csv = toCsv(sheets[0].headers, sheets[0].rows)
  } else {
    const blocks = sheets.map((sheet) =>
      toCsv(
        ['sheet', ...sheet.headers],
        sheet.rows.map((row) => ({ sheet: sheet.name, ...row })),
      ),
    )
    csv = blocks.join('\r\n\r\n')
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  // filename* 走 RFC 5987，中文文件名在各浏览器下都能正确落盘
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(filename)}.csv`,
  )
  res.send(CSV_BOM + csv)
}

/**
 * 导出埋点事件数据
 * GET /api/export/tracking-events?startDate=&endDate=
 */
async function exportTrackingEvents(req, res, next) {
  try {
    const { startDate, endDate } = req.query

    let sql = 'SELECT * FROM tracking_events'
    const params = []

    if (startDate) { sql += ' WHERE timestamp >= ?'; params.push(startDate) }
    if (endDate) { sql += startDate ? ' AND timestamp <= ?' : ' WHERE timestamp <= ?'; params.push(endDate) }

    sql += ' ORDER BY timestamp DESC LIMIT 10000'

    const rows = await queryDb(sql, params)

    const data = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      session_id: r.session_id,
      event_type: r.event_type,
      step_id: r.step_id,
      properties: r.properties,
      page_url: r.page_url,
      timestamp: r.timestamp,
    }))

    writeCsvResponse(res, [
      {
        name: '埋点事件',
        headers: ['id', 'user_id', 'session_id', 'event_type', 'step_id', 'properties', 'page_url', 'timestamp'],
        rows: data,
      },
    ], `埋点事件_${startDate || 'all'}_${endDate || 'all'}`)
  } catch (err) {
    logger.error('导出埋点事件失败:', err)
    next(err)
  }
}

/**
 * 导出答题数据
 * GET /api/export/answers?startDate=&endDate=
 */
async function exportAnswers(req, res, next) {
  try {
    const { startDate, endDate } = req.query

    let sql = `
      SELECT a.id, a.student_id, s.student_name, a.wen_id, a.question_id,
             a.user_answer, a.correct_answer, a.score, a.submitted_at
      FROM answers a
      LEFT JOIN students s ON a.student_id = s.student_id`
    const params = []

    if (startDate) { sql += ' WHERE a.submitted_at >= ?'; params.push(startDate) }
    if (endDate) { sql += startDate ? ' AND a.submitted_at <= ?' : ' WHERE a.submitted_at <= ?'; params.push(endDate) }

    sql += ' ORDER BY a.submitted_at DESC LIMIT 10000'

    const rows = await queryDb(sql, params)

    const data = rows.map((r) => ({
      id: r.id,
      student_id: r.student_id,
      student_name: r.student_name || '',
      wen_id: r.wen_id,
      question_id: r.question_id,
      user_answer: r.user_answer,
      correct_answer: r.correct_answer,
      score: r.score,
      submitted_at: r.submitted_at,
    }))

    writeCsvResponse(res, [
      {
        name: '答题数据',
        headers: ['id', 'student_id', 'student_name', 'wen_id', 'question_id', 'user_answer', 'correct_answer', 'score', 'submitted_at'],
        rows: data,
      },
    ], `答题数据_${startDate || 'all'}_${endDate || 'all'}`)
  } catch (err) {
    logger.error('导出答题数据失败:', err)
    next(err)
  }
}

/**
 * 导出汇总统计（看板数据）
 * GET /api/export/dashboard-summary?startDate=&endDate=
 */
async function exportDashboardSummary(req, res, next) {
  try {
    const { startDate, endDate } = req.query

    // 1. 步骤漏斗统计
    let funnelSql = `
      SELECT step_id, COUNT(*) AS enter_count
      FROM tracking_events
      WHERE event_type = 'step_enter'`
    const funnelParams = []
    if (startDate) { funnelSql += ' AND timestamp >= ?'; funnelParams.push(startDate) }
    if (endDate) { funnelSql += startDate ? ' AND timestamp <= ?' : ' WHERE timestamp <= ?'; funnelParams.push(endDate) }
    funnelSql += ' GROUP BY step_id ORDER BY enter_count DESC'
    const funnelRows = await queryDb(funnelSql, funnelParams)

    // 2. 模块交互统计
    let interactionSql = `
      SELECT
        JSON_EXTRACT(properties, '$.module_type') AS module_type,
        JSON_EXTRACT(properties, '$.action') AS action,
        COUNT(*) AS count
      FROM tracking_events
      WHERE event_type = 'interaction'`
    const interactionParams = []
    if (startDate) { interactionSql += ' AND timestamp >= ?'; interactionParams.push(startDate) }
    if (endDate) { interactionSql += startDate ? ' AND timestamp <= ?' : ' WHERE timestamp <= ?'; interactionParams.push(endDate) }
    interactionSql += ' GROUP BY module_type, action ORDER BY count DESC'
    const interactionRows = await queryDb(interactionSql, interactionParams)

    // 3. 字词查询统计
    let searchSql = `
      SELECT
        step_id,
        JSON_EXTRACT(properties, '$.word') AS word,
        COUNT(*) AS query_count
      FROM tracking_events
      WHERE event_type = 'search_word'`
    const searchParams = []
    if (startDate) { searchSql += ' AND timestamp >= ?'; searchParams.push(startDate) }
    if (endDate) { searchSql += startDate ? ' AND timestamp <= ?' : ' WHERE timestamp <= ?'; searchParams.push(endDate) }
    searchSql += ' GROUP BY step_id, word ORDER BY query_count DESC LIMIT 50'
    const searchRows = await queryDb(searchSql, searchParams)

    // 4. 闯关成绩统计
    let quizSql = `
      SELECT
        step_id,
        CAST(JSON_EXTRACT(properties, '$.score') AS INTEGER) AS score,
        COUNT(*) AS count
      FROM tracking_events
      WHERE event_type = 'quiz_submit'
        AND JSON_EXTRACT(properties, '$.score') IS NOT NULL`
    const quizParams = []
    if (startDate) { quizSql += ' AND timestamp >= ?'; quizParams.push(startDate) }
    if (endDate) { quizSql += startDate ? ' AND timestamp <= ?' : ' WHERE timestamp <= ?'; quizParams.push(endDate) }
    quizSql += ' GROUP BY step_id, score ORDER BY step_id, score'
    const quizRows = await queryDb(quizSql, quizParams)

    writeCsvResponse(res, [
      { name: '步骤漏斗', headers: ['step_id', 'enter_count'], rows: funnelRows },
      { name: '模块交互', headers: ['module_type', 'action', 'count'], rows: interactionRows },
      { name: '字词查询', headers: ['step_id', 'word', 'query_count'], rows: searchRows },
      { name: '闯关成绩', headers: ['step_id', 'score', 'count'], rows: quizRows },
    ], `看板汇总_${startDate || 'all'}_${endDate || 'all'}`)
  } catch (err) {
    logger.error('导出汇总统计失败:', err)
    next(err)
  }
}

module.exports = {
  exportTrackingEvents,
  exportAnswers,
  exportDashboardSummary,
  // 导出供单测直接验证 CSV 转义
  escapeCsvCell,
  toCsv,
}
