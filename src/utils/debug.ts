/**
 * 调试日志工具
 * 
 * 功能说明：
 * - 基于环境变量的条件日志输出
 * - 仅在开发环境输出调试信息
 * - 生产环境自动禁用日志输出
 * 
 * 使用示例：
 * import { debugLog, debugError, debugWarn } from '@/utils/debug'
 * 
 * debugLog('[Component] 初始化完成')
 * debugError('[Component] 加载失败', error)
 * debugWarn('[Component] 性能警告')
 */

const isDev = import.meta.env.DEV

/**
 * 调试日志（仅开发环境输出）
 */
export function debugLog(...args: unknown[]) {
  if (isDev) {
    console.log(...args)
  }
}

/**
 * 调试错误日志（仅开发环境输出）
 */
export function debugError(...args: unknown[]) {
  if (isDev) {
    console.error(...args)
  }
}

/**
 * 调试警告日志（仅开发环境输出）
 */
export function debugWarn(...args: unknown[]) {
  if (isDev) {
    console.warn(...args)
  }
}

/**
 * 调试信息日志（仅开发环境输出）
 */
export function debugInfo(...args: unknown[]) {
  if (isDev) {
    console.info(...args)
  }
}

/**
 * 调试分组日志（仅开发环境输出）
 */
export function debugGroup(label: string) {
  if (isDev) {
    console.group(label)
  }
}

/**
 * 结束调试分组（仅开发环境输出）
 */
export function debugGroupEnd() {
  if (isDev) {
    console.groupEnd()
  }
}
