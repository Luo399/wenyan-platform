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
  // R91: body 从 any 改为 unknown，由调用方具体类型推断
  body?: unknown
  timeout?: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  code?: number
  timestamp?: number
  requestId?: string
}

// R91: 后端响应原始结构（normalizeResponse 的输入），用具体接口替代 any
interface RawApiResponse<T = unknown> {
  success?: boolean
  data?: T
  message?: string
  code?: number
  timestamp?: number
  requestId?: string
}

export function normalizeResponse<T = unknown>(response: unknown): ApiResponse<T> {
  if (response === null || response === undefined) {
    return {
      success: false,
      message: '响应为空',
      code: 500,
      timestamp: Date.now(),
    }
  }

  // R91: 用类型谓词收窄 unknown，替代直接访问 any
  if (typeof response === 'object' && response !== null && 'success' in response) {
    const raw = response as RawApiResponse<T>
    const success = !!raw.success
    return {
      success,
      data: raw.data,
      message: raw.message || (success ? '操作成功' : '操作失败'),
      code: raw.code ?? (success ? 200 : 500),
      timestamp: raw.timestamp ?? Date.now(),
      requestId: raw.requestId,
    }
  }

  if (typeof response === 'object' && response !== null && 'data' in response) {
    const raw = response as RawApiResponse<T>
    return {
      success: true,
      data: raw.data,
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

export async function request<T = unknown>(
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
      // R91: body 已是 unknown，JSON.stringify 接受 unknown；R93 的 falsy 判断属另一问题
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
      // R91: errorData 收窄为 Record<string, unknown> | null，替代隐式 any
      const errorData = (await response.json().catch(() => null)) as Record<string, unknown> | null
      const errCode =
        errorData && typeof errorData.error === 'string' ? errorData.error : 'REQUEST_FAILED'
      const errMsg =
        errorData && typeof errorData.message === 'string'
          ? errorData.message
          : `请求失败: ${response.status}`
      throw new ApiError(response.status, errCode, errMsg)
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

export async function get<T = unknown>(
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

export async function post<T = unknown>(
  url: string,
  body?: unknown,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'POST', body })
}

export async function put<T = unknown>(
  url: string,
  body?: unknown,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'PUT', body })
}

export async function del<T = unknown>(
  url: string,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'DELETE' })
}

// ============================================================
// 文件结束
// ============================================================
