/**
 * Level 1 Quiz Adapter（R108 重构后薄封装）
 *
 * 通用逻辑见 levelQuizAdapterCore.ts，本文件仅保留原导出名称以维持向后兼容。
 */
import { createLevelQuizAdapter } from './levelQuizAdapterCore'

// 类型别名：与 core 中的同构类型等价，保留原命名供外部使用
export type { RawLevelQuizItem as RawLevel1QuizItem } from './levelQuizAdapterCore'
export type { ProcessedLevelQuizItem as ProcessedLevel1QuizItem } from './levelQuizAdapterCore'

// 创建实例并解构导出
const adapter = createLevelQuizAdapter({
  module: 'A',
  defaultDifficulty: 'L1',
  questionIdPrefix: 'A',
})

export const adaptLevel1Quiz = adapter.adapt
export const getAllLevel1Quizzes = adapter.getAll
export const getLevel1QuizByQuestionNumber = adapter.getByQuestionNumber
