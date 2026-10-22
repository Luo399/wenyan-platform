/**
 * AI 告警模块
 * 功能：配额预警、下游异常计数、apiKey 缺失启动告警
 *
 * 设计说明：
 * - 所有内存状态在多进程部署时不共享，当前 PM2 cluster=1 单实例下有效
 * - dispatchAlert 默认 warn 日志；若配置 AI_ALERT_WEBHOOK 则追加 POST（失败静默）
 */

const config = require('../config/app')
const logger = require('../utils/logger')

/* ============================================================
 * 配额预警（每自然日每学生只告警一次）
 * ============================================================ */

// key: `${studentId}-quota-alert-day`  value: 'YYYY-MM-DD'
const quotaAlertCooldown = new Map()

function getDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 任一 bucket 使用率 >80% 时告警；同学生同自然日只告警一次。
 * @param {string|number} studentId
 * @param {{ daily:{used,limit}, weekly:{used,limit}, monthly:{used,limit} }} quota
 */
function checkQuotaAlert(studentId, quota) {
  if (!quota) return

  const buckets = ['daily', 'weekly', 'monthly']
  for (const key of buckets) {
    const b = quota[key]
    if (!b || !b.limit) continue
    const usage = b.used / b.limit
    if (usage > 0.8) {
      const dayKey = getDayKey(new Date())
      const cooldownKey = `${studentId}-quota-alert-day`
      if (quotaAlertCooldown.get(cooldownKey) === dayKey) return
      quotaAlertCooldown.set(cooldownKey, dayKey)

      const payload = {
        studentId,
        bucket: key,
        used: b.used,
        limit: b.limit,
        usage: Number((usage * 100).toFixed(1)) + '%',
      }
      dispatchAlert('ai_quota_high', payload)
      return
    }
  }
}

/* ============================================================
 * 下游（DeepSeek）错误连续计数
 * ============================================================ */

let downstreamErrorCount = 0
const DOWNSTREAM_ERROR_THRESHOLD = 3

function trackDownstreamError() {
  downstreamErrorCount += 1
  if (downstreamErrorCount === DOWNSTREAM_ERROR_THRESHOLD) {
    dispatchAlert('ai_deepseek_downstream', {
      count: downstreamErrorCount,
      threshold: DOWNSTREAM_ERROR_THRESHOLD,
    })
  }
}

function getDownstreamErrorCount() {
  return downstreamErrorCount
}

function resetDownstreamErrorCount() {
  downstreamErrorCount = 0
}

/* ============================================================
 * dispatchAlert：日志 stub + 可选 webhook
 * ============================================================ */

async function dispatchAlert(type, payload) {
  logger.warn('[AI_ALERT]', { type, payload })

  const webhook = process.env.AI_ALERT_WEBHOOK
  if (!webhook) return

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    await global.fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: `[AI_ALERT] ${type}\n${JSON.stringify(payload)}`,
        },
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch (err) {
    // webhook 失败静默，不阻断主流程
    logger.debug('[AI_ALERT] webhook 投递失败（静默忽略）', { error: err.message })
  }
}

/* ============================================================
 * 启动时 apiKey 缺失告警
 * ============================================================ */

let apiKeyStartupAlerted = false

function checkApiKeyStartup() {
  if (apiKeyStartupAlerted) return
  if (process.env.NODE_ENV === 'production' && !config.deepseek.apiKey) {
    apiKeyStartupAlerted = true
    logger.warn('[AI_ALERT] production 环境 DEEPSEEK_API_KEY 未配置，AI 对话功能将返回 503')
  }
}

module.exports = {
  checkQuotaAlert,
  trackDownstreamError,
  getDownstreamErrorCount,
  resetDownstreamErrorCount,
  dispatchAlert,
  checkApiKeyStartup,
}
