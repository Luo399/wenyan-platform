import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BlocksRenderer from '@/components/figma/BlocksRenderer.vue'
import { defaultQuizInteraction } from '@/config/quizInteraction'
import type { BlockModel, QuizModel } from '@/adapters/pageAdapter'
import type { QuizSnapshot } from '@/composables/useQuizSession'

// 轻量替身：避免真实组件触发数据请求 / 音频逻辑
vi.mock('@/components/DialogueCard.vue', () => ({
  default: {
    name: 'DialogueCardStub',
    props: ['pre_dialog'],
    template: '<div class="dialogue-stub">{{ pre_dialog }}</div>',
  },
}))
vi.mock('@/components/WordList.vue', () => ({
  default: { name: 'WordListStub', template: '<div class="wordlist-stub" />' },
}))
vi.mock('@/components/MultiRoleReading.vue', () => ({
  default: { name: 'MultiRoleReadingStub', template: '<div class="multi-role-stub" />' },
}))
vi.mock('@/components/VideoPlayer.vue', () => ({
  default: { name: 'VideoPlayerStub', template: '<div class="video-stub" />' },
}))

function makeQuiz(id: string): QuizModel {
  return {
    id,
    wenId: 'WEN_01',
    module: 'B',
    type: 'radio',
    stem: `题干 ${id}`,
    options: [{ key: 'A', text: '甲', index: 0 }],
    answerKeys: ['A'],
    answerIndexes: [0],
    answerFormat: 'letter',
    optionOffset: 0,
    explanation: '',
    invalid: false,
  }
}

function makeBlocks(): BlockModel[] {
  return [
    { type: 'dialogue', data: { pre_dialog: '甲：你好' } },
    { type: 'quiz', data: makeQuiz('q1') },
    { type: 'wordlist', data: { wenId: 'WEN_01' } },
    { type: 'multi-role-reading', data: { wenId: 'WEN_01', autoLoad: false } },
    { type: 'video', data: { src: '/video/demo.mp4' } },
    { type: 'quiz', data: makeQuiz('q2') },
    { type: 'unknown', data: { rawType: 'mystery' } },
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

describe('figma/BlocksRenderer', () => {
  it('按类型映射渲染组件，quiz 使用 figma 卡片', () => {
    const wrapper = mount(BlocksRenderer, {
      props: { blocks: makeBlocks(), snapshot: makeSnapshot(), config: defaultQuizInteraction },
    })

    expect(wrapper.findAll('.fg-block')).toHaveLength(7)
    expect(wrapper.find('.dialogue-stub').exists()).toBe(true)
    expect(wrapper.find('.wordlist-stub').exists()).toBe(true)
    expect(wrapper.find('.multi-role-stub').exists()).toBe(true)
    expect(wrapper.find('.video-stub').exists()).toBe(true)
    expect(wrapper.findAll('.fg-quiz-card')).toHaveLength(2)
    expect(wrapper.find('.fg-block-unknown').text()).toContain('mystery')
  })

  it('全部块预挂载，未解锁的后续 quiz 仅视觉隐藏', () => {
    const wrapper = mount(BlocksRenderer, {
      props: { blocks: makeBlocks(), snapshot: makeSnapshot(), config: defaultQuizInteraction },
    })

    const blocks = wrapper.findAll('.fg-block')
    // 第一个 quiz 之前的块与第一个 quiz 可见
    expect(blocks[0]!.attributes('aria-hidden')).toBe('false')
    expect(blocks[1]!.attributes('aria-hidden')).toBe('false')
    // 第二个 quiz 未解锁
    expect(blocks[5]!.attributes('aria-hidden')).toBe('true')
  })

  it('解锁第二个 quiz 后，其之前的块继续保持可见', () => {
    const wrapper = mount(BlocksRenderer, {
      props: {
        blocks: makeBlocks(),
        snapshot: makeSnapshot({ unlockedIndex: 1 }),
        config: defaultQuizInteraction,
      },
    })

    const blocks = wrapper.findAll('.fg-block')
    expect(blocks[5]!.attributes('aria-hidden')).toBe('false')
    expect(blocks[6]!.attributes('aria-hidden')).toBe('false')
  })

  it('转发 select / submit 事件并携带 quizId', async () => {
    const wrapper = mount(BlocksRenderer, {
      props: {
        blocks: [{ type: 'quiz', data: makeQuiz('q1') }],
        snapshot: makeSnapshot({ total: 1 }),
        config: defaultQuizInteraction,
      },
    })

    await wrapper.find('.fg-option').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['q1', 'A']])
  })
})
