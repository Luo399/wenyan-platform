/**
 * API 请求封装
 * 
 * 功能：
 * - 自动在请求头中携带 JWT token
 * - 处理 token 过期和刷新
 * - 统一错误处理
 * - 请求取消支持
 */

import { useAuthStore } from '@/stores/auth'

// 定义 auth store 返回类型
type UseAuthStoreReturn = ReturnType<typeof useAuthStore>

// 存储 auth store 引用
let authStoreRef: UseAuthStoreReturn | null = null

/**
 * 设置 auth store 引用
 */
export function setAuthStore(store: UseAuthStoreReturn): void {
  authStoreRef = store
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
 * 响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: number
}

/**
 * 基础请求函数
 */
export async function request<T = any>(
  url: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000
  } = config

  // 构建请求头
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers
  })

  // 添加 Authorization token
  if (authStoreRef?.token) {
    requestHeaders.set('Authorization', `Bearer ${authStoreRef.token}`)
  }

  // 创建取消控制器
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // 处理 token 过期
    if (response.status === 401) {
      handleUnauthorized()
      throw new Error('登录已过期，请重新登录')
    }

    // 处理服务器错误
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(errorData?.message || `请求失败: ${response.status}`)
    }

    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求超时')
    }
    throw err
  }
}

/**
 * 处理未授权错误
 */
function handleUnauthorized(): void {
  if (authStoreRef) {
    authStoreRef.logout()
    // 可以在这里触发登录弹窗或跳转到登录页
  }
}

/**
 * GET 请求
 */
export async function get<T = any>(
  url: string,
  params?: Record<string, string>,
  config: Omit<RequestConfig, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  const queryString = params
    ? '?' + new URLSearchParams(params).toString()
    : ''
  return request<T>(url + queryString, config)
}

/**
 * POST 请求
 */
export async function post<T = any>(
  url: string,
  body?: any,
  config: Omit<RequestConfig, 'method'> = {}
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'POST', body })
}

/**
 * PUT 请求
 */
export async function put<T = any>(
  url: string,
  body?: any,
  config: Omit<RequestConfig, 'method'> = {}
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'PUT', body })
}

/**
 * DELETE 请求
 */
export async function del<T = any>(
  url: string,
  config: Omit<RequestConfig, 'method'> = {}
): Promise<ApiResponse<T>> {
  return request<T>(url, { ...config, method: 'DELETE' })
}

/**
 * 登录请求
 */
export async function login(studentId: string): Promise<ApiResponse<{
  token: string
  user: {
    id: string
    username: string
    student_id: string
    role: 'student' | 'teacher' | 'admin'
  }
}>> {
  return post('/api/auth/login', { student_id: studentId })
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(message: string, public code?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 提交答案
 * 
 * @param data - 答题数据，包含答案和题目信息
 * @param wenId - 课文ID
 * @param studentId - 学生ID（学号）
 * @param studentName - 学生姓名（可选）
 * @param timeout - 请求超时时间
 */
export async function submitAnswers(
  data: {
    answers: Record<string, string | number | (string | number)[]>
    questions: Array<{ id: string; correctAnswer: string | number | (string | number)[] }>
  },
  wenId: string,
  studentId: string,
  studentName?: string,
  timeout?: number
): Promise<{
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
    details: Array<{ questionId: string; score: number; isCorrect: number; attemptNumber: number }>
  }
}> {
  try {
    // 生成当前时间戳（ISO格式），确保每次答题都有唯一时间记录
    const submittedAt = new Date().toISOString()
    
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authStoreRef?.token ? { Authorization: `Bearer ${authStoreRef.token}` } : {})
      },
      body: JSON.stringify({
        ...data,
        wenId,
        studentId,
        studentName,
        submittedAt  // 每次答题都携带时间戳
      }),
      signal: timeout ? AbortSignal.timeout(timeout) : undefined
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new ApiError(errorData?.message || '提交失败', response.status)
    }
    
    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ApiError('请求超时')
    }
    throw err
  }
}