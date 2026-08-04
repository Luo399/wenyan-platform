/**
 * 数据导出 Controller
 *
 * 提供埋点数据和答题数据的 Excel 导出功能。
 * 使用 xlsx 库生成 .xlsx 文件，通过 Content-Disposition 让浏览器下载。
 */
const XLSX = require('xlsx')
const { db } = require('../config/database')
const logger = require('../utils/logger')

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
 * 将数据数组转换为 Excel 工作簿并写入响应
 * @param {object} res - Express 响应对象
 * @param {Array<{ name: string, rows: object[], headers: string[] }>} sheets - 多个 sheet 配置
 * @param {string} filename - 下载文件名
 */
function writeExcelResponse(res, sheets, filename) {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    // 将数据转为二维数组（含表头）
    const wsData = [sheet.headers]
    for (const row of sheet.rows) {
      wsData.push(sheet.headers.map((h) => row[h] ?? ''))
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // 自动列宽
    const colWidths = sheet.headers.map((h) => ({
      wch: Math.max(h.length * 2, 10),
    }))
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}.xlsx"`)
  res.send(buffer)
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

    writeExcelResponse(res, [
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

    writeExcelResponse(res, [
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

    writeExcelResponse(res, [
      {
        name: '步骤漏斗',
        headers: ['step_id', 'enter_count'],
        rows: funnelRows,
      },
      {
        name: '模块交互',
        headers: ['module_type', 'action', 'count'],
        rows: interactionRows,
      },
      {
        name: '字词查询',
        headers: ['step_id', 'word', 'query_count'],
        rows: searchRows,
      },
      {
        name: '闯关成绩',
        headers: ['step_id', 'score', 'count'],
        rows: quizRows,
      },
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
}