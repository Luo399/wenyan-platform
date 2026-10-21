/**
 * AI 对话服务层
 * 负责 DeepSeek API 调用、配额管理、并发控制、prompt 构造
 */

const config = require('../config/app')
const logger = require('../utils/logger')
const { db } = require('../config/database')
const { dbRun, dbGet, dbTransaction } = require('../utils/dbPromise')
const textsService = require('./textsService')

/* ============================================================
 * 日期工具
 * ============================================================ */

function getDailyPeriod(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMonthlyPeriod(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** ISO 8601 周：yyyy-Www */
function getWeeklyPeriod(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/* ============================================================
 * 2.6 并发信号量（模块级状态）
 * ============================================================ */

const concurrentMap = new Map()
let globalConcurrent = 0

function enterConcurrent(studentId) {
  // 单学生上限
  const perStudent = concurrentMap.get(studentId) || 0
  if (perStudent >= 2) return false
  // 全局上限
  if (globalConcurrent >= config.ai.maxConcurrent) return false
  concurrentMap.set(studentId, perStudent + 1)
  globalConcurrent += 1
  return true
}

function leaveConcurrent(studentId) {
  const perStudent = (concurrentMap.get(studentId) || 0) - 1
  if (perStudent <= 0) {
    concurrentMap.delete(studentId)
  } else {
    concurrentMap.set(studentId, perStudent)
  }
  globalConcurrent = Math.max(0, globalConcurrent - 1)
}

/* ============================================================
 * 2.1 callDeepSeek
 * ============================================================ */

function setTimeoutReject(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DEEPSEEK_TIMEOUT')), ms),
  )
}

/**
 * 发请求到 DeepSeek Chat Completions
 * @param {Array<{role:string,content:string}>} messages
 * @param {object} [options] { temperature, max_tokens }
 */
async function callDeepSeek(messages, options = {}) {
  const url = `${config.deepseek.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const body = {
    model: config.deepseek.model,
    messages,
    temperature: options.temperature ?? 0.7,
  }
  if (options.max_tokens) body.max_tokens = options.max_tokens

  const attempt = async () => {
    const fetchPromise = global.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.deepseek.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const err = new Error('DEEPSEEK_DOWNSTREAM_ERROR')
        err.status = res.status
        err.body = text
        throw err
      }
      return res.json()
    })

    const timeoutPromise = setTimeoutReject(config.ai.timeoutMs)

    try {
      return await Promise.race([fetchPromise, timeoutPromise])
    } catch (err) {
      // 如果是 timeout 先 reject，要清理 fetch
      if (err.message === 'DEEPSEEK_TIMEOUT') {
        throw err
      }
      throw err
    }
  }

  // 指数退避重试（最多 2 次，仅对网络错误和 5xx）
  const maxRetries = 2
  let lastErr
  for (let attemptNum = 0; attemptNum <= maxRetries; attemptNum++) {
    try {
      if (attemptNum > 0) {
        const backoff = 100 * attemptNum
        logger.debug(`[aiService] DeepSeek 重试 #${attemptNum}，等待 ${backoff}ms`)
        await new Promise((r) => setTimeout(r, backoff))
      }
      return await attempt()
    } catch (err) {
      lastErr = err
      const status = err.status
      const isRetryable =
        err.message === 'DEEPSEEK_TIMEOUT' ||
        !status || // 网络错误没有 status
        (status >= 500 && status < 600)
      if (!isRetryable) {
        // 429 / 4xx 不重试，直接抛出
        throw new Error('DEEPSEEK_DOWNSTREAM_ERROR')
      }
    }
  }

  // 重试耗尽
  throw new Error(lastErr.message === 'DEEPSEEK_TIMEOUT' ? 'DEEPSEEK_TIMEOUT' : 'DEEPSEEK_DOWNSTREAM_ERROR')
}

/* ============================================================
 * 2.2 buildSystemPrompt
 * ============================================================ */

function buildSystemPrompt(wenId) {
  const info = textsService.getBasicInfo(wenId)
  if (!info || !info.text_id) {
    throw new Error('TEXT_NOT_FOUND')
  }
  const title = info.title || '未知标题'
  const author = info.author || '未知'
  const dynasty = info.dynasty || '未知'
  let originalText = info.original_text || ''
  if (originalText.length > 8000) {
    originalText = originalText.slice(0, 8000)
  }
  return `你是一位专业的文言文助教，请基于给定课文内容，用深入浅出的中文回答学生的问题。回答要准确、简洁、避免超出课文范围。仅回答关于课文的问题，不要输出课文全文。

【课文标题】${title}
【作者】${author}
【朝代】${dynasty}
【课文原文】
${originalText}`
}

/* ============================================================
 * 2.3 / 2.4 配额管理
 * ============================================================ */

/**
 * 查询三档 quota 当前状态（非原子，仅用于预检）
 */
async function queryQuotaRows(studentId) {
  const daily = await dbGet(db, 'SELECT date, used_tokens FROM ai_quota_daily WHERE student_id = ?', [studentId])
  const weekly = await dbGet(db, 'SELECT week, used_tokens FROM ai_quota_weekly WHERE student_id = ?', [studentId])
  const monthly = await dbGet(db, 'SELECT month, used_tokens FROM ai_quota_monthly WHERE student_id = ?', [studentId])
  return { daily, weekly, monthly }
}

function buildQuotaResult(dailyRow, weeklyRow, monthlyRow, now, tokensDelta) {
  const curDaily = getDailyPeriod(now)
  const curWeekly = getWeeklyPeriod(now)
  const curMonthly = getMonthlyPeriod(now)

  const dailyUsed = dailyRow && dailyRow.date === curDaily ? dailyRow.used_tokens : 0
  const weeklyUsed = weeklyRow && weeklyRow.week === curWeekly ? weeklyRow.used_tokens : 0
  const monthlyUsed = monthlyRow && monthlyRow.month === curMonthly ? monthlyRow.used_tokens : 0

  const dailyNew = dailyUsed + tokensDelta
  const weeklyNew = weeklyUsed + tokensDelta
  const monthlyNew = monthlyUsed + tokensDelta

  const dailyResetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const monthlyResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // 周重置：下一个周一 00:00（本地时区）
  const weekday = now.getDay() // 0=周日
  const daysUntilMonday = weekday === 0 ? 1 : 8 - weekday
  const weeklyResetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday)

  return {
    daily: { used: dailyNew, limit: config.quota.daily, resetAt: dailyResetAt.toISOString() },
    weekly: { used: weeklyNew, limit: config.quota.weekly, resetAt: weeklyResetAt.toISOString() },
    monthly: { used: monthlyNew, limit: config.quota.monthly, resetAt: monthlyResetAt.toISOString() },
    exceeded:
      dailyNew > config.quota.daily ||
      weeklyNew > config.quota.weekly ||
      monthlyNew > config.quota.monthly,
    dailyNew,
    weeklyNew,
    monthlyNew,
    curDaily,
    curWeekly,
    curMonthly,
  }
}

/**
 * 扣配额（原子事务）
 * tokens <= 0 时仅返回当前额度，不扣分
 */
async function checkAndConsumeQuota(studentId, tokens) {
  const now = new Date()

  if (tokens <= 0) {
    const rows = await queryQuotaRows(studentId)
    const info = buildQuotaResult(rows.daily, rows.weekly, rows.monthly, now, 0)
    return {
      ok: true,
      daily: info.daily,
      weekly: info.weekly,
      monthly: info.monthly,
    }
  }

  try {
    return await dbTransaction(db, async ({ dbGet: g, dbRun: r }) => {
      const dailyRow = await g('SELECT date, used_tokens FROM ai_quota_daily WHERE student_id = ?', [studentId])
      const weeklyRow = await g('SELECT week, used_tokens FROM ai_quota_weekly WHERE student_id = ?', [studentId])
      const monthlyRow = await g('SELECT month, used_tokens FROM ai_quota_monthly WHERE student_id = ?', [studentId])

      const info = buildQuotaResult(dailyRow, weeklyRow, monthlyRow, now, tokens)

      if (info.exceeded) {
        // 超限，不扣分，直接返回
        return {
          ok: false,
          daily: info.daily,
          weekly: info.weekly,
          monthly: info.monthly,
        }
      }

      // 原子写入
      await r(
        `INSERT INTO ai_quota_daily(student_id, date, used_tokens) VALUES (?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET date = excluded.date, used_tokens = excluded.used_tokens`,
        [studentId, info.curDaily, info.dailyNew],
      )
      await r(
        `INSERT INTO ai_quota_weekly(student_id, week, used_tokens) VALUES (?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET week = excluded.week, used_tokens = excluded.used_tokens`,
        [studentId, info.curWeekly, info.weeklyNew],
      )
      await r(
        `INSERT INTO ai_quota_monthly(student_id, month, used_tokens) VALUES (?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET month = excluded.month, used_tokens = excluded.used_tokens`,
        [studentId, info.curMonthly, info.monthlyNew],
      )

      return {
        ok: true,
        daily: info.daily,
        weekly: info.weekly,
        monthly: info.monthly,
      }
    })
  } catch (err) {
    logger.error('[aiService] 配额操作异常', { error: err.message })
    throw err
  }
}

/**
 * 仅查询当前额度，不扣分
 */
async function checkQuotaOnly(studentId) {
  const rows = await queryQuotaRows(studentId)
  const now = new Date()
  const info = buildQuotaResult(rows.daily, rows.weekly, rows.monthly, now, 0)
  return {
    daily: info.daily,
    weekly: info.weekly,
    monthly: info.monthly,
  }
}

/* ============================================================
 * 2.5 logAiUsage（fire-and-forget）
 * ============================================================ */

function logAiUsage({ studentId, wenId, promptTokens, completionTokens, totalTokens }) {
  dbRun(
    db,
    `INSERT INTO ai_usage(student_id, wen_id, prompt_tokens, completion_tokens, total_tokens)
     VALUES (?, ?, ?, ?, ?)`,
    [studentId, wenId || null, promptTokens || 0, completionTokens || 0, totalTokens || 0],
  ).catch((err) => {
    logger.warn('[aiService] 写入 ai_usage 失败（不阻断主流程）', { error: err.message })
  })
}

/* ============================================================
 * 2.7 URL 安全过滤
 * ============================================================ */

function sanitizeAiReply(text) {
  if (typeof text !== 'string') return text
  return text.replace(/https?:\/\/[^\s)"'<>]+/g, (url) => `<code>${url}</code>`)
}

module.exports = {
  callDeepSeek,
  buildSystemPrompt,
  checkAndConsumeQuota,
  checkQuotaOnly,
  logAiUsage,
  enterConcurrent,
  leaveConcurrent,
  sanitizeAiReply,
}
