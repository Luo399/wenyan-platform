import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import QuizOptions, { type Option } from '@/components/QuizOptions.vue'

// 测试用的选项数据
const radioOptions: Option[] = [
  { id: 'A', label: '选项A' },
  { id: 'B', label: '选项B' },
  { id: 'C', label: '选项C' },
]

const checkboxOptions: Option[] = [
  { id: 'A', label: '选项A' },
  { id: 'B', label: '选项B' },
  { id: 'C', label: '选项C' },
]

describe('QuizOptions.vue', () => {
  beforeEach(() => {
    // 每个用例独立挂载，无需共享状态
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染所有选项', () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio' },
      })
      const items = wrapper.findAll('.option-item')
      expect(items).toHaveLength(3)
      expect(wrapper.text()).toContain('选项A')
      expect(wrapper.text()).toContain('选项B')
      expect(wrapper.text()).toContain('选项C')
    })

    it('radio 模式下选项应带 radio 类', () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio' },
      })
      expect(wrapper.find('.option-item.radio').exists()).toBe(true)
      expect(wrapper.find('.option-item.checkbox').exists()).toBe(false)
    })

    it('checkbox 模式下选项应带 checkbox 类', () => {
      const wrapper = mount(QuizOptions, {
        props: { options: checkboxOptions, type: 'checkbox' },
      })
      expect(wrapper.find('.option-item.checkbox').exists()).toBe(true)
      expect(wrapper.find('.option-item.radio').exists()).toBe(false)
    })

    it('disabled 状态下选项应带 disabled 类', () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio', disabled: true },
      })
      expect(wrapper.find('.option-item.disabled').exists()).toBe(true)
    })
  })

  describe('radio 模式交互', () => {
    it('点击选项应触发 update:modelValue 与 change 事件，携带单值', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio' },
      })
      await wrapper.findAll('.option-item')[1].trigger('click')
      const emitted = wrapper.emitted()
      expect(emitted).toHaveProperty('update:modelValue')
      expect(emitted).toHaveProperty('change')
      expect(emitted['update:modelValue'][0]).toEqual(['B'])
      expect(emitted['change'][0]).toEqual(['B'])
    })

    it('选中后选项应带 selected 类', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio' },
      })
      await wrapper.findAll('.option-item')[0].trigger('click')
      expect(wrapper.findAll('.option-item')[0].classes()).toContain('selected')
      expect(wrapper.findAll('.option-item')[1].classes()).not.toContain('selected')
    })

    it('radio 模式下切换选项只保留最新选择', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio' },
      })
      await wrapper.findAll('.option-item')[0].trigger('click')
      await wrapper.findAll('.option-item')[1].trigger('click')
      // 仅第二项选中
      expect(wrapper.findAll('.option-item')[0].classes()).not.toContain('selected')
      expect(wrapper.findAll('.option-item')[1].classes()).toContain('selected')
      const changeEvents = wrapper.emitted('change')
      expect(changeEvents[changeEvents.length - 1]).toEqual(['B'])
    })
  })

  describe('checkbox 模式交互', () => {
    it('点击多个选项应累积成数组', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: checkboxOptions, type: 'checkbox' },
      })
      const items = wrapper.findAll('.option-item')
      await items[0].trigger('click')
      await items[2].trigger('click')
      const changeEvents = wrapper.emitted('change')
      expect(changeEvents[changeEvents.length - 1]).toEqual([['A', 'C']])
    })

    it('再次点击已选选项应取消选中', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: checkboxOptions, type: 'checkbox' },
      })
      const items = wrapper.findAll('.option-item')
      await items[0].trigger('click') // 选中 A
      await items[2].trigger('click') // 选中 C
      await items[0].trigger('click') // 取消 A
      const changeEvents = wrapper.emitted('change')
      expect(changeEvents[changeEvents.length - 1]).toEqual([['C']])
      expect(items[0].classes()).not.toContain('selected')
      expect(items[2].classes()).toContain('selected')
    })
  })

  describe('v-model 双向绑定', () => {
    it('外部 modelValue 变化时内部 selectedValue 应同步（radio）', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio', modelValue: 'A' },
      })
      // 初始 A 选中
      expect(wrapper.findAll('.option-item')[0].classes()).toContain('selected')
      // 切到 B
      await wrapper.setProps({ modelValue: 'B' })
      expect(wrapper.findAll('.option-item')[0].classes()).not.toContain('selected')
      expect(wrapper.findAll('.option-item')[1].classes()).toContain('selected')
    })

    it('外部 modelValue 变化时内部 selectedValue 应同步（checkbox）', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: checkboxOptions, type: 'checkbox', modelValue: ['A'] },
      })
      expect(wrapper.findAll('.option-item')[0].classes()).toContain('selected')
      await wrapper.setProps({ modelValue: ['B', 'C'] })
      expect(wrapper.findAll('.option-item')[0].classes()).not.toContain('selected')
      expect(wrapper.findAll('.option-item')[1].classes()).toContain('selected')
      expect(wrapper.findAll('.option-item')[2].classes()).toContain('selected')
    })

    it('radio 模式 modelValue 为空时无选中项', () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio', modelValue: '' },
      })
      expect(wrapper.findAll('.option-item.selected')).toHaveLength(0)
    })

    it('checkbox 模式 modelValue 非数组时降级为空数组', () => {
      const wrapper = mount(QuizOptions, {
        props: {
          options: checkboxOptions,
          type: 'checkbox',
          // 故意传入非数组
          modelValue: 'A' as any,
        },
      })
      expect(wrapper.findAll('.option-item.selected')).toHaveLength(0)
    })
  })

  describe('disabled 状态', () => {
    it('disabled 时点击不触发任何事件', async () => {
      const wrapper = mount(QuizOptions, {
        props: { options: radioOptions, type: 'radio', disabled: true },
      })
      await wrapper.findAll('.option-item')[0].trigger('click')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('change')).toBeUndefined()
    })
  })
})
