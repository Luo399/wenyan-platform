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
import type { User } from '@/types/auth'

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
 * R99: 包裹 getItem 异常（隐私模式/配额满/SecurityError）
 * @param key localStorage key
 * @param fallback 解析失败时的返回值
 */
function safeReadJson<T>(key: string, fallback: T): T {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch (err) {
    debugLog('[localStorage] getItem 异常:', key, err)
    return fallback
  }
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

/**
 * 登录态可以落在两个 storage 里：
 * - local：勾选「记住我」，关标签页/重启浏览器后仍然有效
 * - session：未勾选，刷新页面仍在，关闭标签页即失效
 */
export type AuthPersistTarget = 'local' | 'session'

/** 安全获取 Storage（Safari 私密模式 / 沙箱 iframe 里访问会抛 SecurityError） */
function getAuthStorage(target: AuthPersistTarget): Storage | null {
  try {
    return target === 'local' ? localStorage : sessionStorage
  } catch (err) {
    debugLog('[localStorage] 访问 Storage 异常:', target, err)
    return null
  }
}

// ============================================================
// 答题记录
// ============================================================

/**
 * 读取指定学生的答题记录
 * - 解析结果不是数组（历史脏数据 / 被别处写坏）时按空数组容错，
 *   否则调用方拿到的类型是 T[]、运行时却可能是对象，forEach/push 直接崩
 */
export function getQuizRecords<T>(studentId: string): T[] {
  if (!studentId) return []
  const parsed = safeReadJson<unknown>(buildQuizStorageKey(studentId), [])
  return Array.isArray(parsed) ? (parsed as T[]) : []
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
 *
 * 等价于：getQuizRecords → push → setQuizRecords 的原子封装，
 * 保证读-改-写流程的统一性，避免组件层重复样板代码。
 *
 * R98: 修复 JSON 损坏时数据丢失——原实现 getQuizRecords 在解析失败时返回 []，
 * 随后 setQuizRecords 会用 [record] 覆盖损坏数据，导致历史记录永久丢失。
 * 现改为：检测到 JSON 损坏时跳过追加并返回空数组，保留原始数据等待人工处理。
 *
 * @typeParam T 记录类型
 * @param studentId 学生学号
 * @param record 单条答题记录
 * @returns 追加后的完整答题记录数组（便于上层日志或后续操作）；损坏时返回空数组
 */
export function appendQuizRecord<T>(studentId: string, record: T): T[] {
  if (!studentId) return []

  const key = buildQuizStorageKey(studentId)
  // R140: getItem 本身也可能抛（Safari 私密模式、被禁用的存储、沙箱 iframe 里
  // 访问 localStorage 会直接 SecurityError）。同文件的 safeReadJson 已经把
  // getItem 包起来了，只有这里还是裸调用 —— 一旦抛错，答题提交链路会被打断，
  // 用户表现为「提交后没反应」。存储不可用时按「无法追加」处理，不影响主流程。
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch (err) {
    debugLog('[localStorage] getItem 异常，跳过答题记录追加:', key, err)
    return []
  }

  let records: T[]
  if (!raw) {
    // 无历史数据，正常初始化
    records = []
  } else {
    // 有历史数据，需校验完整性
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        // R98: 数据结构异常（非数组），跳过追加避免覆盖
        debugLog('[localStorage] 原数据非数组，跳过追加以避免覆盖:', key)
        return []
      }
      records = parsed
    } catch (err) {
      // R98: JSON 损坏，跳过追加避免历史记录永久丢失
      debugLog('[localStorage] 原数据 JSON 损坏，跳过追加以避免覆盖:', key, err)
      return []
    }
  }

  records.push(record)
  setQuizRecords(studentId, records)
  return records
}

/**
 * 清空指定学生的答题记录
 */
export function clearQuizRecords(studentId: string): void {
  if (!studentId) return
  // R99: 包裹 removeItem 异常
  try {
    localStorage.removeItem(buildQuizStorageKey(studentId))
  } catch (err) {
    debugLog('[localStorage] removeItem 异常:', err)
  }
}

// ============================================================
// 学号（useStudentStore 用）
// ============================================================

/**
 * 读取持久化学号
 * - 只返回格式合法的学号（≥1 位数字），保证恢复登录态时不脏读
 */
export function getStudentId(): string {
  // R99: 包裹 getItem 异常
  let saved: string | null
  try {
    saved = localStorage.getItem(STORAGE_KEY_STUDENT_ID)
  } catch (err) {
    debugLog('[localStorage] getItem 异常:', err)
    return ''
  }
  if (saved && /^\d+$/.test(saved)) return saved
  return ''
}

/**
 * 写入持久化学号
 */
export function setStudentId(id: string): void {
  // R99: 包裹 setItem 异常
  try {
    localStorage.setItem(STORAGE_KEY_STUDENT_ID, id)
  } catch (err) {
    debugLog('[localStorage] setItem 异常:', err)
  }
}

/**
 * 清除持久化学号
 */
export function clearStudentId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_STUDENT_ID)
  } catch (err) {
    debugLog('[localStorage] removeItem 异常:', err)
  }
}

// ============================================================
// 登录态（useAuthStore 用）
// ============================================================

export interface AuthStorageData {
  token: string | null
  user: User | null
  /** 登录态实际所在的 storage；未登录为 null */
  persist: AuthPersistTarget | null
}

/**
 * 从指定 storage 读取 token + user
 * - token 不存在：认为未登录，返回全 null（不单独读 user）
 */
function readAuthFrom(
  storage: Storage | null,
): { token: string | null; user: User | null } {
  if (!storage) return { token: null, user: null }

  let token: string | null
  try {
    token = storage.getItem(STORAGE_KEY_AUTH_TOKEN)
  } catch (err) {
    debugLog('[localStorage] getItem 异常:', err)
    return { token: null, user: null }
  }
  if (!token) return { token: null, user: null }

  let user: User | null = null
  try {
    const raw = storage.getItem(STORAGE_KEY_AUTH_USER)
    user = raw ? (JSON.parse(raw) as User) : null
  } catch (err) {
    debugLog('[localStorage] 登录用户解析失败，已降级为 null:', err)
    user = null
  }
  return { token, user }
}

/**
 * 写入登录态（token + user）
 * - 任意一个为 null → 全部清空（保证 token/user 成对存在）
 * - remember=false 时写 sessionStorage，实现「刷新仍在、关标签页失效」
 */
export function setAuthData(token: string | null, user: User | null, remember = true): void {
  // 先清空两侧，避免旧 storage 里的登录态和本次登录来源不一致
  clearAuthData()
  if (!token || !user) return

  const target: AuthPersistTarget = remember ? 'local' : 'session'
  const storage = getAuthStorage(target)
  if (!storage) return

  try {
    storage.setItem(STORAGE_KEY_AUTH_TOKEN, token)
  } catch (err) {
    debugLog('[localStorage] setItem 异常:', err)
  }
  try {
    storage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user))
  } catch (err) {
    debugLog('[localStorage] 写入失败:', STORAGE_KEY_AUTH_USER, err)
  }
}

/**
 * 读取登录态（token + user）
 * - 两个 storage 都读，localStorage 优先（勾选「记住我」的那份）
 * - 只有一侧字段完整才算有效登录态；残缺数据原样返回，由 auth store 判断后清理
 */
export function getAuthData(): AuthStorageData {
  const fromLocal = readAuthFrom(getAuthStorage('local'))
  if (fromLocal.token && fromLocal.user) {
    return { ...fromLocal, persist: 'local' }
  }

  const fromSession = readAuthFrom(getAuthStorage('session'))
  if (fromSession.token && fromSession.user) {
    return { ...fromSession, persist: 'session' }
  }

  const partial = fromLocal.token || fromLocal.user ? fromLocal : fromSession
  return { token: partial.token, user: partial.user, persist: null }
}

/**
 * 清除登录态（localStorage 与 sessionStorage 同时清理）
 */
export function clearAuthData(): void {
  for (const target of ['local', 'session'] as const) {
    const storage = getAuthStorage(target)
    if (!storage) continue
    try {
      storage.removeItem(STORAGE_KEY_AUTH_TOKEN)
      storage.removeItem(STORAGE_KEY_AUTH_USER)
    } catch (err) {
      debugLog('[localStorage] removeItem 异常:', err)
    }
  }
}
