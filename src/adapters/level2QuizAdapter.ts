/**
 * Level2 Quiz Adapter（兼容层，re-export 自公共工厂）
 *
 * 原独立实现已合并到 levelQuizAdapter.ts 的 createLevelQuizAdapter 工厂，
 * 本文件仅保留同名导出以保持向后兼容。
 */

import { LEVEL2_ADAPTER } from './levelQuizAdapter'
export type { RawLevelQuizItem as RawLevel2QuizItem, ProcessedLevelQuizItem as ProcessedLevel2QuizItem } from './levelQuizAdapter'
import type { RawLevelQuizItem, ProcessedLevelQuizItem } from './levelQuizAdapter'

// 兼容旧类型命名
export type RawLevel2QuizItem = RawLevelQuizItem
export type ProcessedLevel2QuizItem = ProcessedLevelQuizItem

/** 适配 Level2 测验数据 */
export function adaptLevel2Quiz(
  rawData: RawLevelQuizItem[] | null,
): ProcessedLevelQuizItem[] {
  return LEVEL2_ADAPTER.adapt(rawData)
}

/** 按题号查找 Level2 题目 */
export function getLevel2QuizByQuestionNumber(
  data: ProcessedLevelQuizItem[],
  questionNumber: number,
): ProcessedLevelQuizItem | null {
  return LEVEL2_ADAPTER.getByQuestionNumber(data, questionNumber)
}

/** 返回所有 Level2 题目（新数组） */
export function getAllLevel2Quizzes(
  data: ProcessedLevelQuizItem[],
): ProcessedLevelQuizItem[] {
  return LEVEL2_ADAPTER.getAll(data)
}
