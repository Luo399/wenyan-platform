/**
 * useAiChat - AI 对话 Composable
 *
 * 功能说明：
 * - 管理 AI 对话的消息列表、发送状态、配额缓存
 * - 封装 /api/ai/chat 与 /api/ai/quota 请求
 * - 统一处理 401/429/502 等错误码
 *
 * 使用方式：
 * ```ts
 * const state = ref<'idle' | 'loading' | 'error'>('idle')
 * const { state, messages, quota, sendMessage, refreshQuota } = useAiChat(
 *   computed(() => wenId),
 *   computed(() => article),
 * )
 * ```
 */

import { ref, type Ref } from 'vue'
import { post, get, ApiError } from '@/utils/api'
import { debugWarn } from '@/utils/debug'

export type ChatState = 'idle' | 'loading' | 'error'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ArticleInfo {
  title: string
  author?: string
  dynasty?: string
  content?: string
}

export interface AiQuotaBucket {
  used: number
  limit: number
  resetAt?: string
}

export interface AiQuota {
  daily: AiQuotaBucket
  weekly: AiQuotaBucket
  monthly: AiQuotaBucket
}

interface SendBody {
  wenId: string
  article?: ArticleInfo
  messages: ChatMessage[]
}

export interface AiChatOptions {
  wenId: Ref<string>
  article: Ref<ArticleInfo>
}

const MAX_CONTENT_LENGTH = 2000

/**
 * 把状态码翻译成面向用户的错误提示
 */
function humanizeError(status: number, code: string): string {
  if (status === 401) return '登录已过期，请重新登录'
  if (status === 429) return '今日配额已用尽，请明日再试'
  if (status === 502 || status === 503) return 'AI 服务暂时不可用，请稍后再试'
  if (status === 0) return '网络异常，请检查连接'
  return 'AI 服务请求失败，请稍后再试'
}

export function useAiChat(options: AiChatOptions) {
  const state = ref<ChatState>('idle')
  const messages = ref<ChatMessage[]>([])
  const quota = ref<AiQuota | null>(null)
  const errorMessage = ref<string>('')

  /**
   * 发送消息前的前置校验
   */
  function validateContent(content: string): string | null {
    const trimmed = content.trim()
    if (!trimmed) return '请输入内容后再发送'
    if (trimmed.length > MAX_CONTENT_LENGTH) return `内容过长（${trimmed.length}），请控制在 ${MAX_CONTENT_LENGTH} 字以内`
    return null
  }

  async function refreshQuota(): Promise<void> {
    try {
      const res = await get<AiQuota>('/api/ai/quota')
      if (res.success && res.data) {
        quota.value = res.data
      }
    } catch {
      // 配额刷新失败静默忽略，不要打断用户对话
      debugWarn('[useAiChat] refreshQuota failed')
    }
  }

  async function sendMessage(content: string): Promise<void> {
    const validationError = validateContent(content)
    if (validationError) {
      state.value = 'error'
      errorMessage.value = validationError
      return
    }

    const nextMessage: ChatMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }

    // 乐观更新：先 push 用户消息 + 进入 loading
    const beforeCount = messages.value.length
    messages.value = [...messages.value, nextMessage]
    state.value = 'loading'
    errorMessage.value = ''

    const body: SendBody = {
      wenId: options.wenId.value,
      article: options.article.value,
      messages: messages.value,
    }

    try {
      const res = await post<{
        reply: string
        quota?: AiQuota
      }>('/api/ai/chat', body)

      if (!res.success || !res.data) {
        throw new ApiError(500, 'EMPTY_REPLY', res.message || 'AI 未返回有效内容')
      }

      messages.value = [
        ...messages.value,
        {
          role: 'assistant',
          content: res.data.reply,
          timestamp: Date.now(),
        },
      ]

      if (res.data.quota) {
        quota.value = res.data.quota as AiQuota
      } else {
        // 否则静默刷新一次
        void refreshQuota()
      }

      state.value = 'idle'
    } catch (err) {
      // 回滚最后一条用户消息，让 UI 干净
      messages.value = messages.value.slice(0, beforeCount)

      let msg: string
      if (err instanceof ApiError) {
        msg = humanizeError(err.status, err.errorCode)
      } else if (err instanceof Error) {
        msg = err.message || '请求失败'
      } else {
        msg = '请求失败，请稍后再试'
      }

      errorMessage.value = msg
      state.value = 'error'
      debugWarn('[useAiChat] sendMessage error:', msg)
    }
  }

  return {
    state,
    messages,
    quota,
    errorMessage,
    sendMessage,
    refreshQuota,
  }
}
