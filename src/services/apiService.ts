/**
 * 文言文学习平台 API 服务
 *
 * 功能说明：
 * - 从后端获取文本基础信息
 * - 获取字词注释数据
 * - 获取多角色朗读数据
 * - 获取各级测验数据
 * - 支持缓存机制
 * - 用户登录与答题提交
 *
 * 使用示例：
 * import { getTextBasicInfo, getWordList } from '@/services/apiService'
 * const data = await getTextBasicInfo('WEN_01')
 */

import { get, post } from '@/utils/api'
import type { ApiResponse } from '@/utils/api'

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
 * 登录
 *
 * @param studentId - 学号
 * @returns 用户信息和 token
 */
export async function login(studentId: string): Promise<LoginResponse> {
  const response = await post<LoginResponse>('/api/auth/login', { student_id: studentId })
  return response.data!
}

/**
 * 提交答题结果
 *
 * @param submitData - 答题数据（包含answers和questions）
 * @param wenId - 课文ID
 * @param studentId - 学生ID
 * @param studentName - 学生姓名（可选）
 * @param timeout - 超时时间
 * @returns 提交结果
 */
export async function submitAnswers(
  submitData: { answers: Record<string, any>; questions: QuestionForSubmit[] },
  wenId: string,
  studentId: string,
  studentName?: string,
  timeout?: number,
): Promise<SubmitAnswersResponse> {
  const params: SubmitAnswersParams = {
    studentId,
    studentName,
    wenId,
    submittedAt: new Date().toISOString(),
    answers: submitData.answers,
    questions: submitData.questions,
  }

  const response = await post<SubmitAnswersResponse>('/api/submit', params, { timeout })
  return response.data!
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
  return response.data!
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
 */
function toQueryParams(params: Record<string, any>): Record<string, string> {
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
// 辅助函数
// ============================================================

/**
 * 构建本地JSON文件路径
 *
 * @param dataType 数据类型
 * @param textId 文本ID
 */
export function getLocalJsonPath(dataType: string, textId: string): string {
  const typeMap: Record<string, string> = {
    'basic-info': 'text_basic_info',
    'word-list': 'word_list',
    'multi-role-reading': 'multi_role_reading',
    'level1-quiz': 'level1_quiz',
    'level2-dialog': 'level2_dialog',
    'level2-quiz': 'level2_quiz',
    'level3-scenario-text': 'level3_scenario_text',
    'level3-adaptive-quiz': 'level3_adaptive_quiz',
  }
  const dir = typeMap[dataType] || dataType
  return `/data/${dir}/${textId}.json`
}

/**
 * 从本地JSON文件获取数据（降级方案）
 *
 * @param dataType 数据类型
 * @param textId 文本ID
 * @param timeout 超时时间（毫秒），默认5000
 */
export async function getLocalData<T>(
  dataType: string,
  textId: string,
  timeout = 5000,
): Promise<T> {
  const path = getLocalJsonPath(dataType, textId)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(path, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`无法加载本地数据: ${response.status} ${response.statusText} - ${path}`)
    }

    return await response.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`加载本地数据超时: ${path}`)
    }
    throw err
  }
}
