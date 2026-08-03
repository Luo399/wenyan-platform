/**
 * WordList 数据适配器
 *
 * 负责将原始 JSON 数据转换为组件直接可用的格式
 * 所有复杂的处理逻辑（排序、过滤、拼接 HTML、计算派生字段等）都在此完成
 */

import { buildContentHtmlWithAnnotations } from '@/utils/adapterUtils'

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

  // 字段映射：ProcessedWordItem.word + basic_meaning → {word, meaning}
  const annotations = wordList.map((w) => ({
    word: w.word,
    meaning: w.basic_meaning,
  }))

  // 生成带注释的 HTML 内容（移除斜杠 + 段落包裹）
  const contentHtml = buildContentHtmlWithAnnotations(rawBasicInfo.original_text, annotations, {
    removeSlashes: true,
    wrapParagraphs: true,
  })

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
 * 单独处理词汇列表的适配器（用于其他场景）
 */
export function adaptWordListOnly(rawWordList: RawWordItem[]): ProcessedWordItem[] {
  return processWordList(rawWordList)
}

// 旧本地实现 buildContentHtml 已删除；统一走 @/utils/adapterUtils.buildContentHtmlWithAnnotations
