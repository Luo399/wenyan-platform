import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const mockStorage: Record<string, string> = {}

/** 生成一个 exp 在未来的合法 JWT（initialize() 会校验 exp） */
function makeJwt(expSecondsFromNow = 3600): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`
}

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
    // initialize() 现在会校验 token 的 exp 与 user.role 白名单，
    // 因此持久化数据必须是「合法 JWT + 合法角色」才允许恢复
    const token = makeJwt()
    const user = { id: '1001', username: '张三', studentId: '1001', role: 'student' }
    mockStorage['auth_token'] = token
    mockStorage['auth_user'] = JSON.stringify(user)

    const store = useAuthStore()
    store.initialize()

    expect(store.token).toBe(token)
    expect(store.user).toEqual(user)
  })

  it('should reject expired token from storage', () => {
    mockStorage['auth_token'] = makeJwt(-60)
    mockStorage['auth_user'] = JSON.stringify({
      id: '1001',
      username: '张三',
      studentId: '1001',
      role: 'student',
    })

    const store = useAuthStore()
    store.initialize()

    expect(store.token).toBe(null)
    expect(store.user).toBe(null)
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