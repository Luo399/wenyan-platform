/**
 * useQuizProgress - 逐题交互逻辑与进度管理 Composable
 *
 * 提供完整的题目进度管理功能：
 * - 逐题展示机制
 * - 提交后自动解锁下一题
 * - 进度状态追踪
 * - 答案记录管理
 * - 完成状态检测
 * - localStorage 完成记录（持久化，key 含学生维度，见 quizCompletionStorage）
 */
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
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

export interface QuizAnswer {
  questionIndex: number
  questionId?: string
  module?: string
  answer: number | string
  isCorrect?: boolean
  correctAnswer?: string | number | (string | number)[]
}

export interface UseQuizProgressReturn {
  currentIndex: Ref<number>
  completedCount: Ref<number>
  totalQuestions: Ref<number>
  progressPercent: ComputedRef<number>
  isCompleted: ComputedRef<boolean>
  hasCompletionRecord: ComputedRef<boolean>
  answers: Ref<QuizAnswer[]>
  handleSubmit: (
    answer: number | string,
    isCorrect?: boolean,
    questionId?: string,
    module?: string,
    correctAnswer?: string | number | (string | number)[],
  ) => void
  resetProgress: () => void
  goToQuestion: (index: number) => void
  markAsCompleted: () => void
}

function generateCompletionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `quiz_${timestamp}_${random}`
}

export function useQuizProgress(
  totalQuestionsRef: Ref<number>,
  onSubmit?: (questionIndex: number, answer: number | string, isCorrect?: boolean) => void,
  completionKeyPrefix?: string,
): UseQuizProgressReturn {
  const currentIndex = ref(0)
  const completedCount = ref(0)
  const answers = ref<QuizAnswer[]>([])
  const submittedList = ref<boolean[]>([])

  // P1: 统一提交入口（学生身份/JWT 由入口注入）
  const submitter = useQuizSubmitter()

  const progressPercent = computed(() => {
    if (totalQuestionsRef.value === 0) return 0
    const percent = (completedCount.value / totalQuestionsRef.value) * 100
    return Math.min(Math.round(percent), 100)
  })

  const isCompleted = computed(() => {
    return completedCount.value >= totalQuestionsRef.value && totalQuestionsRef.value > 0
  })

  // P2: 完成记录统一走 quizCompletionStorage（localStorage 持久化、key 含学生维度）
  const hasCompletionRecord = computed(() => {
    if (!completionKeyPrefix) return false
    return getCompletionRecord(getStudentInfo().studentId, completionKeyPrefix) !== null
  })

  function saveCompletionRecord(): void {
    if (!completionKeyPrefix) return
    const record: QuizCompletionRecord = {
      completionId: generateCompletionId(),
      completedAt: new Date().toISOString(),
      totalQuestions: totalQuestionsRef.value,
      answeredCount: completedCount.value,
    }
    setCompletionRecord(getStudentInfo().studentId, completionKeyPrefix, record)
    debugLog(`[useQuizProgress] 完成记录已保存:`, record)
  }

  function clearCompletionRecord(): void {
    if (!completionKeyPrefix) return
    clearCompletionRecordByScope(getStudentInfo().studentId, completionKeyPrefix)
    debugLog(`[useQuizProgress] 完成记录已清除`)
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

  async function submitSingleAnswerToBackend(answer: QuizAnswer): Promise<void> {
    if (!completionKeyPrefix) {
      debugLog(`[useQuizProgress] submitSingleAnswerToBackend - 无需提交`)
      return
    }

    try {
      const { studentId } = getStudentInfo()

      if (!studentId) {
        debugWarn('[useQuizProgress] submitSingleAnswerToBackend - 未登录，跳过后端提交')
        return
      }

      // P2: questionId 统一——数据源 questionId 优先，缺失时用 `${wenId}_q{n}` 兜底
      const questionId = resolveQuestionId(
        completionKeyPrefix,
        answer.questionId,
        answer.questionIndex + 1,
      )

      // P1: 统一走 useQuizSubmitter 提交入口，学生身份/JWT 由入口统一注入
      await submitter.submitSingle({
        wenId: completionKeyPrefix,
        questionId,
        userAnswer: answer.answer,
        correctAnswer: answer.correctAnswer,
        submittedAt: new Date().toISOString(),
      })

      debugLog(`[useQuizProgress] submitSingleAnswerToBackend - 单题答案已提交`, {
        questionId,
        answer: answer.answer,
        isCorrect: answer.isCorrect,
      })
    } catch (error) {
      debugError('[useQuizProgress] submitSingleAnswerToBackend - 提交失败:', error)
    }
  }

  async function handleSubmit(
    answer: number | string,
    isCorrect?: boolean,
    questionId?: string,
    module?: string,
    correctAnswer?: string | number | (string | number)[],
  ): Promise<void> {
    const prevCurrentIndex = currentIndex.value
    const prevCompletedCount = completedCount.value

    if (isCompleted.value) {
      debugLog(`[useQuizProgress] handleSubmit - 已全部完成，跳过提交`)
      return
    }

    const existingIndex = answers.value.findIndex((a) => a.questionIndex === currentIndex.value)
    const answerRecord: QuizAnswer = {
      questionIndex: currentIndex.value,
      questionId,
      module,
      answer,
      isCorrect,
      correctAnswer,
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
      onSubmit(currentIndex.value, answer, isCorrect)
    }

    await submitSingleAnswerToBackend(answerRecord)

    if (isCompleted.value) {
      saveCompletionRecord()
    }

    if (currentIndex.value < totalQuestionsRef.value - 1) {
      currentIndex.value++
    }

    debugLog(`[useQuizProgress] handleSubmit - 操作完成`, {
      operation: 'submit',
      prevCurrentIndex,
      newCurrentIndex: currentIndex.value,
      prevCompletedCount,
      newCompletedCount: completedCount.value,
      answer,
      isCorrect,
      questionId,
      module,
      isCompleted: isCompleted.value,
    })
  }

  function markAsCompleted(): void {
    saveCompletionRecord()
    debugLog(`[useQuizProgress] markAsCompleted - 手动标记完成`)
  }

  function resetProgress(): void {
    const prevCurrentIndex = currentIndex.value
    const prevCompletedCount = completedCount.value
    const prevAnswerCount = answers.value.length

    clearCompletionRecord()

    currentIndex.value = 0
    completedCount.value = 0
    answers.value = []
    submittedList.value = []

    debugLog(`[useQuizProgress] resetProgress - 进度已重置`, {
      operation: 'reset',
      prevCurrentIndex,
      newCurrentIndex: currentIndex.value,
      prevCompletedCount,
      newCompletedCount: completedCount.value,
      prevAnswerCount,
      newAnswerCount: answers.value.length,
    })
  }

  function goToQuestion(index: number): void {
    const prevIndex = currentIndex.value

    if (index >= 0 && index < totalQuestionsRef.value) {
      currentIndex.value = index
      debugLog(`[useQuizProgress] goToQuestion - 跳转到题目`, {
        operation: 'goToQuestion',
        prevIndex,
        newIndex: currentIndex.value,
      })
    } else {
      debugLog(`[useQuizProgress] goToQuestion - 无效索引`, {
        operation: 'goToQuestion',
        requestedIndex: index,
        totalQuestions: totalQuestionsRef.value,
      })
    }
  }

  watch(
    totalQuestionsRef,
    (newVal, oldVal) => {
      debugLog(`[useQuizProgress] watch - 题目总数变化`, {
        operation: 'totalQuestionsChange',
        oldValue: oldVal,
        newValue: newVal,
      })

      // R88: 题目总数变化时重置进度，避免旧答案/已完成计数与新总数不匹配
      submittedList.value = Array.from({ length: newVal }, () => false)

      if (newVal === 0) {
        resetProgress()
      } else if (oldVal !== undefined && newVal !== oldVal) {
        // 总数变化（非首次）：清空旧答案，重置计数与游标
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
    totalQuestions: totalQuestionsRef,
    progressPercent,
    isCompleted,
    hasCompletionRecord,
    answers,
    handleSubmit,
    resetProgress,
    goToQuestion,
    markAsCompleted,
  }
}
