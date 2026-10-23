import { authStore } from '@/stores/auth'
import type { ApiResponse } from '@/types/pageConfig'

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export function buildAuthHeaders(): Record<string, string> {
  const store = authStore()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (store.token) headers['Authorization'] = `Bearer ${store.token}`
  return headers
}

export function buildFetchConfig(extra?: RequestInit): RequestInit {
  const headers = buildAuthHeaders()
  return { headers, credentials: 'include', ...extra }
}

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  if (res.status === 401) {
    const store = authStore()
    store.clearAuth()
    // eslint-disable-next-line no-console
    console.warn('[api] 401 未授权，已清理登录态')
    return { success: false, error: 'UNAUTHORIZED', message: '登录已失效，请重新登录' }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { success: false, error: `HTTP_${res.status}`, message: text || `HTTP ${res.status}` }
  }
  try {
    return (await res.json()) as ApiResponse<T>
  } catch {
    return { success: true, message: 'OK' } as unknown as ApiResponse<T>
  }
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${VITE_API_BASE_URL}${path}`, buildFetchConfig())
  return handleResponse<T>(res)
}

export async function apiPost<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
  const body = data !== undefined ? JSON.stringify(data) : undefined
  const res = await fetch(`${VITE_API_BASE_URL}${path}`, buildFetchConfig({ method: 'POST', body }))
  return handleResponse<T>(res)
}

/**
 * multipart 上传 —— 不自动加 Content-Type（浏览器自动加 boundary）
 * 额外 Authorization 头仍从 authStore 取
 */
export async function upload<T>(path: string, formData: FormData, extraHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
  const store = authStore()
  const headers: Record<string, string> = {}
  if (store.token) headers['Authorization'] = `Bearer ${store.token}`
  if (extraHeaders) Object.assign(headers, extraHeaders)
  const res = await fetch(`${VITE_API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  })
  return handleResponse<T>(res)
}

// 便捷别名
export const request = apiGet
export const post = apiPost
export const put = apiPost
