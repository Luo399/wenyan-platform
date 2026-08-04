/**
 * useTracking composable 单元测试
 *
 * 覆盖范围：
 * 1. buildStepId 逻辑（poemId 拼接 / 无 poemId）
 * 2. isFirstEnter 去重逻辑
 * 3. resetFirstEnterSet 清除去重记录
 * 4. 主动埋点方法（trackInteraction / trackSearchWord / trackQuizSubmit）
 * 5. setFromBackButton / setNextStepId 状态设置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock 依赖
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

// mock Vue 生命周期钩子，让 composable 不依赖真实组件上下文
const mountedCallbacks: Array<() => void> = []
const unmountedCallbacks: Array<() => void> = []
const activatedCallbacks: Array<() => void> = []
const deactivatedCallbacks: Array<() => void> = []

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: (cb: () => void) => mountedCallbacks.push(cb),
    onUnmounted: (cb: () => void) => unmountedCallbacks.push(cb),
    onActivated: (cb: () => void) => activatedCallbacks.push(cb),
    onDeactivated: (cb: () => void) => deactivatedCallbacks.push(cb),
  }
})

import { useTracking, resetFirstEnterSet } from '@/composables/useTracking'
import { post } from '@/utils/api'

const mockPost = vi.mocked(post)

describe('useTracking', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.useFakeTimers()
    mockPost.mockReset()
    mockPost.mockResolvedValue(undefined)
    mountedCallbacks.length = 0
    unmountedCallbacks.length = 0
    activatedCallbacks.length = 0
    deactivatedCallbacks.length = 0
    resetFirstEnterSet()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ============================================================
  // stepId 构建
  // ============================================================
  describe('stepId 构建', () => {
    it('有 poemId 时拼接为 routeName_poemId', () => {
      const { stepId } = useTracking('stepone', '3')
      // stepId 是 ref<string>
      expect(stepId.value ? stepId.value : stepId).toBe('stepone_3')
    })

    it('无 poemId 时仅为 routeName', () => {
      const { stepId } = useTracking('home', '')
      expect(stepId.value ? stepId.value : stepId).toBe('home')
    })
  })

  // ============================================================
  // 主动埋点方法
  // ============================================================
  describe('trackInteraction', () => {
    it('发送 interaction 事件，包含 module_type / action / cost_time', () => {
      const { trackInteraction } = useTracking('stepone', '1')

      trackInteraction('朗读', '播放', 5000)

      vi.advanceTimersByTime(500)

      expect(mockPost).toHaveBeenCalledTimes(1)
      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      const event = body.events[0]
      expect(event.event_type).toBe('interaction')
      expect(event.step_id).toBe('stepone_1')
      expect(event.properties).toEqual({
        module_type: '朗读',
        action: '播放',
        cost_time: 5000,
      })
    })

    it('cost_time 缺省时默认为 0', () => {
      const { trackInteraction } = useTracking('stepone', '1')

      trackInteraction('AI', '提交')

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      expect(body.events[0].properties.cost_time).toBe(0)
    })
  })

  describe('trackSearchWord', () => {
    it('发送 search_word 事件，包含 word / is_audio', () => {
      const { trackSearchWord } = useTracking('stepone', '1')

      trackSearchWord('之', true)

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      const event = body.events[0]
      expect(event.event_type).toBe('search_word')
      expect(event.properties).toEqual({ word: '之', is_audio: true })
    })

    it('is_audio 缺省时默认为 false', () => {
      const { trackSearchWord } = useTracking('stepone', '1')

      trackSearchWord('乎')

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      expect(body.events[0].properties.is_audio).toBe(false)
    })
  })

  describe('trackQuizSubmit', () => {
    it('发送 quiz_submit 事件，包含 score / wrong_answers', () => {
      const { trackQuizSubmit } = useTracking('stepthree', '2')

      trackQuizSubmit(85, ['q2', 'q5'])

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      const event = body.events[0]
      expect(event.event_type).toBe('quiz_submit')
      expect(event.step_id).toBe('stepthree_2')
      expect(event.properties).toEqual({ score: 85, wrong_answers: ['q2', 'q5'] })
    })

    it('wrong_answers 缺省时默认为空数组', () => {
      const { trackQuizSubmit } = useTracking('stepthree', '1')

      trackQuizSubmit(100)

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      expect(body.events[0].properties.wrong_answers).toEqual([])
    })
  })

  // ============================================================
  // 状态设置
  // ============================================================
  describe('setFromBackButton / setNextStepId', () => {
    it('setFromBackButton 设置后退标记', () => {
      const { setFromBackButton } = useTracking('stepone', '1')
      // 仅验证函数不抛错
      expect(() => setFromBackButton(true)).not.toThrow()
    })

    it('setNextStepId 设置下一步 step_id', () => {
      const { setNextStepId } = useTracking('stepone', '1')
      expect(() => setNextStepId('steptwo_1')).not.toThrow()
    })
  })

  // ============================================================
  // 生命周期钩子注册
  // ============================================================
  describe('生命周期钩子', () => {
    it('useTracking 注册了 onMounted 和 onUnmounted 回调', () => {
      useTracking('stepone', '1')
      expect(mountedCallbacks.length).toBeGreaterThan(0)
      expect(unmountedCallbacks.length).toBeGreaterThan(0)
    })

    it('onMounted 触发 step_enter 事件', () => {
      useTracking('stepone', '1')

      // 手动触发 onMounted 回调
      mountedCallbacks.forEach((cb) => cb())

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      expect(body.events[0].event_type).toBe('step_enter')
    })

    it('onUnmounted 触发 step_exit 事件', () => {
      useTracking('stepone', '1')

      mountedCallbacks.forEach((cb) => cb())
      unmountedCallbacks.forEach((cb) => cb())

      vi.advanceTimersByTime(500)

      // step_enter 和 step_exit 可能合并在一次批量发送中
      const hasExitEvent = mockPost.mock.calls.some((call) => {
        const body = call[1] as { events: Array<Record<string, unknown>> }
        return body?.events?.some((e) => e.event_type === 'step_exit')
      })
      expect(hasExitEvent).toBe(true)
    })
  })

  // ============================================================
  // isFirstEnter 去重
  // ============================================================
  describe('isFirstEnter 去重', () => {
    it('同一 stepId 首次 onMounted 时 is_first_enter=true', () => {
      useTracking('stepone', '1')
      mountedCallbacks.forEach((cb) => cb())

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      expect(body.events[0].properties.is_first_enter).toBe(true)
    })

    it('resetFirstEnterSet 后重新标记为首次进入', () => {
      useTracking('home', '')
      mountedCallbacks.forEach((cb) => cb())

      vi.advanceTimersByTime(500)

      resetFirstEnterSet()

      // 重新创建 useTracking 实例
      mockPost.mockReset()
      mountedCallbacks.length = 0
      useTracking('home', '')
      mountedCallbacks.forEach((cb) => cb())

      vi.advanceTimersByTime(500)

      const body = mockPost.mock.calls[0][1] as { events: Array<Record<string, unknown>> }
      expect(body.events[0].properties.is_first_enter).toBe(true)
    })
  })
})
