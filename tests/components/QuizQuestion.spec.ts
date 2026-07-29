import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import QuizQuestion, { type QuestionData } from '@/components/QuizQuestion.vue'
import { useStudentStore } from '@/stores/student'
import { ApiError } from '@/utils/api'

// mock submitAnswers，避免真实网络请求
vi.mock('@/services/apiService', () => ({
  submitAnswers: vi.fn(),
}))

import { submitAnswers } from '@/services/apiService'

// 构造单选题测试数据
const radioQuestion: QuestionData = {
  id: 'WEN_01_Q1',
  wenId: 'WEN_01',
  questionSeq: 1,
  text: '下列哪个选项是正确的？',
  type: 'radio',
  options: [
    { id: 'A', label: '选项A' },
    { id: 'B', label: '选项B' },
    { id: 'C', label: '选项C' },
    { id: 'D', label: '选项D' },
  ],
  correctAnswer: 'B',
  audioUrl: null,
  imageUrl: null,
}

// 构造多选题测试数据
const checkboxQuestion: QuestionData = {
  id: 'WEN_01_Q2',
  wenId: 'WEN_01',
  questionSeq: 2,
  text: '下列哪些选项是正确的？',
  type: 'checkbox',
  options: [
    { id: 'A', label: '选项A' },
    { id: 'B', label: '选项B' },
    { id: 'C', label: '选项C' },
  ],
  correctAnswer: ['A', 'C'],
  audioUrl: null,
  imageUrl: null,
}

describe('QuizQuestion.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染题目序号、题型标签与题干', () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      expect(wrapper.text()).toContain('第 1 题')
      expect(wrapper.text()).toContain('单选')
      expect(wrapper.text()).toContain('下列哪个选项是正确的？')
    })

    it('多选题应显示"多选"标签', () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: checkboxQuestion },
      })
      expect(wrapper.text()).toContain('多选')
    })

    it('应该渲染所有选项', () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      // QuizOptions 子组件渲染 4 个 .option-item
      expect(wrapper.findAll('.option-item')).toHaveLength(4)
    })

    it('未提交时不应显示结果徽章', () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      expect(wrapper.find('.result-badge').exists()).toBe(false)
    })

    it('未提交且无错误时不应显示正确答案区域', () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      expect(wrapper.find('.correct-answer').exists()).toBe(false)
    })

    it('未提交时按钮文字应为"提交答案"', () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      expect(wrapper.find('.submit-btn').text()).toBe('提交答案')
    })
  })

  describe('未登录与空答案拦截', () => {
    it('未登录时点击提交应显示"请先登录"', async () => {
      // 默认未设置 studentId，isLoggedIn 为 false
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      await wrapper.find('.submit-btn').trigger('click')
      expect(wrapper.find('.submit-error').text()).toBe('请先登录')
      expect(submitAnswers).not.toHaveBeenCalled()
    })

    it('已登录但未选答案时点击提交应显示"请先选择答案"', async () => {
      useStudentStore().setStudentId('1234')
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      await wrapper.find('.submit-btn').trigger('click')
      expect(wrapper.find('.submit-error').text()).toBe('请先选择答案')
      expect(submitAnswers).not.toHaveBeenCalled()
    })
  })

  describe('提交答案成功路径', () => {
    it('单选选对后应显示"正确"徽章', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockResolvedValue({ success: true })

      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      // 选择正确答案 B
      await wrapper.findAll('.option-item')[1].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(submitAnswers).toHaveBeenCalledTimes(1)
      expect(wrapper.find('.result-badge.correct').exists()).toBe(true)
      expect(wrapper.find('.result-badge').text()).toBe('正确')
      // 选对时不显示正确答案区域
      expect(wrapper.find('.correct-answer').exists()).toBe(false)
      // 按钮文字变为"已提交"
      expect(wrapper.find('.submit-btn').text()).toBe('已提交')
    })

    it('单选选错后应显示"错误"徽章与正确答案', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockResolvedValue({ success: true })

      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      // 选择错误答案 A
      await wrapper.findAll('.option-item')[0].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(wrapper.find('.result-badge.wrong').exists()).toBe(true)
      expect(wrapper.find('.result-badge').text()).toBe('错误')
      // 选错时显示正确答案区域
      expect(wrapper.find('.correct-answer').exists()).toBe(true)
      expect(wrapper.find('.correct-answer .value').text()).toBe('B')
    })

    it('多选全对时显示"正确"徽章', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockResolvedValue({ success: true })

      const wrapper = mount(QuizQuestion, {
        props: { question: checkboxQuestion },
      })
      // 选 A 和 C（正确答案）
      const items = wrapper.findAll('.option-item')
      await items[0].trigger('click')
      await items[2].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(wrapper.find('.result-badge.correct').exists()).toBe(true)
    })

    it('多选漏选时显示"错误"徽章与正确答案', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockResolvedValue({ success: true })

      const wrapper = mount(QuizQuestion, {
        props: { question: checkboxQuestion },
      })
      // 只选 A（漏了 C）
      await wrapper.findAll('.option-item')[0].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(wrapper.find('.result-badge.wrong').exists()).toBe(true)
      // 多选正确答案格式化应为 "A、C"
      expect(wrapper.find('.correct-answer .value').text()).toBe('A、C')
    })

    it('提交过程中按钮应显示"提交中..."且禁用', async () => {
      useStudentStore().setStudentId('1234')
      // 用一个永不 resolve 的 promise 锁定 isSubmitting 状态
      ;(submitAnswers as any).mockReturnValue(new Promise(() => {}))

      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      await wrapper.findAll('.option-item')[1].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      // 不 flushPromises，让请求挂起
      expect(wrapper.find('.submit-btn').text()).toContain('提交中...')
      expect(wrapper.find('.submit-btn').attributes('disabled')).toBeDefined()
      expect(wrapper.find('.spinner').exists()).toBe(true)
    })
  })

  describe('提交答案失败路径', () => {
    it('ApiError 错误应回显错误消息', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockRejectedValue(new ApiError(400, 'BAD', '答案格式不合法'))

      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      await wrapper.findAll('.option-item')[1].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(wrapper.find('.submit-error').text()).toBe('答案格式不合法')
      // 失败时不进入已提交状态
      expect(wrapper.find('.result-badge').exists()).toBe(false)
      // 按钮恢复可用
      expect(wrapper.find('.submit-btn').text()).toBe('提交答案')
    })

    it('非 ApiError 错误应回显"提交失败"', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockRejectedValue(new Error('网络断开'))

      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      await wrapper.findAll('.option-item')[1].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(wrapper.find('.submit-error').text()).toBe('提交失败')
    })
  })

  describe('事件发射', () => {
    it('选项变化时应发射 update:modelValue 与 answer-change', async () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      await wrapper.findAll('.option-item')[1].trigger('click')
      const emitted = wrapper.emitted()
      expect(emitted).toHaveProperty('update:modelValue')
      expect(emitted['update:modelValue'][0]).toEqual(['B'])
      expect(emitted).toHaveProperty('answer-change')
      expect(emitted['answer-change'][0]).toEqual(['WEN_01_Q1', 'B'])
    })

    it('answer-change 应携带正确的 questionId', async () => {
      const wrapper = mount(QuizQuestion, {
        props: { question: checkboxQuestion },
      })
      await wrapper.findAll('.option-item')[0].trigger('click')
      const events = wrapper.emitted('answer-change')
      expect(events[0]).toEqual(['WEN_01_Q2', ['A']])
    })
  })

  describe('正确答案格式化', () => {
    it('单选正确答案应直接输出字符串', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockResolvedValue({ success: true })

      const wrapper = mount(QuizQuestion, {
        props: { question: radioQuestion },
      })
      // 选错 A 触发显示正确答案 B
      await wrapper.findAll('.option-item')[0].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(wrapper.find('.correct-answer .value').text()).toBe('B')
    })

    it('多选正确答案应用顿号连接', async () => {
      useStudentStore().setStudentId('1234')
      ;(submitAnswers as any).mockResolvedValue({ success: true })

      const wrapper = mount(QuizQuestion, {
        props: { question: checkboxQuestion },
      })
      // 选错：只选 B
      await wrapper.findAll('.option-item')[1].trigger('click')
      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(wrapper.find('.correct-answer .value').text()).toBe('A、C')
    })
  })
})
