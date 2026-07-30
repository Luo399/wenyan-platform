import { useAuthStore } from '@/stores/auth'

const apiBase = import.meta.env.VITE_API_BASE_URL as string
export { apiBase }

// R90 已移除前端 HMAC 密钥与签名生成（VITE_AUTH_SECRET 是服务端 secret，不应进入客户端构建产物）
// 提交答案的鉴权由 JWT Bearer token 承担（见 getAuthHeaders），后端 answerController 不再校验 HMAC 签名

function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    return ''
  }
  return baseUrl
}

function getAuthHeaders(): Record<string, string> {
  const authStore = useAuthStore()
  if (!authStore.token) {
    return {}
  }
  return { Authorization: `Bearer ${authStore.token}` }
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: number
  timestamp?: number
  requestId?: string
}

export function normalizeResponse<T = any>(response: any): ApiResponse<T> {
  if (response === null || response === undefined) {
    return {
      success: false,
      message: '响应为空',
      code: 500,
      timestamp: Date.now(),
    }
  }

  if (typeof response === 'object' && 'success' in response) {
    return {
      success: response.success,
      data: response.data,
      message: response.message || (response.success ? '操作成功' : '操作失败'),
      code: response.code ?? (response.success ? 200 : 500),
      timestamp: response.timestamp ?? Date.now(),
      requestId: response.requestId,
    }
  }

  if (typeof response === 'object' && 'data' in response) {
    return {
      success: true,
      data: response.data,
      message: '操作成功',
      code: 200,
      timestamp: Date.now(),
    }
  }

  return {
    success: true,
    data: response as T,
    message: '操作成功',
    code: 200,
    timestamp: Date.now(),
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public errorCode: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function request<T = any>(
  url: string,
  config: RequestConfig = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', headers = {}, body, timeout = 30000 } = config

  const fullUrl = url.startsWith('http') ? url : `${getBaseUrl()}${url}`

  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...headers,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(fullUrl, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.status === 401) {
      const authStore = useAuthStore()
      if (authStore.isLoggedIn) {
        authStore.logout()
      }
      throw new ApiError(401, 'AUTH_EXPIRED', '登录已过期，请重新登录')
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new ApiError(
        response.status,
        errorData?.error || 'REQUEST_FAILED',
        errorData?.message || `请求失败: ${response.status}`,
      )
    }

    const jsonResponse = await response.json()
    return normalizeResponse<T>(jsonResponse)
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', '请求超时')
    }
    throw err
  }
}

export async function get<T = any>(
  url: string,
  params?: Record<string, string | number>,
  config: Omit<RequestConfig, 'method' | 'body'> = {},
): Promise<ApiResponse<T>> {
  const queryString = params
    ? '?' +
      new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      ).toString()
    : ''
  return request<T>(url + queryString, config)
}

export async function post<T = any>(
  url: string,
  body?: any,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'POST', body })
}

export async function put<T = any>(
  url: string,
  body?: any,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'PUT', body })
}

export async function del<T = any>(
  url: string,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'DELETE' })
}

// ============================================================
// 文件结束
// ============================================================
