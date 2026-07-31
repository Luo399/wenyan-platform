import { debugWarn } from '../utils/debug'

export interface RawLevel2QuizItem {
  text_id: string | null
  question_number: number | null
  question_text: string | null
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  audio_file: string | null
  difficulty: string | null
  correct_answer: string | null
  explanation: string | null
  question_type: string | null
}

export interface ProcessedLevel2QuizItem {
  textId: string
  questionId: string
  module: string
  questionNumber: number
  questionText: string
  options: { label: string; value: string }[]
  audioFile: string | null
  difficulty: string
  correctAnswer: string | null
  explanation: string
  questionType: string
}

export function adaptLevel2Quiz(rawData: RawLevel2QuizItem[] | null): ProcessedLevel2QuizItem[] {
  if (!rawData || !Array.isArray(rawData)) {
    debugWarn('Level2测验数据为空或格式异常')
    return []
  }

  return rawData
    .filter((item) => item && item.text_id)
    .map((item, index) => {
      const textId = item.text_id || ''
      // R111: questionId 优先用后端 question_number，index+1 仅作 fallback
      const seq = item.question_number ?? index + 1
      return {
        textId,
        questionId: `${textId}_B${seq}`,
        module: 'B',
        questionNumber: item.question_number || 0,
        questionText: item.question_text || '',
        // R112: 过滤空选项，避免渲染空按钮
        options: [
          { label: 'A', value: item.option_a || '' },
          { label: 'B', value: item.option_b || '' },
          { label: 'C', value: item.option_c || '' },
          { label: 'D', value: item.option_d || '' },
        ].filter((opt) => opt.value.trim() !== ''),
        audioFile: item.audio_file || null,
        difficulty: item.difficulty || 'L2',
        // R109: 用 ?? 避免空字符串/0 被误判为 falsy 而丢失正确答案
        correctAnswer: item.correct_answer ?? null,
        explanation: item.explanation || '',
        questionType: item.question_type || 'radio',
      }
    })
    .filter((item) => item.questionText.trim())
}

export function getLevel2QuizByQuestionNumber(
  data: ProcessedLevel2QuizItem[],
  questionNumber: number,
): ProcessedLevel2QuizItem | null {
  return data.find((item) => item.questionNumber === questionNumber) || null
}

export function getAllLevel2Quizzes(data: ProcessedLevel2QuizItem[]): ProcessedLevel2QuizItem[] {
  return [...data]
}
