/**
 * Level 2 Quiz Adapter（R108 重构后薄封装）
 *
 * 通用逻辑见 levelQuizAdapterCore.ts，本文件仅保留原导出名称以维持向后兼容。
 */
import { createLevelQuizAdapter } from './levelQuizAdapterCore'

// 类型别名：与 core 中的同构类型等价，保留原命名供外部使用
export type { RawLevelQuizItem as RawLevel2QuizItem } from './levelQuizAdapterCore'
export type { ProcessedLevelQuizItem as ProcessedLevel2QuizItem } from './levelQuizAdapterCore'

// 创建实例并解构导出
const adapter = createLevelQuizAdapter({
  module: 'B',
  defaultDifficulty: 'L2',
  questionIdPrefix: 'B',
})

export const adaptLevel2Quiz = adapter.adapt
export const getAllLevel2Quizzes = adapter.getAll
export const getLevel2QuizByQuestionNumber = adapter.getByQuestionNumber
