import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/utils/api', () => ({
  post: vi.fn(),
}))

import { post } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const postMock = post as unknown as ReturnType<typeof vi.fn>

/** 构造一个结构合法的 JWT（签名不参与前端解析） */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`
}

const inSeconds = (offsetSec: number) => Math.floor(Date.now() / 1000) + offsetSec

/**
 * F-004 回归测试：令牌过期判定与续期
 *
 * 背景：refreshToken() 此前无任何调用方（死代码），
 * 且刷新失败时会直接登出，导致一次网络抖动就把有效会话踢掉。
 */
describe('auth store 令牌过期与续期', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    postMock.mockReset()
  })

  it('剩余寿命充足时不判定为即将过期', () => {
    const store = useAuthStore()
    store.token = makeJwt({ exp: inSeconds(3600) })

    expect(store.isTokenExpired()).toBe(false)
    expect(store.isTokenExpiringSoon()).toBe(false)
  })

  it('剩余寿命低于阈值时判定为即将过期', () => {
    const store = useAuthStore()
    store.token = makeJwt({ exp: inSeconds(60) })

    expect(store.isTokenExpired()).toBe(false)
    expect(store.isTokenExpiringSoon()).toBe(true)
  })

  it('已过期判定为过期，且不算即将过期', () => {
    const store = useAuthStore()
    store.token = makeJwt({ exp: inSeconds(-10) })

    expect(store.isTokenExpired()).toBe(true)
    expect(store.isTokenExpiringSoon()).toBe(false)
  })

  it('无法解析的 token 视为已过期', () => {
    const store = useAuthStore()
    store.token = 'not-a-jwt'

    expect(store.isTokenExpired()).toBe(true)
    expect(store.isTokenExpiringSoon()).toBe(false)
  })

  it('刷新成功应替换 token', async () => {
    const store = useAuthStore()
    store.token = makeJwt({ exp: inSeconds(60) })
    store.user = { id: '1', username: 'u', studentId: '1', role: 'student' }
    postMock.mockResolvedValue({ success: true, data: { token: 'new-token' } })

    await store.refreshToken()

    expect(store.token).toBe('new-token')
  })

  it('刷新失败不应直接登出（避免网络抖动踢人）', async () => {
    const store = useAuthStore()
    const original = makeJwt({ exp: inSeconds(60) })
    store.token = original
    store.user = { id: '1', username: 'u', studentId: '1', role: 'student' }
    postMock.mockRejectedValue(new Error('network down'))

    await expect(store.refreshToken()).rejects.toThrow('network down')
    expect(store.token).toBe(original)
  })
})
