/**
 * 答题记录相关类型
 *
 * 数据源：后端 /api/answers/wen/:wenId 与 /api/answers/student/:studentId。
 * 后端返回的字段随版本演进，除已知字段外一律用索引签名透传，
 * 避免组件层为了读取新字段而反复改类型。
 */

/** 单题答题明细 */
export interface AnswerDetail {
  questionId?: string
  questionNumber?: number
  userAnswer?: string
  correctAnswer?: string | number
  isCorrect?: boolean
  score?: number
  submittedAt?: string
  [key: string]: unknown
}

/** 文言文维度下，单个学生的聚合答题记录（/api/answers/wen/:wenId → data.students[i]） */
export interface WenIdAnswerRecord {
  studentId: string
  studentName?: string
  totalQuestions?: number
  correctCount?: number
  wrongCount?: number
  avgScore?: number
  submittedAt?: string
  answers?: AnswerDetail[]
  [key: string]: unknown
}

/** 学生维度下，单篇文言文的聚合答题记录（/api/answers/student/:studentId → data.wenRecords[i]） */
export interface StudentIdAnswerRecord {
  wenId: string
  wenTitle?: string
  totalQuestions?: number
  correctCount?: number
  wrongCount?: number
  avgScore?: number
  submittedAt?: string
  answers?: AnswerDetail[]
  studentId?: string
  studentName?: string
  [key: string]: unknown
}

/** AnswerTable 两种模式下接受的行类型 */
export type AnswerTableRow = WenIdAnswerRecord | StudentIdAnswerRecord
