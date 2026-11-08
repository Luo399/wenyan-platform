/**
 * useQuizEffects - 答题副作用层
 *
 * 职责：把「提交后端 / 写完成记录 / 埋点」从状态机与渲染器中隔离出来。
 * 约束：不碰 DOM、不持有渲染状态；失败时返回结果对象，由视图决定提示方式。
 */

import type { Ref } from 'vue'
import { isCorrect, toSubmitValue, type QuizModel } from '@/adapters/pageAdapter'
import { useQuizSubmitter } from '@/composables/useQuizSubmitter'
import { useStudentInfo } from '@/composables/useStudentInfo'
import { clearCompletionRecord, setCompletionRecord } from '@/utils/quizCompletionStorage'

export interface SubmitOutcome {
  ok: boolean
  error?: string
}

export interface UseQuizEffectsOptions {
  /** 当前篇目 ID（提交与完成记录的 scope） */
  wenId: Ref<string>
  /** 埋点回调，由视图注入，避免副作用层依赖路由 */
  onTrack?: (payload: { isCorrect: boolean; questionId: string }) => void
}

/** 生成完成记录 ID（时间戳 + 随机串，仅用于区分会话） */
function generateCompletionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `quiz_${timestamp}_${random}`
}

export function useQuizEffects(options: UseQuizEffectsOptions) {
  const submitter = useQuizSubmitter()
  const { studentId } = useStudentInfo()

  /**
   * 提交单题答案。
   * 注意：不传 correctAnswer —— 让后端用自身 JSON 数据判分，避免客户端自证正确。
   */
  async function submitAnswer(quiz: QuizModel, keys: string[]): Promise<SubmitOutcome> {
    if (quiz.invalid) {
      return { ok: false, error: '题目配置异常，无法提交' }
    }

    const userAnswer = toSubmitValue(quiz, keys)
    const isEmpty = userAnswer === '' || (Array.isArray(userAnswer) && userAnswer.length === 0)
    if (isEmpty) {
      return { ok: false, error: '请先选择答案' }
    }

    try {
      await submitter.submitSingle({
        wenId: options.wenId.value,
        questionId: quiz.id,
        userAnswer,
        submittedAt: new Date().toISOString(),
      })
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '提交失败，请重试',
      }
    }

    options.onTrack?.({ isCorrect: isCorrect(quiz, keys), questionId: quiz.id })
    return { ok: true }
  }

  /** 全部答完后写完成记录 */
  function markCompleted(totalQuestions: number, answeredCount: number): void {
    setCompletionRecord(studentId.value, options.wenId.value, {
      completionId: generateCompletionId(),
      completedAt: new Date().toISOString(),
      totalQuestions,
      answeredCount,
    })
  }

  /** 切篇目时清除本 scope 的完成记录 */
  function resetCompletion(): void {
    clearCompletionRecord(studentId.value, options.wenId.value)
  }

  return { submitAnswer, markCompleted, resetCompletion }
}
