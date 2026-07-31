import { ref, onUnmounted, watch } from 'vue'
import { debugLog } from '@/utils/debug'

// Worker 超时时间（毫秒）
const WORKER_TIMEOUT = 5000
// Worker 空闲回收延迟：所有 useDataLoader 实例卸载后若超过此时间无新任务，自动 terminate
const WORKER_IDLE_GC_DELAY = 10_000

// 模块级 LRU 缓存配置
const MAX_CACHE_SIZE = 100
const DEFAULT_CACHE_TTL = 5 * 60 * 1000 // 默认5分钟
// 缓存过期清理节流间隔：避免每次 get/set 都遍历整张 Map
const EXPIRED_CACHE_CLEANUP_INTERVAL = 60 * 1000

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
let lastExpiredCleanupAt = 0

/**
 * A08: 按 TTL 主动清理所有已过期的缓存条目
 * - 节流：避免高频场景下每次 get/set 都 O(N) 遍历
 */
function clearExpiredCacheIfNeeded(): void {
  const now = Date.now()
  if (now - lastExpiredCleanupAt < EXPIRED_CACHE_CLEANUP_INTERVAL) return
  lastExpiredCleanupAt = now

  let removed = 0
  for (const [key, entry] of cacheMap) {
    if (now - entry.timestamp > DEFAULT_CACHE_TTL) {
      cacheMap.delete(key)
      removed++
    } else {
      // 未过期：按当前设计 LRU 的 ttl 可能不同，因此需要遍历整张表；
      // 实际应用中 entries 通常 100 以内，可接受。
    }
  }
  if (removed > 0) {
    debugLog(`[useDataLoader] 已清理 ${removed} 条过期缓存`)
  }
}

/**
 * 获取缓存数据
 * - 命中未过期：移动到"最新"位置后返回数据
 * - 命中但过期：删除并返回 null
 */
function getCachedData<T>(key: string, ttl: number): T | null {
  clearExpiredCacheIfNeeded()
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
  clearExpiredCacheIfNeeded()
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

// Worker 实例缓存 + 活跃消费者管理
let jsonParserWorker: Worker | null = null
let activeConsumerCount = 0
let workerIdleGcTimer: ReturnType<typeof setTimeout> | null = null
let runningJsonTaskCount = 0

/**
 * 取消"空闲 Worker 自动终止"定时器（当有新任务或新消费者进入时）
 */
function cancelWorkerIdleGc(): void {
  if (workerIdleGcTimer) {
    clearTimeout(workerIdleGcTimer)
    workerIdleGcTimer = null
  }
}

/**
 * A08: 活跃消费者数变为 0 且没有运行中的 JSON 解析任务时，
 * 延迟 WORKER_IDLE_GC_DELAY 毫秒后自动 terminate Worker，避免常驻内存。
 * 若延迟期间有新任务/新消费者进入，定时器会被 cancelWorkerIdleGc() 取消。
 */
function scheduleWorkerIdleGcIfNeeded(): void {
  if (jsonParserWorker === null) return
  if (workerIdleGcTimer !== null) return
  if (activeConsumerCount > 0 || runningJsonTaskCount > 0) return

  workerIdleGcTimer = setTimeout(() => {
    workerIdleGcTimer = null
    if (
      jsonParserWorker !== null &&
      activeConsumerCount === 0 &&
      runningJsonTaskCount === 0
    ) {
      terminateJsonParserWorker()
    }
  }, WORKER_IDLE_GC_DELAY)
}

/**
 * A08: 注册/注销 useDataLoader 消费者；
 * - 注册时 cancel idle GC，避免立即终止
 * - 注销时若计数归零，重新调度 idle GC
 */
function registerWorkerConsumer(): void {
  cancelWorkerIdleGc()
  activeConsumerCount++
}
function unregisterWorkerConsumer(): void {
  if (activeConsumerCount > 0) activeConsumerCount--
  scheduleWorkerIdleGcIfNeeded()
}

/**
 * 获取共享的 JSON 解析 Worker
 * - 按需新建
 * - 注册消费者时会取消 idle GC 定时器
 */
function getJsonParserWorker(): Worker {
  cancelWorkerIdleGc()
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
    cancelWorkerIdleGc()
    const worker = getJsonParserWorker()
    // 任务计数：若 GC 定时器正在等待且当前计数 > 0，则不应回收
    runningJsonTaskCount++
    const taskId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Date.now() + Math.random()

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let resolved = false

    const finalize = () => {
      if (resolved) return
      resolved = true
      if (timeoutId) clearTimeout(timeoutId)
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      runningJsonTaskCount--
      scheduleWorkerIdleGcIfNeeded()
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data.id === taskId) {
        if (e.data.success) {
          resolve(e.data.data)
        } else {
          reject(new Error(e.data.error || 'JSON 解析失败'))
        }
        finalize()
      }
    }

    const handleError = (err: ErrorEvent) => {
      reject(new Error(err.message || 'Worker 执行错误'))
      finalize()
    }

    timeoutId = setTimeout(() => {
      reject(new Error(`JSON 解析超时 (${timeout}ms)`))
      finalize()
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
  // A08: Worker 消费者计数：每个 useDataLoader 实例都是一个潜在消费者
  let workerConsumerRegistered = false

  /**
   * A08: 确保 worker 消费者已注册（使用到 Worker 能力时注册，避免未用的实例也计数）
   */
  function ensureWorkerConsumerRegistered() {
    if (workerConsumerRegistered) return
    registerWorkerConsumer()
    workerConsumerRegistered = true
  }

  function cancelPendingRetry() {
    if (pendingRetryTimer) {
      clearTimeout(pendingRetryTimer)
      pendingRetryTimer = null
    }
  }

  async function load() {
    const url = urlGetter()
    debugLog('[useDataLoader] 开始加载:', url)

    // 阶段 1：前置检查（URL 为空、缓存命中）—— 命中则直接 return
    if (!prepareLoadWithEarlyReturn(url)) {
      return
    }

    const startTime = Date.now()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    // 阶段 2：执行请求 + 解析 + 转换 + 写缓存
    try {
      timeoutId = setTimeout(() => {
        debugLog('[useDataLoader] 请求超时触发')
        abortController?.abort(TIMEOUT_ABORT_REASON)
      }, timeout)

      await executeLoad(url)
      clearTimeout(timeoutId)
      debugLog(`[useDataLoader] 请求完成，耗时: ${Date.now() - startTime}ms`)

      // 阶段 3：成功回调与状态清理
      loading.value = false
      // R20: 请求成功路径务必重置 retryAttempts
      retryAttempts = 0
      onLoadSuccess?.(data.value!)
    } catch (err) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      cancelPendingRetry()
      handleLoadError(err, startTime)
    }
  }

  /**
   * A07: 加载前置检查（URL 校验 + 查缓存 + 取消上一次 + 初始化状态）
   *
   * @returns true 表示需要继续走网络请求；false 表示已通过缓存或 URL 校验短路返回
   */
  function prepareLoadWithEarlyReturn(url: string): boolean {
    if (!url) {
      error.value = '请提供有效的URL'
      loading.value = false
      debugLog('[useDataLoader] URL 为空')
      onLoadError?.(error.value)
      return false
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
        return false
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
    return true
  }

  /**
   * A07: 执行"网络请求 + 解析 + 转换 + 写缓存"链路
   * - 不处理错误、不清理状态：错误交给 load() 的 catch → handleLoadError()
   */
  async function executeLoad(url: string): Promise<void> {
    if (!abortController) {
      throw new Error('内部错误：缺少 AbortController')
    }
    // 使用到 Worker 能力时登记消费者，卸载时才会触发 idle GC
    ensureWorkerConsumerRegistered()
    const parsed = await fetchAndParse(url, abortController)
    data.value = transform ? transform(parsed) : (parsed as T)

    if (cacheEnabled) {
      setCachedData(url, data.value)
    }
  }


  /**
   * R84: fetch + 解析 JSON（从 load 拆分，保持单一职责）
   * R19: 超时使用特定 reason abort，便于和"主动取消"区分
   */
  async function fetchAndParse(url: string, controller: AbortController): Promise<unknown> {
    debugLog('[useDataLoader] 发起请求:', url)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    // 使用 arrayBuffer + TextDecoder 防乱码
    const buffer = await response.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(buffer)

    // Worker 解析 JSON（失败抛错，外层 catch 统一处理）
    return parseJsonWithWorker(text)
  }

  /**
   * R84: 错误处理 + 重试调度（从 load 拆分）
   */
  function handleLoadError(err: unknown, startTime: number): void {
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
      const backoff = Math.min(Math.pow(2, retryAttempts) * 1000, 10000)
      debugLog(`[useDataLoader] 第 ${retryAttempts} 次重试，等待 ${backoff}ms...`)
      pendingRetryTimer = setTimeout(() => load(), backoff)
      return
    }

    loading.value = false
    retryAttempts = 0
    onLoadError?.(error.value!)
  }

  function retry() {
    retryAttempts = 0
    load()
  }

  // 组件卸载时取消请求 + 取消尚未触发的重试 + 注销 Worker 消费者
  onUnmounted(() => {
    cancelPendingRetry()
    if (abortController) {
      abortController.abort()
    }
    if (workerConsumerRegistered) {
      unregisterWorkerConsumer()
      workerConsumerRegistered = false
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
