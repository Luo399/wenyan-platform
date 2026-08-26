/**
 * useQuizSubmitter - 统一答题提交入口（P1 重构）
 *
 * 职责：
 * - 所有答题提交动作（单题/批量）都经由本 Composable 统一出口；
 * - 学生身份统一从 useStudentInfo（authStore）读取，禁止组件各自取号；
 * - JWT 由 utils/api 封装的 getAuthHeaders 自动附加，组件无需感知；
 * - 错误向上抛出，由调用方（页面容器/进度管理）决定 UI 反馈。
 *
 * 设计约束：
 * - 传输层仍是 services/apiService（本文件只做"身份注入 + 参数规整"）；
 * - 组件内禁止再直接 import apiService 的 submit* 函数。
 */

import { useStudentInfo } from '@/composables/useStudentInfo'
import {
  submitSingleAnswer as apiSubmitSingleAnswer,
  submitAnswers as apiSubmitAnswers,
} from '@/services/apiService'

/** 单题提交参数（业务字段，不含学生身份） */
export interface QuizSubmitterSingleParams {
  wenId: string
  questionId: string
  userAnswer: string | number | (string | number)[]
  correctAnswer?: string | number | (string | number)[]
  submittedAt?: string
}

/** 批量提交参数（业务字段，不含学生身份） */
export interface QuizSubmitterBatchParams {
  wenId: string
  submittedAt: string
  answers: Record<string, string | number | (string | number)[]>
  questions: Array<{ id: string; correctAnswer: string | number | (string | number)[] }>
}

/**
 * 获取统一的提交上下文（学生 ID + 姓名）
 * 未登录时抛出错误，交由调用方处理（可静默或提示）
 */
export function useQuizSubmitter() {
  const { studentId, getStudentName } = useStudentInfo()

  /** 校验登录态并返回学号 */
  function requireStudentId(): string {
    const id = studentId.value
    if (!id) {
      throw new Error('未登录，无法提交答案')
    }
    return id
  }

  /** 异步获取学生姓名（可能为空字符串） */
  async function getStudentContext(): Promise<{ studentId: string; studentName?: string }> {
    const id = requireStudentId()
    const name = await getStudentName()
    return { studentId: id, studentName: name || undefined }
  }

  /**
   * 提交单题答案
   * @returns 后端返回的结果（含 isCorrect/score/attemptNumber）
   */
  async function submitSingle(params: QuizSubmitterSingleParams) {
    const { studentId: sid, studentName } = await getStudentContext()
    return apiSubmitSingleAnswer({
      studentId: sid,
      studentName,
      wenId: params.wenId,
      questionId: params.questionId,
      userAnswer: params.userAnswer,
      correctAnswer: params.correctAnswer,
      submittedAt: params.submittedAt || new Date().toISOString(),
    })
  }

  /**
   * 批量提交答案（Level1/整卷场景）
   * @returns 后端返回的统计结果（questionCount/correctCount/avgScore 等）
   */
  async function submitBatch(params: QuizSubmitterBatchParams) {
    const { studentId: sid, studentName } = await getStudentContext()
    return apiSubmitAnswers({
      studentId: sid,
      studentName,
      wenId: params.wenId,
      submittedAt: params.submittedAt || new Date().toISOString(),
      answers: params.answers,
      questions: params.questions,
    })
  }

  return { submitSingle, submitBatch }
}
