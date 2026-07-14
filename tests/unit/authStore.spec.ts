import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const mockStorage: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value },
  removeItem: (key: string) => { delete mockStorage[key] },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) },
})

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.keys(mockStorage).forEach(k => delete mockStorage[k])
  })

  it('should initialize with empty state', () => {
    const store = useAuthStore()
    
    expect(store.token).toBe(null)
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
    
    expect(store.token).toBe(null)
    expect(store.user).toBe(null)
    expect(store.error).toBe(null)
  })

  it('should restore from storage', () => {
    mockStorage['auth_token'] = 'stored-token'
    mockStorage['auth_user'] = JSON.stringify({ id: '1001', name: '张三' })
    
    const store = useAuthStore()
    store.initialize()
    
    expect(store.token).toBe('stored-token')
    expect(store.user).toEqual({ id: '1001', name: '张三' })
  })

  it('should handle invalid JSON in storage', () => {
    mockStorage['auth_token'] = 'stored-token'
    mockStorage['auth_user'] = 'invalid-json'
    
    const store = useAuthStore()
    store.initialize()
    
    expect(store.token).toBe(null)
    expect(store.user).toBe(null)
    expect(store.error).toBe('登录状态已过期，请重新登录')
  })
})