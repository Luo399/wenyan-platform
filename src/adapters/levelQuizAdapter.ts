/**
 * Level Quiz Adapter 工厂
 *
 * Level1/2/3 三套 quiz adapter 结构、字段、过滤逻辑完全相同，
 * 仅 module / questionId 前缀 / difficulty 默认值不同，
 * 统一由 createLevelQuizAdapter 生成，消除重复代码。
 */

import { debugWarn } from '../utils/debug'

/**
 * 原始数据结构（三套 level 通用）
 */
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

/**
 * 处理后数据结构（三套 level 通用）
 */
export interface ProcessedLevelQuizItem {
  textId: string
  questionId: string
  module: string
  questionNumber: number
  questionText: string
  options: Array<{ label: string; value: string }>
  audioFile: string | null
  difficulty: string
  correctAnswer: string | null
  explanation: string
  questionType: string
}

/**
 * 工厂返回的 adapter 函数集
 */
export interface LevelQuizAdapter {
  adapt: (rawData: RawLevelQuizItem[] | null) => ProcessedLevelQuizItem[]
  getByQuestionNumber: (
    data: ProcessedLevelQuizItem[],
    questionNumber: number,
  ) => ProcessedLevelQuizItem | null
  getAll: (data: ProcessedLevelQuizItem[]) => ProcessedLevelQuizItem[]
}

/**
 * 创建 Level Quiz Adapter
 *
 * @param moduleName - 模块名：'A' / 'B' / 'C'
 * @param idPrefix - questionId 后缀：'_A' / '_B' / '_C'
 * @param defaultDifficulty - 默认难度：'L1' / 'L2' / 'L3'
 * @param levelLabel - 调试日志标签（如 'Level1'）
 */
export function createLevelQuizAdapter(
  moduleName: string,
  idPrefix: string,
  defaultDifficulty: string,
  levelLabel: string,
): LevelQuizAdapter {
  function adapt(rawData: RawLevelQuizItem[] | null): ProcessedLevelQuizItem[] {
    if (!rawData || !Array.isArray(rawData)) {
      debugWarn(`${levelLabel}测验数据为空或格式异常`)
      return []
    }

    return rawData
      .filter((item) => item && item.text_id)
      .map((item, index) => {
        const textId = item.text_id || ''
        return {
          textId,
          questionId: `${textId}${idPrefix}${index + 1}`,
          module: moduleName,
          questionNumber: item.question_number || 0,
          questionText: item.question_text || '',
          options: [
            { label: 'A', value: item.option_a || '' },
            { label: 'B', value: item.option_b || '' },
            { label: 'C', value: item.option_c || '' },
            { label: 'D', value: item.option_d || '' },
          ],
          audioFile: item.audio_file || null,
          difficulty: item.difficulty || defaultDifficulty,
          correctAnswer: item.correct_answer || null,
          explanation: item.explanation || '',
          questionType: item.question_type || 'radio',
        }
      })
      .filter((item) => item.questionText.trim())
  }

  function getByQuestionNumber(
    data: ProcessedLevelQuizItem[],
    questionNumber: number,
  ): ProcessedLevelQuizItem | null {
    return data.find((item) => item.questionNumber === questionNumber) || null
  }

  function getAll(data: ProcessedLevelQuizItem[]): ProcessedLevelQuizItem[] {
    return [...data]
  }

  return { adapt, getByQuestionNumber, getAll }
}

// ============================================================
// 预置三套 Level Adapter（兼容旧 import 路径）
// 旧文件 level{1,2,3}QuizAdapter.ts 只是本文件的薄 re-export
// ============================================================

export const LEVEL1_ADAPTER = createLevelQuizAdapter('A', '_A', 'L1', 'Level1')
export const LEVEL2_ADAPTER = createLevelQuizAdapter('B', '_B', 'L2', 'Level2')
export const LEVEL3_ADAPTER = createLevelQuizAdapter('C', '_C', 'L3', 'Level3')
