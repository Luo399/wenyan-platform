// src/composables/quiz/index.ts — 答题域桶文件
// R6 后续新增 useQuizFlow 统一入口（渐进式，旧 composable 保持向后兼容）
export { useQuizProgress } from '../useQuizProgress'
export type { QuizAnswer, UseQuizProgressReturn } from '../useQuizProgress'
export { useQuizSubmitter } from '../useQuizSubmitter'
export { useAnswerSubmitter } from '../useAnswerSubmitter'
export type {
  AnswerRecord,
  QuestionInfo,
  SubmitPayload,
  SubmitResponse,
  ValidationResult,
  UseAnswerSubmitterReturn,
} from '../useAnswerSubmitter'
