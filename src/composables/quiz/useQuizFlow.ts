/**
 * useQuizFlow — 统一答题流程 Composable（R6 新增）
 *
 * 合并 useQuizProgress（进度状态机）+ useQuizSubmitter（后端提交）为单一入口。
 * StepTwo / StepThree 只需要这一个 composable 就能跑完完整答题流程。
 *
 * 设计原则：
 * - 参数与旧 useQuizProgress 保持兼容（渐进式迁移）
 * - 内部仍持有 useQuizSubmitter() 实例做后端提交，不内联
 * - completionKey 用于 localStorage 持久化（含学生维度隔离）
 * - 未登录时后端提交静默跳过（progress 状态仍正常工作）
 */

import {
  ref,
  computed,
  watch,
  toValue,
  type Ref,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { useQuizSubmitter } from '@/composables/useQuizSubmitter'
import { useAuthStore } from '@/stores/auth'
import { resolveQuestionId } from '@/utils/questionId'
import {
  getCompletionRecord,
  setCompletionRecord,
  clearCompletionRecord as clearCompletionRecordByScope,
  type QuizCompletionRecord,
} from '@/utils/quizCompletionStorage'
import { debugLog, debugError, debugWarn } from '@/utils/debug'

/** 答案记录类型 */
export interface QuizFlowAnswer {
  questionIndex: number
  questionId?: string
  module?: string
  answer: number | string
  isCorrect?: boolean
  correctAnswer?: string | number | (string | number)[]
}

/** useQuizFlow 参数 */
export interface QuizFlowParams {
  /** 题目总数（Ref，响应式变化时自动重置进度） */
  totalQuestions: Ref<number>
  /** 单题提交后回调（可选） */
  onSubmit?: (questionIndex: number, answer: number | string, isCorrect?: boolean) => void
  /**
   * 完成记录 key（用于 localStorage 持久化，含学生维度隔离）。
   * 三关共用同一篇 wenId 时会互相覆盖，建议传 `stepone|steptwo|stepthree:${wenId}`。
   */
  completionKey?: MaybeRefOrGetter<string>
  /**
   * 后端提交使用的篇目 ID（WEN_xx）。
   * 与 completionKey 分离，避免为了隔离完成记录而把 `steptwo:WEN_01` 这类 key 带进后端。
   * 缺省时回退 completionKey（兼容旧调用）。
   */
  wenId?: MaybeRefOrGetter<string>
}

/** submit() 参数 */
export interface QuizFlowSubmitParams {
  answer: number | string
  isCorrect?: boolean
  questionId?: string
  module?: string
  correctAnswer?: string | number | (string | number)[]
}

function generateCompletionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `quiz_${timestamp}_${random}`
}

export interface UseQuizFlowReturn {
  /** 当前题目索引（从 0 开始） */
  currentIndex: Ref<number>
  /** 已完成题目数 */
  completedCount: Ref<number>
  /** 题目总数（与传入 totalQuestions 同源） */
  totalQuestions: Ref<number>
  /** 进度百分比 0-100 */
  progressPercent: ComputedRef<number>
  /** 是否已全部完成 */
  isCompleted: ComputedRef<boolean>
  /** localStorage 中是否存在完成记录 */
  hasCompletionRecord: ComputedRef<boolean>
  /** 所有已提交答案（含错题） */
  answers: Ref<QuizFlowAnswer[]>
  /** 提交一道题 */
  submit: (params: QuizFlowSubmitParams) => Promise<void>
  /** 重置进度（清空 localStorage 完成记录） */
  reset: () => void
  /** 跳转到指定题目 */
  goTo: (index: number) => void
  /** 手动标记为已完成（保存完成记录） */
  markCompleted: () => void
}

function getStudentInfo(): { studentId: string; studentName: string } {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn || !authStore.user) {
    return { studentId: '', studentName: '' }
  }
  return {
    studentId: authStore.user.studentId,
    studentName: authStore.user.username,
  }
}

export function useQuizFlow(params: QuizFlowParams): UseQuizFlowReturn {
  const { totalQuestions, onSubmit, completionKey, wenId } = params

  const currentIndex = ref(0)
  const completedCount = ref(0)
  const answers = ref<QuizFlowAnswer[]>([])
  const submittedList = ref<boolean[]>([])

  // 后端提交能力（内部持有，对外不暴露）
  const submitter = useQuizSubmitter()

  const progressPercent = computed(() => {
    if (totalQuestions.value === 0) return 0
    const percent = (completedCount.value / totalQuestions.value) * 100
    return Math.min(Math.round(percent), 100)
  })

  const isCompleted = computed(() => {
    return completedCount.value >= totalQuestions.value && totalQuestions.value > 0
  })

  const hasCompletionRecord = computed(() => {
    const key = toValue(completionKey)
    if (!key) return false
    return getCompletionRecord(getStudentInfo().studentId, key) !== null
  })

  function saveCompletionRecord(): void {
    const key = toValue(completionKey)
    if (!key) return
    const record: QuizCompletionRecord = {
      completionId: generateCompletionId(),
      completedAt: new Date().toISOString(),
      totalQuestions: totalQuestions.value,
      answeredCount: completedCount.value,
    }
    setCompletionRecord(getStudentInfo().studentId, key, record)
    debugLog('[useQuizFlow] 完成记录已保存:', record)
  }

  function clearCompletionRecord(): void {
    const key = toValue(completionKey)
    if (!key) return
    clearCompletionRecordByScope(getStudentInfo().studentId, key)
    debugLog('[useQuizFlow] 完成记录已清除')
  }

  async function submitSingleToBackend(answer: QuizFlowAnswer): Promise<void> {
    const backendWenId = toValue(wenId) || toValue(completionKey)
    if (!backendWenId) {
      debugLog('[useQuizFlow] 无 wenId/completionKey，跳过后端提交')
      return
    }

    try {
      const { studentId } = getStudentInfo()
      if (!studentId) {
        debugWarn('[useQuizFlow] 未登录，跳过后端提交')
        return
      }

      const questionId = resolveQuestionId(
        backendWenId,
        answer.questionId,
        answer.questionIndex + 1,
      )
      await submitter.submitSingle({
        wenId: backendWenId,
        questionId,
        userAnswer: answer.answer,
        correctAnswer: answer.correctAnswer,
        submittedAt: new Date().toISOString(),
      })

      debugLog('[useQuizFlow] 单题答案已提交', { questionId, answer: answer.answer })
    } catch (error) {
      debugError('[useQuizFlow] 后端提交失败:', error)
    }
  }

  async function submit(submitParams: QuizFlowSubmitParams): Promise<void> {
    if (isCompleted.value) {
      debugLog('[useQuizFlow] 已全部完成，跳过提交')
      return
    }

    const prevCurrentIndex = currentIndex.value

    const existingIndex = answers.value.findIndex((a) => a.questionIndex === currentIndex.value)
    const answerRecord: QuizFlowAnswer = {
      questionIndex: currentIndex.value,
      questionId: submitParams.questionId,
      module: submitParams.module,
      answer: submitParams.answer,
      isCorrect: submitParams.isCorrect,
      correctAnswer: submitParams.correctAnswer,
    }

    if (existingIndex >= 0) {
      answers.value[existingIndex] = answerRecord
    } else {
      answers.value.push(answerRecord)
    }

    if (!submittedList.value[currentIndex.value]) {
      submittedList.value[currentIndex.value] = true
      completedCount.value++
    }

    if (onSubmit) {
      onSubmit(currentIndex.value, submitParams.answer, submitParams.isCorrect)
    }

    await submitSingleToBackend(answerRecord)

    if (isCompleted.value) {
      saveCompletionRecord()
    }

    if (currentIndex.value < totalQuestions.value - 1) {
      currentIndex.value++
    }

    debugLog('[useQuizFlow] submit 完成', {
      prevIndex: prevCurrentIndex,
      newIndex: currentIndex.value,
      isCompleted: isCompleted.value,
    })
  }

  function reset(): void {
    clearCompletionRecord()
    currentIndex.value = 0
    completedCount.value = 0
    answers.value = []
    submittedList.value = []
    debugLog('[useQuizFlow] 进度已重置')
  }

  function goTo(index: number): void {
    if (index >= 0 && index < totalQuestions.value) {
      currentIndex.value = index
      debugLog('[useQuizFlow] goTo:', index)
    }
  }

  function markCompleted(): void {
    saveCompletionRecord()
    debugLog('[useQuizFlow] 手动标记完成')
  }

  // 题目总数变化时自动重置
  watch(
    totalQuestions,
    (newVal, oldVal) => {
      submittedList.value = Array.from({ length: newVal }, () => false)

      if (newVal === 0) {
        reset()
      } else if (oldVal !== undefined && newVal !== oldVal) {
        answers.value = []
        completedCount.value = 0
        currentIndex.value = 0
      }
    },
    { immediate: true },
  )

  return {
    currentIndex,
    completedCount,
    totalQuestions,
    progressPercent,
    isCompleted,
    hasCompletionRecord,
    answers,
    submit,
    reset,
    goTo,
    markCompleted,
  }
}
