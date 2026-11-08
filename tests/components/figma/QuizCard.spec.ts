import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FigmaQuizCard from '@/components/figma/QuizCard.vue'
import { defaultQuizInteraction, type QuizInteractionConfig } from '@/config/quizInteraction'
import type { QuizModel } from '@/adapters/pageAdapter'

function makeQuiz(overrides: Partial<QuizModel> = {}): QuizModel {
  return {
    id: 'WEN_01_B1',
    wenId: 'WEN_01',
    module: 'B',
    type: 'radio',
    stem: '下列哪项正确？',
    options: [
      { key: 'A', text: '选项甲', index: 0 },
      { key: 'B', text: '选项乙', index: 1 },
    ],
    answerKeys: ['B'],
    answerIndexes: [1],
    answerFormat: 'letter',
    optionOffset: 0,
    explanation: '解析内容',
    invalid: false,
    ...overrides,
  }
}

function makeConfig(display: Partial<QuizInteractionConfig['display']> = {}): QuizInteractionConfig {
  return { ...defaultQuizInteraction, display: { ...defaultQuizInteraction.display, ...display } }
}

describe('figma/QuizCard', () => {
  it('渲染题干与选项，未选择时提交按钮禁用', () => {
    const wrapper = mount(FigmaQuizCard, {
      props: {
        quiz: makeQuiz(),
        selected: [],
        submitted: false,
        verdict: null,
        config: makeConfig(),
      },
    })

    expect(wrapper.text()).toContain('下列哪项正确？')
    expect(wrapper.findAll('.fg-option')).toHaveLength(2)
    expect(wrapper.find('.fg-submit-btn').attributes('disabled')).toBeDefined()
  })

  it('点击选项只发 select，不自行判分', async () => {
    const wrapper = mount(FigmaQuizCard, {
      props: {
        quiz: makeQuiz(),
        selected: [],
        submitted: false,
        verdict: null,
        config: makeConfig(),
      },
    })

    await wrapper.findAll('.fg-option')[1]!.trigger('click')

    expect(wrapper.emitted('select')).toEqual([['B']])
    expect(wrapper.emitted('submit')).toBeUndefined()
    // 未提交时不出现正确/错误判定样式
    expect(wrapper.find('.fg-option.correct').exists()).toBe(false)
  })

  it('选中后可点击提交并发 submit 事件', async () => {
    const wrapper = mount(FigmaQuizCard, {
      props: {
        quiz: makeQuiz(),
        selected: ['B'],
        submitted: false,
        verdict: null,
        config: makeConfig(),
      },
    })

    const submit = wrapper.find('.fg-submit-btn')
    expect(submit.attributes('disabled')).toBeUndefined()
    await submit.trigger('click')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('after-submit：提交后才显示解析，并按 verdict 标记正确项', () => {
    const wrapper = mount(FigmaQuizCard, {
      props: {
        quiz: makeQuiz(),
        selected: ['A'],
        submitted: true,
        verdict: 'wrong',
        config: makeConfig({ showExplanation: 'after-submit' }),
      },
    })

    expect(wrapper.find('.fg-explanation').exists()).toBe(true)
    expect(wrapper.find('.fg-option.correct').text()).toContain('选项乙')
    expect(wrapper.find('.fg-option.wrong').text()).toContain('选项甲')
    expect(wrapper.find('.fg-submit-btn').exists()).toBe(false)
  })

  it('never：即使已提交也不显示解析', () => {
    const wrapper = mount(FigmaQuizCard, {
      props: {
        quiz: makeQuiz(),
        selected: ['B'],
        submitted: true,
        verdict: 'correct',
        config: makeConfig({ showExplanation: 'never' }),
      },
    })

    expect(wrapper.find('.fg-explanation').exists()).toBe(false)
  })

  it('always：未提交也显示解析', () => {
    const wrapper = mount(FigmaQuizCard, {
      props: {
        quiz: makeQuiz(),
        selected: [],
        submitted: false,
        verdict: null,
        config: makeConfig({ showExplanation: 'always' }),
      },
    })

    expect(wrapper.find('.fg-explanation').exists()).toBe(true)
  })

  it('invalid 题显示配置异常且不出现提交按钮', () => {
    const wrapper = mount(FigmaQuizCard, {
      props: {
        quiz: makeQuiz({ invalid: true, answerKeys: [], answerIndexes: [] }),
        selected: [],
        submitted: false,
        verdict: null,
        config: makeConfig(),
      },
    })

    expect(wrapper.text()).toContain('题目配置异常')
    expect(wrapper.find('.fg-submit-btn').exists()).toBe(false)
  })
})
