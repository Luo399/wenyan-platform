import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import QuizCard from '@/components/QuizCard.vue'

describe('QuizCard.vue', () => {
  const mockQuestionData = {
    question_id: 'Q001',
    question_type: 'radio',
    question_text: '下列哪个选项是正确的？',
    options: ['选项A', '选项B', '选项C', '选项D'],
    correct_answer: 1,
    explanation: '这是正确答案的解析',
    difficulty: 'L2',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示题目内容', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })
      expect(wrapper.text()).toContain('下列哪个选项是正确的？')
    })

    it('应该显示所有选项', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })
      expect(wrapper.text()).toContain('选项A')
      expect(wrapper.text()).toContain('选项B')
      expect(wrapper.text()).toContain('选项C')
      expect(wrapper.text()).toContain('选项D')
    })

    it('应该显示提交按钮', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })
      expect(wrapper.text()).toContain('提交')
    })
  })

  describe('选项选择测试', () => {
    it('未提交状态下应该允许选择选项', async () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionB = optionBtns[1]
      await optionB.trigger('click')

      expect(optionB.classes()).toContain('selected')
    })

    it('选择选项后应该显示为已选择状态', async () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionC = optionBtns[2]
      await optionC.trigger('click')

      expect(optionC.classes()).toContain('selected')
    })

    it('可以切换选择的选项', async () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionA = optionBtns[0]
      const optionB = optionBtns[1]

      await optionA.trigger('click')
      await optionB.trigger('click')

      expect(optionA.classes()).not.toContain('selected')
      expect(optionB.classes()).toContain('selected')
    })
  })

  describe('提交功能测试', () => {
    it('选择选项后应该可以提交', async () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionB = optionBtns[1]
      await optionB.trigger('click')

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')

      expect(wrapper.emitted('submit')).toBeTruthy()
      expect(wrapper.emitted('submit')[0]).toEqual([1])
    })

    it('未选择选项时提交按钮应该禁用', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.element.disabled).toBe(true)
    })

    it('选择选项后提交按钮应该启用', async () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: false,
        },
      })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionA = optionBtns[0]
      await optionA.trigger('click')

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.element.disabled).toBe(false)
    })
  })

  describe('提交状态测试', () => {
    it('已提交状态下应该锁定所有选项', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: true,
        },
      })

      const optionBtns = wrapper.findAll('.option-btn')
      optionBtns.forEach((option) => {
        expect(option.element.disabled).toBe(true)
      })
    })

    it('已提交状态下应该隐藏提交按钮', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: true,
        },
      })

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.exists()).toBe(false)
    })

    it('已提交状态下应该显示答案解析区域', () => {
      const wrapper = mount(QuizCard, {
        props: {
          data: mockQuestionData,
          submitted: true,
        },
      })

      expect(wrapper.find('.explanation-box').exists()).toBe(true)
    })
  })
})