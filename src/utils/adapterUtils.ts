/**
 * 适配器工具函数
 *
 * 提供适配器层共用的工具函数，避免代码重复
 * 时间相关函数（parseTime* / timeToSeconds / parseSecondsToTime）
 * 统一在 @/utils/timeUtils 维护，此处仅 re-export 保持兼容。
 */

import { debugWarn } from './debug'
import {
  parseTimeToSeconds,
  parseTimeRange,
  parseSecondsToTime,
  parseTimeRangeAsTuple,
  timeToSeconds,
} from './timeUtils'

export {
  parseTimeToSeconds,
  parseTimeRange,
  parseSecondsToTime,
  parseTimeRangeAsTuple,
  timeToSeconds,
}

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
 * 转义正则表达式特殊字符
 *
 * @param str - 需要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeRegex(str: string): string {
  if (!str || typeof str !== 'string') {
    return ''
  }
  return str.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')
}

/**
 * 构建 HTML：处理斜杠移除与换行 → <p>/<br> 转换（对已转义的原文安全）
 */
function wrapParagraphsWithSlashesRemoved(html: string, removeSlashes: boolean): string {
  let result = removeSlashes ? html.replace(/\//g, '') : html
  result = result.replace(/\n\n/g, '</p><p>')
  result = result.replace(/\n/g, '<br>')
  return `<p>${result}</p>`
}

/**
 * 构建带注释的HTML内容
 *
 * @param content - 原始内容
 * @param annotations - 注释列表，格式: { word: string, meaning: string }[]
 * @param options - 格式化选项：
 *   - removeSlashes: 是否移除原文中的斜杠符号（默认 false）
 *   - wrapParagraphs: 是否将换行转换为 <p>/<br> 包裹（默认 false）
 * @returns 带注释的HTML字符串
 */
export function buildContentHtmlWithAnnotations(
  content: string,
  annotations: Array<{ word: string; meaning: string }> | null | undefined,
  options: { removeSlashes?: boolean; wrapParagraphs?: boolean } = {},
): string {
  const { removeSlashes = false, wrapParagraphs = false } = options

  const hasAnnotations = annotations && annotations.length > 0

  if (!content) {
    return ''
  }

  // 统一规范化引号，避免弯引号/反引号导致匹配和显示问题
  const normalizedContent = normalizeQuotes(content)

  // 没有注释时：对原文做转义，再按选项做格式化
  if (!hasAnnotations) {
    const escaped = escapeHtml(normalizedContent)
    if (!wrapParagraphs) {
      // 仅需 removeSlashes 时（注意 escapeHtml 不会把 / 转义掉，可直接在 escaped 上操作）
      return removeSlashes ? escaped.replace(/\//g, '') : escaped
    }
    return wrapParagraphsWithSlashesRemoved(escaped, removeSlashes)
  }

  // 有注释时：先处理斜杠 → 占位符替换注释 → 转义输出 → 套段落格式
  let workingContent = removeSlashes ? normalizedContent.replace(/\//g, '') : normalizedContent

  const sortedAnnotations = [...annotations!].sort((a, b) => b.word.length - a.word.length)

  // 占位符策略：避免已注入的 span 被后续词汇匹配破坏
  const placeholderMap = new Map<string, { word: string; meaning: string }>()
  for (const item of sortedAnnotations) {
    const placeholder = `__ANNOTATION_${placeholderMap.size}__`
    placeholderMap.set(placeholder, item)
    workingContent = workingContent.split(item.word).join(placeholder)
  }

  // 先对基础内容做 HTML 转义，再把占位符换回带注释的 span（span 内部已自行转义）
  let result = escapeHtml(workingContent)
  for (const [placeholder, item] of placeholderMap) {
    const escapedWord = escapeHtml(item.word)
    const escapedMeaning = escapeHtml(item.meaning)
    const replacement = `<span class="annotated-word" data-def="${escapedMeaning}">${escapedWord}</span>`
    result = result.split(escapeHtml(placeholder)).join(replacement)
  }

  if (wrapParagraphs) {
    result = result.replace(/\n\n/g, '</p><p>')
    result = result.replace(/\n/g, '<br>')
    result = `<p>${result}</p>`
  }

  return result
}

/**
 * 规范化文本中的引号字符
 *
 * 将中文弯引号/英文弯引号统一转为直引号，避免在 HTML 渲染和注释匹配时产生歧义。
 * 同时处理反引号（backtick）等易混淆字符。
 *
 * 转换规则：
 * - \u201C \u201D（" "）→ "（U+0022）
 * - \u2018 \u2019（' '）→ '（U+0027）
 * - \u300C \u300D（「 」）→ "（U+0022）
 * - \u300E \u300F（『 』）→ "（U+0022）
 * - ` （U+0060 backtick）→ '（U+0027）
 * - ´ （U+00B4 acute accent）→ '（U+0027）
 *
 * @param str - 需要规范化引号的字符串
 * @returns 规范化后的字符串
 */
export function normalizeQuotes(str: string): string {
  if (!str || typeof str !== 'string') {
    return ''
  }
  return (
    str
      // 中文双引号 → 直双引号
      .replace(/\u201C|\u201D|\u300C|\u300D/g, '"')
      // 中文单引号 → 直单引号
      .replace(/\u2018|\u2019|\u300E|\u300F/g, "'")
      // 反引号/尖音符 → 直单引号
      .replace(/[`´]/g, "'")
  )
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
    const value = (obj as Record<string, T | undefined>)[key]
    return value !== undefined ? value : defaultValue
  }
  return defaultValue
}
