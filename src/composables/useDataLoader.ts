import { ref, onUnmounted, watch } from 'vue'
import { debugLog } from '@/utils/debug'

// Worker 超时时间（毫秒）
const WORKER_TIMEOUT = 5000

// 模块级 LRU 缓存配置
const MAX_CACHE_SIZE = 100
const DEFAULT_CACHE_TTL = 5 * 60 * 1000 // 默认5分钟

interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
}

/**
 * R19: AbortReason 常量
 * 用于区分"超时触发的 abort"和"主动取消（切 URL / 卸载组件 / retry）"。
 * 只有超时才设置 isTimeout=true，其他 abort 静默处理（不弹"请求超时"）。
 */
const TIMEOUT_ABORT_REASON = 'use-data-loader-timeout' as const

// ============================================================
// R18: 基于 Map 插入顺序的 O(1) LRU
//   - Map.keys() 的第一个元素 = 最旧（最早插入且最近未再访问）
//   - 访问命中时：delete(key) + set(key, entry) 把条目移到"最新"位置
//   - 淘汰：Map.size >= MAX_CACHE_SIZE 时 delete keys().next().value
//   - 移除原先的 cacheAccessOrder 数组（indexOf+splice 每次 O(n)）
// ============================================================
const cacheMap = new Map<string, CacheEntry>()

/**
 * 获取缓存数据
 * - 命中未过期：移动到"最新"位置后返回数据
 * - 命中但过期：删除并返回 null
 */
function getCachedData<T>(key: string, ttl: number): T | null {
  const entry = cacheMap.get(key)
  if (!entry) return null

  if (Date.now() - entry.timestamp > ttl) {
    cacheMap.delete(key)
    return null
  }

  // LRU: 命中后"重新插入"把该条目更新为最新位置
  cacheMap.delete(key)
  cacheMap.set(key, entry)
  return entry.data as T
}

/**
 * 设置缓存数据
 * - 超出容量时，丢弃 Map.keys() 返回的第一个（最旧）条目
 */
function setCachedData<T>(key: string, data: T): void {
  if (cacheMap.size >= MAX_CACHE_SIZE) {
    const oldestKey = cacheMap.keys().next().value
    if (oldestKey !== undefined) {
      cacheMap.delete(oldestKey)
    }
  }
  cacheMap.set(key, { data, timestamp: Date.now() })
}

/**
 * 清空数据缓存
 */
export function clearDataCache(): void {
  cacheMap.clear()
  debugLog('[useDataLoader] 数据缓存已清空')
}

// Worker 实例缓存
let jsonParserWorker: Worker | null = null

/**
 * 获取共享的 JSON 解析 Worker
 */
function getJsonParserWorker(): Worker {
  if (!jsonParserWorker) {
    jsonParserWorker = new Worker(new URL('../workers/jsonParser.worker.js', import.meta.url))
    debugLog('[useDataLoader] 创建新的 JSON Parser Worker')
  }
  return jsonParserWorker
}

/**
 * 使用 Worker 异步解析 JSON
 */
function parseJsonWithWorker(text: string, timeout = WORKER_TIMEOUT): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = getJsonParserWorker()
    const taskId = Date.now() + Math.random()

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const handleMessage = (e: MessageEvent) => {
      if (e.data.id === taskId) {
        clearTimeout(timeoutId)
        worker.removeEventListener('message', handleMessage)
        worker.removeEventListener('error', handleError)
        if (e.data.success) {
          resolve(e.data.data)
        } else {
          reject(new Error(e.data.error || 'JSON 解析失败'))
        }
      }
    }

    const handleError = (err: ErrorEvent) => {
      clearTimeout(timeoutId)
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      reject(new Error(err.message || 'Worker 执行错误'))
    }

    timeoutId = setTimeout(() => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      reject(new Error(`JSON 解析超时 (${timeout}ms)`))
    }, timeout)

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)

    worker.postMessage({ text, id: taskId })
  })
}

interface UseDataLoaderOptions<T> {
  autoLoad?: boolean
  timeout?: number
  retryCount?: number
  cacheEnabled?: boolean
  cacheTTL?: number // 缓存过期时间（毫秒），默认5分钟
  onLoadSuccess?: (data: T) => void
  onLoadError?: (error: string) => void
  transform?: (raw: unknown) => T // 数据转换函数
}

export function useDataLoader<T>(urlGetter: () => string, options: UseDataLoaderOptions<T> = {}) {
  const {
    autoLoad = true,
    timeout = 10000,
    retryCount = 1,
    cacheEnabled = false,
    cacheTTL = DEFAULT_CACHE_TTL,
    onLoadSuccess,
    onLoadError,
    transform,
  } = options

  const loading = ref(false)
  const error = ref<string | null>(null)
  const isTimeout = ref(false)
  const data = ref<T | null>(null)

  let abortController: AbortController | null = null
  let retryAttempts = 0
  // 记录重试 setTimeout 的 id，组件卸载或 URL 变化时取消未触发的重试
  let pendingRetryTimer: ReturnType<typeof setTimeout> | null = null

  function cancelPendingRetry() {
    if (pendingRetryTimer) {
      clearTimeout(pendingRetryTimer)
      pendingRetryTimer = null
    }
  }

  async function load() {
    const url = urlGetter()
    debugLog('[useDataLoader] 开始加载:', url)

    if (!url) {
      error.value = '请提供有效的URL'
      loading.value = false
      debugLog('[useDataLoader] URL 为空')
      onLoadError?.(error.value)
      return
    }

    // 命中缓存：直接返回，不再走请求链路
    if (cacheEnabled) {
      const cachedData = getCachedData<T>(url, cacheTTL)
      if (cachedData !== null) {
        data.value = cachedData
        loading.value = false
        debugLog('[useDataLoader] 从模块级缓存获取数据')
        // R20: 缓存命中也算"加载成功"，重置重试计数
        retryAttempts = 0
        onLoadSuccess?.(data.value)
        return
      }
    }

    // 先取消上一次请求及尚未触发的重试调度
    cancelPendingRetry()
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    loading.value = true
    error.value = null
    isTimeout.value = false

    const startTime = Date.now()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      // R19: 超时使用特定 reason abort，便于和"主动取消"区分
      timeoutId = setTimeout(() => {
        debugLog('[useDataLoader] 请求超时触发')
        abortController?.abort(TIMEOUT_ABORT_REASON)
      }, timeout)

      debugLog('[useDataLoader] 发起请求:', url)

      const response = await fetch(url, {
        signal: abortController.signal,
        headers: { Accept: 'application/json' },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // 使用 arrayBuffer + TextDecoder 防乱码
      const buffer = await response.arrayBuffer()
      const text = new TextDecoder('utf-8').decode(buffer)

      // Worker 解析 JSON（失败抛错，外层 catch 统一处理）
      const parsed = (await parseJsonWithWorker(text)) as unknown
      data.value = transform ? transform(parsed) : (parsed as T)

      if (cacheEnabled) {
        setCachedData(url, data.value)
      }

      const duration = Date.now() - startTime
      debugLog(`[useDataLoader] 请求完成，耗时: ${duration}ms`)

      loading.value = false
      // R20: 请求成功路径务必重置 retryAttempts，否则"失败→重试成功→再失败"将丢失一次重试机会
      retryAttempts = 0
      onLoadSuccess?.(data.value)
    } catch (err) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      cancelPendingRetry()

      const duration = Date.now() - startTime

      // R19: 区分是超时触发的 abort 还是主动取消
      if (err instanceof DOMException && err.name === 'AbortError') {
        const reason = abortController?.signal?.reason
        if (reason === TIMEOUT_ABORT_REASON) {
          isTimeout.value = true
          error.value = '请求超时'
          debugLog('[useDataLoader] 请求超时，耗时:', `${duration}ms`)
        } else {
          // 主动取消（切 URL / 卸载组件 / retry）：不打错误标记，不暴露给 UI
          debugLog('[useDataLoader] 请求被主动取消（切换URL或卸载组件）')
          loading.value = false
          return
        }
      } else {
        error.value = err instanceof Error ? err.message : '加载失败'
        debugLog('[useDataLoader] 请求失败:', error.value)
      }

      // 自动重试（仅非超时场景，且还有剩余重试次数）
      if (!isTimeout.value && retryAttempts < retryCount) {
        retryAttempts++
        const backoff = Math.min(Math.pow(2, retryAttempts) * 1000, 10000) // 指数退避，最大10秒
        debugLog(`[useDataLoader] 第 ${retryAttempts} 次重试，等待 ${backoff}ms...`)
        pendingRetryTimer = setTimeout(() => load(), backoff)
        return
      }

      loading.value = false
      retryAttempts = 0
      onLoadError?.(error.value!)
    }
  }

  function retry() {
    retryAttempts = 0
    load()
  }

  // 组件卸载时取消请求 + 取消尚未触发的重试
  onUnmounted(() => {
    cancelPendingRetry()
    if (abortController) {
      abortController.abort()
    }
  })

  // 监听 URL 变化自动重新加载
  watch(urlGetter, () => {
    if (autoLoad) {
      retryAttempts = 0
      load()
    }
  })

  if (autoLoad) {
    load()
  }

  return {
    loading,
    error,
    isTimeout,
    data,
    load,
    retry,
  }
}

/**
 * 清理 Worker 实例（可在应用退出时调用）
 */
export function terminateJsonParserWorker() {
  if (jsonParserWorker) {
    jsonParserWorker.terminate()
    jsonParserWorker = null
    debugLog('[useDataLoader] JSON Parser Worker 已终止')
  }
}
