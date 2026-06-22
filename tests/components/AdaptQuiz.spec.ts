import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import AdaptQuiz from '@/components/AdaptQuiz.vue'
import { useDataLoader } from '@/composables/useDataLoader'

vi.mock('@/composables/useDataLoader')

const blockProps = {
  text_id: 'WEN_01',
  question_id: 'WEN_01_B1',
  question_number: 1,
  question_text: '测试题目1',
  option_a: '选项A内容',
  option_b: '选项B内容',
  option_c: '选项C内容',
  option_d: '选项D内容',
  correct_answer: 2,
  explanation: '答案解析内容',
  difficulty: 'L2',
  question_type: 'radio',
}

describe('AdaptQuiz.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useDataLoader).mockReturnValue({
      loading: ref(false),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref<null>(null),
      retry: vi.fn(),
      load: vi.fn(),
    })
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.adapt-quiz').exists()).toBe(true)
    })

    it('应该显示题目内容', () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })
      expect(wrapper.text()).toContain('测试题目1')
    })

    it('应该显示所有选项', () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })
      const optionLabels = wrapper.findAll('.option-label')
      expect(optionLabels.length).toBe(4)
      expect(optionLabels[0].text()).toBe('A')
      expect(optionLabels[1].text()).toBe('B')
      expect(optionLabels[2].text()).toBe('C')
      expect(optionLabels[3].text()).toBe('D')
    })

    it('应该显示难度标签', () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })
      expect(wrapper.find('.quiz-difficulty').exists()).toBe(true)
    })

    it('应该显示选项文本内容', () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })
      expect(wrapper.text()).toContain('选项A内容')
      expect(wrapper.text()).toContain('选项B内容')
      expect(wrapper.text()).toContain('选项C内容')
      expect(wrapper.text()).toContain('选项D内容')
    })
  })

  describe('选项选择测试', () => {
    it('应该允许选择选项', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionB = optionBtns[1]
      await optionB.trigger('click')
      await flushPromises()

      expect(optionB.classes()).toContain('selected')
    })

    it('选择选项后应该显示为已选择状态', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionC = optionBtns[2]
      await optionC.trigger('click')
      await flushPromises()

      expect(optionC.classes()).toContain('selected')
    })

    it('可以切换选择的选项', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionA = optionBtns[0]
      const optionB = optionBtns[1]

      await optionA.trigger('click')
      await optionB.trigger('click')
      await flushPromises()

      expect(optionA.classes()).not.toContain('selected')
      expect(optionB.classes()).toContain('selected')
    })

    it('已提交后应该不能修改选择', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      await optionBtns[0].trigger('click')
      await flushPromises()

      expect(optionBtns[0].classes()).not.toContain('selected')
      expect(optionBtns[2].classes()).toContain('correct')
    })
  })

  describe('答案正确性判断测试', () => {
    it('选择正确答案应该显示correct状态', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const refreshedOptions = wrapper.findAll('.option-btn')
      expect(refreshedOptions[2].classes()).toContain('correct')
    })

    it('选择错误答案应该显示wrong状态', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[0].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const refreshedOptions = wrapper.findAll('.option-btn')
      expect(refreshedOptions[0].classes()).toContain('wrong')
      expect(refreshedOptions[2].classes()).toContain('correct')
    })

    it('答案比较应该正确处理数字格式的correct_answer', async () => {
      const propsWithNumericAnswer = {
        ...blockProps,
        correct_answer: 1,
        question_text: '测试题目',
      }

      const wrapper = mount(AdaptQuiz, { props: propsWithNumericAnswer })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[1].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const emittedAnswer = wrapper.emitted('answer')
      expect(emittedAnswer).toBeTruthy()
      expect(emittedAnswer![0][2]).toBe(true)
    })
  })

  describe('提交功能测试', () => {
    it('选择选项后应该可以提交', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionB = optionBtns[1]
      await optionB.trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('answer')).toBeTruthy()
      expect(wrapper.emitted('quiz-submitted')).toBeTruthy()
    })

    it('未选择选项时提交按钮应该禁用', () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.element.disabled).toBe(true)
    })

    it('选择选项后提交按钮应该启用', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      const optionA = optionBtns[0]
      await optionA.trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.element.disabled).toBe(false)
    })
  })

  describe('提交状态测试', () => {
    it('已提交状态下应该显示结果', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.explanation-box').exists()).toBe(true)
      expect(wrapper.text()).toContain('解析')
    })

    it('已提交状态下应该显示完成按钮', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const nextBtn = wrapper.find('.next-btn')
      expect(nextBtn.exists()).toBe(true)
      expect(nextBtn.text()).toContain('完成')
    })

    it('点击完成按钮应该发射complete事件', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const nextBtn = wrapper.find('.next-btn')
      await nextBtn.trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('complete')
      expect(emitted).toBeTruthy()
    })
  })

  describe('事件发射测试', () => {
    it('提交答案时应该发射answer事件', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('answer')
      expect(emitted).toBeTruthy()
      expect(emitted!.length).toBe(1)
    })

    it('完成所有题目时应该发射complete事件', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const nextBtn = wrapper.find('.next-btn')
      await nextBtn.trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('complete')
      expect(emitted).toBeTruthy()
    })
  })

  describe('correct_answer格式兼容性测试', () => {
    it('应该正确处理数字格式的correct_answer', async () => {
      const propsWithNumericAnswer = {
        ...blockProps,
        correct_answer: 2,
        question_text: '数字答案测试题目',
      }

      const wrapper = mount(AdaptQuiz, { props: propsWithNumericAnswer })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const emittedAnswer = wrapper.emitted('answer')
      expect(emittedAnswer![0][2]).toBe(true)
    })

    it('应该正确处理correct_answer为0的情况', async () => {
      const propsWithZeroAnswer = {
        ...blockProps,
        correct_answer: 0,
        question_text: '零答案测试题目',
      }

      const wrapper = mount(AdaptQuiz, { props: propsWithZeroAnswer })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[0].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const emittedAnswer = wrapper.emitted('answer')
      expect(emittedAnswer![0][2]).toBe(true)
    })

    it('应该正确处理correct_answer为1的情况', async () => {
      const propsWithOneAnswer = {
        ...blockProps,
        correct_answer: 1,
        question_text: '1答案测试题目',
      }

      const wrapper = mount(AdaptQuiz, { props: propsWithOneAnswer })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[1].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const emittedAnswer = wrapper.emitted('answer')
      expect(emittedAnswer![0][2]).toBe(true)
    })

    it('应该正确处理correct_answer为3的情况', async () => {
      const propsWithThreeAnswer = {
        ...blockProps,
        correct_answer: 3,
        question_text: '3答案测试题目',
      }

      const wrapper = mount(AdaptQuiz, { props: propsWithThreeAnswer })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[3].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      const emittedAnswer = wrapper.emitted('answer')
      expect(emittedAnswer![0][2]).toBe(true)
    })
  })

  describe('错误状态测试', () => {
    it('应该显示错误状态', async () => {
      vi.mocked(useDataLoader).mockReturnValue({
        loading: ref(false),
        error: ref('加载失败'),
        isTimeout: ref(false),
        data: ref<null>(null),
        retry: vi.fn(),
        load: vi.fn(),
      })

      const wrapper = mount(AdaptQuiz, {
        props: { textId: 'WEN_01', level: 'level1' },
      })
      await flushPromises()

      expect(wrapper.find('.quiz-error').exists()).toBe(true)
      expect(wrapper.text()).toContain('加载失败')
    })

    it('加载失败时应该发射error事件', async () => {
      vi.mocked(useDataLoader).mockReturnValue({
        loading: ref(false),
        error: ref('加载失败'),
        isTimeout: ref(false),
        data: ref<null>(null),
        retry: vi.fn(),
        load: vi.fn(),
      })

      const wrapper = mount(AdaptQuiz, {
        props: { textId: 'WEN_01', level: 'level1' },
      })
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
    })
  })

  describe('难度标签测试', () => {
    it('应该显示L1难度标签', () => {
      const propsWithL1 = { ...blockProps, difficulty: 'L1' }
      const wrapper = mount(AdaptQuiz, { props: propsWithL1 })
      expect(wrapper.find('.difficulty-l1').exists()).toBe(true)
    })

    it('应该显示L2难度标签', () => {
      const propsWithL2 = { ...blockProps, difficulty: 'L2' }
      const wrapper = mount(AdaptQuiz, { props: propsWithL2 })
      expect(wrapper.find('.difficulty-l2').exists()).toBe(true)
    })

    it('应该显示L3难度标签', () => {
      const propsWithL3 = { ...blockProps, difficulty: 'L3' }
      const wrapper = mount(AdaptQuiz, { props: propsWithL3 })
      expect(wrapper.find('.difficulty-l3').exists()).toBe(true)
    })
  })

  describe('解析内容测试', () => {
    it('应该显示解析内容', async () => {
      const wrapper = mount(AdaptQuiz, { props: blockProps })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.explanation-text').exists()).toBe(true)
      expect(wrapper.find('.explanation-text').text()).toBe('答案解析内容')
    })

    it('没有解析内容时不应该显示解析框', async () => {
      const propsWithoutExplanation = { ...blockProps, explanation: '' }
      const wrapper = mount(AdaptQuiz, { props: propsWithoutExplanation })

      const optionBtns = wrapper.findAll('.option-btn')
      await optionBtns[2].trigger('click')
      await flushPromises()

      const submitBtn = wrapper.find('.submit-btn')
      await submitBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.explanation-box').exists()).toBe(false)
    })
  })
})
