/**
 * tracking.ts 单元测试
 *
 * 覆盖范围：
 * 1. session_id 管理（getSessionId / resetSessionId）
 * 2. 退出类型检测（setPendingExitType / consumeExitType）
 * 3. 后退按钮标记（markNextEnterFromBackButton / consumeBackButtonFlag）
 * 4. track() 核心函数（缓冲/立即模式）
 * 5. flushOnUnload（Blob + application/json、buffer 清空）
 * 6. trackSessionStart 事件结构
 * 7. 页面可见性初始状态
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// mock 依赖，避免模块加载时的副作用和 pinia 依赖
vi.mock('@/utils/api', () => ({
  post: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isLoggedIn: false,
    user: null,
  }),
}))

// 必须在 mock 之后 import
import {
  track,
  flushOnUnload,
  getSessionId,
  resetSessionId,
  setPendingExitType,
  consumeExitType,
  markNextEnterFromBackButton,
  consumeBackButtonFlag,
  isPageVisible,
  trackSessionStart,
} from '@/utils/tracking'
import { post } from '@/utils/api'

const mockPost = vi.mocked(post)

// ============================================================
// session_id 管理
// ============================================================
describe('tracking - session_id 管理', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('getSessionId 返回以 s_ 开头的字符串', () => {
    const sid = getSessionId()
    expect(sid).toMatch(/^s_/)
  })

  it('连续调用 getSessionId 返回相同值（持久化）', () => {
    const sid1 = getSessionId()
    const sid2 = getSessionId()
    expect(sid1).toBe(sid2)
  })

  it('resetSessionId 后生成新的 session_id', () => {
    const sid1 = getSessionId()
    resetSessionId()
    const sid2 = getSessionId()
    expect(sid1).not.toBe(sid2)
  })

  it('新 session_id 仍以 s_ 开头', () => {
    resetSessionId()
    const sid = getSessionId()
    expect(sid).toMatch(/^s_/)
  })

  it('session_id 包含时间戳和随机数部分', () => {
    const sid = getSessionId()
    // 格式：s_{timestamp_base36}_{random_base36}
    const parts = sid.split('_')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('s')
    expect(parts[1].length).toBeGreaterThan(0)
    expect(parts[2].length).toBeGreaterThan(0)
  })
})

// ============================================================
// 退出类型检测
// ============================================================
describe('tracking - 退出类型检测', () => {
  it('初始退出类型为 unknown', () => {
    expect(consumeExitType()).toBe('unknown')
  })

  it('setPendingExitType 设置后 consumeExitType 能消费', () => {
    setPendingExitType('forward')
    expect(consumeExitType()).toBe('forward')
  })

  it('consumeExitType 消费后重置为 unknown', () => {
    setPendingExitType('backward')
    consumeExitType()
    expect(consumeExitType()).toBe('unknown')
  })

  it('支持所有退出类型', () => {
    const types = ['forward', 'backward', 'close', 'refresh', 'unknown'] as const
    for (const t of types) {
      setPendingExitType(t)
      expect(consumeExitType()).toBe(t)
    }
  })
})

// ============================================================
// 后退按钮标记
// ============================================================
describe('tracking - 后退按钮标记', () => {
  it('初始状态为 false', () => {
    expect(consumeBackButtonFlag()).toBe(false)
  })

  it('markNextEnterFromBackButton 设置后能消费', () => {
    markNextEnterFromBackButton()
    expect(consumeBackButtonFlag()).toBe(true)
  })

  it('消费后重置为 false', () => {
    markNextEnterFromBackButton()
    consumeBackButtonFlag()
    expect(consumeBackButtonFlag()).toBe(false)
  })

  it('markNextEnterFromBackButton 同时设置退出类型为 backward', () => {
    markNextEnterFromBackButton()
    expect(consumeExitType()).toBe('backward')
  })
})

// ============================================================
// track() 核心函数
// ============================================================
describe('tracking - track 函数', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPost.mockReset()
    mockPost.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('非立即模式加入缓冲，500ms 后批量发送', async () => {
    track('step_enter', 'test_step', { from_back_button: false })

    // 还没到 500ms，不会发送
    expect(mockPost).not.toHaveBeenCalled()

    // 快进 500ms
    vi.advanceTimersByTime(500)

    // 现在应该发送了
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/track', expect.objectContaining({
      events: expect.arrayContaining([
        expect.objectContaining({ event_type: 'step_enter', step_id: 'test_step' }),
      ]),
    }))
  })

  it('立即模式先 flush 已有缓冲，再发当前事件', async () => {
    track('step_enter', 'step1') // 缓冲一个事件

    // 立即模式
    track('step_exit', 'step2', { duration: 1000 }, true)

    // 等待异步完成
    await vi.runAllTimersAsync()

    // 应至少调用 2 次 post：flush 缓冲 + 发送当前事件
    expect(mockPost.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('track 事件包含正确字段', async () => {
    track('interaction', 'step1', { module_type: '朗读', action: '播放' })

    vi.advanceTimersByTime(500)

    const callArgs = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
    const event = callArgs.events[0]
    expect(event.event_type).toBe('interaction')
    expect(event.step_id).toBe('step1')
    expect(event.properties).toEqual({ module_type: '朗读', action: '播放' })
    expect(event.session_id).toMatch(/^s_/)
    expect(event.timestamp).toBeDefined()
    expect(event.page_url).toBeDefined()
  })

  it('未登录时 user_id 为空字符串', async () => {
    track('step_enter', 'step1')
    vi.advanceTimersByTime(500)

    const callArgs = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
    expect(callArgs.events[0].user_id).toBe('')
  })

  it('连续多次 track 在 500ms 内合并为一次批量发送', async () => {
    track('step_enter', 'step1')
    track('interaction', 'step1', { module_type: '朗读' })
    track('step_exit', 'step1', { duration: 5000 })

    vi.advanceTimersByTime(500)

    expect(mockPost).toHaveBeenCalledTimes(1)
    const callArgs = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
    expect(callArgs.events).toHaveLength(3)
  })
})

// ============================================================
// trackSessionStart
// ============================================================
describe('tracking - trackSessionStart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPost.mockReset()
    mockPost.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('发送 session_start 事件', async () => {
    trackSessionStart()

    // session_start 是立即模式
    await vi.runAllTimersAsync()

    const immediateCall = mockPost.mock.calls.find((call) => {
      const body = call[1] as { events: Array<Record<string, unknown>> }
      return body?.events?.[0]?.event_type === 'session_start'
    })
    expect(immediateCall).toBeDefined()
  })

  it('session_start 事件包含 user_agent 和 language', async () => {
    trackSessionStart()
    await vi.runAllTimersAsync()

    const immediateCall = mockPost.mock.calls.find((call) => {
      const body = call[1] as { events: Array<Record<string, unknown>> }
      return body?.events?.[0]?.event_type === 'session_start'
    })
    const event = (immediateCall![1] as { events: Array<Record<string, unknown>> }).events[0]
    expect(event.properties).toHaveProperty('user_agent')
    expect(event.properties).toHaveProperty('language')
  })
})

// ============================================================
// flushOnUnload
// ============================================================
describe('tracking - flushOnUnload', () => {
  let sendBeaconSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    sendBeaconSpy = vi.fn()
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconSpy,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('必须用 Blob (application/json) 发送，确保后端 express.json() 能解析', () => {
    track('step_enter', 'test_step', { foo: 'bar' })
    flushOnUnload()

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    const [, payload] = sendBeaconSpy.mock.calls[0]
    expect(payload).toBeInstanceOf(Blob)
    expect((payload as Blob).type).toBe('application/json')
  })

  it('发送后应清空 buffer（不重复发送）', () => {
    track('step_enter', 'test_step')
    flushOnUnload()
    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)

    flushOnUnload()
    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
  })

  it('buffer 为空时不发送', () => {
    flushOnUnload()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
  })

  it('多个缓冲事件应一次性发送', () => {
    track('step_enter', 'step1')
    track('interaction', 'step1', { module_type: '朗读' })
    track('step_exit', 'step1', { duration: 1000 })

    flushOnUnload()

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    const [, payload] = sendBeaconSpy.mock.calls[0]
    const blob = payload as Blob
    return blob.text().then((text) => {
      const parsed = JSON.parse(text)
      expect(parsed.events).toHaveLength(3)
      expect(parsed.events[0].event_type).toBe('step_enter')
      expect(parsed.events[1].event_type).toBe('interaction')
      expect(parsed.events[2].event_type).toBe('step_exit')
    })
  })
})

// ============================================================
// 页面可见性
// ============================================================
describe('tracking - 页面可见性初始状态', () => {
  it('isPageVisible 初始值为 true', () => {
    // 仅检查初始值，不触发 visibilitychange
    expect(isPageVisible).toBe(true)
  })
})
