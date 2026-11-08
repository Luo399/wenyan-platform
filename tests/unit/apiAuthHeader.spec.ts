import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { request } from '@/utils/api'

let storageData: Record<string, string | null>
let fetchMock: ReturnType<typeof vi.fn>

function authHeaderOf(callIndex = 0): string | null {
  const headers = fetchMock.mock.calls[callIndex]?.[1]?.headers as Headers
  return headers.get('Authorization')
}

/**
 * F-005 回归测试：初始化竞态下的鉴权头
 *
 * 背景：getAuthHeaders() 在 Pinia 未安装时静默返回空对象，
 * 请求因此不带 Authorization，后端返回 AUTH_REQUIRED，
 * 前端却提示「登录已过期，请重新登录」，把"竞态"误报成"会话过期"。
 */
describe('api 鉴权头构造（容器未就绪的兜底）', () => {
  beforeEach(() => {
    storageData = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k: string) => (k in storageData ? storageData[k] : null)),
      setItem: vi.fn((k: string, v: string) => {
        storageData[k] = v
      }),
      removeItem: vi.fn((k: string) => {
        delete storageData[k]
      }),
      clear: vi.fn(() => {
        storageData = {}
      }),
    })
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('Pinia 未安装时回退到持久化登录态，不发出匿名请求', async () => {
    setActivePinia(undefined as unknown as ReturnType<typeof createPinia>)
    storageData.auth_token = 'persisted-token'

    await request('/api/answers/1')

    expect(authHeaderOf()).toBe('Bearer persisted-token')
  })

  it('store 已有 token 时优先使用 store', async () => {
    setActivePinia(createPinia())
    storageData.auth_token = 'persisted-token'
    useAuthStore().token = 'store-token'

    await request('/api/answers/1')

    expect(authHeaderOf()).toBe('Bearer store-token')
  })

  it('store 尚未水合但存储已有 token 时使用存储值', async () => {
    setActivePinia(createPinia())
    storageData.auth_token = 'persisted-token'

    await request('/api/answers/1')

    expect(authHeaderOf()).toBe('Bearer persisted-token')
  })

  it('确实无登录态时不附加 Authorization', async () => {
    setActivePinia(createPinia())

    await request('/api/answers/1')

    expect(authHeaderOf()).toBeNull()
  })
})
