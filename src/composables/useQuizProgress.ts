/**
 * 答题进度本地存储封装
 *
 * 集中管理 AdaptQuiz / Level1Quiz 写入 localStorage 的答题记录，
 * 避免各组件直接访问 localStorage，确保持久化逻辑统一。
 *
 * 存储结构：
 *   key:   `quiz_records_${studentId}`
 *   value: QuizRecordReport[]（每次答题生成一个 report，内含单题 records）
 */

import { debugLog, debugWarn } from '@/utils/debug'

/** 单题答题记录 */
export interface QuizQuestionRecord {
  questionId: string
  questionNumber: number
  userAnswer: unknown
  correctAnswer: unknown
  isCorrect: boolean
  score: number
  submittedAt: string
}

/** 一次答题（整份题目）生成的报告 */
export interface QuizRecordReport {
  studentId: string
  studentName: string
  wenId: string
  submittedAt: string
  /** level1 整卷模式：整卷题目数；level2/3 单题模式：固定 1 */
  totalQuestions: number
  correctCount: number
  wrongCount: number
  totalScore: number
  /** 百分制整数（correct / total） */
  avgScore: number
  /** 单题明细数组 */
  records: QuizQuestionRecord[]
}

/** Storage key 前缀（后缀拼 studentId） */
const STORAGE_KEY_PREFIX = 'quiz_records_'

/**
 * 组装 key；空 studentId 不抛错，但会返回空串，下游调用会拒绝写入
 */
function getStorageKey(studentId: string): string {
  return studentId ? `${STORAGE_KEY_PREFIX}${studentId}` : ''
}

/**
 * 读取某学生的全部报告列表；非浏览器或无数据返回 []
 */
export function loadQuizRecords(studentId: string): QuizRecordReport[] {
  const key = getStorageKey(studentId)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QuizRecordReport[]) : []
  } catch (e) {
    debugWarn('[useQuizProgress] 读取 localStorage 失败，已回退为空列表:', e)
    return []
  }
}

/**
 * 追加一个 report 到某学生的记录列表
 * @returns 追加后的完整列表
 */
export function saveQuizRecord(studentId: string, report: QuizRecordReport): QuizRecordReport[] {
  const key = getStorageKey(studentId)
  if (!key) {
    debugWarn('[useQuizProgress] studentId 为空，跳过 localStorage 写入')
    return []
  }
  const list = loadQuizRecords(studentId)
  list.push(report)
  try {
    localStorage.setItem(key, JSON.stringify(list))
    debugLog('[useQuizProgress] 答题数据已保存到本地:', {
      studentId,
      wenId: report.wenId,
      questions: report.totalQuestions,
      avgScore: report.avgScore,
    })
  } catch (e) {
    debugWarn('[useQuizProgress] 写入 localStorage 失败:', e)
  }
  return list
}

/**
 * 清空某学生的全部答题记录（主要用于测试/退出登录场景）
 */
export function clearQuizRecords(studentId: string): void {
  const key = getStorageKey(studentId)
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch (e) {
    debugWarn('[useQuizProgress] 清空 localStorage 失败:', e)
  }
}
