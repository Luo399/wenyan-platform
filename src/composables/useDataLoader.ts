import { ref, onUnmounted, watch } from 'vue'
import { debugLog, debugError } from '@/utils/debug'

interface UseDataLoaderOptions<T> {
  autoLoad?: boolean
  timeout?: number
  retryCount?: number
  cacheEnabled?: boolean
  onLoadSuccess?: (data: T) => void
  onLoadError?: (error: string) => void
}

export function useDataLoader<T>(urlGetter: () => string, options: UseDataLoaderOptions<T> = {}) {
  const {
    autoLoad = true,
    timeout = 10000,
    retryCount = 1,
    cacheEnabled = false,
    onLoadSuccess,
    onLoadError,
  } = options

  const loading = ref(false)
  const error = ref<string | null>(null)
  const isTimeout = ref(false)
  const data = ref<T | null>(null)

  let abortController: AbortController | null = null
  let retryAttempts = 0
  const cache = new Map<string, T>()

  async function load() {
    const url = urlGetter()
    if (!url) {
      error.value = '请提供有效的URL'
      loading.value = false
      onLoadError?.(error.value)
      return
    }

    // 检查缓存
    if (cacheEnabled && cache.has(url)) {
      data.value = cache.get(url)!
      loading.value = false
      onLoadSuccess?.(data.value)
      return
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
        abortController?.abort()
      }, timeout)

      debugLog(`[useDataLoader] 🌐 发起请求: ${url}`)

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
      data.value = JSON.parse(text)

      // 存入缓存
      if (cacheEnabled) {
        cache.set(url, data.value)
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
        debugLog(`[useDataLoader] ⏰ 请求超时，耗时: ${duration}ms`)
      } else {
        error.value = err instanceof Error ? err.message : '加载失败'
        debugError(`[useDataLoader] ❌ 请求失败: ${error.value}`)
      }

      // 自动重试
      if (!isTimeout.value && retryAttempts < retryCount) {
        retryAttempts++
        debugLog(`[useDataLoader] 🔄 第 ${retryAttempts} 次重试...`)
        setTimeout(() => load(), 1000)
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
