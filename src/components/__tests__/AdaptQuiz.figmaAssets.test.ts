import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AdaptQuiz from '../AdaptQuiz.vue'
import type { QuizItem } from '@/adapters/quizAdapter'

/**
 * AdaptQuiz × Figma 扫描资产 集成测试
 *
 * 验证选项按钮确实从 OSS images/screens/{wenId}/quiz 读取 option_a..d 底图，
 * 并在该篇没有素材时不写 background-image（保持纯 CSS 回退）。
 */

vi.mock('@/utils/asset', () => ({
  ossBase: 'https://oss.example.com',
}))

const quiz: QuizItem = {
  textId: 'WEN_02',
  questionId: 'WEN_02_B1',
  module: 'B',
  questionNumber: 1,
  questionText: '下列对“其真无马邪”理解正确的一项是？',
  options: [
    { label: 'A', value: '真的没有千里马吗' },
    { label: 'B', value: '难道真的没有千里马吗' },
    { label: 'C', value: '它的确没有千里马' },
    { label: 'D', value: '它真的不是马' },
  ],
  audioFile: null,
  difficulty: 'L2',
  correctAnswer: 'B',
  explanation: '“其”表反问，“邪”通“耶”，应理解为“难道真的没有千里马吗”。',
  questionType: 'radio',
}

function mountQuiz(textId = 'WEN_02') {
  return mount(AdaptQuiz, {
    props: {
      textId,
      level: 'level2',
      quizzes: [quiz],
      autoLoad: false,
    },
  })
}

describe('AdaptQuiz 选项底图接入', () => {
  it('四个选项分别使用 OSS 上的 option_a..d 底图', () => {
    const wrapper = mountQuiz()
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons).toHaveLength(4)

    for (const [index, label] of ['A', 'B', 'C', 'D'].entries()) {
      const style = buttons[index].attributes('style') ?? ''
      expect(style).toContain(
        `https://oss.example.com/images/screens/WEN_02/quiz/option_${label.toLowerCase()}_01.png`,
      )
    }
  })

  it('该篇没有扫描素材时不设置 background-image，回退纯 CSS', () => {
    const wrapper = mountQuiz('WEN_99')
    const buttons = wrapper.findAll('.option-btn')
    expect(buttons).toHaveLength(4)
    for (const button of buttons) {
      expect(button.attributes('style') ?? '').not.toContain('background-image')
    }
  })

  it('选中错误选项提交后仍能正常标出正确/错误状态（底图不影响答题）', async () => {
    const wrapper = mountQuiz()
    const buttons = wrapper.findAll('.option-btn')

    await buttons[0].trigger('click')
    expect(buttons[0].classes()).toContain('selected')

    await wrapper.find('.submit-btn').trigger('click')

    expect(wrapper.find('.submit-btn').exists()).toBe(false)
    expect(wrapper.find('.next-btn').exists()).toBe(true)
    expect(wrapper.find('.explanation-box').text()).toContain('难道真的没有千里马吗')

    const after = wrapper.findAll('.option-btn')
    expect(after[0].classes()).toContain('wrong')
    expect(after[1].classes()).toContain('correct')
  })
})
