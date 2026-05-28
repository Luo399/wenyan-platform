export interface RawLevel3QuizItem {
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

export interface ProcessedLevel3QuizItem {
  textId: string
  questionNumber: number
  questionText: string
  options: { label: string; value: string }[]
  audioFile: string | null
  difficulty: string
  correctAnswer: string | null
  explanation: string
  questionType: string
}

export function adaptLevel3Quiz(rawData: RawLevel3QuizItem[] | null): ProcessedLevel3QuizItem[] {
  if (!rawData || !Array.isArray(rawData)) {
    console.warn('Level3测验数据为空或格式异常')
    return []
  }

  return rawData
    .filter(item => item && item.text_id === 'WEN_01')
    .map(item => ({
      textId: item.text_id || '',
      questionNumber: item.question_number || 0,
      questionText: item.question_text || '',
      options: [
        { label: 'A', value: item.option_a || '' },
        { label: 'B', value: item.option_b || '' },
        { label: 'C', value: item.option_c || '' },
        { label: 'D', value: item.option_d || '' }
      ],
      audioFile: item.audio_file || null,
      difficulty: item.difficulty || 'L1',
      correctAnswer: item.correct_answer || null,
      explanation: item.explanation || '',
      questionType: item.question_type || 'radio'
    }))
    .filter(item => item.questionText.trim())
}

export function getLevel3QuizByQuestionNumber(data: ProcessedLevel3QuizItem[], questionNumber: number): ProcessedLevel3QuizItem | null {
  return data.find(item => item.questionNumber === questionNumber) || null
}

export function getAllLevel3Quizzes(data: ProcessedLevel3QuizItem[]): ProcessedLevel3QuizItem[] {
  return [...data]
}