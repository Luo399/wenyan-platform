import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { useDataLoader, terminateJsonParserWorker, clearDataCache } from '@/composables/useDataLoader'

vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}))

describe('useDataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearDataCache()
    terminateJsonParserWorker()

    const createMockWorker = () => {
      const messageHandlers: Array<(e: { data: { id: number; success: boolean; data: unknown } }) => void> = []
      return {
        postMessage: vi.fn((data: { text: string; id: number }) => {
          setTimeout(() => {
            messageHandlers.forEach((handler) => {
              handler({
                data: {
                  id: data.id,
                  success: true,
                  data: JSON.parse(data.text),
                },
              })
            })
          }, 0)
        }),
        addEventListener: vi.fn((event: string, handler: any) => {
          if (event === 'message') {
            messageHandlers.push(handler)
          }
        }),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
      }
    }

    vi.stubGlobal('Worker', vi.fn().mockImplementation(createMockWorker))
  })

  afterEach(() => {
    terminateJsonParserWorker()
    vi.unstubAllGlobals()
  })

  describe('初始化测试', () => {
    it('应该正确初始化状态', () => {
      const { loading, error, isTimeout, data } = useDataLoader(() => '/test.json', {
        autoLoad: false,
      })

      expect(loading.value).toBe(false)
      expect(error.value).toBe(null)
      expect(isTimeout.value).toBe(false)
      expect(data.value).toBe(null)
    })

    it('应该返回所有必要的属性和方法', () => {
      const loader = useDataLoader(() => '/test.json', { autoLoad: false })

      expect(loader).toHaveProperty('loading')
      expect(loader).toHaveProperty('error')
      expect(loader).toHaveProperty('isTimeout')
      expect(loader).toHaveProperty('data')
      expect(loader).toHaveProperty('load')
      expect(loader).toHaveProperty('retry')
    })
  })

  describe('缓存机制测试', () => {
    it('应该启用缓存并返回缓存数据', async () => {
      const mockData = { items: [1, 2, 3] }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(mockData)),
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
      }) as Mock

      const urlGetter = () => '/cached.json'
      const { data, load } = useDataLoader(urlGetter, {
        autoLoad: false,
        cacheEnabled: true,
        cacheTTL: 60000,
      })

      await load()
      expect(data.value).toEqual(mockData)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      await load()
      expect(data.value).toEqual(mockData)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('缓存过期后应该重新获取数据', async () => {
      const mockData = { items: [1, 2, 3] }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(mockData)),
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
      }) as Mock

      const urlGetter = () => '/expiring.json'
      const { load } = useDataLoader(urlGetter, {
        autoLoad: false,
        cacheEnabled: true,
        cacheTTL: 1,
      })

      await load()
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // 等待缓存过期
      await new Promise((resolve) => setTimeout(resolve, 10))

      await load()
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('缓存应该按URL区分', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ url1: 'data1' })),
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ url2: 'data2' })),
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
        }) as Mock

      const url1Getter = () => '/url1.json'
      const url2Getter = () => '/url2.json'

      const loader1 = useDataLoader(url1Getter, { autoLoad: false, cacheEnabled: true })
      const loader2 = useDataLoader(url2Getter, { autoLoad: false, cacheEnabled: true })

      await loader1.load()
      await loader2.load()
      await loader1.load()

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('数据转换测试', () => {
    it('transform函数应该正确转换数据', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ raw: 'data' })),
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
      }) as Mock

      const transform = (raw: unknown) => ({
        transformed: (raw as { raw: string }).raw.toUpperCase(),
      })

      const { data, load } = useDataLoader(() => '/transform.json', {
        autoLoad: false,
        transform,
      })

      await load()

      expect(data.value).toEqual({ transformed: 'DATA' })
    })
  })

  describe('空URL处理测试', () => {
    it('空URL应该触发错误', async () => {
      const { error, load } = useDataLoader(() => '', { autoLoad: false })

      await load()

      expect(error.value).toBe('请提供有效的URL')
    })

    it('undefined URL应该触发错误', async () => {
      const { error, load } = useDataLoader(() => undefined as any, { autoLoad: false })

      await load()

      expect(error.value).toBe('请提供有效的URL')
    })
  })

  describe('超时配置测试', () => {
    it('应该使用自定义超时配置', async () => {
      global.fetch = vi.fn().mockImplementation((url: string, options: { signal: AbortSignal }) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve({
              ok: true,
              arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ slow: 'data' })),
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            })
          }, 5000)

          options.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId)
            reject(new DOMException('AbortError', 'AbortError'))
          })
        })
      }) as Mock

      const { error, isTimeout, load } = useDataLoader(() => '/slow.json', {
        autoLoad: false,
        timeout: 100,
      })

      await load()

      expect(isTimeout.value).toBe(true)
      expect(error.value).toBe('请求超时')
    })
  })
})