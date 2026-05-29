import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()

    // Mock localStorage
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => null)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {})
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {})

    // Mock fetch
    global.fetch = vi.fn()
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
      const mockUser = JSON.stringify({ id: '2024001', name: '张三', role: 'student' })
      vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'auth_token') return 'mock-token'
        if (key === 'auth_user') return mockUser
        return null
      })

      const authStore = useAuthStore()
      authStore.initialize()

      expect(authStore.token).toBe('mock-token')
      expect(authStore.user).toEqual({ id: '2024001', name: '张三', role: 'student' })
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
            user: { id: '2024001', name: '张三', role: 'student' },
          },
        }),
      })

      const authStore = useAuthStore()
      await authStore.login('2024001')

      expect(authStore.token).toBe('jwt-token')
      expect(authStore.user).toEqual({ id: '2024001', name: '张三', role: 'student' })
      expect(authStore.isLoggedIn).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token')
    })

    it('登录失败应该设置错误信息', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, message: '学号不存在' }),
      })

      const authStore = useAuthStore()
      await authStore.login('9999999')

      expect(authStore.error).toBe('学号不存在')
      expect(authStore.isLoggedIn).toBe(false)
    })

    it('网络错误应该设置错误信息', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('网络错误'))

      const authStore = useAuthStore()
      await authStore.login('2024001')

      expect(authStore.error).toBe('网络错误，请稍后重试')
    })
  })

  describe('登出测试', () => {
    it('登出应该清除用户和token', () => {
      const authStore = useAuthStore()
      authStore.token = 'jwt-token'
      authStore.user = { id: '2024001', name: '张三', role: 'student' }

      authStore.logout()

      expect(authStore.token).toBe(null)
      expect(authStore.user).toBe(null)
      expect(authStore.isLoggedIn).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_user')
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
      authStore.user = { id: '2024001', name: '张三', role: 'student' }

      await authStore.refreshToken()

      expect(authStore.token).toBe(null)
      expect(authStore.user).toBe(null)
    })
  })
})
