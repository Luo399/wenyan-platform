import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayer from '@/components/VideoPlayer.vue'

describe('VideoPlayer.vue', () => {
  const testSrc = '/test/video.mp4'
  const testPoster = '/test/poster.jpg'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该渲染视频元素', () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
        },
      })
      const video = wrapper.find('video')
      expect(video.exists()).toBe(true)
    })

    it('应该正确设置 src 属性', () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
        },
      })
      const video = wrapper.find('video')
      expect(video.attributes('src')).toBe(testSrc)
    })

    it('应该正确设置 poster 属性', () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
          poster: testPoster,
        },
      })
      const video = wrapper.find('video')
      expect(video.attributes('poster')).toBe(testPoster)
    })
  })

  describe('控制栏测试', () => {
    it('应该显示播放/暂停按钮', () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
        },
      })
      expect(wrapper.text()).toContain('播放')
    })

    it('应该显示时间显示', () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
        },
      })
      expect(wrapper.text()).toContain('00:00')
    })
  })

  describe('播放状态测试', () => {
    it('初始状态应该显示播放按钮', () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
        },
      })
      expect(wrapper.text()).toContain('播放')
    })
  })

  describe('属性绑定测试', () => {
    it('应该正确响应 src 属性变化', async () => {
      const wrapper = mount(VideoPlayer, {
        props: {
          src: testSrc,
        },
      })

      await wrapper.setProps({
        src: '/new/video.mp4',
      })

      const video = wrapper.find('video')
      expect(video.attributes('src')).toBe('/new/video.mp4')
    })
  })
})
