import { describe, it, expect } from 'vitest'
import {
  adaptPage,
  adaptQuiz,
  extractQuizzes,
  isCorrect,
  toSubmitValue,
} from '@/adapters/pageAdapter'

const ctx = { wenId: 'WEN_01', fallbackId: 'WEN_01_q1' }

describe('pageAdapter - 答案归一化', () => {
  it('字母答案 B：归一为 key B / index 1，提交回字母', () => {
    const quiz = adaptQuiz(
      {
        question_text: '题干',
        option_a: '甲',
        option_b: '乙',
        option_c: '丙',
        option_d: '丁',
        correct_answer: 'B',
      },
      ctx,
    )

    expect(quiz.answerKeys).toEqual(['B'])
    expect(quiz.answerIndexes).toEqual([1])
    expect(quiz.answerFormat).toBe('letter')
    expect(quiz.optionOffset).toBe(0)
    expect(toSubmitValue(quiz, ['B'])).toBe('B')
  })

  it('数字答案 1（options 数组）：归一为 key B，提交回数字 1', () => {
    const quiz = adaptQuiz(
      {
        question_text: '题干',
        options: ['甲', '乙', '丙', '丁'],
        correct_answer: 1,
      },
      ctx,
    )

    expect(quiz.answerKeys).toEqual(['B'])
    expect(quiz.answerFormat).toBe('index')
    expect(toSubmitValue(quiz, ['B'])).toBe(1)
  })

  it('字符串数字 "1"：按索引处理', () => {
    const quiz = adaptQuiz(
      {
        question_text: '题干',
        options: ['甲', '乙', '丙', '丁'],
        correct_answer: '1',
      },
      ctx,
    )

    expect(quiz.answerIndexes).toEqual([1])
    expect(quiz.answerFormat).toBe('index')
    expect(toSubmitValue(quiz, ['B'])).toBe(1)
  })

  it('仅有 correct_index 时用其作为 0 基索引', () => {
    const quiz = adaptQuiz(
      {
        question_text: '题干',
        option_a: '甲',
        option_b: '乙',
        option_c: '丙',
        correct_index: 2,
      },
      ctx,
    )

    expect(quiz.answerKeys).toEqual(['C'])
    expect(quiz.answerFormat).toBe('index')
  })

  it('多选数组 [0, 2]：keys 为 A、C，提交回数组', () => {
    const quiz = adaptQuiz(
      {
        question_text: '题干',
        options: ['甲', '乙', '丙', '丁'],
        question_type: 'checkbox',
        correct_answer: [0, 2],
      },
      ctx,
    )

    expect(quiz.type).toBe('checkbox')
    expect(quiz.answerKeys).toEqual(['A', 'C'])
    expect(toSubmitValue(quiz, ['A', 'C'])).toEqual([0, 2])
  })

  it('缺正确答案：标记 invalid，不做 0 分兜底', () => {
    const quiz = adaptQuiz({ question_text: '题干', options: ['甲', '乙'] }, ctx)

    expect(quiz.invalid).toBe(true)
    expect(quiz.answerKeys).toEqual([])
  })

  it('答案越界：标记 invalid', () => {
    const quiz = adaptQuiz(
      { question_text: '题干', options: ['甲', '乙'], correct_answer: 9 },
      ctx,
    )

    expect(quiz.invalid).toBe(true)
  })

  it('options[0] 与题干相同：丢弃该选项并同步索引偏移', () => {
    const quiz = adaptQuiz(
      {
        question_text: '以下哪项正确？',
        options: ['以下哪项正确？', '正确项', '错误项1', '错误项2'],
        correct_answer: 1,
      },
      ctx,
    )

    expect(quiz.optionOffset).toBe(1)
    expect(quiz.options.map((option) => option.text)).toEqual(['正确项', '错误项1', '错误项2'])
    expect(quiz.answerKeys).toEqual(['A'])
    // 原始数据用索引 1 表示正确项，提交时必须回到原始空间
    expect(toSubmitValue(quiz, ['A'])).toBe(1)
  })
})

describe('pageAdapter - 页面结构', () => {
  it('blocks 模式：题目走统一 questionId，未知块保留占位', () => {
    const page = adaptPage(
      {
        pageId: 'WEN_01',
        blocks: [
          { type: 'dialogue', data: { pre_dialog: '甲：你好', text_id: 'WEN_01' } },
          { type: 'quiz', data: { question_text: '题干', options: ['甲', '乙'], correct_answer: 'A' } },
          { type: 'mystery', data: {} },
        ],
      },
      { renderMode: 'blocks', wenId: 'WEN_01', pageKey: 'steptwo' },
    )

    expect(page.kind).toBe('blocks')
    if (page.kind !== 'blocks') return

    expect(page.blocks.map((block) => block.type)).toEqual(['dialogue', 'quiz', 'unknown'])
    const quizzes = extractQuizzes(page)
    expect(quizzes).toHaveLength(1)
    expect(quizzes[0]?.id).toBe('WEN_01_q1')
  })

  it('quiz-list 模式：情景文本与题目一一对应', () => {
    const page = adaptPage(
      {
        pageId: 'WEN_01',
        items: [
          {
            text: '情景一',
            quiz: { question_id: 'WEN_01_C1', question_text: '题干', options: ['甲', '乙'], correct_answer: 0 },
          },
        ],
      },
      { renderMode: 'quiz-list', wenId: 'WEN_01', pageKey: 'stepthree' },
    )

    expect(page.kind).toBe('quizList')
    if (page.kind !== 'quizList') return
    expect(page.items[0]?.scenario).toBe('情景一')
    expect(page.items[0]?.quiz.id).toBe('WEN_01_C1')
  })

  it('结构非法时返回空集合而不是抛错', () => {
    const page = adaptPage(null, { renderMode: 'blocks', wenId: 'WEN_01', pageKey: 'steptwo' })
    expect(page.kind).toBe('blocks')
    if (page.kind !== 'blocks') return
    expect(page.blocks).toEqual([])
  })
})

describe('pageAdapter - 判定', () => {
  it('isCorrect 按集合比较，忽略顺序与重复', () => {
    const quiz = adaptQuiz(
      { question_text: '题干', options: ['甲', '乙', '丙'], question_type: 'checkbox', correct_answer: [0, 2] },
      ctx,
    )

    expect(isCorrect(quiz, ['C', 'A'])).toBe(true)
    expect(isCorrect(quiz, ['A', 'A', 'C'])).toBe(true)
    expect(isCorrect(quiz, ['A'])).toBe(false)
  })
})
