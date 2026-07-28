import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { normalizeResponse, request, get, post, put, del, ApiError } from '@/utils/api'

vi.stubGlobal('localStorage', {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})

describe('api', () => {
  let fetchMock: vi.Mock

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('normalizeResponse', () => {
    it('should return standardized response for success format', () => {
      const response = { success: true, data: { id: 1 }, message: '成功' }
      const result = normalizeResponse(response)
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 1 })
      expect(result.message).toBe('成功')
      expect(result.code).toBe(200)
    })

    it('should return standardized response for failure format', () => {
      const response = { success: false, message: '失败', code: 400 }
      const result = normalizeResponse(response)
      expect(result.success).toBe(false)
      expect(result.message).toBe('失败')
      expect(result.code).toBe(400)
    })

    it('should handle response with only data field', () => {
      const response = { data: { id: 1 } }
      const result = normalizeResponse(response)
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 1 })
    })

    it('should wrap raw data as success response', () => {
      const response = { id: 1, name: 'test' }
      const result = normalizeResponse(response)
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 1, name: 'test' })
    })

    it('should handle null or undefined', () => {
      const result = normalizeResponse(null as any)
      expect(result.success).toBe(false)
      expect(result.message).toBe('响应为空')
      expect(result.code).toBe(500)

      const result2 = normalizeResponse(undefined as any)
      expect(result2.success).toBe(false)
    })
  })

  describe('ApiError', () => {
    it('should create error with message and code', () => {
      const error = new ApiError('测试错误', 404)
      expect(error.message).toBe('测试错误')
      expect(error.code).toBe(404)
      expect(error.name).toBe('ApiError')
    })

    it('should create error without code', () => {
      const error = new ApiError('测试错误')
      expect(error.message).toBe('测试错误')
      expect(error.code).toBeUndefined()
    })
  })

  describe('request', () => {
    it('should make GET request with auth headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: { id: 1 } }),
      } as any)

      await request('/api/test')

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
        }),
      )
    })

    it('should handle 401 response and logout', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: '未授权' }),
      } as any)

      await expect(request('/api/test')).rejects.toThrow(ApiError)
    })

    it('should throw error for non-2xx response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ message: '服务器错误' }),
      } as any)

      await expect(request('/api/test')).rejects.toThrow('服务器错误')
    })

    it('should handle network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))

      await expect(request('/api/test')).rejects.toThrow('Network error')
    })
  })

  describe('get', () => {
    it('should make GET request with query params', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: [] }),
      } as any)

      await get('/api/test', { id: '123', page: 1 })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/test?id=123&page=1',
        expect.anything(),
      )
    })

    it('should handle no query params', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: [] }),
      } as any)

      await get('/api/test')

      expect(fetchMock).toHaveBeenCalledWith('/api/test', expect.anything())
    })
  })

  describe('post', () => {
    it('should make POST request with body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: { id: 1 } }),
      } as any)

      await post('/api/test', { name: 'test' })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })
  })

  describe('put', () => {
    it('should make PUT request with body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: { id: 1 } }),
      } as any)

      await put('/api/test/1', { name: 'updated' })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({
          method: 'PUT',
        }),
      )
    })
  })

  describe('del', () => {
    it('should make DELETE request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      } as any)

      await del('/api/test/1')

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({
          method: 'DELETE',
        }),
      )
    })
  })
})