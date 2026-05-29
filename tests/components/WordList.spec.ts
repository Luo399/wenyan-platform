import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WordList from '@/components/WordList.vue'

describe('WordList.vue', () => {
  const mockWordListData = [
    {
      text_id: 'WEN_01',
      word: '阳城',
      basic_meaning: '在今河南登封东南',
      synonym_analysis: '',
      follow_up_questions: [],
    },
    {
      text_id: 'WEN_01',
      word: '陈涉',
      basic_meaning: '陈胜，字涉',
      synonym_analysis: '',
      follow_up_questions: [],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
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

  describe('数据加载测试', () => {
    it('应该正确加载字词数据', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(mockWordListData)),
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () =>
            new TextEncoder().encode(
              JSON.stringify({
                text_id: 'WEN_01',
                title: '陈涉世家',
                author: '司马迁',
                dynasty: '汉',
                original_text: '陈胜者，阳城人也',
              }),
            ),
        })

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('加载成功后应该显示字词列表', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(mockWordListData)),
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () =>
            new TextEncoder().encode(
              JSON.stringify({
                text_id: 'WEN_01',
                title: '陈涉世家',
                author: '司马迁',
                dynasty: '汉',
                original_text: '陈胜者，阳城人也',
              }),
            ),
        })

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(wrapper.text()).toContain('阳城')
      expect(wrapper.text()).toContain('陈涉')
    })

    it('应该显示课文标题', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(mockWordListData)),
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () =>
            new TextEncoder().encode(
              JSON.stringify({
                text_id: 'WEN_01',
                title: '陈涉世家',
                author: '司马迁',
                dynasty: '汉',
                original_text: '陈胜者，阳城人也',
              }),
            ),
        })

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(wrapper.text()).toContain('陈涉世家')
    })
  })

  describe('错误处理测试', () => {
    it('加载失败应该显示错误信息', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('网络错误'))

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(wrapper.text()).toContain('错误')
    })

    it('应该显示重试按钮', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('网络错误'))

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(wrapper.find('.retry-btn').exists()).toBe(true)
    })
  })

  describe('空数据处理测试', () => {
    it('空数据应该显示暂无数据', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify([])),
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () =>
            new TextEncoder().encode(
              JSON.stringify({
                text_id: 'WEN_01',
                title: '陈涉世家',
                author: '司马迁',
                dynasty: '汉',
                original_text: '陈胜者，阳城人也',
              }),
            ),
        })

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(wrapper.text()).toContain('暂无数据')
    })
  })
})
