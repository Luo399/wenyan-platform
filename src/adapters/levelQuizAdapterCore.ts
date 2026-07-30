/**
 * Level Quiz Adapter 工厂核心（R108 重构）
 *
 * 三个 level[N]QuizAdapter.ts 之前 100% 重复，仅 module 字母、默认难度、questionId 前缀不同。
 * 此文件提供共享类型 + 工厂函数，由各 level adapter 薄封装复用。
 *
 * 设计原则：
 * 1. 严格保持与原三个 adapter 完全一致的行为（含 `|| null` 等历史 quirk，留给 R109 单独修）
 * 2. 不做选项空值过滤（与 quizAdapter.ts 行为不一致的问题留给 R112）
 * 3. 公开类型与函数签名保持向后兼容
 */
import { debugWarn } from '../utils/debug'

/** 原始 Level Quiz 数据项（与原 RawLevel[N]QuizItem 同构） */
export interface RawLevelQuizItem {
  text_id: string | null
  question_number: number | null
  question_text: string | null
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  audio_file: string | null
  difficulty: string | null
  correct_answer: string | null
  explanation: string | null
  question_type: string | null
}

/** 处理后的 Level Quiz 数据项（与原 ProcessedLevel[N]QuizItem 同构） */
export interface ProcessedLevelQuizItem {
  textId: string
  questionId: string
  module: string
  questionNumber: number
  questionText: string
  options: { label: string; value: string }[]
  audioFile: string | null
  difficulty: string
  correctAnswer: string | null
  explanation: string
  questionType: string
}

/** 工厂配置 */
export interface LevelAdapterConfig {
  /** 模块字母：'A' | 'B' | 'C' */
  module: string
  /** 默认难度：'L1' | 'L2' | 'L3' */
  defaultDifficulty: string
  /** questionId 前缀字母：与 module 一致 */
  questionIdPrefix: string
}

/** 工厂产物：与原三个文件导出的函数签名一致 */
export interface LevelAdapter {
  adapt: (rawData: RawLevelQuizItem[] | null) => ProcessedLevelQuizItem[]
  getAll: (data: ProcessedLevelQuizItem[]) => ProcessedLevelQuizItem[]
  getByQuestionNumber: (
    data: ProcessedLevelQuizItem[],
    questionNumber: number,
  ) => ProcessedLevelQuizItem | null
}

/** 构建选项列表（A/B/C/D 标签，原样保留空值，与原实现一致） */
function buildOptions(item: RawLevelQuizItem): { label: string; value: string }[] {
  return [
    { label: 'A', value: item.option_a || '' },
    { label: 'B', value: item.option_b || '' },
    { label: 'C', value: item.option_c || '' },
    { label: 'D', value: item.option_d || '' },
  ]
}

/**
 * 创建 Level Quiz Adapter 实例
 *
 * 用法：
 *   const adapter = createLevelQuizAdapter({ module: 'A', defaultDifficulty: 'L1', questionIdPrefix: 'A' })
 *   adapter.adapt(rawData)
 */
export function createLevelQuizAdapter(config: LevelAdapterConfig): LevelAdapter {
  const { module, defaultDifficulty, questionIdPrefix } = config

  function adapt(rawData: RawLevelQuizItem[] | null): ProcessedLevelQuizItem[] {
    if (!rawData || !Array.isArray(rawData)) {
      debugWarn(`Level${module}测验数据为空或格式异常`)
      return []
    }

    return rawData
      .filter((item) => item && item.text_id)
      .map((item, index) => {
        const textId = item.text_id || ''
        return {
          textId,
          questionId: `${textId}_${questionIdPrefix}${index + 1}`,
          module,
          questionNumber: item.question_number || 0,
          questionText: item.question_text || '',
          options: buildOptions(item),
          audioFile: item.audio_file || null,
          difficulty: item.difficulty || defaultDifficulty,
          correctAnswer: item.correct_answer || null,
          explanation: item.explanation || '',
          questionType: item.question_type || 'radio',
        }
      })
      .filter((item) => item.questionText.trim())
  }

  function getAll(data: ProcessedLevelQuizItem[]): ProcessedLevelQuizItem[] {
    return [...data]
  }

  function getByQuestionNumber(
    data: ProcessedLevelQuizItem[],
    questionNumber: number,
  ): ProcessedLevelQuizItem | null {
    return data.find((item) => item.questionNumber === questionNumber) || null
  }

  return { adapt, getAll, getByQuestionNumber }
}
