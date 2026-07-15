import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WordList from '@/components/WordList.vue'

describe('WordList.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('初始状态应该显示加载中', () => {
      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })
      expect(wrapper.text()).toContain('加载中')
    })
  })
})
