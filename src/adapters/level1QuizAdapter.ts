export interface RawLevel1QuizItem {
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

export interface ProcessedLevel1QuizItem {
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

export function adaptLevel1Quiz(rawData: RawLevel1QuizItem[] | null): ProcessedLevel1QuizItem[] {
  if (!rawData || !Array.isArray(rawData)) {
    console.warn('Level1测验数据为空或格式异常')
    return []
  }

  return rawData
    .filter((item) => item && item.text_id)
    .map((item, index) => {
      const textId = item.text_id || ''
      return {
        textId,
        questionId: `${textId}_A${index + 1}`,
        module: 'A',
        questionNumber: item.question_number || 0,
        questionText: item.question_text || '',
        options: [
          { label: 'A', value: item.option_a || '' },
          { label: 'B', value: item.option_b || '' },
          { label: 'C', value: item.option_c || '' },
          { label: 'D', value: item.option_d || '' },
        ],
        audioFile: item.audio_file || null,
        difficulty: item.difficulty || 'L1',
        correctAnswer: item.correct_answer || null,
        explanation: item.explanation || '',
        questionType: item.question_type || 'radio',
      }
    })
    .filter((item) => item.questionText.trim())
}

export function getLevel1QuizByQuestionNumber(
  data: ProcessedLevel1QuizItem[],
  questionNumber: number,
): ProcessedLevel1QuizItem | null {
  return data.find((item) => item.questionNumber === questionNumber) || null
}

export function getAllLevel1Quizzes(data: ProcessedLevel1QuizItem[]): ProcessedLevel1QuizItem[] {
  return [...data]
}
