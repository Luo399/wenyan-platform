/**
 * 适配器工具函数
 *
 * 提供适配器层共用的工具函数，避免代码重复
 * 时间相关函数（parseTime* / timeToSeconds / parseSecondsToTime）
 * 统一在 @/utils/timeUtils 维护，此处仅 re-export 保持兼容。
 */

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
 * 单条注释：词 + 释义 + 追问列表（预留）
 *
 * `followUpQuestions` 对应 word_list JSON 的 `follow_up_questions`。
 * 目前 4 篇课文全为空数组，追问 UI 本轮不做，所以**空即不写属性**，
 * 保证生成的 HTML 与线上现状逐字节一致；数据一旦填上，DOM 自动带上
 * `data-follow-up`，渲染层不需要再改。
 */
export interface WordAnnotation {
  word: string
  meaning: string
  followUpQuestions?: string[]
}

/**
 * 追问列表 → span 上的 data-follow-up 属性片段
 *
 * @returns 非空时返回 ` data-follow-up="..."`（JSON 经 escapeHtml），空则返回空串
 */
function buildFollowUpAttribute(list: string[] | undefined): string {
  const items = (list ?? []).filter((q) => typeof q === 'string' && q.trim() !== '')
  if (items.length === 0) {
    return ''
  }
  return ` data-follow-up="${escapeHtml(JSON.stringify(items))}"`
}

/**
 * 词条匹配用的常量
 *
 * 真实 word_list 数据里有两类词条和正文对不上，直接字符串相等匹配会漏标：
 * - 括号注音：`鲦（tiáo）鱼`、`槽枥(lì)`（全角/半角都有），正文里只有「鲦鱼」「槽枥」；
 * - 长短语被标点/空格断开：`乃丹书帛曰陈胜王` 在正文里是 `乃丹书帛曰"陈胜王"`。
 */
/** 词条里的括号注音片段（全角（）或半角()） */
const PAREN_PRONUNCIATION_RE = /[（(][^）)]*[)）]/g
/** 单个汉字判定（中日韩统一表意文字基本区）；不带 g，避免 test 的 lastIndex 状态 */
const CJK_CHAR_RE = /[\u4e00-\u9fff]/
/** 全文汉字计数用 */
const CJK_CHAR_GLOBAL_RE = /[\u4e00-\u9fff]/g
/** 标点容错匹配时，两个汉字之间最多允许跳过的非汉字字符数（引号、逗号、空格） */
const MAX_PUNCT_GAP = 4
/** 参与标点容错匹配的词条最短汉字数：太短的片段容易跨句误配 */
const MIN_PHRASE_CJK_LEN = 4
/** 剥掉注音后仍参与标注的最短汉字数：`食(sì)` 这类单字音注不能全量标注（正文里「食」出现 5 次，只有部分是 sì 读法） */
const MIN_STRIPPED_CJK_LEN = 2

/** 统计字符串里的汉字数 */
function cjkLength(str: string): number {
  return (str.match(CJK_CHAR_GLOBAL_RE) || []).length
}

/** 剥掉词条中的括号注音，返回应去正文里匹配的写法；无注音时返回原串 */
function stripParenthesisPronunciation(word: string): string {
  return word.replace(PAREN_PRONUNCIATION_RE, '').trim()
}

/**
 * 由词条的汉字骨架生成「允许中间夹标点/空格」的正则
 *
 * 例：`乃丹书帛曰陈胜王` → 乃[^汉字]{0,4}丹[^汉字]{0,4}书…，
 * 于是正文里的 `乃丹书帛曰"陈胜王"` 也能整段命中。
 * 跳过的字符数被 MAX_PUNCT_GAP 限死，既够包住「，”」这类组合，
 * 也不会跨过占位符（占位符本身 ≥14 个非汉字字符）造成二次误配。
 */
function buildPunctTolerantRegex(word: string): RegExp | null {
  const skeleton = Array.from(word).filter((ch) => CJK_CHAR_RE.test(ch))
  if (skeleton.length < MIN_PHRASE_CJK_LEN) {
    return null
  }
  const body = skeleton.map((ch) => escapeRegex(ch)).join(`[^\\u4e00-\\u9fff]{0,${MAX_PUNCT_GAP}}`)
  return new RegExp(body, 'g')
}

/** 一条注释最终落到 span 上的结果：释义取自词条，展示文本取自正文实际命中的片段 */
interface ResolvedAnnotation {
  item: WordAnnotation
  displayText: string
}

/**
 * 构建带注释的HTML内容
 *
 * 注释匹配按「先保原样、再兜底」三级策略，逐级尝试且只在该级没命中时才降级，
 * 因此现有能命中的词条产出的 HTML 逐字节不变：
 * 1. 词条原文整体替换（历史行为）；
 * 2. 剥掉括号注音后再替换，span 显示正文里的写法（`鲦（tiáo）鱼` → 标注「鲦鱼」），
 *    剥完不足两字的单字音注不标（见 MIN_STRIPPED_CJK_LEN 的说明）；
 * 3. ≥4 个汉字的长短语允许中间夹标点/空格整段命中（`乃丹书帛曰陈胜王`）。
 * 出处类词条（篇名不在正文里，如「马说」「岳阳楼记」「史记」）三级都不会命中，
 * 属数据侧问题，见 figma-plugin/docs/step1-word-tooltip-plan.md 的未命中清单。
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
  annotations: WordAnnotation[] | null | undefined,
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

  // 排序键用汉字数而不是字符串长度：带注音的词条（`鲦（tiáo）鱼`）原始长度虚高，
  // 按汉字数排才和正文实际占比一致；汉字数相同时再按原始长度兜底。
  const sortedAnnotations = [...annotations!].sort(
    (a, b) => cjkLength(b.word) - cjkLength(a.word) || b.word.length - a.word.length,
  )

  // 占位符策略：避免已注入的 span 被后续词汇匹配破坏
  const placeholderMap = new Map<string, ResolvedAnnotation>()
  const takePlaceholder = (item: WordAnnotation, displayText: string): string => {
    const placeholder = `__ANNOTATION_${placeholderMap.size}__`
    placeholderMap.set(placeholder, { item, displayText })
    return placeholder
  }
  /** 整串替换（同一词条的所有出现共用一个占位符，展示文本就是 needle 本身） */
  const replaceLiterally = (needle: string, item: WordAnnotation): boolean => {
    if (!needle || !workingContent.includes(needle)) {
      return false
    }
    workingContent = workingContent.split(needle).join(takePlaceholder(item, needle))
    return true
  }
  /** 标点容错匹配：命中的片段可能各处不同，逐个生成占位符 */
  const replacePunctTolerantly = (item: WordAnnotation): boolean => {
    const pattern = buildPunctTolerantRegex(item.word)
    if (!pattern) {
      return false
    }
    const before = workingContent
    workingContent = workingContent.replace(pattern, (matched) => takePlaceholder(item, matched))
    return workingContent !== before
  }

  for (const item of sortedAnnotations) {
    if (replaceLiterally(item.word, item)) {
      continue
    }
    const stripped = stripParenthesisPronunciation(item.word)
    if (stripped !== item.word && cjkLength(stripped) >= MIN_STRIPPED_CJK_LEN) {
      if (replaceLiterally(stripped, item)) {
        continue
      }
    }
    replacePunctTolerantly(item)
  }

  // 先对基础内容做 HTML 转义，再把占位符换回带注释的 span（span 内部已自行转义）
  let result = escapeHtml(workingContent)
  for (const [placeholder, resolved] of placeholderMap) {
    const escapedWord = escapeHtml(resolved.displayText)
    const escapedMeaning = escapeHtml(resolved.item.meaning)
    const followUpAttr = buildFollowUpAttribute(resolved.item.followUpQuestions)
    const replacement = `<span class="annotated-word" data-def="${escapedMeaning}"${followUpAttr}>${escapedWord}</span>`
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
 * - \u300E \u300F（『 』）→ '（U+0027）—— 外层双、内层单，与英文排版一致
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
