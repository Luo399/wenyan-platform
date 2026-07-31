/**
 * Level1 Quiz Adapter（兼容层，re-export 自公共工厂）
 *
 * 原独立实现已合并到 levelQuizAdapter.ts 的 createLevelQuizAdapter 工厂，
 * 本文件仅保留同名导出以保持向后兼容。
 */

import { LEVEL1_ADAPTER } from './levelQuizAdapter'
export type { RawLevelQuizItem as RawLevel1QuizItem, ProcessedLevelQuizItem as ProcessedLevel1QuizItem } from './levelQuizAdapter'
import type { RawLevelQuizItem, ProcessedLevelQuizItem } from './levelQuizAdapter'

// 兼容旧类型命名
export type RawLevel1QuizItem = RawLevelQuizItem
export type ProcessedLevel1QuizItem = ProcessedLevelQuizItem

/** 适配 Level1 测验数据 */
export function adaptLevel1Quiz(
  rawData: RawLevelQuizItem[] | null,
): ProcessedLevelQuizItem[] {
  return LEVEL1_ADAPTER.adapt(rawData)
}

/** 按题号查找 Level1 题目 */
export function getLevel1QuizByQuestionNumber(
  data: ProcessedLevelQuizItem[],
  questionNumber: number,
): ProcessedLevelQuizItem | null {
  return LEVEL1_ADAPTER.getByQuestionNumber(data, questionNumber)
}

/** 返回所有 Level1 题目（新数组） */
export function getAllLevel1Quizzes(
  data: ProcessedLevelQuizItem[],
): ProcessedLevelQuizItem[] {
  return LEVEL1_ADAPTER.getAll(data)
}
