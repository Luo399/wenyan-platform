// ============================================================
// localStorage 类型安全封装：答题记录本地持久化
// ============================================================
//
// 功能说明：
// - 统一管理答题记录的 localStorage 读写，避免组件直接调用 localStorage
// - 泛型支持不同记录结构（AdaptQuiz 单题记录、Level1Quiz 整份报告等）
// - JSON.parse 失败时容错返回空数组，避免污染数据导致组件崩溃
// - 不同 studentId 使用独立 key 命名空间，互不污染
//
// 使用示例：
// import { appendQuizRecord, getQuizRecords } from '@/utils/localStorage'
//
// appendQuizRecord(studentId, record)
// const records = getQuizRecords<ReportRecord>(studentId)

import { debugLog } from './debug'

/** localStorage key 前缀，统一格式：quiz_records_<studentId> */
const STORAGE_KEY_PREFIX = 'quiz_records_'

/**
 * 构造答题记录的 localStorage key
 * @param studentId 学生学号
 * @returns 形如 `quiz_records_2024001` 的 key
 */
function buildStorageKey(studentId: string): string {
  return `${STORAGE_KEY_PREFIX}${studentId}`
}

/**
 * 读取指定学生的答题记录
 *
 * 容错策略：
 * - key 不存在 → 返回 []
 * - JSON 解析失败 → 返回 []（避免脏数据导致组件崩溃）
 * - 解析结果非数组 → 返回 []（数据结构异常时降级）
 *
 * @typeParam T 记录类型，由调用方推断（如单题 record 或整份 report）
 * @param studentId 学生学号
 * @returns 答题记录数组（空数组表示无记录或读取失败）
 */
export function getQuizRecords<T>(studentId: string): T[] {
  if (!studentId) return []

  const key = buildStorageKey(studentId)
  const raw = localStorage.getItem(key)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    debugLog('[localStorage] 答题记录 JSON 解析失败，已重置为空数组:', err)
    return []
  }
}

/**
 * 写入指定学生的完整答题记录数组（覆盖式）
 * @typeParam T 记录类型
 * @param studentId 学生学号
 * @param records 答题记录数组
 */
export function setQuizRecords<T>(studentId: string, records: T[]): void {
  if (!studentId) return

  const key = buildStorageKey(studentId)
  try {
    localStorage.setItem(key, JSON.stringify(records ?? []))
  } catch (err) {
    debugLog('[localStorage] 答题记录写入失败:', err)
  }
}

/**
 * 追加单条答题记录到已有列表末尾
 *
 * 等价于：getQuizRecords → push → setQuizRecords 的原子封装，
 * 保证读-改-写流程的统一性，避免组件层重复样板代码。
 *
 * @typeParam T 记录类型
 * @param studentId 学生学号
 * @param record 单条答题记录
 * @returns 追加后的完整答题记录数组（便于上层日志或后续操作）
 */
export function appendQuizRecord<T>(studentId: string, record: T): T[] {
  const records = getQuizRecords<T>(studentId)
  records.push(record)
  setQuizRecords(studentId, records)
  return records
}

/**
 * 清空指定学生的答题记录
 * @param studentId 学生学号
 */
export function clearQuizRecords(studentId: string): void {
  if (!studentId) return

  const key = buildStorageKey(studentId)
  localStorage.removeItem(key)
}
