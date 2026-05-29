import { ref, onUnmounted, watch } from 'vue'
import { debugLog, debugError } from '@/utils/debug'

// 诊断日志函数 - 始终输出用于调试
function diagLog(...args: unknown[]) {
  console.log('[useDataLoader 诊断]', ...args)
}

// Worker 超时时间（毫秒）
const WORKER_TIMEOUT = 5000

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

    // 设置超时
    timeoutId = setTimeout(() => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      reject(new Error(`JSON 解析超时 (${timeout}ms)`))
    }, timeout)

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)

    // 发送解析任务
    worker.postMessage({ text, id: taskId })
    diagLog('[useDataLoader] Worker 解析任务已发送')
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
    cacheTTL = 5 * 60 * 1000, // 默认5分钟
    onLoadSuccess,
    onLoadError,
    transform, // 数据转换函数
  } = options

  const loading = ref(false)
  const error = ref<string | null>(null)
  const isTimeout = ref(false)
  const data = ref<T | null>(null)

  let abortController: AbortController | null = null
  let retryAttempts = 0
  interface CacheEntry {
    data: T
    timestamp: number
  }
  const cache = new Map<string, CacheEntry>()

  async function load() {
    const url = urlGetter()
    diagLog('🔍 开始加载:', url)

    if (!url) {
      error.value = '请提供有效的URL'
      loading.value = false
      diagLog('❌ URL为空')
      onLoadError?.(error.value)
      return
    }

    // 检查缓存
    if (cacheEnabled && cache.has(url)) {
      const cachedEntry = cache.get(url)!
      // 检查缓存是否过期
      if (Date.now() - cachedEntry.timestamp < cacheTTL) {
        data.value = cachedEntry.data
        loading.value = false
        diagLog('📦 从缓存获取数据')
        onLoadSuccess?.(data.value)
        return
      }
      // 缓存过期，删除
      cache.delete(url)
      diagLog('⏰ 缓存已过期，重新获取')
    }

    // 取消之前的请求
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
      timeoutId = setTimeout(() => {
        diagLog('⏰ 请求超时触发')
        abortController?.abort()
      }, timeout)

      diagLog('🌐 发起请求:', url)

      const response = await fetch(url, {
        signal: abortController.signal,
        headers: { Accept: 'application/json' },
      })

      clearTimeout(timeoutId)

      diagLog('📡 响应状态:', response.status, response.headers.get('content-type'))

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // 使用 arrayBuffer + TextDecoder 防乱码
      const buffer = await response.arrayBuffer()
      diagLog('📊 下载字节数:', buffer.byteLength)

      const text = new TextDecoder('utf-8').decode(buffer)
      diagLog('📝 解码后文本长度:', text.length, '前100字:', text.slice(0, 100))

      // 使用 Worker 线程解析 JSON
      try {
        const parsed = (await parseJsonWithWorker(text)) as unknown
        // 如果有转换函数，先进行数据转换
        data.value = transform ? transform(parsed) : (parsed as T)
        diagLog(
          '✅ JSON解析成功，数据类型:',
          typeof data.value,
          Array.isArray(data.value) ? `数组(${data.value.length}条)` : '',
        )
      } catch (parseErr) {
        throw new Error(
          `JSON解析失败: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        )
      }

      // 存入缓存
      if (cacheEnabled) {
        cache.set(url, { data: data.value, timestamp: Date.now() })
      }

      const duration = Date.now() - startTime
      debugLog(`[useDataLoader] ✅ 请求完成，耗时: ${duration}ms`)

      loading.value = false
      onLoadSuccess?.(data.value)
    } catch (err) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const duration = Date.now() - startTime

      if (err instanceof DOMException && err.name === 'AbortError') {
        isTimeout.value = true
        error.value = '请求超时'
        diagLog('⏰ 请求超时，耗时:', duration + 'ms')
      } else {
        error.value = err instanceof Error ? err.message : '加载失败'
        diagLog('❌ 请求失败:', error.value, err)
      }

      // 自动重试（指数退避）
      if (!isTimeout.value && retryAttempts < retryCount) {
        retryAttempts++
        const backoff = Math.min(Math.pow(2, retryAttempts) * 1000, 10000) // 指数退避，最大10秒
        debugLog(`[useDataLoader] 🔄 第 ${retryAttempts} 次重试，等待 ${backoff}ms...`)
        setTimeout(() => load(), backoff)
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

  // 组件卸载时取消请求
  onUnmounted(() => {
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

  // 自动加载
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
