/**
 * Level3 Quiz Adapter（兼容层，re-export 自公共工厂）
 *
 * 原独立实现已合并到 levelQuizAdapter.ts 的 createLevelQuizAdapter 工厂，
 * 本文件仅保留同名导出以保持向后兼容。
 */

import { LEVEL3_ADAPTER } from './levelQuizAdapter'
import type { RawLevelQuizItem, ProcessedLevelQuizItem } from './levelQuizAdapter'

// 兼容旧类型命名
export type RawLevel3QuizItem = RawLevelQuizItem
export type ProcessedLevel3QuizItem = ProcessedLevelQuizItem

/** 适配 Level3 测验数据 */
export function adaptLevel3Quiz(rawData: RawLevelQuizItem[] | null): ProcessedLevelQuizItem[] {
  return LEVEL3_ADAPTER.adapt(rawData)
}

/** 按题号查找 Level3 题目 */
export function getLevel3QuizByQuestionNumber(
  data: ProcessedLevelQuizItem[],
  questionNumber: number,
): ProcessedLevelQuizItem | null {
  return LEVEL3_ADAPTER.getByQuestionNumber(data, questionNumber)
}

/** 返回所有 Level3 题目（新数组） */
export function getAllLevel3Quizzes(data: ProcessedLevelQuizItem[]): ProcessedLevelQuizItem[] {
  return LEVEL3_ADAPTER.getAll(data)
}
