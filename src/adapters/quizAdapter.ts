export interface QuizItem {
  textId: string
  questionId: string
  module: string
  questionNumber: number
  questionText: string
  options: { label: string; value: string }[]
  audioFile: string | null
  difficulty: string
  correctAnswer: string | number | null
  explanation: string
  questionType: string
}

export interface BlockQuizData {
  text_id?: string
  question_id?: string
  module?: string
  question_number?: number | string
  question_text?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  audio_file?: string
  difficulty?: string
  pre_dialog?: string
  correct_answer?: number | string | null
  explanation?: string
  question_type?: string
}

export function adaptBlockQuizToQuizItem(
  blockData: BlockQuizData,
  textId: string = '',
  questionId: string = '',
): QuizItem {
  const qNumber = typeof blockData.question_number === 'number'
    ? blockData.question_number
    : parseInt(String(blockData.question_number)) || 1

  let correctAnswer: string | number | null = null
  if (blockData.correct_answer !== undefined && blockData.correct_answer !== null) {
    correctAnswer = blockData.correct_answer
  }

  return {
    textId: blockData.text_id || textId,
    questionId: blockData.question_id || questionId || '',
    module: blockData.module || '',
    questionNumber: qNumber,
    questionText: blockData.question_text || '',
    options: [
      { label: 'A', value: blockData.option_a || '' },
      { label: 'B', value: blockData.option_b || '' },
      { label: 'C', value: blockData.option_c || '' },
      { label: 'D', value: blockData.option_d || '' },
    ].filter((opt) => opt.value.trim() !== ''),
    audioFile: blockData.audio_file || null,
    difficulty: blockData.difficulty || 'L2',
    correctAnswer,
    explanation: blockData.explanation || '',
    questionType: blockData.question_type || 'radio',
  }
}

export function isValidQuizItem(item: QuizItem): boolean {
  return item.questionText.trim() !== '' && item.options.length > 0
}