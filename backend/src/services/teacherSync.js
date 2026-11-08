/**
 * 教师后台同步服务（R170）
 *
 * 设计：
 * - answerService 在成功写入本地 SQLite 后调用 syncToTeacherBackend()
 * - 改为小型内存队列：调用方立即返回，不阻塞学生答题主流程
 * - 失败最多重试 3 次（指数退避 500ms / 1s / 2s），每次请求带 AbortController 超时
 * - 只发送最小字段（学生 id、姓名、班级、分数汇总），不整包发送答题明细
 * - 日志只记录状态码与条数，不记录响应体、姓名等敏感内容
 * - TEACHER_BACKEND_URL 留空时完全跳过，零开销
 */

const { info, warn } = require('../utils/logger')

/** 教师后台配置（每次调用时从 process.env 读，支持运行时 reload .env 后 PM2 reload --update-env 生效） */
function getConfig() {
  return {
    baseUrl: process.env.TEACHER_BACKEND_URL?.trim() || '',
    syncPath: process.env.TEACHER_BACKEND_SYNC_PATH?.trim() || '/api/answers/sync',
    token: process.env.TEACHER_BACKEND_TOKEN?.trim() || '',
    timeoutMs: Number(process.env.TEACHER_BACKEND_TIMEOUT_MS) || 5000,
  }
}

const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 500
const MAX_QUEUE_SIZE = 500

/** 待同步队列（进程内，重启丢失；教师后台可用全量导出兜底） */
const syncQueue = []
let draining = false

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 构造最小同步 payload：只包含学生标识、班级与分数汇总
 * @param {object} record
 * @returns {object}
 */
function buildPayload(record) {
  return {
    studentId: record.studentId,
    studentName: record.studentName || '',
    classCode: record.classCode || '',
    wenId: record.wenId,
    submittedAt: record.submittedAt,
    questionCount: record.questionCount || 0,
    totalScore: record.totalScore || 0,
    correctCount: record.correctCount || 0,
    wrongCount: record.wrongCount || 0,
    avgScore: record.avgScore || 0,
  }
}

/**
 * 单次推送（不读取响应体，避免把教师后台返回内容写入日志）
 * @param {object} payload
 * @param {object} cfg
 * @returns {Promise<{ ok: boolean, status: number|null, error?: string }>}
 */
async function postOnce(payload, cfg) {
  const url = cfg.baseUrl.replace(/\/+$/, '') + cfg.syncPath
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'wenyan-platform-backend/r170',
  }
  if (cfg.token) {
    headers['Authorization'] = `Bearer ${cfg.token}`
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 带重试的推送：最多 3 次，指数退避
 * @param {object} record
 * @returns {Promise<{ ok: boolean }>}
 */
async function deliverWithRetry(record) {
  const cfg = getConfig()
  if (!cfg.baseUrl) return { ok: true }

  const payload = buildPayload(record)
  let lastStatus = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await postOnce(payload, cfg)
    lastStatus = result.status

    if (result.ok) {
      info('[TeacherSync] 答题汇总同步成功', { status: result.status, count: 1 })
      return { ok: true }
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
    }
  }

  // 只记状态码与尝试次数，不记响应体/学生姓名
  warn('[TeacherSync] 答题汇总同步失败，已丢弃', {
    status: lastStatus,
    attempts: MAX_ATTEMPTS,
  })
  return { ok: false }
}

/**
 * 逐个消费队列（同一时刻只有一个消费者）
 */
async function drainQueue() {
  if (draining) return
  draining = true
  try {
    while (syncQueue.length > 0) {
      const record = syncQueue.shift()
      try {
        await deliverWithRetry(record)
      } catch (err) {
        warn('[TeacherSync] 同步任务异常', { error: err.message, pending: syncQueue.length })
      }
    }
  } finally {
    draining = false
  }
}

/**
 * 异步推送答题汇总到教师后台（入队后立即返回，不阻塞主流程）
 *
 * @param {object} record - 答题汇总
 * @param {string} record.studentId
 * @param {string|null} record.studentName
 * @param {string|null} record.classCode
 * @param {string} record.wenId
 * @param {string} record.submittedAt
 * @param {number} record.questionCount
 * @param {number} record.totalScore
 * @param {number} record.correctCount
 * @param {number} record.wrongCount
 * @param {number} record.avgScore
 * @returns {Promise<{ ok: boolean, queued?: boolean, pending?: number }>}
 */
async function syncToTeacherBackend(record) {
  const cfg = getConfig()

  // 未配置教师后台 URL —— 静默跳过（生产留空即可停用，不发 warning）
  if (!cfg.baseUrl) {
    return { ok: true }
  }

  // 队列有界，避免教师后台长时间不可用时内存无限增长
  if (syncQueue.length >= MAX_QUEUE_SIZE) {
    syncQueue.shift()
    warn('[TeacherSync] 同步队列已满，丢弃最旧记录', { pending: syncQueue.length })
  }
  syncQueue.push(record)

  // 入队即返回；drainQueue 内部串行消费
  void drainQueue()
  return { ok: true, queued: true, pending: syncQueue.length }
}

module.exports = {
  syncToTeacherBackend,
  // 导出供 answerService 内部检查是否启用同步
  isEnabled: () => !!getConfig().baseUrl,
}
