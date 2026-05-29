/**
 * WordList 数据适配器
 *
 * 负责将原始 JSON 数据转换为组件直接可用的格式
 * 所有复杂的处理逻辑（排序、过滤、拼接 HTML、计算派生字段等）都在此完成
 */

import { escapeHtml, escapeRegex } from '@/utils/adapterUtils'

// 原始数据接口
export interface RawWordItem {
  text_id: string
  word: string
  basic_meaning: string
  synonym_analysis?: string
  follow_up_questions?: string[]
}

export interface RawTextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration?: string
  bgm?: string
}

// 处理后的数据接口
export interface ProcessedWordItem extends RawWordItem {
  highlighted: boolean // 是否被高亮标记
}

export interface ProcessedTextBasicInfo extends RawTextBasicInfo {
  contentHtml: string // 预生成的带注释的 HTML 内容
}

export interface WordListAdapterResult {
  basicInfo: ProcessedTextBasicInfo
  wordList: ProcessedWordItem[]
}

/**
 * 主适配器函数：将原始数据转换为组件可用的格式
 */
export function adaptWordList(
  rawBasicInfo: RawTextBasicInfo,
  rawWordList: RawWordItem[],
): WordListAdapterResult {
  // 处理词汇列表
  const wordList = processWordList(rawWordList)

  // 生成带注释的 HTML 内容
  const contentHtml = buildContentHtml(rawBasicInfo.original_text, wordList)

  // 返回处理后的结果
  return {
    basicInfo: {
      ...rawBasicInfo,
      contentHtml,
    },
    wordList,
  }
}

/**
 * 处理词汇列表：排序、过滤、添加派生字段
 */
function processWordList(rawWordList: RawWordItem[]): ProcessedWordItem[] {
  // 过滤有效词汇并按长度降序排列（避免短词优先匹配）
  const validWords = rawWordList
    .filter((item) => item.word && item.basic_meaning)
    .sort((a, b) => b.word.length - a.word.length)

  // 添加派生字段
  return validWords.map((item) => ({
    ...item,
    highlighted: true,
  }))
}

/**
 * 构建带注释的 HTML 内容
 * 将原文中的词汇替换为带注释的 span 标签
 */
function buildContentHtml(originalText: string, wordList: ProcessedWordItem[]): string {
  // 移除原文中的斜杠符号，确保词汇匹配
  let content = originalText.replace(/\//g, '')

  // 处理所有词汇
  for (const item of wordList) {
    // 先转义正则特殊字符（用于正则匹配），再转义HTML（用于输出）
    const escapedRegex = escapeRegex(item.word)
    const escapedWord = escapeHtml(item.word)
    const escapedMeaning = escapeHtml(item.basic_meaning)
    const regex = new RegExp(escapedRegex, 'g')
    const replacement = `<span class="annotated-word" data-def="${escapedMeaning}">${escapedWord}</span>`
    content = content.replace(regex, replacement)
  }

  // 处理换行符
  content = content.replace(/\n\n/g, '</p><p>')
  content = content.replace(/\n/g, '<br>')
  content = `<p>${content}</p>`

  return content
}

/**
 * 单独处理词汇列表的适配器（用于其他场景）
 */
export function adaptWordListOnly(rawWordList: RawWordItem[]): ProcessedWordItem[] {
  return processWordList(rawWordList)
}
