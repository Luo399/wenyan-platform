/**
 * 适配器工具函数
 * 
 * 提供适配器层共用的工具函数，避免代码重复
 */

/**
 * HTML转义函数，防止XSS攻击
 * 
 * @param str - 需要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') {
    return ''
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 解析时间字符串为秒数
 * 
 * @param timeStr - 时间字符串，格式如 "00:12" 或 "1:30"
 * @returns 秒数，无效输入返回0
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0
  }
  
  const parts = timeStr.split(':').map(Number)
  
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    console.warn(`[adapterUtils] 无效的时间格式: ${timeStr}`)
    return 0
  }
  
  return parts[0] * 60 + parts[1]
}

/**
 * 解析时间范围字符串
 * 
 * @param timeRange - 时间范围字符串，格式如 "00:00-00:15"
 * @returns { start: number, end: number } - 起始和结束秒数
 */
export function parseTimeRange(timeRange: string): { start: number; end: number } {
  if (!timeRange || typeof timeRange !== 'string') {
    return { start: 0, end: 0 }
  }
  
  const [startStr, endStr] = timeRange.split('-')
  
  return {
    start: parseTimeToSeconds(startStr),
    end: parseTimeToSeconds(endStr)
  }
}

/**
 * 转义正则表达式特殊字符
 * 
 * @param str - 需要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')
}

/**
 * 构建带注释的HTML内容
 * 
 * @param content - 原始内容
 * @param annotations - 注释列表，格式: { word: string, meaning: string }[]
 * @returns 带注释的HTML字符串
 */
export function buildContentHtmlWithAnnotations(
  content: string,
  annotations: Array<{ word: string; meaning: string }>
): string {
  if (!content || !annotations || annotations.length === 0) {
    return escapeHtml(content || '')
  }
  
  let result = content
  
  // 按长度排序，优先替换长词
  const sortedAnnotations = [...annotations].sort((a, b) => b.word.length - a.word.length)
  
  for (const item of sortedAnnotations) {
    // 先转义正则特殊字符（用于正则匹配），再转义HTML（用于输出）
    const escapedRegex = escapeRegex(item.word)
    const escapedWord = escapeHtml(item.word)
    const escapedMeaning = escapeHtml(item.meaning)
    const replacement = `<span class="annotated-word" data-def="${escapedMeaning}">${escapedWord}</span>`
    result = result.replace(new RegExp(escapedRegex, 'g'), replacement)
  }
  
  return result
}

/**
 * 安全获取对象属性，避免undefined访问
 * 
 * @param obj - 对象
 * @param key - 属性名
 * @param defaultValue - 默认值
 * @returns 属性值或默认值
 */
export function getSafe<T>(obj: unknown, key: string, defaultValue: T): T {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, T>)[key]
  }
  return defaultValue
}
