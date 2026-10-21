/**
 * 教师后台同步服务（R170）
 *
 * 设计：
 * - answerService 在成功写入本地 SQLite 后调用 syncToTeacherBackend()
 * - 异步 HTTP POST，失败不阻塞主流程（学生答题已保存本地）
 * - TEACHER_BACKEND_URL 留空时完全跳过，零开销
 * - 超时默认 5s，可通过 TEACHER_BACKEND_TIMEOUT_MS 覆盖
 *
 * 推送 payload（与本地 answers 表字段一致）：
 * ```json
 * {
 *   "studentId": "10001",
 *   "studentName": "张三",
 *   "wenId": "WEN_01",
 *   "submittedAt": "2026-10-21T08:00:00.000Z",
 *   "questions": [
 *     {
 *       "questionId": "WEN_01_level1_q1",
 *       "userAnswer": 1,
 *       "correctAnswer": 2,
 *       "isCorrect": false,
 *       "score": 0,
 *       "attemptNumber": 3
 *     }
 *   ],
 *   "totalScore": 5,
 *   "correctCount": 5,
 *   "wrongCount": 0
 * }
 * ```
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

/**
 * 异步推送答题记录到教师后台
 *
 * @param {object} record - 完整答题数据
 * @param {string} record.studentId
 * @param {string|null} record.studentName
 * @param {string} record.wenId
 * @param {string} record.submittedAt
 * @param {Array}  record.questions - [{ questionId, userAnswer, correctAnswer, isCorrect, score, attemptNumber }]
 * @param {number} record.totalScore
 * @param {number} record.correctCount
 * @param {number} record.wrongCount
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
async function syncToTeacherBackend(record) {
  const cfg = getConfig()

  // 未配置教师后台 URL —— 静默跳过（生产留空即可停用，不发 warning）
  if (!cfg.baseUrl) {
    return { ok: true }
  }

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
      body: JSON.stringify(record),
      signal: controller.signal,
    })

    // 4xx/5xx 视为同步失败，warn 但不阻塞主流程
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      warn('[TeacherSync] 教师后台返回非 2xx', {
        url,
        status: res.status,
        body: body.slice(0, 200),
        studentId: record.studentId,
        wenId: record.wenId,
      })
      return { ok: false, error: `HTTP ${res.status}` }
    }

    info('[TeacherSync] 答题记录同步成功', {
      studentId: record.studentId,
      wenId: record.wenId,
      questionCount: record.questions?.length,
      url,
    })
    return { ok: true }
  } catch (err) {
    // 网络错误 / 超时 / CORS —— 只 warn，不阻塞主流程
    warn('[TeacherSync] 同步教师后台失败', {
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      url,
      studentId: record.studentId,
      wenId: record.wenId,
    })
    return { ok: false, error: err.message }
  } finally {
    clearTimeout(timer)
  }
}

module.exports = {
  syncToTeacherBackend,
  // 导出供 answerService 内部检查是否启用同步
  isEnabled: () => !!getConfig().baseUrl,
}
