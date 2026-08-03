/**
 * 用户行为埋点工具
 *
 * 功能：
 * - session_id 管理（localStorage 持久化，跨标签页独立）
 * - 提供统一的 track() 函数发送埋点事件到后端
 * - 支持事件批量发送（自动合并 500ms 内的连续事件）
 *
 * 埋点事件类型：
 * - step_enter: 进入某步（properties: { from_back_button }）
 * - step_exit: 离开某步（properties: { duration, next_step_id }）
 * - interaction: 模块交互（properties: { module_type, action, cost_time }）
 * - search_word: 字词查询（properties: { word, is_audio }）
 * - quiz_submit: 闯关提交（properties: { score, wrong_answers }）
 *
 * 使用方式：
 * ```ts
 * import { track } from '@/utils/tracking'
 * track('step_enter', { step_id: 'stepone', from_back_button: false })
 * ```
 */

import { post } from '@/utils/api'
import { debugLog, debugWarn } from '@/utils/debug'
import { useAuthStore } from '@/stores/auth'

// ============================================================
// session_id 管理
// ============================================================

const STORAGE_KEY_SESSION_ID = 'tracking_session_id'

/**
 * 生成唯一 session_id（时间戳 + 随机数）
 */
function generateSessionId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 10)
  return `s_${ts}_${rand}`
}

/**
 * 获取当前 session_id（惰性生成，localStorage 持久化）
 */
export function getSessionId(): string {
  try {
    let sid = localStorage.getItem(STORAGE_KEY_SESSION_ID)
    if (!sid) {
      sid = generateSessionId()
      localStorage.setItem(STORAGE_KEY_SESSION_ID, sid)
    }
    return sid
  } catch {
    return generateSessionId()
  }
}

/**
 * 重置 session_id（用户主动退出登录时调用，切割会话）
 */
export function resetSessionId(): void {
  try {
    const newSid = generateSessionId()
    localStorage.setItem(STORAGE_KEY_SESSION_ID, newSid)
  } catch {
    // 静默失败
  }
}

// ============================================================
// 事件缓冲 & 批量发送
// ============================================================

interface TrackEvent {
  event_type: string
  user_id: string
  session_id: string
  step_id: string
  properties: Record<string, unknown>
  page_url: string
  timestamp: string
}

/** 事件缓冲队列 */
let eventBuffer: TrackEvent[] = []
/** 批量发送定时器 */
let flushTimer: ReturnType<typeof setTimeout> | null = null
/** 批量发送间隔（ms） */
const FLUSH_INTERVAL = 500

/**
 * 立即发送缓冲队列中的所有事件
 */
async function flushEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  const events = eventBuffer.splice(0, eventBuffer.length)
  if (events.length === 0) return

  try {
    await post('/api/track', { events })
    debugLog(`[tracking] 已发送 ${events.length} 个埋点事件`)
  } catch (err) {
    debugWarn('[tracking] 埋点发送失败（静默）:', err)
    // 静默失败，不阻塞用户操作
  }
}

/**
 * 将事件加入缓冲队列，延迟批量发送
 */
function enqueueEvent(event: TrackEvent): void {
  eventBuffer.push(event)

  if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL)
  }
}

// ============================================================
// 核心 track 函数
// ============================================================

/**
 * 发送埋点事件
 *
 * @param eventType - 事件类型
 * @param stepId - 当前步骤 ID（如 'stepone', 'steptwo', 'home' 等）
 * @param properties - 事件属性（不同事件类型携带不同字段）
 * @param immediate - 是否立即发送（默认 false，走批量缓冲）
 */
export function track(
  eventType: string,
  stepId: string,
  properties: Record<string, unknown> = {},
  immediate = false,
): void {
  try {
    let userId = ''
    try {
      const authStore = useAuthStore()
      if (authStore.isLoggedIn && authStore.user) {
        userId = authStore.user.studentId || authStore.user.id || ''
      }
    } catch {
      // Pinia 未就绪时使用空 user_id
    }

    const event: TrackEvent = {
      event_type: eventType,
      user_id: userId,
      session_id: getSessionId(),
      step_id: stepId,
      properties,
      page_url: window.location.pathname + window.location.search,
      timestamp: new Date().toISOString(),
    }

    if (immediate) {
      // 立即发送：先 flush 已有缓冲，再发当前事件
      flushEvents().then(() => {
        post('/api/track', { events: [event] }).catch(() => {
          // 静默失败
        })
      })
    } else {
      enqueueEvent(event)
    }
  } catch {
    // 全局静默，确保埋点异常不会影响业务
  }
}

/**
 * 页面卸载前强制发送剩余事件（通过 sendBeacon 保证送达率）
 */
export function flushOnUnload(): void {
  const events = eventBuffer.splice(0, eventBuffer.length)
  if (events.length === 0) return

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    navigator.sendBeacon(`${baseUrl}/api/track`, JSON.stringify({ events }))
  } catch {
    // 静默失败
  }
}

// ============================================================
// 后退按钮标记（跨页面通信）
// ============================================================

/** 模块级标记：下一次 step_enter 是否来自后退按钮 */
let _nextEnterFromBackButton = false

/**
 * 设置"下一页的进入来自后退按钮"标记
 * 在视图组件调用 goPrev() 前调用
 */
export function markNextEnterFromBackButton(): void {
  _nextEnterFromBackButton = true
}

/**
 * 检查并消费后退按钮标记
 * 由 useTracking 的 onMounted 调用，消费后重置
 */
export function consumeBackButtonFlag(): boolean {
  const val = _nextEnterFromBackButton
  _nextEnterFromBackButton = false
  return val
}

// 注册页面卸载时的发送
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushOnUnload)
  window.addEventListener('pagehide', flushOnUnload)
}
