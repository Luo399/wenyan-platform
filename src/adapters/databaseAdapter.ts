/**
 * 数据库数据适配器
 *
 * 功能说明：
 * - 将从后端API获取的原始数据转换为组件可用格式
 * - 提供与原JSON文件相同的接口结构
 * - 支持平滑迁移从本地JSON到API数据
 *
 * 使用示例：
 * import { adaptTextBasicInfoFromApi, adaptWordListFromApi } from '@/adapters/databaseAdapter'
 * const processed = adaptTextBasicInfoFromApi(rawData)
 */

import type { TextBasicInfo, WordItem } from '@/services/apiService'

// ============================================================
// 原始数据接口（保持与原JSON格式兼容）
// ============================================================

/**
 * 原始文本基础信息（兼容JSON格式）
 */
export interface RawTextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration?: string
  bgm?: string
}

/**
 * 原始字词项（兼容JSON格式）
 */
export interface RawWordItem {
  text_id: string
  word: string
  basic_meaning: string
  synonym_analysis?: string
  follow_up_questions?: string[]
}

/**
 * 原始多角色朗读数据
 */
export interface RawMultiRoleReading {
  text_id: string
  audio_file: string
  segments: Array<{
    sentence_index: number
    time_range: string
    role_name: string
    dialogue: string
  }>
}

/**
 * 原始测验问题
 */
export interface RawQuizQuestion {
  question_id: string
  question: string
  options: string[]
  correct_answer: number | string
  explanation?: string
  difficulty?: string
}

// ============================================================
// 处理后的数据接口
// ============================================================

/**
 * 处理后的文本基础信息
 */
export interface ProcessedTextBasicInfo extends RawTextBasicInfo {
  contentHtml: string // 预生成的带注释的 HTML 内容
}

/**
 * 处理后的字词项
 */
export interface ProcessedWordItem extends RawWordItem {
  highlighted: boolean // 是否被高亮标记
}

/**
 * 处理后的多角色朗读数据
 */
export interface ProcessedMultiRoleReading extends RawMultiRoleReading {
  segments: Array<{
    sentence_index: number
    time_range: string
    role_name: string
    dialogue: string
    startTime: number // 解析后的开始时间（秒）
    endTime: number // 解析后的结束时间（秒）
  }>
}

/**
 * 处理后的测验数据
 */
export interface ProcessedQuizData {
  questions: Array<{
    question_id: string
    question: string
    options: string[]
    correct_answer: number | string
    explanation?: string
    difficulty?: string
    optionLabels: string[] // 选项标签（如 ['A', 'B', 'C', 'D']）
  }>
}

// ============================================================
// 适配器函数
// ============================================================

/**
 * 适配文本基础信息
 *
 * @param rawData API返回的原始数据
 */
export function adaptTextBasicInfoFromApi(rawData: TextBasicInfo): ProcessedTextBasicInfo {
  return {
    text_id: rawData.text_id,
    title: rawData.title,
    author: rawData.author,
    dynasty: rawData.dynasty,
    original_text: rawData.original_text,
    illustration: rawData.illustration,
    bgm: rawData.bgm,
    contentHtml: buildContentHtml(rawData.original_text),
  }
}

/**
 * 适配字词列表
 *
 * @param rawData API返回的原始数据
 */
export function adaptWordListFromApi(rawData: WordItem[]): ProcessedWordItem[] {
  // 过滤有效词汇并按长度降序排列（避免短词优先匹配）
  const validWords = rawData
    .filter((item) => item.word && item.basic_meaning)
    .sort((a, b) => b.word.length - a.word.length)

  // 添加派生字段
  return validWords.map((item) => ({
    ...item,
    highlighted: true,
  }))
}

/**
 * 适配多角色朗读数据
 *
 * @param rawData API返回的原始数据
 */
export function adaptMultiRoleReadingFromApi(rawData: any): ProcessedMultiRoleReading {
  return {
    text_id: rawData.text_id,
    audio_file: rawData.audio_file,
    segments: rawData.segments.map((segment: any) => ({
      ...segment,
      startTime: parseTimeRange(segment.time_range).start,
      endTime: parseTimeRange(segment.time_range).end,
    })),
  }
}

/**
 * 适配测验数据
 *
 * @param rawData API返回的原始数据
 */
export function adaptQuizFromApi(rawData: any): ProcessedQuizData {
  return {
    questions: (rawData.questions || []).map((question: any) => ({
      ...question,
      optionLabels: generateOptionLabels(question.options.length),
    })),
  }
}

/**
 * 批量适配器：处理字词列表和文本基础信息
 *
 * @param rawBasicInfo 原始文本基础信息
 * @param rawWordList 原始字词列表
 */
export function adaptWordListPairFromApi(
  rawBasicInfo: TextBasicInfo,
  rawWordList: WordItem[],
): {
  basicInfo: ProcessedTextBasicInfo
  wordList: ProcessedWordItem[]
} {
  const processedBasicInfo = adaptTextBasicInfoFromApi(rawBasicInfo)
  const processedWordList = adaptWordListFromApi(rawWordList)

  // 更新文本基础信息的HTML内容，添加字词注释
  const contentHtml = buildContentHtmlWithAnnotations(rawBasicInfo.original_text, processedWordList)

  return {
    basicInfo: {
      ...processedBasicInfo,
      contentHtml,
    },
    wordList: processedWordList,
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 解析时间范围字符串（如 '00:00-00:16'）
 *
 * @param timeRange 时间范围字符串
 */
function parseTimeRange(timeRange: string): { start: number; end: number } {
  const [startStr, endStr] = timeRange.split('-')
  return {
    start: parseTimeToSeconds(startStr),
    end: parseTimeToSeconds(endStr),
  }
}

/**
 * 将时间字符串转换为秒数
 *
 * @param timeStr 时间字符串（如 '00:16'）
 */
function parseTimeToSeconds(timeStr: string): number {
  const [minutes, seconds] = timeStr.split(':').map(Number)
  return minutes * 60 + seconds
}

/**
 * 生成选项标签（A, B, C, D...）
 *
 * @param count 选项数量
 */
function generateOptionLabels(count: number): string[] {
  const labels: string[] = []
  for (let i = 0; i < count; i++) {
    labels.push(String.fromCharCode(65 + i)) // A, B, C...
  }
  return labels
}

/**
 * 构建带换行的HTML内容
 *
 * @param originalText 原始文本
 */
function buildContentHtml(originalText: string): string {
  // 移除原文中的斜杠符号
  let content = originalText.replace(/\//g, '')

  // 处理换行符
  content = content.replace(/\n\n/g, '</p><p>')
  content = content.replace(/\n/g, '<br>')
  content = `<p>${content}</p>`

  return content
}

/**
 * 构建带字词注释的HTML内容
 *
 * @param originalText 原始文本
 * @param wordList 字词列表
 */
function buildContentHtmlWithAnnotations(
  originalText: string,
  wordList: ProcessedWordItem[],
): string {
  // 移除原文中的斜杠符号
  let content = originalText.replace(/\//g, '')

  // 处理所有词汇（按长度降序已排序）
  for (const item of wordList) {
    const escaped = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'g')
    const replacement = `<span class="annotated-word" data-def="${item.basic_meaning}">${item.word}</span>`
    content = content.replace(regex, replacement)
  }

  // 处理换行符
  content = content.replace(/\n\n/g, '</p><p>')
  content = content.replace(/\n/g, '<br>')
  content = `<p>${content}</p>`

  return content
}
