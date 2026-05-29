import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.spyOn(localStorage, 'getItem').mockReturnValue(null)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {})
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {})
  })

  it('should initialize with empty state', () => {
    const store = useAuthStore()
    
    expect(store.token).toBe('')
    expect(store.user).toBe(null)
    expect(store.error).toBe(null)
    expect(store.isLoggedIn).toBe(false)
  })

  it('should set token and user', () => {
    const store = useAuthStore()
    const testUser = { id: '1001', name: '张三', role: 'student' }
    
    store.token = 'test-token'
    store.user = testUser
    
    expect(store.token).toBe('test-token')
    expect(store.user).toEqual(testUser)
    expect(store.isLoggedIn).toBe(true)
  })

  it('should clear auth data', () => {
    const store = useAuthStore()
    store.token = 'test-token'
    store.user = { id: '1001', name: '张三', role: 'student' }
    
    store.clearAuthData()
    
    expect(store.token).toBe('')
    expect(store.user).toBe(null)
    expect(store.error).toBe(null)
  })

  it('should restore from storage', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => {
      if (key === 'auth_token') return 'stored-token'
      if (key === 'auth_user') return JSON.stringify({ id: '1001', name: '张三' })
      return null
    })
    
    const store = useAuthStore()
    store.restoreFromStorage()
    
    expect(store.token).toBe('stored-token')
    expect(store.user).toEqual({ id: '1001', name: '张三' })
  })

  it('should handle invalid JSON in storage', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => {
      if (key === 'auth_token') return 'stored-token'
      if (key === 'auth_user') return 'invalid-json'
      return null
    })
    
    const store = useAuthStore()
    store.restoreFromStorage()
    
    expect(store.token).toBe('')
    expect(store.user).toBe(null)
    expect(store.error).toBe('登录状态已过期，请重新登录')
  })
})