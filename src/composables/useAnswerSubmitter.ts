/**
 * useAnswerSubmitter - 答题数据提交 Composable
 *
 * 功能：
 * - 统一收集和管理答题数据
 * - 将零散的答案转换为后端API要求的格式
 * - 提供答案验证和提交功能
 * - 处理数据类型转换、字段映射和数据校验
 *
 * 使用方式：
 * const {
 *   answers,
 *   addAnswer,
 *   updateAnswer,
 *   removeAnswer,
 *   clearAnswers,
 *   validateAnswers,
 *   buildSubmitPayload,
 *   submitAnswers,
 *   isSubmitting
 * } = useAnswerSubmitter()
 */

import { ref, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import { post } from '@/utils/api'

/**
 * 单个答案记录（前端内部使用）
 */
export interface AnswerRecord {
  questionId: string
  userAnswer: string | number | (string | number)[]
  isCorrect?: boolean
  correctAnswer?: string | number | (string | number)[]
  module?: string
  questionNumber?: number
}

/**
 * 题目信息（用于构建提交载荷）
 */
export interface QuestionInfo {
  id: string
  correctAnswer: string | number | (string | number)[]
}

/**
 * 提交载荷接口（后端期望的格式）
 */
export interface SubmitPayload {
  studentId: string
  studentName?: string
  wenId: string
  submittedAt: string
  answers: Record<string, string | number | (string | number)[]>
  questions: QuestionInfo[]
}

/**
 * 提交响应接口
 */
export interface SubmitResponse {
  success: boolean
  message: string
  data?: {
    studentId: string
    wenId: string
    submittedAt: string
    questionCount: number
    correctCount: number
    wrongCount: number
    totalScore: number
    avgScore: number
    details: Array<{
      questionId: string
      score: number
      isCorrect: number
      attemptNumber: number
    }>
  }
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  missing: string[]
}

/**
 * useAnswerSubmitter 返回类型
 */
export interface UseAnswerSubmitterReturn {
  /** 答案列表 */
  answers: Ref<AnswerRecord[]>

  /** 添加答案 */
  addAnswer: (record: AnswerRecord) => void

  /** 更新答案 */
  updateAnswer: (questionId: string, updates: Partial<AnswerRecord>) => void

  /** 删除答案 */
  removeAnswer: (questionId: string) => void

  /** 清空所有答案 */
  clearAnswers: () => void

  /** 验证答案是否完整 */
  validateAnswers: () => ValidationResult

  /** 构建提交载荷 */
  buildSubmitPayload: (wenId: string) => SubmitPayload | null

  /** 提交答案到后端 */
  submitAnswers: (wenId: string) => Promise<SubmitResponse>

  /** 是否正在提交 */
  isSubmitting: Ref<boolean>

  /** 提交错误信息 */
  submitError: Ref<string | null>
}

/**
 * 数据类型转换工具
 */
const TypeConverter = {
  /**
   * 将答案值转换为后端可接受的格式
   */
  convertAnswerValue(
    value: string | number | (string | number)[],
  ): string | number | (string | number)[] {
    if (Array.isArray(value)) {
      return value.map((v) => this.convertSingleValue(v))
    }
    return this.convertSingleValue(value)
  },

  /**
   * 转换单个值
   */
  convertSingleValue(value: string | number): string | number {
    // 如果是字符串类型的数字，转换为数字类型
    if (typeof value === 'string') {
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        return numValue
      }
    }
    return value
  },

  /**
   * 验证答案值是否有效
   */
  isValidAnswer(value: unknown): boolean {
    if (value === undefined || value === null) return false
    if (Array.isArray(value)) {
      return value.length > 0 && value.every((v) => v !== undefined && v !== null)
    }
    return true
  },

  /**
   * 生成ISO格式的时间戳
   */
  generateTimestamp(): string {
    return new Date().toISOString()
  },
}

/**
 * 答题数据提交 Composable
 */
export function useAnswerSubmitter(): UseAnswerSubmitterReturn {
  /** 答案列表 */
  const answers = ref<AnswerRecord[]>([])

  /** 是否正在提交 */
  const isSubmitting = ref(false)

  /** 提交错误信息 */
  const submitError = ref<string | null>(null)

  /**
   * 获取学生ID（优先从authStore，其次从studentStore）
   */
  function getStudentId(): string {
    const authStore = useAuthStore()
    if (authStore.isLoggedIn && authStore.user) {
      return authStore.user.studentId
    }
    const studentStore = useStudentStore()
    return studentStore.studentId
  }

  /**
   * 获取学生姓名
   */
  function getStudentName(): string {
    const authStore = useAuthStore()
    if (authStore.isLoggedIn && authStore.user) {
      return authStore.user.username
    }
    return ''
  }

  /**
   * 添加答案
   * @param record - 答案记录
   */
  function addAnswer(record: AnswerRecord): void {
    // 数据类型转换
    const processedRecord: AnswerRecord = {
      ...record,
      userAnswer: TypeConverter.convertAnswerValue(record.userAnswer),
      correctAnswer:
        record.correctAnswer !== undefined
          ? TypeConverter.convertAnswerValue(record.correctAnswer)
          : undefined,
    }

    const existingIndex = answers.value.findIndex(
      (a) => a.questionId === processedRecord.questionId,
    )
    if (existingIndex >= 0) {
      answers.value[existingIndex] = { ...answers.value[existingIndex], ...processedRecord }
    } else {
      answers.value.push(processedRecord)
    }
    console.log(`[useAnswerSubmitter] 答案已添加/更新: ${processedRecord.questionId}`)
  }

  /**
   * 更新答案
   * @param questionId - 题目ID
   * @param updates - 更新内容
   */
  function updateAnswer(questionId: string, updates: Partial<AnswerRecord>): void {
    const index = answers.value.findIndex((a) => a.questionId === questionId)
    if (index >= 0) {
      const current = answers.value[index]!

      // 处理数据类型转换
      const processedUpdates: Partial<AnswerRecord> = { ...updates }
      if (updates.userAnswer !== undefined) {
        processedUpdates.userAnswer = TypeConverter.convertAnswerValue(updates.userAnswer)
      }
      if (updates.correctAnswer !== undefined) {
        processedUpdates.correctAnswer = TypeConverter.convertAnswerValue(updates.correctAnswer)
      }

      answers.value[index] = {
        questionId: current.questionId,
        userAnswer: current.userAnswer,
        ...processedUpdates,
      } as AnswerRecord
      console.log(`[useAnswerSubmitter] 答案已更新: ${questionId}`)
    }
  }

  /**
   * 删除答案
   * @param questionId - 题目ID
   */
  function removeAnswer(questionId: string): void {
    const index = answers.value.findIndex((a) => a.questionId === questionId)
    if (index >= 0) {
      answers.value.splice(index, 1)
      console.log(`[useAnswerSubmitter] 答案已删除: ${questionId}`)
    }
  }

  /**
   * 清空所有答案
   */
  function clearAnswers(): void {
    answers.value = []
    submitError.value = null
    console.log('[useAnswerSubmitter] 所有答案已清空')
  }

  /**
   * 验证答案是否完整
   * @returns 验证结果
   */
  function validateAnswers(): ValidationResult {
    const errors: string[] = []
    const missing: string[] = []

    answers.value.forEach((answer, index) => {
      // 验证 questionId
      if (
        !answer.questionId ||
        typeof answer.questionId !== 'string' ||
        answer.questionId.trim() === ''
      ) {
        const msg = `第 ${index + 1} 题缺少有效的 questionId`
        errors.push(msg)
        missing.push(msg)
      }

      // 验证 userAnswer
      if (!TypeConverter.isValidAnswer(answer.userAnswer)) {
        const msg = `第 ${index + 1} 题缺少有效的用户答案`
        errors.push(msg)
        missing.push(msg)
      }

      // 验证数据类型
      if (answer.userAnswer !== undefined && answer.userAnswer !== null) {
        if (!Array.isArray(answer.userAnswer)) {
          if (typeof answer.userAnswer !== 'string' && typeof answer.userAnswer !== 'number') {
            errors.push(`第 ${index + 1} 题答案类型不正确，应为 string | number | array`)
          }
        }
      }
    })

    // 验证是否有重复的 questionId
    const questionIds = answers.value.map((a) => a.questionId)
    const uniqueIds = new Set(questionIds)
    if (questionIds.length !== uniqueIds.size) {
      errors.push('存在重复的题目ID')
    }

    return {
      valid: errors.length === 0,
      errors,
      missing,
    }
  }

  /**
   * 构建提交载荷（转换为后端API要求的格式）
   * @param wenId - 课文ID
   * @returns 提交载荷或null（验证失败时）
   */
  function buildSubmitPayload(wenId: string): SubmitPayload | null {
    const studentId = getStudentId()

    // 验证学生ID
    if (!studentId || studentId.trim() === '') {
      console.error('[useAnswerSubmitter] 学生未登录或学号为空')
      return null
    }

    // 验证学号格式（数字）
    if (!/^\d+$/.test(studentId)) {
      console.error('[useAnswerSubmitter] 学号格式不正确，应为纯数字')
      return null
    }

    // 验证课文ID
    if (!wenId || wenId.trim() === '') {
      console.error('[useAnswerSubmitter] 课文ID为空')
      return null
    }

    // 验证答案
    const validation = validateAnswers()
    if (!validation.valid) {
      console.error('[useAnswerSubmitter] 答案验证失败:', validation.errors)
      return null
    }

    // 构建 answers 对象（{ questionId: userAnswer } 格式）
    const answersObject: Record<string, string | number | (string | number)[]> = {}
    answers.value.forEach((answer) => {
      answersObject[answer.questionId] = answer.userAnswer
    })

    // 构建 questions 数组（包含题目ID和正确答案）
    const questionsArray: QuestionInfo[] = answers.value
      .filter((answer) => answer.correctAnswer !== undefined)
      .map((answer) => ({
        id: answer.questionId,
        correctAnswer: answer.correctAnswer!,
      }))

    // 如果没有正确答案信息，仍然构建载荷（后端可能自己判断）
    if (questionsArray.length === 0 && answers.value.length > 0) {
      console.warn('[useAnswerSubmitter] 没有提供正确答案信息，后端将无法自动判分')
      answers.value.forEach((answer) => {
        questionsArray.push({
          id: answer.questionId,
          correctAnswer: '',
        })
      })
    }

    // 获取学生姓名（用于自动注册）
    const studentName = getStudentName()

    // 构建最终载荷
    const payload: SubmitPayload = {
      studentId,
      wenId,
      submittedAt: TypeConverter.generateTimestamp(),
      answers: answersObject,
      questions: questionsArray,
    }

    // 添加可选的学生姓名
    if (studentName && studentName.trim()) {
      payload.studentName = studentName
    }

    console.log('[useAnswerSubmitter] 提交载荷已构建:', JSON.stringify(payload, null, 2))
    return payload
  }

  /**
   * 提交答案到后端
   * @param wenId - 课文ID
   * @returns 提交结果
   */
  async function submitAnswers(wenId: string): Promise<SubmitResponse> {
    const payload = buildSubmitPayload(wenId)

    if (!payload) {
      throw new Error('无法构建提交载荷')
    }

    isSubmitting.value = true
    submitError.value = null

    try {
      const apiResponse = await post<SubmitResponse['data']>('/api/submit', payload)

      if (apiResponse.success) {
        console.log('[useAnswerSubmitter] 答案提交成功')
        return {
          success: true,
          message: apiResponse.message || '提交成功',
          data: apiResponse.data,
        }
      } else {
        throw new Error(apiResponse.message || '提交失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '提交失败'
      submitError.value = errorMessage
      console.error('[useAnswerSubmitter] 提交失败:', error)
      throw error
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    answers,
    addAnswer,
    updateAnswer,
    removeAnswer,
    clearAnswers,
    validateAnswers,
    buildSubmitPayload,
    submitAnswers,
    isSubmitting,
    submitError,
  }
}

/**
 * 批量添加答案（从 useQuizProgress 格式转换）
 * @param quizAnswers - 答题进度答案列表
 * @param questionIds - 题目ID列表（可选）
 * @param questionInfos - 题目信息列表（可选，包含正确答案）
 * @returns 转换后的答案记录列表
 */
export function convertFromQuizProgress(
  quizAnswers: Array<{
    questionIndex: number
    answer: number | string
    isCorrect?: boolean
    questionId?: string
    module?: string
  }>,
  questionIds?: string[],
  questionInfos?: Array<{
    questionId: string
    correctAnswer: string | number | (string | number)[]
  }>,
): AnswerRecord[] {
  return quizAnswers.map((ans, index) => {
    // 优先使用 ans.questionId，其次使用 questionIds 数组，最后生成默认ID
    const questionId = ans.questionId || questionIds?.[index] || `question_${ans.questionIndex}`

    // 查找对应的正确答案
    const matchingInfo = questionInfos?.find((q) => q.questionId === questionId)

    return {
      questionId,
      userAnswer: ans.answer,
      isCorrect: ans.isCorrect,
      correctAnswer: matchingInfo?.correctAnswer,
      module: ans.module,
      questionNumber: ans.questionIndex + 1,
    }
  })
}

/**
 * 从题目数据批量添加答案
 * @param questions - 题目列表
 * @param userAnswers - 用户答案映射 { questionId: answer }
 * @returns 答案记录列表
 */
export function convertFromQuestions(
  questions: Array<{
    questionId: string
    correctAnswer?: string | number | (string | number)[]
    module?: string
    questionNumber?: number
  }>,
  userAnswers: Record<string, string | number | (string | number)[]>,
): AnswerRecord[] {
  return questions.map((q, index) => ({
    questionId: q.questionId,
    userAnswer: userAnswers[q.questionId] ?? '',
    correctAnswer: q.correctAnswer,
    module: q.module,
    questionNumber: q.questionNumber || index + 1,
  }))
}
