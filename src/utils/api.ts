/**
 * API 工具函数
 * 
 * 功能说明：
 * - 封装 API 请求方法
 * - 统一处理请求配置和错误
 * - 支持超时处理
 * - 支持 HMAC 签名鉴权
 */

/** API 基础地址，从环境变量读取 */
export const apiBase = import.meta.env.VITE_API_BASE_URL as string

/** 鉴权密钥（从环境变量读取，用于 HMAC 签名） */
const authSecret = import.meta.env.VITE_AUTH_SECRET as string | undefined

/** 是否启用签名鉴权 */
const authEnabled = !!authSecret && authSecret.length > 0

/**
 * 生成 HMAC 签名（异步）
 * 
 * @param studentId - 学号
 * @param timestamp - 时间戳（ISO 格式）
 * @returns Promise<string> HMAC 签名
 */
async function generateHmacSignature(studentId: string, timestamp: string): Promise<string> {
  if (!authSecret) {
    throw new Error('AUTH_SECRET 未配置')
  }
  
  const payload = `${studentId}:${timestamp}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(authSecret)
  const messageData = encoder.encode(payload)
  
  // 使用 Web Crypto API 生成 HMAC
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

/**
 * 提交答案 API
 * 
 * @param data - 提交的数据
 * @param timeout - 超时时间（毫秒），默认 30000ms
 * @returns Promise 响应结果
 */
export async function submitAnswers(
  data: SubmitAnswersRequest,
  timeout: number = 30000
): Promise<SubmitAnswersResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    // 如果启用鉴权，生成签名
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

    // 处理网络错误或超时
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', '请求超时')
    }

    throw new ApiError(0, 'NETWORK_ERROR', '网络连接失败')
  }
}

/**
 * API 错误类
 */
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

// ============================================================
// 类型定义
// ============================================================

/** 提交答案请求类型 */
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

/** 提交答案响应类型 */
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
}// 更新时间: Tue Jul 14 10:16:31 UTC 2026
