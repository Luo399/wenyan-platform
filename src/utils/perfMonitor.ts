/**
 * 性能监控工具 - 用于检测函数执行超时

 * 使用方法：
 * ```ts
 * const perfMonitor = createPerfMonitor(5000) // 5秒超时
 *
 * async function mySlowFunction() {
 *   const end = perfMonitor.start('mySlowFunction')
 *   try {
 *     // ... 执行逻辑
 *   } finally {
 *     end()
 *   }
 * }
 * ```
 */

// 超时阈值配置（毫秒）
const DEFAULT_TIMEOUT = 5000 // 5秒

// 存储正在执行的函数
const runningFunctions = new Map<string, number>()

/**
 * 创建性能监控器
 */
export function createPerfMonitor(timeout: number = DEFAULT_TIMEOUT) {
  /**
   * 开始计时
   * @param name 函数名称
   * @returns 结束函数，调用后停止计时
   */
  function start(name: string): () => void {
    const startTime = performance.now()
    runningFunctions.set(name, startTime)

    console.debug(`[Perf] ▶️ 开始: ${name}`)

    // 设置超时检测
    const timeoutId = setTimeout(() => {
      if (runningFunctions.has(name)) {
        console.error(`[Perf] ⏰ 超时警告: ${name} 执行超过 ${timeout}ms`)
        console.error(`[Perf] 💡 可能原因:`)
        console.error(`  1. 网络请求卡住或超时`)
        console.error(`  2. 大量数据处理阻塞主线程`)
        console.error(`  3. 无限循环或死循环`)
        console.error(`  4. 第三方库阻塞`)
      }
    }, timeout)

    return () => {
      clearTimeout(timeoutId)
      const duration = performance.now() - startTime
      runningFunctions.delete(name)

      if (duration > timeout) {
        console.warn(`[Perf] ⚠️ 慢函数: ${name} 执行耗时 ${duration.toFixed(2)}ms`)
      } else {
        console.debug(`[Perf] ⏹️ 结束: ${name} (${duration.toFixed(2)}ms)`)
      }
    }
  }

  /**
   * 异步包装器 - 自动计时和错误处理
   */
  async function track<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const end = start(name)
    try {
      const result = await fn()
      return result
    } catch (error) {
      console.error(`[Perf] ❌ 错误: ${name}`, error)
      throw error
    } finally {
      end()
    }
  }

  return { start, track }
}

// 默认性能监控器
export const perfMonitor = createPerfMonitor()

/**
 * 检测当前正在执行的函数
 */
export function getRunningFunctions(): string[] {
  return Array.from(runningFunctions.keys())
}

/**
 * 检查是否有函数正在执行
 */
export function hasRunningFunctions(): boolean {
  return runningFunctions.size > 0
}
