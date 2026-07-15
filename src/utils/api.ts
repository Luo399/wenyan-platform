import { useAuthStore } from '@/stores/auth'

const apiBase = import.meta.env.VITE_API_BASE_URL as string
const authSecret = import.meta.env.VITE_AUTH_SECRET as string | undefined
const authEnabled = !!authSecret && authSecret.length > 0

async function generateHmacSignature(studentId: string, timestamp: string): Promise<string> {
  if (!authSecret) {
    throw new Error('AUTH_SECRET 未配置')
  }
  
  const payload = `${studentId}:${timestamp}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(authSecret)
  const messageData = encoder.encode(payload)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

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
    message: string
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
      throw new ApiError(response.status, errorData?.error || 'REQUEST_FAILED', errorData?.message || `请求失败: ${response.status}`)
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

export interface LoginResponse {
  token: string
  user: {
    id: string
    username: string
    student_id: string
    role: 'student' | 'teacher' | 'admin'
  }
}

export async function login(studentId: string): Promise<LoginResponse> {
  const response = await post<LoginResponse>('/api/auth/login', { student_id: studentId })
  return response.data!
}

export interface QuestionForSubmit {
  id: string
  correctAnswer: string | number | (string | number)[]
}

export interface SubmitAnswersRequest {
  studentId: string
  wenId: string
  submittedAt: string
  answers: Record<string, string | number | (string | number)[]>
  questions: Array<{
    id: string
    correctAnswer: string | number | (string | number)[]
  }>
  signature?: string
}

export interface SubmitAnswersResponse {
  success: boolean
  message: string
  data?: {
    studentId: string
    wenId: string
    submittedAt: string
    questionCount: number
    totalScore: number
    avgScore: number
    details: Array<{
      questionId: string
      score: number
    }>
  }
  error?: string
}

export async function submitAnswers(
  data: SubmitAnswersRequest,
  timeout: number = 30000
): Promise<SubmitAnswersResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    let requestBody = data
    
    if (authEnabled) {
      const signature = await generateHmacSignature(data.studentId, data.submittedAt)
      requestBody = {
        ...data,
        signature
      }
    }

    const response = await fetch(`${apiBase}/api/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new ApiError(
        response.status,
        errorData?.error || 'UNKNOWN_ERROR',
        errorData?.message || '请求失败'
      )
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof ApiError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', '请求超时')
    }

    throw new ApiError(0, 'NETWORK_ERROR', '网络连接失败')
  }
}

export interface SubmitSingleAnswerParams {
  studentId: string
  studentName?: string
  wenId: string
  questionId: string
  userAnswer: string | number | (string | number)[]
  correctAnswer?: string | number | (string | number)[]
  submittedAt?: string
}

export interface SubmitSingleAnswerResponse {
  success: boolean
  message: string
  data?: {
    studentId: string
    wenId: string
    questionId: string
    userAnswer: string | number | (string | number)[]
    correctAnswer?: string | number | (string | number)[]
    isCorrect: number
    score: number
    submittedAt: string
    attemptNumber: number
  }
}

export async function submitSingleAnswer(
  params: SubmitSingleAnswerParams,
): Promise<SubmitSingleAnswerResponse> {
  const response = await post<SubmitSingleAnswerResponse>('/api/submit/single', {
    ...params,
    submittedAt: params.submittedAt || new Date().toISOString(),
  })
  return response.data!
}

export interface TextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration?: string
  bgm?: string
}

export async function getTextBasicInfo(textId: string): Promise<TextBasicInfo> {
  const response = await get<TextBasicInfo>(`/api/texts/${textId}/basic-info`)
  return response.data!
}

export interface WordItem {
  text_id: string
  word: string
  basic_meaning: string
  synonym_analysis?: string
  follow_up_questions?: string[]
}

export async function getWordList(textId: string): Promise<WordItem[]> {
  const response = await get<WordItem[]>(`/api/texts/${textId}/word-list`)
  return response.data!
}