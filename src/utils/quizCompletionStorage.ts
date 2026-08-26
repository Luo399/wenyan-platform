/**
 * 完成记录持久化（P2 存储双轨合并）
 *
 * 背景：此前"完成记录"由 useQuizProgress 直写 sessionStorage（关闭标签页即丢、
 * 且 key 不含学生维度，同浏览器多人串号），与"答题明细"（localStorage）形成双轨。
 *
 * 本模块提供统一的完成记录读写：
 * - 统一走 localStorage（持久化，与答题明细同一机制，双轨合一）；
 * - key 含学生维度：`quiz_completion_{studentId}_{scope}`，未登录用 anon 兜底；
 * - 所有读写包裹异常，隐私模式/配额满时静默降级，不影响答题流程。
 */

const KEY_PREFIX = 'quiz_completion_'

/** 完成记录内容 */
export interface QuizCompletionRecord {
  /** 本次完成会话标识 */
  completionId: string
  /** 完成时间（ISO） */
  completedAt: string
  /** 题目总数 */
  totalQuestions: number
  /** 已答数量 */
  answeredCount: number
}

/** 组装完成记录 key（含学生维度） */
function buildKey(studentId: string, scope: string): string {
  const sid = studentId && studentId.trim() !== '' ? studentId.trim() : 'anon'
  return `${KEY_PREFIX}${sid}_${scope}`
}

/** 安全读取 localStorage */
function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 安全写入 localStorage */
function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 隐私模式/配额已满：静默降级，不影响答题主流程
  }
}

/** 安全删除 localStorage key */
function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // 同上
  }
}

/**
 * 读取某学生某课文的完成记录（未完成返回 null）
 */
export function getCompletionRecord(studentId: string, scope: string): QuizCompletionRecord | null {
  const raw = safeRead(buildKey(studentId, scope))
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as QuizCompletionRecord
    if (!parsed || typeof parsed.completedAt !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 写入完成记录
 */
export function setCompletionRecord(
  studentId: string,
  scope: string,
  record: QuizCompletionRecord,
): void {
  safeWrite(buildKey(studentId, scope), JSON.stringify(record))
}

/**
 * 清除完成记录
 */
export function clearCompletionRecord(studentId: string, scope: string): void {
  safeRemove(buildKey(studentId, scope))
}
