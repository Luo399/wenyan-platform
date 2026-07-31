/**
 * 时间处理工具（A04 统一层）
 *
 * 统一管理：
 *  - 字符串 "HH:MM:SS" / "MM:SS" → 秒数
 *  - 时间范围 "HH:MM:SS-HH:MM:SS" → {start, end} 或 [start, end] 元组
 *  - 秒数 → "HH:MM:SS" / "MM:SS" 展示字符串
 *
 * 原分散位置：
 *  - adapterUtils.parseTimeToSeconds / parseTimeRange（返回对象）
 *  - multiPoleAdapter.timeToSeconds / parseTimeRange（返回元组）
 *  - MultiRoleReading.vue 本地 parseTimeRange（返回对象）
 */

import { debugWarn } from './debug'

/**
 * 解析 "HH:MM:SS" / "MM:SS" / "SS" → 秒数
 * - 支持纯数字单段（兼容 "123.45" 样式纯秒字符串，MultiRoleReading 原 parseTime 语义）
 * - 别名 timeToSeconds 保持与旧 multiPoleAdapter 兼容
 */
export function parseTimeToSeconds(timeStr: string | null | undefined): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0
  }
  const normalized = timeStr.trim()
  if (!normalized) return 0
  const parts = normalized.split(':').map(Number)
  if (parts.length === 1) {
    // 单段：视为纯秒数（允许带小数，例如 "123.45"）
    const s = parts[0]
    return Number.isFinite(s) ? s! : 0
  }
  if (parts.length < 2 || parts.length > 3 || parts.some(isNaN)) {
    debugWarn(`[timeUtils] 无效的时间格式: ${timeStr}`)
    return 0
  }
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
  }
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

// 别名，兼容 multiPoleAdapter 中的命名
export const timeToSeconds = parseTimeToSeconds

/**
 * 秒数 → 展示字符串：秒 < 3600 时 "MM:SS"，否则 "HH:MM:SS"
 * - 可通过 forceHours 强制带小时（用于对其展示）
 */
export function parseSecondsToTime(
  seconds: number,
  options: { forceHours?: boolean } = {},
): string {
  const { forceHours = false } = options
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const secs = Math.floor(seconds)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0 || forceHours) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

/**
 * 解析时间范围字符串 → 对象形式 { start, end }
 * - 兼容 adapterUtils / MultiRoleReading.vue 的返回类型
 */
export function parseTimeRangeAsObject(timeRange: string | null | undefined): {
  start: number
  end: number
} {
  if (!timeRange || typeof timeRange !== 'string') {
    return { start: 0, end: 0 }
  }
  const [startStr, endStr] = timeRange.split('-')
  return {
    start: parseTimeToSeconds(startStr ?? ''),
    end: parseTimeToSeconds(endStr ?? ''),
  }
}

/**
 * 解析时间范围字符串 → 元组形式 [start, end]
 * - 兼容 multiPoleAdapter 的返回类型
 */
export function parseTimeRangeAsTuple(timeRange: string | null | undefined): [number, number] {
  if (!timeRange || typeof timeRange !== 'string') {
    return [0, 0]
  }
  const [startStr, endStr] = timeRange.split('-')
  return [parseTimeToSeconds(startStr ?? ''), parseTimeToSeconds(endStr ?? '')]
}

/**
 * 兼容旧导入的默认 parseTimeRange 导出（保持返回对象，与 adapterUtils 历史用法一致）
 * - 需要元组形式时显式使用 parseTimeRangeAsTuple
 */
export function parseTimeRange(timeRange: string | null | undefined): {
  start: number
  end: number
} {
  return parseTimeRangeAsObject(timeRange)
}
