/**
 * API 请求封装
 *
 * 功能：
 * - 自动在请求头中携带 JWT token（动态获取）
 * - 统一错误处理（非2xx响应抛出错误）
 * - 环境变量控制后端地址
 * - 业务接口集中管理
 */

import { useAuthStore } from '@/stores/auth'

/**
 * 获取后端 API 基础地址
 * 开发环境返回空字符串，让请求使用相对路径（通过 Vite 代理转发）
 * 生产环境配置 .env.production 中的 VITE_API_BASE
 */
function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE
  // 开发环境（无配置或本地地址）使用相对路径
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    return ''
  }
  return baseUrl
}

/**
 * 获取认证请求头
 * 每次请求时动态调用 useAuthStore() 获取最新状态，token 不会过期残留
 */
function getAuthHeaders(): Record<string, string> {
  const authStore = useAuthStore()
  if (!authStore.token) {
    return {}
  }
  return { Authorization: `Bearer ${authStore.token}` }
}

/**
 * 请求配置接口
 */
export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
}

/**
 * 统一响应接口
 * 所有API响应必须遵循此格式
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: number
  timestamp?: number
  requestId?: string
}

/**
 * 标准化API响应
 * 确保所有响应都符合统一格式
 */
export function normalizeResponse<T = any>(response: any): ApiResponse<T> {
  if (response === null || response === undefined) {
    return {
      success: false,
      message: '响应为空',
      code: 500,
      timestamp: Date.now(),
    }
  }

  // 如果已经是标准化格式，直接返回
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

  // 如果响应只有 data 字段，包装成标准化格式
  if (typeof response === 'object' && 'data' in response) {
    return {
      success: true,
      data: response.data,
      message: '操作成功',
      code: 200,
      timestamp: Date.now(),
    }
  }

  // 如果响应本身就是数据，包装成标准化格式
  return {
    success: true,
    data: response as T,
    message: '操作成功',
    code: 200,
    timestamp: Date.now(),
  }
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 基础请求函数
 * 非 2xx 响应会抛出错误，调用方用 try/catch 包裹即可
 */
export async function request<T = any>(
  url: string,
  config: RequestConfig = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', headers = {}, body, timeout = 30000 } = config

  // 构建完整 URL
  const fullUrl = url.startsWith('http') ? url : `${getBaseUrl()}${url}`

  // 构建请求头（包含认证信息）
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...headers,
  })

  // 创建取消控制器
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

    // 处理 token 过期
    if (response.status === 401) {
      const authStore = useAuthStore()
      // 只在用户已登录状态且token无效时才登出
      if (authStore.isLoggedIn) {
        authStore.logout()
      }
      throw new ApiError('登录已过期，请重新登录', 401)
    }

    // 统一错误处理：非 2xx 响应抛出错误
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new ApiError(errorData?.message || `请求失败: ${response.status}`, response.status)
    }

    const jsonResponse = await response.json()
    return normalizeResponse<T>(jsonResponse)
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('请求超时')
    }
    throw err
  }
}

/**
 * GET 请求
 */
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

/**
 * POST 请求
 */
export async function post<T = any>(
  url: string,
  body?: any,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'POST', body })
}

/**
 * PUT 请求
 */
export async function put<T = any>(
  url: string,
  body?: any,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'PUT', body })
}

/**
 * DELETE 请求
 */
export async function del<T = any>(
  url: string,
  config: Omit<RequestConfig, 'method'> = {},
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'DELETE' })
}

// ============================================================
// 业务接口封装
// ============================================================

/**
 * 登录请求
 *
 * @param studentId - 学号
 * @returns 用户信息和 token
 */
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

/**
 * 答题数据接口
 */
export interface QuestionForSubmit {
  id: string
  correctAnswer: string | number | (string | number)[]
}

export interface SubmitAnswersParams {
  studentId: string
  studentName?: string
  wenId: string
  submittedAt: string
  answers: Record<string, string | number | (string | number)[]>
  questions: QuestionForSubmit[]
}

export interface SubmitAnswersResponse {
  success: boolean
  message: string
  data?: {
    studentId: string
    wenId: string
    submittedAt: string
    questionCount: number
    correctCount: number
    wrongCount: number
    totalScore: number
    avgScore: number
    details: Array<{
      questionId: string
      score: number
      isCorrect: number
      attemptNumber: number
    }>
  }
}

/**
 * 提交答题结果
 *
 * @param submitData - 答题数据（包含answers和questions）
 * @param wenId - 课文ID
 * @param studentId - 学生ID
 * @param studentName - 学生姓名（可选）
 * @param timeout - 超时时间
 * @returns 提交结果
 */
export async function submitAnswers(
  submitData: { answers: Record<string, any>; questions: QuestionForSubmit[] },
  wenId: string,
  studentId: string,
  studentName?: string,
  timeout?: number,
): Promise<SubmitAnswersResponse> {
  const params: SubmitAnswersParams = {
    studentId,
    studentName,
    wenId,
    submittedAt: new Date().toISOString(),
    answers: submitData.answers,
    questions: submitData.questions,
  }

  const response = await post<SubmitAnswersResponse>('/api/submit', params, { timeout })
  return response.data!
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

/**
 * 获取文本基础信息
 *
 * @param textId - 课文ID
 */
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

/**
 * 获取字词注释数据
 *
 * @param textId - 课文ID
 */
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
