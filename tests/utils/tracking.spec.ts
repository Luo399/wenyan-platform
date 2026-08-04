/**
 * tracking.ts 单元测试
 *
 * 回归测试范围：
 * 1. flushOnUnload 必须用 Blob + application/json 发送（而非字符串）
 *    —— 修复前用字符串发送，Content-Type 为 text/plain，后端 express.json() 不解析
 * 2. flushOnUnload 发送后清空 buffer
 * 3. track() 非立即模式会加入 buffer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock 依赖，避免模块加载时的副作用和 pinia 依赖
vi.mock('@/utils/api', () => ({
  post: vi.fn(),
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
import { track, flushOnUnload } from '@/utils/tracking'

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
    // 修复前：sendBeacon(url, JSON.stringify(...)) 发送字符串，
    // Content-Type 默认为 text/plain，后端 req.body 为 undefined
    track('step_enter', 'test_step', { foo: 'bar' })
    flushOnUnload()

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    const [, payload] = sendBeaconSpy.mock.calls[0]
    // 必须是 Blob 类型，且 type 为 application/json
    expect(payload).toBeInstanceOf(Blob)
    expect((payload as Blob).type).toBe('application/json')
  })

  it('发送后应清空 buffer（不重复发送）', () => {
    track('step_enter', 'test_step')
    flushOnUnload()
    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)

    // 再次调用 flushOnUnload，buffer 已空，不应再发送
    flushOnUnload()
    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
  })

  it('buffer 为空时不发送', () => {
    flushOnUnload()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
  })

  it('多个缓冲事件应一次性发送', async () => {
    track('step_enter', 'step1')
    track('interaction', 'step1', { module_type: '朗读' })
    track('step_exit', 'step1', { duration: 1000 })

    flushOnUnload()

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    const [, payload] = sendBeaconSpy.mock.calls[0]
    const blob = payload as Blob
    // 验证 Blob 内容包含 3 个事件
    return blob.text().then((text) => {
      const parsed = JSON.parse(text)
      expect(parsed.events).toHaveLength(3)
      expect(parsed.events[0].event_type).toBe('step_enter')
      expect(parsed.events[1].event_type).toBe('interaction')
      expect(parsed.events[2].event_type).toBe('step_exit')
    })
  })
})
