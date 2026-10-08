import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { request, ApiError } from '@/utils/api'

vi.stubGlobal('localStorage', {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
})

/**
 * F-002 回归测试：401 语义分流
 *
 * 后端登录接口用 401 + INVALID_CREDENTIALS 表示「学号或密码错误」，
 * 与「会话过期」共用 401 状态码。前端必须按 error 字段区分，
 * 否则会把真实原因覆盖成「登录已过期，请重新登录」。
 */
describe('api 401 语义分流', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mock401(body: Record<string, unknown>) {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue(body),
    })
  }

  it('凭证错误应原样透传后端消息，不伪装成会话过期', async () => {
    mock401({ success: false, error: 'INVALID_CREDENTIALS', message: '学号或密码错误' })

    await expect(
      request('/api/auth/student/login', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({
      status: 401,
      errorCode: 'INVALID_CREDENTIALS',
      message: '学号或密码错误',
    })
  })

  it('会话过期仍提示重新登录', async () => {
    mock401({ success: false, error: 'AUTH_FAILED', message: '登录已过期，请重新登录' })

    await expect(request('/api/answers/1')).rejects.toMatchObject({
      status: 401,
      errorCode: 'AUTH_EXPIRED',
      message: '登录已过期，请重新登录',
    })
  })

  it('缺少 error 字段的 401 回退为会话过期', async () => {
    mock401({ message: '未授权' })

    await expect(request('/api/answers/1')).rejects.toMatchObject({
      status: 401,
      errorCode: 'AUTH_EXPIRED',
    })
  })

  it('两个分支抛出的都是 ApiError', async () => {
    mock401({ success: false, error: 'INVALID_CREDENTIALS', message: '学号或密码错误' })

    await expect(
      request('/api/auth/student/login', { method: 'POST', body: {} }),
    ).rejects.toBeInstanceOf(ApiError)
  })
})
