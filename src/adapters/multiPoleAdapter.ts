/**
 * MultiRoleReading 数据适配器
 *
 * 负责将原始 JSON 数据转换为朗读组件直接可用的格式
 * 所有数据处理逻辑均为纯函数，无响应式副作用
 *
 * 核心原则：
 * - 原始数据类型（Raw）允许 null 值，反映真实数据状态
 * - 处理后的数据类型（Processed）不允许 null 值，提供类型安全边界
 * - 适配器统一填充默认值，组件无需处理空值逻辑
 *
 * 时间工具已统一在 @/utils/timeUtils：
 *  - parseTimeRangeAsTuple 返回 [start, end]（本文件原有返回类型）
 *  - timeToSeconds / parseSecondsToTime 已重导出
 */

import { parseTimeRangeAsTuple, timeToSeconds, parseSecondsToTime } from '@/utils/timeUtils'

// 原始数据接口（允许 null，与 JSON 结构一一对应）
export interface RawMultiRoleSegment {
  sentence_index: number | null
  time_range: string | null
  role_name: string | null
  dialogue: string | null
  // 预留字段，目前可能为 null
  role_icon?: string | null
  emotion?: string | null
  subtitle?: string | null
}

export interface RawMultiRoleData {
  text_id: string | null
  audio_file: string | null
  segments: RawMultiRoleSegment[] | null
  // 预留字段
  title?: string | null
  author?: string | null
  bgm_file?: string | null
}

// 处理后的数据接口（不含 null，给组件使用）
export interface ProcessedMultiRoleSegment {
  sentence_index: number // 默认 0
  time_range: string // 默认 "00:00-00:00"
  role_name: string // 默认 "未知角色"
  dialogue: string // 默认 ""
  startTime: number // 转换为秒数
  endTime: number // 转换为秒数
  duration: number // 持续时间（秒）
  role_icon: string // 默认 ""
  emotion: string // 默认 ""
  subtitle: string // 默认 ""
}

export interface ProcessedMultiRoleData {
  text_id: string // 默认 ""
  audio_file: string // 默认 ""
  segments: ProcessedMultiRoleSegment[] // 默认 []
  totalDuration: number // 总时长（秒）
  title: string // 默认 ""
  author: string // 默认 ""
  bgm_file: string // 默认 ""
}

/**
 * 主适配器函数：将原始数据转换为组件可用的格式
 * @param rawData - 原始 JSON 数据（允许 null）
 * @returns 处理后的数据对象（所有字段均有默认值，不含 null）
 */
export function adaptMultiRoleReading(rawData: RawMultiRoleData | null): ProcessedMultiRoleData {
  // null 值保护
  if (!rawData) {
    return {
      text_id: '',
      audio_file: '',
      segments: [],
      totalDuration: 0,
      title: '',
      author: '',
      bgm_file: '',
    }
  }

  // 处理片段数据（空数组保护）
  const segments = processSegments(rawData.segments ?? [])

  // 计算总时长
  const totalDuration = calculateTotalDuration(segments)

  // 统一填充默认值，确保组件永远不会遇到 null
  return {
    text_id: rawData.text_id ?? '',
    audio_file: rawData.audio_file ?? '',
    segments,
    totalDuration,
    title: rawData.title ?? '',
    author: rawData.author ?? '',
    bgm_file: rawData.bgm_file ?? '',
  }
}

/**
 * 处理片段数据：解析时间范围、计算派生字段、填充默认值
 */
function processSegments(rawSegments: RawMultiRoleSegment[]): ProcessedMultiRoleSegment[] {
  return rawSegments.map((segment) => {
    // 安全获取字段值，null 转为默认值
    const sentenceIndex = segment.sentence_index ?? 0
    const timeRange = segment.time_range ?? '00:00-00:00'
    const [start, end] = parseTimeRangeAsTuple(timeRange)

    return {
      sentence_index: sentenceIndex,
      time_range: timeRange,
      role_name: segment.role_name ?? '未知角色',
      dialogue: segment.dialogue ?? '',
      startTime: start,
      endTime: end,
      duration: end - start,
      role_icon: segment.role_icon ?? '',
      emotion: segment.emotion ?? '',
      subtitle: segment.subtitle ?? '',
    }
  })
}

// 旧本地 parseTimeRange / timeToSeconds / parseSecondsToTime
// 已统一到 @/utils/timeUtils：
//   - 元组返回：parseTimeRangeAsTuple
//   - 对象返回：parseTimeRange（from adapterUtils / timeUtils）
//   - 时间解析：timeToSeconds / parseTimeToSeconds
//   - 秒格式化：parseSecondsToTime
// 此处保留 parseTimeRange 的"本地别名"并指向 parseTimeRangeAsTuple，
// 避免外部已有 import 失效。
export const parseTimeRange = parseTimeRangeAsTuple
export { timeToSeconds, parseSecondsToTime }
/**
 * 将秒数格式化为时间字符串（格式："00:00"）
 * - 别名：parseSecondsToTime（统一在 timeUtils，支持 HH:MM:SS）
 * @param seconds - 秒数
 * @returns 格式化的时间字符串
 */
export function formatTime(seconds: number): string {
  return parseSecondsToTime(seconds)
}

/**
 * 计算总时长
 * @param segments - 处理后的片段数组
 * @returns 总时长（秒）
 */
function calculateTotalDuration(segments: ProcessedMultiRoleSegment[]): number {
  if (segments.length === 0) {
    return 0
  }

  const lastSegment = segments[segments.length - 1]
  return lastSegment ? lastSegment.endTime : 0
}

/**
 * 根据当前时间获取对应的片段索引
 * @param currentTime - 当前播放时间（秒）
 * @param segments - 处理后的片段数组
 * @returns 当前片段索引，未找到返回 -1
 */
export function getCurrentSegmentIndex(
  currentTime: number | null,
  segments: ProcessedMultiRoleSegment[] | null,
): number {
  // 空值检查
  if (currentTime == null || !segments || segments.length === 0) {
    return -1
  }

  // 处理 currentTime 早于第一个段落开始时间的情况
  const firstSeg = segments[0]
  if (firstSeg && currentTime < firstSeg.startTime) {
    return -1
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg && currentTime >= seg.startTime && currentTime < seg.endTime) {
      return i
    }
  }

  // currentTime >= 最后一个段落的开始时间（可能在播放中或已结束）
  return segments.length - 1
}
