import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiRoleReading from '@/components/MultiRoleReading.vue'

// Mock fetch
beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        text_id: 'WEN_01',
        audio_file: 'test_audio.mp3',
        segments: [
          {
            sentence_index: 1,
            time_range: '00:00-00:10',
            role_name: '旁白',
            dialogue: '这是第一段',
          },
        ],
      }),
  })
})

describe('MultiRoleReading.vue', () => {
  const testWenId = 'WEN_01'

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem'],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Props 测试', () => {
    it('应该正确接收 wenId prop', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem'],
        },
      })
      expect(wrapper.props('wenId')).toBe(testWenId)
    })
  })

  describe('音频控制测试', () => {
    it('应该显示音频控制按钮', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem'],
        },
      })
      expect(wrapper.find('audio').exists()).toBe(true)
    })
  })
})
