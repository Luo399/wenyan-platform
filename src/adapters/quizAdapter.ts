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
  // R110: 用 Number + 兜底替代 parseInt || 1，避免空串/非法值时 parseInt 返回 NaN 再被 || 1 吞掉
  const parsedNumber =
    typeof blockData.question_number === 'number'
      ? blockData.question_number
      : Number(blockData.question_number)
  const qNumber = Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : 1

  return {
    textId: blockData.text_id || textId,
    questionId: blockData.question_id || questionId || '',
    module: blockData.module || '',
    questionNumber: qNumber,
    questionText: blockData.question_text || '',
    // R113: 抽取 buildOptions 保持单一职责；R112: 过滤空选项
    options: buildQuizOptions(blockData),
    audioFile: blockData.audio_file || null,
    difficulty: blockData.difficulty || 'L2',
    // R110: 用 ?? 保持 0/'' 等合法 falsy 答案
    correctAnswer: blockData.correct_answer ?? null,
    explanation: blockData.explanation || '',
    questionType: blockData.question_type || 'radio',
  }
}

/**
 * R113: 构造选择题选项并过滤空值（从 adaptBlockQuizToQuizItem 拆分）
 */
function buildQuizOptions(blockData: BlockQuizData): { label: string; value: string }[] {
  return [
    { label: 'A', value: blockData.option_a || '' },
    { label: 'B', value: blockData.option_b || '' },
    { label: 'C', value: blockData.option_c || '' },
    { label: 'D', value: blockData.option_d || '' },
  ].filter((opt) => opt.value.trim() !== '')
}

export function isValidQuizItem(item: QuizItem): boolean {
  return (
    Boolean(item?.questionText?.trim()) && Array.isArray(item?.options) && item.options.length > 0
  )
}
