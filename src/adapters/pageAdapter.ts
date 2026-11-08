/**
 * 页面数据适配器（唯一清洗入口）
 *
 * 职责：
 * - 把 Figma / Excel 产出的原始 JSON 归一为 `PageModel`，供渲染器直接消费；
 * - 一次性消化「字母 / 索引 / correct_index」三种答案表示；
 * - 统一 questionId 生成规则，避免同一道题在不同页面产生不同 ID；
 * - 防御历史脏数据（如 Python 转换器把题干写进 options[0]）。
 *
 * 约束：本文件不 import Vue、不发请求、不读环境变量，保持纯函数可单测。
 */

import type { FigmaRenderMode } from '@/config/pageRegistry'

/** 原始数据中的答案表示（决定提交给后端时用字母还是索引） */
export type AnswerFormat = 'letter' | 'index'

/** 归一化后的选项：key 永远从 A 开始连续编号 */
export interface QuizOptionModel {
  key: string
  text: string
  index: number
}

/** 归一化后的单题：渲染器只读此结构，不再接触原始字段 */
export interface QuizModel {
  id: string
  wenId: string
  module: string
  type: 'radio' | 'checkbox'
  stem: string
  options: QuizOptionModel[]
  /** 正确答案的展示键（如 ['B']） */
  answerKeys: string[]
  /** 正确答案的展示索引（0 基，已剔除被丢弃的错位选项） */
  answerIndexes: number[]
  /** 原始答案表示：提交时按同一表示回传，保证与后端 JSON 对齐 */
  answerFormat: AnswerFormat
  /** 被丢弃的前置选项数量（Python 遗留错位时通常为 1） */
  optionOffset: number
  explanation: string
  difficulty?: string
  audioFile?: string | null
  /** 缺正确答案 / 选项不足 / 题干为空 → true，UI 显示配置异常而不是当 0 分 */
  invalid: boolean
}

export interface DialogueBlockModel {
  text_id?: string
  pre_dialog?: string
  audio_file?: string
  icon_dialog?: string
}

/** 块流模型：新增块类型时在 BlocksRenderer 的映射表中注册渲染组件 */
export type BlockModel =
  | { type: 'dialogue'; data: DialogueBlockModel }
  | { type: 'quiz'; data: QuizModel }
  | { type: 'wordlist'; data: { wenId: string } }
  | { type: 'multi-role-reading'; data: { wenId: string; autoLoad: boolean } }
  | { type: 'video'; data: { src: string; poster?: string } }
  | { type: 'unknown'; data: { rawType: string } }

export interface QuizListItemModel {
  scenario?: string
  quiz: QuizModel
}

export type PageModel =
  | { kind: 'blocks'; pageId: string; title?: string; blocks: BlockModel[] }
  | { kind: 'quizList'; pageId: string; title?: string; items: QuizListItemModel[] }

export interface AdaptPageOptions {
  renderMode: FigmaRenderMode
  wenId: string
  pageKey: string
}

export interface AdaptQuizContext {
  wenId: string
  /** 数据源缺 question_id 时的兜底 ID（格式 `${wenId}_q${n}`） */
  fallbackId: string
}

// ============================================================
// 基础类型守卫
// ============================================================

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  return String(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

// ============================================================
// 选项与答案归一化
// ============================================================

interface BuiltOptions {
  texts: string[]
  optionOffset: number
  options: QuizOptionModel[]
}

/**
 * 构造选项列表。
 * - 优先读 `options` 数组，其次读 `option_a`~`option_d`；
 * - 若 `options[0]` 与题干完全相同（Python 转换器遗留错位），丢弃该项并记录偏移。
 */
function buildOptions(raw: Record<string, unknown>, stem: string): BuiltOptions {
  const fromArray = asArray(raw.options)
    .map(asString)
    .filter((text) => text.trim() !== '')

  let texts = fromArray
  let optionOffset = 0

  if (fromArray.length === 0) {
    texts = ['option_a', 'option_b', 'option_c', 'option_d']
      .map((key) => asString(raw[key]))
      .filter((text) => text.trim() !== '')
  } else if (fromArray.length > 1 && stem.trim() !== '' && fromArray[0]?.trim() === stem.trim()) {
    texts = fromArray.slice(1)
    optionOffset = 1
  }

  return {
    texts,
    optionOffset,
    options: texts.map((text, index) => ({
      key: String.fromCharCode(65 + index),
      text,
      index,
    })),
  }
}

/** 单个答案值 → 原始索引（字母按 A=0 转换） */
function parseSingleAnswer(value: unknown): { format: AnswerFormat; index: number } | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { format: 'index', index: value }
  }
  const text = asString(value).trim().toUpperCase()
  if (!text) return null
  if (/^[A-Z]$/.test(text)) {
    return { format: 'letter', index: text.charCodeAt(0) - 65 }
  }
  if (/^-?\d+$/.test(text)) {
    return { format: 'index', index: Number.parseInt(text, 10) }
  }
  return null
}

/** 答案值（标量或数组）→ 原始索引集合 + 表示格式 */
function parseAnswer(value: unknown): { format: AnswerFormat; indexes: number[] } | null {
  if (value === null || value === undefined || value === '') return null

  const items = Array.isArray(value) ? value : [value]
  const parsed = items
    .map(parseSingleAnswer)
    .filter((item): item is { format: AnswerFormat; index: number } => item !== null)

  if (parsed.length === 0) return null
  return {
    format: parsed[0]!.format,
    indexes: parsed.map((item) => item.index),
  }
}

// ============================================================
// 单题 / 页面
// ============================================================

/** 把原始题目归一为 QuizModel */
export function adaptQuiz(rawInput: unknown, ctx: AdaptQuizContext): QuizModel {
  const raw = asRecord(rawInput)
  const stem = asString(raw.question_text).trim() || asString(raw.stem).trim()
  const { options, optionOffset } = buildOptions(raw, stem)

  // correct_answer 优先；缺失时回退 correct_index（level1 数据两者并存）
  const parsed = parseAnswer(raw.correct_answer) ?? parseAnswer(raw.correct_index)

  const answerIndexes = (parsed?.indexes ?? [])
    .map((index) => index - optionOffset)
    .filter((index) => index >= 0 && index < options.length)

  const invalid = options.length < 2 || parsed === null || answerIndexes.length === 0 || stem === ''

  return {
    id: asString(raw.question_id) || asString(raw.id) || ctx.fallbackId,
    wenId: asString(raw.text_id) || ctx.wenId,
    module: asString(raw.module),
    type: asString(raw.question_type) === 'checkbox' ? 'checkbox' : 'radio',
    stem,
    options,
    answerKeys: invalid ? [] : answerIndexes.map((index) => String.fromCharCode(65 + index)),
    answerIndexes: invalid ? [] : answerIndexes,
    answerFormat: parsed?.format ?? 'letter',
    optionOffset,
    explanation: asString(raw.explanation),
    difficulty: asString(raw.difficulty) || undefined,
    audioFile: asString(raw.audio_file) || null,
    invalid,
  }
}

/** 判定作答是否正确（纯函数，渲染器不参与） */
export function isCorrect(quiz: QuizModel, selectedKeys: string[]): boolean {
  if (quiz.invalid || selectedKeys.length === 0) return false

  const expected = [...quiz.answerKeys].sort()
  const actual = [...new Set(selectedKeys)].sort()
  if (expected.length !== actual.length) return false
  return expected.every((key, index) => key === actual[index])
}

/**
 * 生成提交给后端的答案值。
 * 关键：后端用原始 JSON 的 `correct_answer` 做严格比较，因此必须按原始表示回传。
 * - 原始用字母 → 回传字母（错位时同步加 offset）
 * - 原始用索引 → 回传索引（错位时同步加 offset）
 */
export function toSubmitValue(
  quiz: QuizModel,
  selectedKeys: string[],
): string | number | string[] | number[] {
  const displayIndexes = selectedKeys
    .map((key) => quiz.options.find((option) => option.key === key)?.index)
    .filter((index): index is number => typeof index === 'number')

  if (displayIndexes.length === 0) {
    return quiz.type === 'checkbox' ? [] : ''
  }

  const rawIndexes = displayIndexes.map((index) => index + quiz.optionOffset)

  if (quiz.answerFormat === 'letter') {
    const letters = rawIndexes.map((index) => String.fromCharCode(65 + index))
    return quiz.type === 'checkbox' ? letters : (letters[0] ?? '')
  }
  return quiz.type === 'checkbox' ? rawIndexes : (rawIndexes[0] ?? 0)
}

function adaptBlocks(
  raw: Record<string, unknown>,
  pageId: string,
  title: string | undefined,
  options: AdaptPageOptions,
): PageModel {
  const blocks: BlockModel[] = []
  let quizOrdinal = 0

  for (const item of asArray(raw.blocks)) {
    const block = asRecord(item)
    const type = asString(block.type)
    const data = asRecord(block.data)

    if (type === 'quiz') {
      quizOrdinal += 1
      blocks.push({
        type: 'quiz',
        data: adaptQuiz(data, {
          wenId: options.wenId,
          fallbackId: `${options.wenId}_q${quizOrdinal}`,
        }),
      })
      continue
    }

    if (type === 'dialogue') {
      blocks.push({
        type: 'dialogue',
        data: {
          text_id: asString(data.text_id) || options.wenId,
          pre_dialog: asString(data.pre_dialog) || asString(data.dialogText),
          audio_file: asString(data.audio_file) || undefined,
          icon_dialog: asString(data.icon_dialog) || undefined,
        },
      })
      continue
    }

    if (type === 'wordlist') {
      blocks.push({
        type: 'wordlist',
        data: { wenId: asString(data.wenId) || asString(data.wen_id) || options.wenId },
      })
      continue
    }

    if (type === 'multi-role-reading') {
      blocks.push({
        type: 'multi-role-reading',
        data: {
          wenId: asString(data.wenId) || asString(data.wen_id) || options.wenId,
          autoLoad: data.autoLoad !== false,
        },
      })
      continue
    }

    if (type === 'video') {
      blocks.push({
        type: 'video',
        data: {
          src: asString(data.src) || asString(data.video),
          poster: asString(data.poster) || undefined,
        },
      })
      continue
    }

    // 未知块类型保留占位，由渲染器降级展示，避免整页数据被静默丢弃
    blocks.push({ type: 'unknown', data: { rawType: type } })
  }

  return { kind: 'blocks', pageId, title, blocks }
}

function adaptQuizList(
  raw: Record<string, unknown>,
  pageId: string,
  title: string | undefined,
  options: AdaptPageOptions,
): PageModel {
  const items: QuizListItemModel[] = asArray(raw.items).map((item, index) => {
    const record = asRecord(item)
    return {
      scenario: asString(record.text) || undefined,
      quiz: adaptQuiz(record.quiz, {
        wenId: options.wenId,
        fallbackId: `${options.wenId}_q${index + 1}`,
      }),
    }
  })

  return { kind: 'quizList', pageId, title, items }
}

/** 页面入口：按 renderMode 选择 blocks / quiz-list 结构 */
export function adaptPage(rawInput: unknown, options: AdaptPageOptions): PageModel {
  const raw = asRecord(rawInput)
  const pageId = asString(raw.pageId) || options.wenId
  const title = asString(raw.title) || undefined

  if (options.renderMode === 'quiz-list') {
    return adaptQuizList(raw, pageId, title, options)
  }
  return adaptBlocks(raw, pageId, title, options)
}

/** 从 PageModel 中按顺序提取全部题目（blocks 取 quiz 块） */
export function extractQuizzes(pageModel: PageModel | null): QuizModel[] {
  if (!pageModel) return []
  if (pageModel.kind === 'quizList') return pageModel.items.map((item) => item.quiz)
  return pageModel.blocks
    .filter((block): block is { type: 'quiz'; data: QuizModel } => block.type === 'quiz')
    .map((block) => block.data)
}
