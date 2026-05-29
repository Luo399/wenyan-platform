import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BackContinue from '@/components/BackContinue.vue'

describe('BackContinue.vue', () => {
  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(BackContinue)
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示默认的按钮文本', () => {
      const wrapper = mount(BackContinue)
      expect(wrapper.text()).toContain('返回')
      expect(wrapper.text()).toContain('继续')
    })
  })

  describe('属性传递测试', () => {
    it('应该正确渲染自定义的返回按钮文本', () => {
      const wrapper = mount(BackContinue, {
        props: {
          backText: '上一页',
        },
      })
      expect(wrapper.text()).toContain('上一页')
    })

    it('应该正确渲染自定义的继续按钮文本', () => {
      const wrapper = mount(BackContinue, {
        props: {
          continueText: '下一步',
        },
      })
      expect(wrapper.text()).toContain('下一步')
    })

    it('当 showContinue 为 false 时，不应该显示继续按钮', () => {
      const wrapper = mount(BackContinue, {
        props: {
          showContinue: false,
        },
      })
      expect(wrapper.text()).not.toContain('继续')
    })
  })

  describe('事件处理测试', () => {
    it('点击返回按钮应该触发 back 事件', async () => {
      const wrapper = mount(BackContinue)
      const backButton = wrapper.findAll('button')[0]

      await backButton.trigger('click')

      expect(wrapper.emitted()).toHaveProperty('back')
      expect(wrapper.emitted('back')).toHaveLength(1)
    })

    it('点击继续按钮应该触发 continue 事件', async () => {
      const wrapper = mount(BackContinue)
      const continueButton = wrapper.findAll('button')[1]

      await continueButton.trigger('click')

      expect(wrapper.emitted()).toHaveProperty('continue')
      expect(wrapper.emitted('continue')).toHaveLength(1)
    })

    it('应该能正确处理自定义 backEvent', async () => {
      const backSpy = vi.fn()
      const wrapper = mount(BackContinue, {
        props: {
          backEvent: backSpy,
        },
      })
      const backButton = wrapper.findAll('button')[0]

      await backButton.trigger('click')

      expect(backSpy).toHaveBeenCalled()
    })

    it('应该能正确处理自定义 continueEvent', async () => {
      const continueSpy = vi.fn()
      const wrapper = mount(BackContinue, {
        props: {
          continueEvent: continueSpy,
        },
      })
      const continueButton = wrapper.findAll('button')[1]

      await continueButton.trigger('click')

      expect(continueSpy).toHaveBeenCalled()
    })
  })
})
