// ============================================================
// localStorage 类型安全封装：答题记录 + 学号 + 登录态
// ============================================================
//
// 功能说明：
// - 统一管理各类 localStorage 读写，避免组件/store 直接调用 localStorage
// - 泛型支持不同记录结构（AdaptQuiz 单题记录、Level1Quiz 整份报告等）
// - JSON.parse 失败时容错返回空对象/空数组，避免污染数据导致组件崩溃
// - 不同 studentId 使用独立 key 命名空间，互不污染
//
// R34: 新增 auth/student 封装入口：
//   - getAuthData()/setAuthData()/clearAuthData()
//   - getStudentId()/setStudentId()/clearStudentId()
// ============================================================

import { debugLog } from './debug'
import type { User } from '@/stores/auth'

/** localStorage key 前缀：答题记录 */
const STORAGE_KEY_PREFIX_QUIZ = 'quiz_records_'
/** localStorage key：学号 */
const STORAGE_KEY_STUDENT_ID = 'studentId'
/** localStorage key：登录 token */
const STORAGE_KEY_AUTH_TOKEN = 'auth_token'
/** localStorage key：登录用户信息 */
const STORAGE_KEY_AUTH_USER = 'auth_user'

/**
 * 构造答题记录的 localStorage key
 * @param studentId 学生学号
 * @returns 形如 `quiz_records_2024001` 的 key
 */
function buildQuizStorageKey(studentId: string): string {
  return `${STORAGE_KEY_PREFIX_QUIZ}${studentId}`
}

/**
 * 安全读取并 JSON.parse 一个 localStorage key
 * @param key localStorage key
 * @param fallback 解析失败时的返回值
 */
function safeReadJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch (err) {
    debugLog('[localStorage] JSON 解析失败，已降级为默认值:', key, err)
    return fallback
  }
}

/**
 * 安全写入 JSON 字符串到 localStorage（忽略 quota 异常）
 */
function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    debugLog('[localStorage] 写入失败:', key, err)
  }
}

// ============================================================
// 答题记录
// ============================================================

/**
 * 读取指定学生的答题记录
 */
export function getQuizRecords<T>(studentId: string): T[] {
  if (!studentId) return []
  return safeReadJson<T[]>(buildQuizStorageKey(studentId), [])
}

/**
 * 写入指定学生的完整答题记录数组（覆盖式）
 */
export function setQuizRecords<T>(studentId: string, records: T[]): void {
  if (!studentId) return
  safeWriteJson(buildQuizStorageKey(studentId), records ?? [])
}

/**
 * 追加单条答题记录到已有列表末尾
 * @returns 追加后的完整答题记录数组
 */
export function appendQuizRecord<T>(studentId: string, record: T): T[] {
  const records = getQuizRecords<T>(studentId)
  records.push(record)
  setQuizRecords(studentId, records)
  return records
}

/**
 * 清空指定学生的答题记录
 */
export function clearQuizRecords(studentId: string): void {
  if (!studentId) return
  localStorage.removeItem(buildQuizStorageKey(studentId))
}

// ============================================================
// 学号（useStudentStore 用）
// ============================================================

/**
 * 读取持久化学号
 * - 只返回格式合法的学号（≥1 位数字），保证恢复登录态时不脏读
 */
export function getStudentId(): string {
  const saved = localStorage.getItem(STORAGE_KEY_STUDENT_ID)
  if (saved && /^\d+$/.test(saved)) return saved
  return ''
}

/**
 * 写入持久化学号
 */
export function setStudentId(id: string): void {
  localStorage.setItem(STORAGE_KEY_STUDENT_ID, id)
}

/**
 * 清除持久化学号
 */
export function clearStudentId(): void {
  localStorage.removeItem(STORAGE_KEY_STUDENT_ID)
}

// ============================================================
// 登录态（useAuthStore 用）
// ============================================================

export interface AuthStorageData {
  token: string | null
  user: User | null
}

/**
 * 读取登录态（token + user）
 * - token 不存在：认为未登录，返回全 null（不单独读 user）
 */
export function getAuthData(): AuthStorageData {
  const token = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN)
  if (!token) return { token: null, user: null }

  const user = safeReadJson<User | null>(STORAGE_KEY_AUTH_USER, null)
  return { token, user }
}

/**
 * 写入登录态
 * - 任意一个为 null → 全部清空（保证 token/user 成对存在）
 */
export function setAuthData(token: string | null, user: User | null): void {
  if (!token || !user) {
    clearAuthData()
    return
  }
  localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token)
  safeWriteJson(STORAGE_KEY_AUTH_USER, user)
}

/**
 * 清除登录态
 */
export function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN)
  localStorage.removeItem(STORAGE_KEY_AUTH_USER)
}
