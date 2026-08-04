import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

// mock tracking 模块，避免模块加载时的副作用（visibilitychange/beforeunload 监听）
// 并允许 spy resetSessionId / resetFirstEnterSet 的调用
vi.mock('@/utils/tracking', () => ({
  resetSessionId: vi.fn(),
  resetFirstEnterSet: vi.fn(),
  getSessionId: vi.fn(() => 'test-session-id'),
  track: vi.fn(),
  trackSessionStart: vi.fn(),
  setPendingExitType: vi.fn(),
  consumeExitType: vi.fn(() => 'unknown'),
  isPageVisible: true,
  initVisibilityTracking: vi.fn(),
  flushOnUnload: vi.fn(),
  markNextEnterFromBackButton: vi.fn(),
  consumeBackButtonFlag: vi.fn(() => false),
}))

// 引入 mock 函数用于断言
import { resetSessionId, resetFirstEnterSet } from '@/utils/tracking'

describe('useAuthStore', () => {
  const localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)

    vi.spyOn(localStorage, 'getItem').mockImplementation(
      (key: string) => localStorageMock[key] || null,
    )
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value
    })
    vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
      delete localStorageMock[key]
    })

    Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key])

    global.fetch = vi.fn()

    // 清理 tracking mock 调用记录
    vi.mocked(resetSessionId).mockClear()
    vi.mocked(resetFirstEnterSet).mockClear()
  })

  describe('初始化测试', () => {
    it('应该正确初始化 store', () => {
      const authStore = useAuthStore()

      expect(authStore.user).toBe(null)
      expect(authStore.token).toBe(null)
      expect(authStore.isLoggedIn).toBe(false)
      expect(authStore.isLoading).toBe(false)
      expect(authStore.error).toBe(null)
    })

    it('应该从 localStorage 恢复状态', () => {
      const mockUser = JSON.stringify({
        id: '2024001',
        username: '张三',
        studentId: '2024001',
        role: 'student',
      })
      localStorage.setItem('auth_token', 'mock-token')
      localStorage.setItem('auth_user', mockUser)

      const authStore = useAuthStore()
      authStore.initialize()

      expect(authStore.token).toBe('mock-token')
      expect(authStore.user).toEqual({
        id: '2024001',
        username: '张三',
        studentId: '2024001',
        role: 'student',
      })
      expect(authStore.isLoggedIn).toBe(true)
    })
  })

  describe('登录测试', () => {
    it('登录成功应该设置用户和token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: 'jwt-token',
            user: { id: '2024001', username: '张三', studentId: '2024001', role: 'student' },
          },
        }),
      })

      const authStore = useAuthStore()
      await authStore.login('2024001')

      expect(authStore.token).toBe('jwt-token')
      expect(authStore.user).toEqual({
        id: '2024001',
        username: '张三',
        studentId: '2024001',
        role: 'student',
      })
      expect(authStore.isLoggedIn).toBe(true)
    })

    it('登录成功应同步重置 session_id 和首次进入记录（切割旧会话）', async () => {
      // 回归测试：新用户登录时必须清空旧会话的 firstEnterSet，
      // 否则上一个用户的 step_enter 会被误标记为非首次进入
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: 'jwt-token',
            user: { id: '2024002', username: '李四', studentId: '2024002', role: 'student' },
          },
        }),
      })

      const authStore = useAuthStore()
      await authStore.login('2024002')

      expect(resetSessionId).toHaveBeenCalledTimes(1)
      expect(resetFirstEnterSet).toHaveBeenCalledTimes(1)
    })

    it('登录失败应该设置错误信息', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, message: '学号不存在' }),
      })

      const authStore = useAuthStore()
      await expect(authStore.login('9999999')).rejects.toThrow()

      expect(authStore.error).toBe('学号不存在')
      expect(authStore.isLoggedIn).toBe(false)
    })

    it('网络错误应该设置错误信息', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('网络错误'))

      const authStore = useAuthStore()
      await expect(authStore.login('2024001')).rejects.toThrow()

      expect(authStore.error).toBe('网络错误')
    })
  })

  describe('登出测试', () => {
    it('登出应该清除用户和token', () => {
      const authStore = useAuthStore()
      authStore.token = 'jwt-token'
      authStore.user = { id: '2024001', username: '张三', studentId: '2024001', role: 'student' }

      authStore.logout()

      expect(authStore.token).toBe(null)
      expect(authStore.user).toBe(null)
      expect(authStore.isLoggedIn).toBe(false)
    })

    it('登出应同步重置 session_id 和首次进入记录（会话切割）', () => {
      // 回归测试：resetFirstEnterSet 之前未被调用，导致跨用户会话的 is_first_enter 标记错误
      const authStore = useAuthStore()
      authStore.token = 'jwt-token'
      authStore.user = { id: '2024001', username: '张三', studentId: '2024001', role: 'student' }

      authStore.logout()

      expect(resetSessionId).toHaveBeenCalledTimes(1)
      expect(resetFirstEnterSet).toHaveBeenCalledTimes(1)
    })
  })

  describe('清除错误测试', () => {
    it('应该清除错误信息', () => {
      const authStore = useAuthStore()
      authStore.error = '测试错误'

      authStore.clearError()

      expect(authStore.error).toBe(null)
    })
  })

  describe('刷新令牌测试', () => {
    it('应该刷新token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { token: 'new-jwt-token' },
        }),
      })

      const authStore = useAuthStore()
      authStore.token = 'old-token'

      await authStore.refreshToken()

      expect(authStore.token).toBe('new-jwt-token')
    })

    it('刷新失败应该登出', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, message: 'token过期' }),
      })

      const authStore = useAuthStore()
      authStore.token = 'expired-token'
      authStore.user = { id: '2024001', username: '张三', studentId: '2024001', role: 'student' }

      await expect(authStore.refreshToken()).rejects.toThrow()

      expect(authStore.token).toBe(null)
      expect(authStore.user).toBe(null)
    })
  })
})
