/**
 * pages_level3_adaptive_quiz 页面适配器
 *
 * 第三关的 Figma JSON（`/data/pages_level3_adaptive_quiz/WEN_nn.json`）直接喂给
 * QuizCard 会踩到一组固定的错位，2026-10-30 对 WEN_01–04 四份线上数据逐份核过：
 *
 * 1. `options[0]` 实际是**题干**（以「（）」「（ ）」结尾），真正的选项从 `options[1]` 开始；
 *    QuizCard 会把题干渲染成一个可点击的选项，学生能把题目本身当答案选。
 * 2. `correct_answer` 是按**含题干的数组**计数的 0 基下标：WEN_01 的 1 指「有胆有识」，
 *    去掉题干后应变成 0；WEN_04 的 0 是作者按「去题干后的选项」写的，保持 0。
 * 3. `question_text` 要么和 `item.text` 场景文案逐字重复（WEN_01），
 *    要么是一句通用的「请根据以上情景选择正确答案。」（WEN_02–04），
 *    真正的问句藏在 options[0] 里。
 * 4. 解析文案里引用了选项字母（「正确选项：C」「答案是B」），
 *    选项前移一位后字母也要跟着前移，否则学生会看到「答案说 C，标绿的是 B」。
 *
 * 这里只在渲染层做兼容，不改 OSS 上的原始 JSON：
 * 题干提升为 question_text → 选项数组去掉首项 → correct_answer 与解析字母同步前移。
 * 启发式只在「首项像题干（空括号结尾）且 question_text 为空/泛化/与场景重复」时触发，
 * 避免把正常选项（比如一句带问号的话）误当题干。
 */

export interface RawAdaptiveQuiz {
  question_id?: string | null
  module?: string | null
  question_type?: string | null
  question_text?: string | null
  options?: Array<string | null | undefined> | null
  correct_answer?: number | number[] | string | null
  explanation?: string | null
  difficulty?: string | null
}

export interface RawAdaptiveQuizPage {
  pageId?: string | null
  items?: Array<{ text?: string | null; quiz?: RawAdaptiveQuiz | null } | null> | null
}

export interface AdaptiveQuizItem {
  question_id: string
  module: string
  question_type: 'radio' | 'checkbox'
  question_text: string
  options: string[]
  correct_answer?: number | number[]
  explanation: string
  difficulty: string
}

export interface AdaptiveQuizPageItem {
  text: string
  quiz: AdaptiveQuizItem
}

export interface AdaptiveQuizPage {
  pageId: string
  items: AdaptiveQuizPageItem[]
}

/** 空括号结尾：题干常见的填空位，`（）`、`（ ）`、`()`、`( )` 都算 */
const EMPTY_BRACKET_SUFFIX = /[（(]\s*[)）]\s*$/

/** 插件生成的通用问句，不含真实题意 */
const GENERIC_QUESTION_TEXTS = new Set([
  '请根据以上情景选择正确答案。',
  '请根据以上情景选择正确答案',
  '根据以上情景选择正确答案。',
  '根据以上情景选择正确答案',
])

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * 题干收尾整理：
 * - 「……哪一项？（）」这种问号后还带空括号的，去掉括号，避免问号叠填空位；
 * - 「……核心情感是（）」这种括号本身就是答题空位的，保留括号。
 */
function normalizeStemText(value: string): string {
  const trimmed = normalizeWhitespace(value)
  const withoutBracket = trimmed.replace(EMPTY_BRACKET_SUFFIX, '').trim()
  return /[？?]$/.test(withoutBracket) ? withoutBracket : trimmed
}

/** 首项是否像题干：空括号结尾且不是一两个字 */
function looksLikeQuestionStem(option: string | null | undefined): boolean {
  if (typeof option !== 'string') return false
  const trimmed = normalizeWhitespace(option)
  return trimmed.length > 8 && EMPTY_BRACKET_SUFFIX.test(trimmed)
}

/** question_text 是否没有独立信息（空 / 通用句 / 与场景文案逐字重复） */
function isPlaceholderQuestionText(questionText: string, scenarioText: string): boolean {
  const normalized = normalizeWhitespace(questionText)
  if (!normalized) return true
  if (normalized === normalizeWhitespace(scenarioText)) return true
  return GENERIC_QUESTION_TEXTS.has(normalized)
}

/** 把 number / "C" / "2" 之类的答案标注归一成 0 基下标 */
function toOptionIndex(value: number | string): number | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : undefined
  }
  const trimmed = value.trim()
  if (/^[A-Da-d]$/.test(trimmed)) {
    return trimmed.toUpperCase().charCodeAt(0) - 65
  }
  const numeric = Number(trimmed)
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : undefined
}

/**
 * 去掉首项题干后同步答案下标。
 *
 * 原始数据有两种混用口径（都出现在现有四篇里）：
 * - 按含题干的数组计数（WEN_01/02/03）：1/2/1 → 0/1/0；
 * - 作者按真实选项计数（WEN_04）：0 保持不变。
 * 两种口径在「0」上收敛，因此用 `index > 0 ? index - 1 : 0` 同时兼容。
 */
function shiftCorrectAnswer(
  raw: RawAdaptiveQuiz['correct_answer'],
  removedLeadingOption: boolean,
  optionCount: number,
): number | number[] | undefined {
  if (raw === null || raw === undefined) return undefined
  const values = Array.isArray(raw) ? raw : [raw]
  const indexes = values
    .map(toOptionIndex)
    .filter((index): index is number => index !== undefined)
    .map((index) => (removedLeadingOption && index > 0 ? index - 1 : index))
    .filter((index) => index < optionCount)

  const deduped = [...new Set(indexes)]
  if (!deduped.length) return undefined
  return Array.isArray(raw) ? deduped : deduped[0]
}

/**
 * 解析文案里「正确选项：C」「答案是B」这类字母引用同步前移一位。
 * 只改紧跟在「答案/正确选项」后的单个 A–D，避免误改正文里的英文缩写。
 */
function shiftExplanationOptionLetters(explanation: string): string {
  return explanation.replace(
    /((?:正确选项|正确答案|答案)\s*[：:]?\s*(?:是\s*)?)([A-D])(?![A-Za-z])/g,
    (match, prefix: string, letter: string) => {
      const index = letter.charCodeAt(0) - 65
      // A 指向被移除的题干时属于脏数据，没有可靠的映射目标，保持原样
      if (index <= 0) return match
      return `${prefix}${String.fromCharCode(64 + index)}`
    },
  )
}

function normalizeQuiz(raw: RawAdaptiveQuiz, scenarioText: string): AdaptiveQuizItem {
  const rawOptions = Array.isArray(raw.options)
    ? raw.options.map((option) => (typeof option === 'string' ? option.trim() : ''))
    : []
  const rawQuestionText = typeof raw.question_text === 'string' ? raw.question_text.trim() : ''

  const firstOption = rawOptions[0] ?? ''
  const promoteStem =
    rawOptions.length > 1 &&
    looksLikeQuestionStem(firstOption) &&
    isPlaceholderQuestionText(rawQuestionText, scenarioText)

  const options = promoteStem ? rawOptions.slice(1) : rawOptions
  let questionText = rawQuestionText
  if (promoteStem) {
    questionText = normalizeStemText(firstOption)
  } else if (questionText && normalizeWhitespace(questionText) === normalizeWhitespace(scenarioText)) {
    // 没有题干可提升时，至少别把场景文案在题目区再贴一遍
    questionText = ''
  }

  const correctAnswer = shiftCorrectAnswer(raw.correct_answer, promoteStem, options.length)
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : ''

  return {
    question_id: raw.question_id || '',
    module: raw.module || 'C',
    question_type: raw.question_type === 'checkbox' ? 'checkbox' : 'radio',
    question_text: questionText,
    options,
    correct_answer: correctAnswer,
    explanation: promoteStem ? shiftExplanationOptionLetters(explanation) : explanation,
    difficulty: raw.difficulty || 'L1',
  }
}

/**
 * 把页面的原始 JSON 归一成 QuizCard 可直接消费的结构。
 * 结构不完整的条目（没有 quiz / 少于两个选项）直接丢弃，避免渲染空白卡片。
 */
export function adaptAdaptiveQuizPage(raw: RawAdaptiveQuizPage | null): AdaptiveQuizPage {
  if (!raw || !Array.isArray(raw.items)) {
    return { pageId: raw?.pageId || '', items: [] }
  }

  const items = raw.items
    .filter((item): item is { text?: string | null; quiz: RawAdaptiveQuiz } =>
      Boolean(item && item.quiz && typeof item.quiz === 'object'),
    )
    .map((item) => {
      const text = typeof item.text === 'string' ? item.text.trim() : ''
      return { text, quiz: normalizeQuiz(item.quiz, text) }
    })
    .filter((item) => item.quiz.options.length >= 2)

  return {
    pageId: raw.pageId || '',
    items,
  }
}
