/**
 * 文言文学习平台 API 服务
 *
 * 功能说明：
 * - 从后端获取文本基础信息
 * - 获取字词注释数据
 * - 获取多角色朗读数据
 * - 获取各级测验数据
 * - 支持缓存机制
 *
 * 使用示例：
 * import { getTextBasicInfo, getWordList } from '@/services/apiService'
 * const data = await getTextBasicInfo('WEN_01')
 */

import { get, post } from '@/utils/api'
import type { ApiResponse } from '@/utils/api'
import { ApiError } from '@/utils/api'

// ============================================================
// 类型定义
// ============================================================

/**
 * 文本基础信息
 */
export interface TextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration?: string
  bgm?: string
}

/**
 * 字词注释项
 */
export interface WordItem {
  text_id: string
  word: string
  basic_meaning: string
  synonym_analysis?: string
  follow_up_questions?: string[]
}

/**
 * 多角色朗读数据
 */
export interface MultiRoleReadingData {
  text_id: string
  audio_file: string
  segments: Array<{
    sentence_index: number
    time_range: string
    role_name: string
    dialogue: string
  }>
}

/**
 * 一级测验数据
 */
export interface Level1QuizData {
  text_id: string
  questions: Array<{
    question_id: string
    question: string
    options: string[]
    correct_answer: number | string
    explanation?: string
  }>
}

/**
 * 对话块内容
 */
interface DialogBlockContent {
  speaker: string
  text: string
  audio_file?: string
}

/**
 * 测验块内容
 */
interface QuizBlockContent {
  question: string
  options: string[]
  correct_answer: number | string
}

/**
 * 二级对话数据
 */
export interface Level2DialogData {
  text_id: string
  blocks: Array<
    | {
        block_id: string
        block_type: 'dialog'
        content: DialogBlockContent
      }
    | {
        block_id: string
        block_type: 'quiz'
        content: QuizBlockContent
      }
  >
}

/**
 * 二级测验数据
 */
export interface Level2QuizData {
  text_id: string
  questions: Array<{
    question_id: string
    question: string
    options: string[]
    correct_answer: number | string
    difficulty?: 'easy' | 'medium' | 'hard'
  }>
}

/**
 * 三级情景文本数据
 */
export interface Level3ScenarioText {
  text_id: string
  scenario_text: string
  questions: Array<{
    question_id: string
    question: string
    question_type: string
  }>
}

/**
 * 三级自适应测验数据
 */
export interface Level3AdaptiveQuiz {
  text_id: string
  adaptive_questions: Array<{
    question_id: string
    difficulty: 'L1' | 'L2' | 'L3'
    question: string
    options: string[]
    correct_answer: number | string
    next_question_if_correct?: string
    next_question_if_wrong?: string
    explanation?: string
  }>
}

// ============================================================
// API 服务函数
// ============================================================

/**
 * 获取文本基础信息
 *
 * @param textId 文本ID（如 'WEN_01'）
 */
export async function getTextBasicInfo(textId: string): Promise<ApiResponse<TextBasicInfo>> {
  return get<TextBasicInfo>(`/api/texts/${textId}/basic-info`)
}

/**
 * 获取字词注释数据
 *
 * @param textId 文本ID
 */
export async function getWordList(textId: string): Promise<ApiResponse<WordItem[]>> {
  return get<WordItem[]>(`/api/texts/${textId}/word-list`)
}

/**
 * 获取多角色朗读数据
 *
 * @param textId 文本ID
 */
export async function getMultiRoleReading(
  textId: string,
): Promise<ApiResponse<MultiRoleReadingData>> {
  return get<MultiRoleReadingData>(`/api/texts/${textId}/multi-role-reading`)
}

/**
 * 获取一级测验数据
 *
 * @param textId 文本ID
 */
export async function getLevel1Quiz(textId: string): Promise<ApiResponse<Level1QuizData>> {
  return get<Level1QuizData>(`/api/texts/${textId}/level1-quiz`)
}

/**
 * 获取二级对话数据
 *
 * @param textId 文本ID
 */
export async function getLevel2Dialog(textId: string): Promise<ApiResponse<Level2DialogData>> {
  return get<Level2DialogData>(`/api/texts/${textId}/level2-dialog`)
}

/**
 * 获取二级测验数据
 *
 * @param textId 文本ID
 */
export async function getLevel2Quiz(textId: string): Promise<ApiResponse<Level2QuizData>> {
  return get<Level2QuizData>(`/api/texts/${textId}/level2-quiz`)
}

/**
 * 获取三级情景文本数据
 *
 * @param textId 文本ID
 */
export async function getLevel3ScenarioText(
  textId: string,
): Promise<ApiResponse<Level3ScenarioText>> {
  return get<Level3ScenarioText>(`/api/texts/${textId}/level3-scenario-text`)
}

/**
 * 获取三级自适应测验数据
 *
 * @param textId 文本ID
 */
export async function getLevel3AdaptiveQuiz(
  textId: string,
): Promise<ApiResponse<Level3AdaptiveQuiz>> {
  return get<Level3AdaptiveQuiz>(`/api/texts/${textId}/level3-adaptive-quiz`)
}

/**
 * 批量获取文本数据
 *
 * @param textIds 文本ID数组
 */
export async function getTextBatch(textIds: string[]): Promise<
  ApiResponse<
    Array<{
      text_id: string
      basic_info: TextBasicInfo
      word_list: WordItem[]
    }>
  >
> {
  return post('/api/texts/batch', { text_ids: textIds })
}

/**
 * 转换参数为查询字符串格式
 * R105: Record<string, any> → Record<string, unknown>
 */
function toQueryParams(params: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key in params) {
    if (params[key] != null) {
      result[key] = String(params[key])
    }
  }
  return result
}

/**
 * 获取文本列表
 *
 * @param page 页码
 * @param pageSize 每页数量
 */
export async function getTextList(
  page = 1,
  pageSize = 20,
): Promise<
  ApiResponse<{
    total: number
    texts: Array<{
      text_id: string
      title: string
      author: string
      dynasty: string
    }>
  }>
> {
  return get('/api/texts', toQueryParams({ page, page_size: pageSize }))
}

// ============================================================
// 认证相关接口
// ============================================================

// R103: 已删除 apiService.login（dead code，无调用方）
// 登录走 stores/auth.ts 的 login()，调用 /api/auth/student/login 传 student_id + password
// LoginResponse 接口保留，供 stores/auth.ts 类型参考

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string
  user: {
    id: string
    username: string
    student_id: string
    role: 'student' | 'teacher' | 'admin'
  }
}

// ============================================================
// 答题提交接口
// ============================================================

/**
 * 答题数据接口
 */
export interface QuestionForSubmit {
  id: string
  correctAnswer: string | number | (string | number)[]
}

export interface SubmitAnswersParams {
  studentId: string
  studentName?: string
  wenId: string
  submittedAt: string
  answers: Record<string, string | number | (string | number)[]>
  questions: QuestionForSubmit[]
}

export interface SubmitAnswersResponse {
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
 * 提交答题结果
 *
 * 支持两种调用方式：
 * 1. 传完整 SubmitAnswersParams：由上层（如 useAnswerSubmitter）控制 submittedAt 等业务字段
 * 2. 传拆散参数：submitAnswers 自动生成 submittedAt
 *
 * @param paramsOrData - SubmitAnswersParams 或 {answers, questions}
 * @param wenId - 课文ID（第二种方式必填）
 * @param studentId - 学生ID（第二种方式必填）
 * @param studentName - 学生姓名（可选）
 * @param timeout - 超时时间
 * @returns 提交结果
 */
export async function submitAnswers(
  paramsOrData:
    | SubmitAnswersParams
    | {
        answers: Record<string, string | number | (string | number)[]>
        questions: QuestionForSubmit[]
      },
  wenId?: string,
  studentId?: string,
  studentName?: string,
  timeout?: number,
): Promise<SubmitAnswersResponse> {
  let params: SubmitAnswersParams

  // 通过 studentId + submittedAt 字段判断是否为完整 params 格式
  if (
    typeof paramsOrData === 'object' &&
    paramsOrData !== null &&
    'studentId' in paramsOrData &&
    'submittedAt' in paramsOrData
  ) {
    params = paramsOrData as SubmitAnswersParams
  } else if (wenId && studentId) {
    params = {
      studentId,
      studentName,
      wenId,
      submittedAt: new Date().toISOString(),
      answers: (paramsOrData as { answers: Record<string, string | number | (string | number)[]> }).answers,
      questions: (paramsOrData as { questions: QuestionForSubmit[] }).questions,
    }
  } else {
    throw new Error('submitAnswers 参数错误：需传完整 SubmitAnswersParams 或 (answers+wenId+studentId)')
  }

  const response = await post<SubmitAnswersResponse>('/api/submit', params, { timeout })
  if (!response.success || !response.data) {
    throw new ApiError(500, 'SUBMIT_FAILED', response.message || '提交答题结果失败')
  }
  return response.data
}

export interface SubmitSingleAnswerParams {
  studentId: string
  studentName?: string
  wenId: string
  questionId: string
  userAnswer: string | number | (string | number)[]
  correctAnswer?: string | number | (string | number)[]
  submittedAt?: string
}

export interface SubmitSingleAnswerResponse {
  success: boolean
  message: string
  data?: {
    studentId: string
    wenId: string
    questionId: string
    userAnswer: string | number | (string | number)[]
    correctAnswer?: string | number | (string | number)[]
    isCorrect: number
    score: number
    submittedAt: string
    attemptNumber: number
  }
}

/**
 * 提交单题答案
 */
export async function submitSingleAnswer(
  params: SubmitSingleAnswerParams,
): Promise<SubmitSingleAnswerResponse> {
  const response = await post<SubmitSingleAnswerResponse>('/api/submit/single', {
    ...params,
    submittedAt: params.submittedAt || new Date().toISOString(),
  })
  // R104: 移除 response.data! 非空断言，先校验 success 与 data 存在性
  if (!response.success || !response.data) {
    throw new ApiError(500, 'SUBMIT_FAILED', response.message || '提交单题答案失败')
  }
  return response.data
}
