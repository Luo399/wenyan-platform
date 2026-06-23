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
 *
 * 使用方式：
 * const {
 *   currentIndex,
 *   completedCount,
 *   totalQuestions,
 *   progressPercent,
 *   isCompleted,
 *   hasCompletionRecord,
 *   handleSubmit,
 *   resetProgress
 * } = useQuizProgress(totalQuestionsRef, onSubmitCallback)
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { submitAnswers } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'

/**
 * 答案记录类型
 */
export interface QuizAnswer {
  questionIndex: number
  questionId?: string
  module?: string
  answer: number | string
  isCorrect?: boolean
  correctAnswer?: string | number | (string | number)[]
}

/**
 * useQuizProgress 返回类型
 */
export interface UseQuizProgressReturn {
  /** 当前题目索引（从0开始） */
  currentIndex: Ref<number>

  /** 已完成题目数量 */
  completedCount: Ref<number>

  /** 总题目数量（Ref类型） */
  totalQuestions: Ref<number>

  /** 完成百分比（0-100） */
  progressPercent: ComputedRef<number>

  /** 是否已全部完成 */
  isCompleted: ComputedRef<boolean>

  /** 是否存在完成记录（从 sessionStorage 获取） */
  hasCompletionRecord: ComputedRef<boolean>

  /** 答案记录列表 */
  answers: Ref<QuizAnswer[]>

  /**
   * 提交当前题目
   * @param answer 用户选择的答案（数字索引或字符串）
   * @param isCorrect 是否正确（可选）
   * @param questionId 题目ID（可选，用于后端提交）
   * @param module 模块标识（可选，B表示steptwo，C表示stepthree）
   * @param correctAnswer 正确答案（可选，用于后端提交）
   */
  handleSubmit: (
    answer: number | string,
    isCorrect?: boolean,
    questionId?: string,
    module?: string,
    correctAnswer?: string | number | (string | number)[],
  ) => void

  /**
   * 重置进度到初始状态（同时清除完成记录）
   */
  resetProgress: () => void

  /**
   * 跳转到指定题目（仅用于查看，不会标记为已完成）
   * @param index 题目索引
   */
  goToQuestion: (index: number) => void

  /**
   * 手动标记为已完成（用于特殊场景）
   */
  markAsCompleted: () => void
}

/**
 * 生成唯一的 completionId
 */
function generateCompletionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `quiz_${timestamp}_${random}`
}

/**
 * 获取 sessionStorage 中的完成记录键名
 * @param prefix 前缀标识（用于区分不同测验）
 */
function getCompletionKey(prefix?: string): string {
  return `quiz_completion_${prefix || 'default'}`
}

/**
 * 逐题交互逻辑与进度管理 Composable
 *
 * @param totalQuestionsRef 题目总数（Ref类型，支持响应式更新）
 * @param onSubmit 提交事件回调（可选），每次提交时调用
 * @param completionKeyPrefix sessionStorage 完成记录的前缀（用于区分不同测验）
 * @returns 进度状态和控制方法
 */
export function useQuizProgress(
  totalQuestionsRef: Ref<number>,
  onSubmit?: (questionIndex: number, answer: number | string, isCorrect?: boolean) => void,
  completionKeyPrefix?: string,
): UseQuizProgressReturn {
  /** 当前题目索引（从0开始） */
  const currentIndex = ref(0)

  /** 已完成题目数量 */
  const completedCount = ref(0)

  /** 答案记录列表 */
  const answers = ref<QuizAnswer[]>([])

  /** 提交状态列表（记录每个题目是否已提交） */
  const submittedList = ref<boolean[]>([])

  /**
   * 完成百分比（0-100）
   */
  const progressPercent = computed(() => {
    if (totalQuestionsRef.value === 0) return 0
    const percent = (completedCount.value / totalQuestionsRef.value) * 100
    return Math.min(Math.round(percent), 100)
  })

  /**
   * 是否已全部完成
   */
  const isCompleted = computed(() => {
    return completedCount.value >= totalQuestionsRef.value && totalQuestionsRef.value > 0
  })

  /**
   * 是否存在完成记录（从 sessionStorage 获取）
   */
  const hasCompletionRecord = computed(() => {
    const key = getCompletionKey(completionKeyPrefix)
    const record = sessionStorage.getItem(key)
    return !!record
  })

  /**
   * 保存完成记录到 sessionStorage
   */
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

  /**
   * 清除 sessionStorage 中的完成记录
   */
  function clearCompletionRecord(): void {
    const key = getCompletionKey(completionKeyPrefix)
    sessionStorage.removeItem(key)
    console.log(`[useQuizProgress] 完成记录已清除`)
  }

  /**
   * 提交答案到后端
   */
  async function submitAnswersToBackend(): Promise<void> {
    if (!completionKeyPrefix || answers.value.length === 0) {
      console.log(`[useQuizProgress] submitAnswersToBackend - 无需提交`)
      return
    }

    try {
      // 优先使用新的认证 store（新逻辑）
      const authStore = useAuthStore()
      let studentId = ''
      let studentName = ''

      // 新逻辑：从 authStore 获取学生信息
      if (authStore.isLoggedIn && authStore.user) {
        studentId = authStore.user.studentId
        studentName = authStore.user.username
        console.log(`[useQuizProgress] 使用新登录逻辑 - 学生ID: ${studentId}, 姓名: ${studentName}`)
      } else {
        // 旧逻辑：从 studentStore 获取学生ID（兼容旧代码）
        const studentStore = useStudentStore()
        studentId = studentStore.studentId
        console.log(`[useQuizProgress] 使用旧登录逻辑 - 学生ID: ${studentId}`)
      }

      if (!studentId) {
        console.warn('[useQuizProgress] submitAnswersToBackend - 未登录，跳过后端提交')
        return
      }

      // 构建题目数据（包含正确答案和题目ID）
      const questions = answers.value.map((ans) => ({
        id: ans.questionId || `${completionKeyPrefix}_question_${ans.questionIndex}`,
        correctAnswer: ans.correctAnswer ?? 0,
      }))

      // 构建答案映射（使用 questionId 或 questionIndex，key格式与questions保持一致）
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

      // 提交到后端（传入学生姓名）
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

  /**
   * 提交当前题目
   *
   * @param answer 用户选择的答案（数字索引或字符串）
   * @param isCorrect 是否正确（可选）
   * @param questionId 题目ID（可选，用于后端提交）
   * @param module 模块标识（可选，B表示steptwo，C表示stepthree）
   * @param correctAnswer 正确答案（可选，用于后端提交）
   */
  async function handleSubmit(
    answer: number | string,
    isCorrect?: boolean,
    questionId?: string,
    module?: string,
    correctAnswer?: string | number | (string | number)[],
  ): Promise<void> {
    const prevCurrentIndex = currentIndex.value
    const prevCompletedCount = completedCount.value

    // 检查是否已全部完成
    if (isCompleted.value) {
      console.log(`[useQuizProgress] handleSubmit - 已全部完成，跳过提交`)
      return
    }

    // 记录答案（包含 questionId 和 module）
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
      // 更新已有答案
      answers.value[existingIndex] = answerRecord
    } else {
      // 添加新答案
      answers.value.push(answerRecord)
    }

    // 增加已完成计数（仅在首次提交时）
    if (!submittedList.value[currentIndex.value]) {
      submittedList.value[currentIndex.value] = true
      completedCount.value++
    }

    // 调用外部回调
    if (onSubmit) {
      onSubmit(currentIndex.value, answer, isCorrect)
    }

    // 检查是否全部完成，如果是则保存完成记录并提交到后端
    if (isCompleted.value) {
      saveCompletionRecord()
      await submitAnswersToBackend()
    }

    // 自动解锁下一题（如果有下一题）
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

  /**
   * 手动标记为已完成（用于特殊场景）
   */
  function markAsCompleted(): void {
    saveCompletionRecord()
    console.log(`[useQuizProgress] markAsCompleted - 手动标记完成`)
  }

  /**
   * 重置进度到初始状态（同时清除完成记录）
   */
  function resetProgress(): void {
    const prevCurrentIndex = currentIndex.value
    const prevCompletedCount = completedCount.value
    const prevAnswerCount = answers.value.length

    // 清除完成记录
    clearCompletionRecord()

    // 重置状态
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

  /**
   * 跳转到指定题目（仅用于查看，不会标记为已完成）
   *
   * @param index 题目索引（0-based）
   */
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

  /**
   * 监听题目总数变化，自动初始化提交状态列表
   */
  watch(
    totalQuestionsRef,
    (newVal, oldVal) => {
      console.log(`[useQuizProgress] watch - 题目总数变化`, {
        operation: 'totalQuestionsChange',
        oldValue: oldVal,
        newValue: newVal,
      })

      // 初始化提交状态列表
      submittedList.value = Array.from({ length: newVal }, () => false)

      // 仅当题目总数变为0时重置进度，避免数据加载时误清除答案
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
