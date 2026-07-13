/**
 * useQuizProgress - 逐题交互逻辑与进度管理 Composable
 *
 * 提供完整的题目进度管理功能：
 * - 逐题展示机制
 * - 提交后自动解锁下一题
 * - 进度状态追踪
 * - 答案记录管理
 * - 完成状态检测
 * - sessionStorage 完成记录（关闭标签页后清除）
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { submitAnswers, submitSingleAnswer } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

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

function getCompletionKey(prefix?: string): string {
  return `quiz_completion_${prefix || 'default'}`
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

  const progressPercent = computed(() => {
    if (totalQuestionsRef.value === 0) return 0
    const percent = (completedCount.value / totalQuestionsRef.value) * 100
    return Math.min(Math.round(percent), 100)
  })

  const isCompleted = computed(() => {
    return completedCount.value >= totalQuestionsRef.value && totalQuestionsRef.value > 0
  })

  const hasCompletionRecord = computed(() => {
    const key = getCompletionKey(completionKeyPrefix)
    const record = sessionStorage.getItem(key)
    return !!record
  })

  function saveCompletionRecord(): void {
    const key = getCompletionKey(completionKeyPrefix)
    const record = {
      completionId: generateCompletionId(),
      completedAt: new Date().toISOString(),
      totalQuestions: totalQuestionsRef.value,
      answeredCount: completedCount.value,
    }
    sessionStorage.setItem(key, JSON.stringify(record))
    console.log(`[useQuizProgress] 完成记录已保存:`, record)
  }

  function clearCompletionRecord(): void {
    const key = getCompletionKey(completionKeyPrefix)
    sessionStorage.removeItem(key)
    console.log(`[useQuizProgress] 完成记录已清除`)
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
      console.log(`[useQuizProgress] submitSingleAnswerToBackend - 无需提交`)
      return
    }

    try {
      const { studentId, studentName } = getStudentInfo()

      if (!studentId) {
        console.warn('[useQuizProgress] submitSingleAnswerToBackend - 未登录，跳过后端提交')
        return
      }

      const questionId =
        answer.questionId || `${completionKeyPrefix}_question_${answer.questionIndex}`

      await submitSingleAnswer({
        studentId,
        studentName,
        wenId: completionKeyPrefix,
        questionId,
        userAnswer: answer.answer,
        correctAnswer: answer.correctAnswer,
        submittedAt: new Date().toISOString(),
      })

      console.log(`[useQuizProgress] submitSingleAnswerToBackend - 单题答案已提交`, {
        questionId,
        answer: answer.answer,
        isCorrect: answer.isCorrect,
      })
    } catch (error) {
      console.error('[useQuizProgress] submitSingleAnswerToBackend - 提交失败:', error)
    }
  }

  async function submitAnswersToBackend(): Promise<void> {
    if (!completionKeyPrefix || answers.value.length === 0) {
      console.log(`[useQuizProgress] submitAnswersToBackend - 无需提交`)
      return
    }

    try {
      const { studentId, studentName } = getStudentInfo()

      if (!studentId) {
        console.warn('[useQuizProgress] submitAnswersToBackend - 未登录，跳过后端提交')
        return
      }

      const questions = answers.value.map((ans) => ({
        id: ans.questionId || `${completionKeyPrefix}_question_${ans.questionIndex}`,
        correctAnswer: ans.correctAnswer ?? 0,
      }))

      const answerMap: Record<string, any> = {}
      const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
      answers.value.forEach((ans) => {
        const key = ans.questionId || `${completionKeyPrefix}_question_${ans.questionIndex}`
        let mappedAnswer: string | number = ans.answer
        if (typeof ans.answer === 'string') {
          const index = letterToIndex[ans.answer]
          if (index !== undefined) {
            mappedAnswer = index
          }
        }
        answerMap[key] = mappedAnswer
      })

      await submitAnswers(
        { answers: answerMap, questions },
        completionKeyPrefix,
        studentId,
        studentName,
      )

      console.log(`[useQuizProgress] submitAnswersToBackend - 答题数据已成功提交到后端`)
    } catch (error) {
      console.error('[useQuizProgress] submitAnswersToBackend - 提交失败:', error)
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
      console.log(`[useQuizProgress] handleSubmit - 已全部完成，跳过提交`)
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

    console.log(`[useQuizProgress] handleSubmit - 操作完成`, {
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
    console.log(`[useQuizProgress] markAsCompleted - 手动标记完成`)
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

    console.log(`[useQuizProgress] resetProgress - 进度已重置`, {
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
      console.log(`[useQuizProgress] goToQuestion - 跳转到题目`, {
        operation: 'goToQuestion',
        prevIndex,
        newIndex: currentIndex.value,
      })
    } else {
      console.log(`[useQuizProgress] goToQuestion - 无效索引`, {
        operation: 'goToQuestion',
        requestedIndex: index,
        totalQuestions: totalQuestionsRef.value,
      })
    }
  }

  watch(
    totalQuestionsRef,
    (newVal, oldVal) => {
      console.log(`[useQuizProgress] watch - 题目总数变化`, {
        operation: 'totalQuestionsChange',
        oldValue: oldVal,
        newValue: newVal,
      })

      submittedList.value = Array.from({ length: newVal }, () => false)

      if (newVal === 0) {
        resetProgress()
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