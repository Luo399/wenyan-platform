import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuizListRenderer from '@/components/figma/QuizListRenderer.vue'
import { defaultQuizInteraction, type QuizInteractionConfig } from '@/config/quizInteraction'
import type { QuizListItemModel, QuizModel } from '@/adapters/pageAdapter'
import type { QuizSnapshot } from '@/composables/useQuizSession'

function makeQuiz(id: string): QuizModel {
  return {
    id,
    wenId: 'WEN_01',
    module: 'C',
    type: 'radio',
    stem: `题干 ${id}`,
    options: [
      { key: 'A', text: '甲', index: 0 },
      { key: 'B', text: '乙', index: 1 },
    ],
    answerKeys: ['A'],
    answerIndexes: [0],
    answerFormat: 'index',
    optionOffset: 0,
    explanation: `解析 ${id}`,
    invalid: false,
  }
}

function makeItems(): QuizListItemModel[] {
  return [
    { scenario: '情景文本', quiz: makeQuiz('q1') },
    { quiz: makeQuiz('q2') },
  ]
}

function makeSnapshot(overrides: Partial<QuizSnapshot> = {}): QuizSnapshot {
  return {
    status: 'answering',
    unlockedIndex: 0,
    selections: {},
    answers: {},
    results: {},
    submittedIds: [],
    error: null,
    answeredCount: 0,
    correctCount: 0,
    total: 2,
    isCompleted: false,
    ...overrides,
  }
}

function mountRenderer(snapshot: QuizSnapshot, config: QuizInteractionConfig = defaultQuizInteraction) {
  return mount(QuizListRenderer, {
    props: { items: makeItems(), snapshot, config },
  })
}

describe('figma/QuizListRenderer', () => {
  it('全量挂载，未解锁题目用 v-show 隐藏而不是卸载', () => {
    const wrapper = mountRenderer(makeSnapshot())

    expect(wrapper.findAll('.fg-quiz-item')).toHaveLength(2)
    expect(wrapper.findAll('.fg-quiz-item')[0]!.attributes('aria-hidden')).toBe('false')
    expect(wrapper.findAll('.fg-quiz-item')[1]!.attributes('aria-hidden')).toBe('true')
  })

  it('allowReview=false 时只展开当前题，旧题仍保留在 DOM', () => {
    const config: QuizInteractionConfig = {
      ...defaultQuizInteraction,
      display: { ...defaultQuizInteraction.display, allowReview: false },
    }
    const wrapper = mountRenderer(
      makeSnapshot({ unlockedIndex: 1, submittedIds: ['q1'] }),
      config,
    )

    const items = wrapper.findAll('.fg-quiz-item')
    expect(items).toHaveLength(2)
    expect(items[0]!.attributes('aria-hidden')).toBe('true')
    expect(items[1]!.attributes('aria-hidden')).toBe('false')
  })

  it('情景文本按 first-item 策略只出现在第一题', () => {
    const wrapper = mountRenderer(makeSnapshot({ unlockedIndex: 1 }))

    expect(wrapper.findAll('.fg-scenario')).toHaveLength(1)
  })

  it('向外转发 select / submit 事件并携带 quizId', async () => {
    const wrapper = mountRenderer(makeSnapshot())

    await wrapper.findAll('.fg-option')[0]!.trigger('click')

    expect(wrapper.emitted('select')).toEqual([['q1', 'A']])
  })

  it('完成后展示统计文案', () => {
    const wrapper = mountRenderer(
      makeSnapshot({
        status: 'completed',
        unlockedIndex: 1,
        answeredCount: 2,
        correctCount: 1,
        isCompleted: true,
        submittedIds: ['q1', 'q2'],
        results: { q1: true, q2: false },
      }),
    )

    expect(wrapper.text()).toContain('测验完成！')
    expect(wrapper.text()).toContain('答对 1 / 2 题')
  })

  it('进度条展示已答 / 总数', () => {
    const wrapper = mountRenderer(makeSnapshot({ answeredCount: 1 }))

    expect(wrapper.find('.fg-progress-text').text()).toBe('1 / 2')
  })
})
