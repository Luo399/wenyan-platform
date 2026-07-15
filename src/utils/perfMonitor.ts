/**
 * 性能监控工具
 *
 * 功能说明：
 * - 监控组件渲染性能
 * - 记录数据加载时间
 * - 检测内存泄漏风险
 *
 * 使用示例：
 * const monitor = createPerfMonitor('WordList')
 * monitor.start('dataLoad')
 * await loadData()
 * monitor.end('dataLoad')
 */

interface PerfRecord {
  name: string
  startTime: number
  endTime?: number
  duration?: number
}

export function createPerfMonitor(componentName: string) {
  const records = new Map<string, PerfRecord>()

  function start(name: string) {
    const key = `${componentName}:${name}`
    records.set(key, {
      name,
      startTime: performance.now(),
    })
    console.log(`[${componentName}] ⏱️ 开始 ${name}`)
  }

  function end(name: string) {
    const key = `${componentName}:${name}`
    const record = records.get(key)
    if (!record) {
      console.warn(`[${componentName}] ⚠️ 未找到性能记录: ${name}`)
      return
    }

    record.endTime = performance.now()
    record.duration = record.endTime - record.startTime

    console.log(`[${componentName}] ✅ 完成 ${name}, 耗时: ${record.duration.toFixed(2)}ms`)

    // 性能警告
    if (record.duration > 1000) {
      console.warn(`[${componentName}] ⚠️ 性能警告: ${name} 耗时超过1秒`)
    }
  }

  function getRecords() {
    return Array.from(records.values())
  }

  function getAverageTime(name: string) {
    const filtered = Array.from(records.values()).filter((r) => r.name === name)
    if (filtered.length === 0) return 0

    const total = filtered.reduce((sum, r) => sum + (r.duration || 0), 0)
    return total / filtered.length
  }

  function clear() {
    records.clear()
  }

  return {
    start,
    end,
    getRecords,
    getAverageTime,
    clear,
  }
}

/**
 * 内存监控工具
 */
export function checkMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
    const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2)
    const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)

    console.log(`📊 内存使用情况:
      已用: ${usedMB}MB
      总计: ${totalMB}MB
      限制: ${limitMB}MB
      使用率: ${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2)}%
    `)

    // 内存警告
    if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
      console.warn('⚠️ 内存使用率超过80%，可能存在内存泄漏')
    }
  }
}

/**
 * 组件渲染性能监控装饰器
 */
export function withPerfMonitor<T extends (...args: any[]) => any>(
  componentName: string,
  fn: T,
): T {
  return ((...args: any[]) => {
    const startTime = performance.now()
    const result = fn(...args)
    const endTime = performance.now()
    const duration = endTime - startTime

    console.log(`[${componentName}] ⏱️ 执行耗时: ${duration.toFixed(2)}ms`)

    if (duration > 16) {
      console.warn(`[${componentName}] ⚠️ 执行时间超过一帧(16ms)，可能影响性能`)
    }

    return result
  }) as T
}
