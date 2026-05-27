/**
 * MultiRoleReading 数据适配器
 *
 * 负责将原始 JSON 数据转换为朗读组件直接可用的格式
 */

// 原始数据接口
export interface RawMultiRoleSegment {
  sentence_index: number
  time_range: string
  role_name: string
  dialogue: string
}

export interface RawMultiRoleData {
  text_id: string
  audio_file: string
  segments: RawMultiRoleSegment[]
}

// 处理后的数据接口
export interface ProcessedMultiRoleSegment extends RawMultiRoleSegment {
  startTime: number // 转换为秒数
  endTime: number // 转换为秒数
  duration: number // 持续时间（秒）
  isPlaying: boolean // 是否正在播放
}

export interface ProcessedMultiRoleData extends RawMultiRoleData {
  segments: ProcessedMultiRoleSegment[]
  totalDuration: number // 总时长（秒）
}

/**
 * 主适配器函数：将原始数据转换为组件可用的格式
 */
export function adaptMultiRoleReading(rawData: RawMultiRoleData): ProcessedMultiRoleData {
  // 处理片段数据
  const segments = processSegments(rawData.segments)

  // 计算总时长
  const totalDuration = calculateTotalDuration(segments)

  return {
    ...rawData,
    segments,
    totalDuration,
  }
}

/**
 * 处理片段数据：解析时间范围、计算派生字段
 */
function processSegments(rawSegments: RawMultiRoleSegment[]): ProcessedMultiRoleSegment[] {
  return rawSegments.map((segment) => {
    const [start, end] = parseTimeRange(segment.time_range)
    return {
      ...segment,
      startTime: start,
      endTime: end,
      duration: end - start,
      isPlaying: false,
    }
  })
}

/**
 * 解析时间范围字符串（格式："00:00-00:16"）
 */
function parseTimeRange(timeRange: string): [number, number] {
  const parts = timeRange.split('-')
  if (parts.length !== 2) {
    return [0, 0]
  }

  const startPart = parts[0]?.trim() || '0:00'
  const endPart = parts[1]?.trim() || '0:00'

  const start = timeToSeconds(startPart)
  const end = timeToSeconds(endPart)

  return [start, end]
}

/**
 * 将时间字符串转换为秒数（格式："00:00"）
 */
function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 2) {
    return 0
  }

  const minuteStr = parts[0] || '0'
  const secondStr = parts[1] || '0'

  const minutes = parseInt(minuteStr, 10) || 0
  const seconds = parseInt(secondStr, 10) || 0

  return minutes * 60 + seconds
}

/**
 * 计算总时长
 */
function calculateTotalDuration(segments: ProcessedMultiRoleSegment[]): number {
  if (segments.length === 0) {
    return 0
  }

  const lastSegment = segments[segments.length - 1]
  return lastSegment ? lastSegment.endTime : 0
}
