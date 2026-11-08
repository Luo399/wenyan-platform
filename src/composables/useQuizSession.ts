/**
 * useQuizSession - 答题状态机（纯逻辑层）
 *
 * 职责：维护「解锁进度 / 当前选择 / 已提交答案 / 判定结果」，
 * 对外只暴露只读快照与显式事件方法。
 *
 * 约束：
 * - 不发起网络请求、不读写 localStorage、不埋点、不 import 组件；
 * - 提交副作用由视图层编排：beginSubmit → useQuizEffects → confirmSuccess/confirmFailure。
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { isCorrect, type QuizModel } from '@/adapters/pageAdapter'
import type { QuizInteractionConfig } from '@/config/quizInteraction'

export type QuizStatus = 'idle' | 'loading' | 'answering' | 'submitting' | 'submitted' | 'completed'

/** 渲染器只读的快照 */
export interface QuizSnapshot {
  status: QuizStatus
  /** 已解锁到第几题（针对 quizzes 数组的下标，含） */
  unlockedIndex: number
  /** 当前选择（含未提交的草稿） */
  selections: Record<string, string[]>
  /** 已成功提交的答案 */
  answers: Record<string, string[]>
  /** 已提交题目的判定结果 */
  results: Record<string, boolean>
  submittedIds: string[]
  error: string | null
  answeredCount: number
  correctCount: number
  total: number
  isCompleted: boolean
}

/** 一次提交所需的上下文 */
export interface QuizSubmission {
  quiz: QuizModel
  keys: string[]
}

export interface UseQuizSessionOptions {
  quizzes: ComputedRef<QuizModel[]> | Ref<QuizModel[]>
  config: QuizInteractionConfig
  /** 没有题目时是否视为已完成（blocks 页面沿用旧行为：无 quiz 直接可继续） */
  emptyMeansCompleted?: boolean
}

export function useQuizSession(options: UseQuizSessionOptions) {
  const { quizzes, config } = options
  const emptyMeansCompleted = options.emptyMeansCompleted ?? false

  // 内部基础状态（status 由这些状态 + isCompleted 派生）
  const baseStatus = ref<'idle' | 'loading' | 'answering' | 'submitting'>('idle')
  const unlockedIndex = ref(0)
  const selections = ref<Record<string, string[]>>({})
  const answers = ref<Record<string, string[]>>({})
  const results = ref<Record<string, boolean>>({})
  const submittedIds = ref<string[]>([])
  const error = ref<string | null>(null)

  const validQuizzes = computed(() => quizzes.value.filter((quiz) => !quiz.invalid))
  const validIds = computed(() => new Set(validQuizzes.value.map((quiz) => quiz.id)))

  const total = computed(() => validQuizzes.value.length)

  const answeredCount = computed(
    () => submittedIds.value.filter((id) => validIds.value.has(id)).length,
  )

  const correctCount = computed(
    () =>
      submittedIds.value.filter((id) => validIds.value.has(id) && results.value[id] === true)
        .length,
  )

  const isCompleted = computed(() => {
    if (total.value === 0) return emptyMeansCompleted
    return answeredCount.value >= total.value
  })

  const status = computed<QuizStatus>(() => {
    if (baseStatus.value === 'loading') return 'loading'
    if (baseStatus.value === 'submitting') return 'submitting'
    if (isCompleted.value) return 'completed'
    if (baseStatus.value === 'idle') return 'idle'
    return 'answering'
  })

  const snapshot = computed<QuizSnapshot>(() => ({
    status: status.value,
    unlockedIndex: unlockedIndex.value,
    selections: selections.value,
    answers: answers.value,
    results: results.value,
    submittedIds: submittedIds.value,
    error: error.value,
    answeredCount: answeredCount.value,
    correctCount: correctCount.value,
    total: total.value,
    isCompleted: isCompleted.value,
  }))

  function findQuiz(quizId: string): QuizModel | undefined {
    return quizzes.value.find((quiz) => quiz.id === quizId)
  }

  /** 把解锁位推进到下一个有效题目（跳过配置异常的题） */
  function unlockNextValid(fromIndex: number): void {
    const list = quizzes.value
    let next = fromIndex + 1
    while (next < list.length && list[next]?.invalid) {
      next += 1
    }
    if (next < list.length && next > unlockedIndex.value) {
      unlockedIndex.value = next
    }
  }

  /** 数据就绪：跳过开头的无效题，进入作答态 */
  function setReady(): void {
    const list = quizzes.value
    let first = 0
    while (first < list.length && list[first]?.invalid) {
      first += 1
    }
    if (list.length > 0) {
      unlockedIndex.value = Math.max(unlockedIndex.value, Math.min(first, list.length - 1))
    }
    baseStatus.value = 'answering'
  }

  function setLoading(): void {
    baseStatus.value = 'loading'
  }

  /** 选择选项（多选切换，单选替换）；已提交或无效题不可改 */
  function select(quizId: string, key: string): void {
    const quiz = findQuiz(quizId)
    if (!quiz || quiz.invalid) return
    if (submittedIds.value.includes(quizId)) return

    if (quiz.type === 'checkbox') {
      const current = selections.value[quizId] ?? []
      selections.value[quizId] = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
      return
    }
    selections.value[quizId] = [key]
  }

  /** 进入提交态并返回提交上下文；不可提交时返回 null */
  function beginSubmit(quizId: string): QuizSubmission | null {
    const quiz = findQuiz(quizId)
    const keys = selections.value[quizId] ?? []

    if (!quiz || quiz.invalid || keys.length === 0) return null
    if (submittedIds.value.includes(quizId)) return null

    baseStatus.value = 'submitting'
    error.value = null
    return { quiz, keys: [...keys] }
  }

  /** 提交成功：记录答案与判定，按 advancePolicy 解锁下一题 */
  function confirmSuccess(quizId: string): void {
    const quiz = findQuiz(quizId)
    if (!quiz) {
      baseStatus.value = 'answering'
      return
    }

    const keys = selections.value[quizId] ?? []
    const correct = isCorrect(quiz, keys)

    answers.value[quizId] = [...keys]
    results.value[quizId] = correct

    // on-correct 策略下答错不解锁，保留重试机会（不写入 submittedIds）
    if (config.advancePolicy === 'on-correct' && !correct) {
      selections.value[quizId] = []
      baseStatus.value = 'answering'
      return
    }

    if (!submittedIds.value.includes(quizId)) {
      submittedIds.value = [...submittedIds.value, quizId]
    }
    baseStatus.value = 'answering'

    if (config.advancePolicy === 'manual') return

    const index = quizzes.value.findIndex((item) => item.id === quizId)
    if (index >= 0) unlockNextValid(index)
  }

  /** 提交失败：保留作答，回到作答态并给出可重试提示（不推进、不写完成记录） */
  function confirmFailure(message?: string): void {
    error.value = message || null
    baseStatus.value = 'answering'
  }

  /** 切篇目 / 重新开始 */
  function reset(): void {
    baseStatus.value = 'idle'
    unlockedIndex.value = 0
    selections.value = {}
    answers.value = {}
    results.value = {}
    submittedIds.value = []
    error.value = null
    if (quizzes.value.length > 0) setReady()
  }

  /** 该题是否已解锁（预渲染 + 视觉隐藏，不销毁） */
  function isRevealed(index: number): boolean {
    return index >= 0 && index <= unlockedIndex.value
  }

  function isSubmitted(quizId: string): boolean {
    return submittedIds.value.includes(quizId)
  }

  /** 已提交题目的判定展示值；未提交返回 null */
  function verdict(quizId: string): 'correct' | 'wrong' | null {
    if (!submittedIds.value.includes(quizId)) return null
    return results.value[quizId] ? 'correct' : 'wrong'
  }

  function clearError(): void {
    error.value = null
  }

  return {
    snapshot,
    total,
    isCompleted,
    select,
    beginSubmit,
    confirmSuccess,
    confirmFailure,
    setLoading,
    setReady,
    reset,
    isRevealed,
    isSubmitted,
    verdict,
    clearError,
  }
}
