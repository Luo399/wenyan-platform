import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorDisplay from '@/components/ErrorDisplay.vue'

describe('ErrorDisplay.vue', () => {
  const testError = new Error('Test error message')
  const testResourcePath = '/test/resource.mp4'
  const testSourceName = 'TestComponent'

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示通用错误标题当类型未指定时', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
        },
      })
      expect(wrapper.text()).toContain('资源加载失败')
    })
  })

  describe('资源类型渲染测试', () => {
    it('视频类型错误应该显示视频相关标题和图标', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          resourceType: 'video',
          resourcePath: testResourcePath,
        },
      })
      expect(wrapper.text()).toContain('视频资源加载失败')
      expect(wrapper.text()).toContain('视频 (Video)')
    })

    it('音频类型错误应该显示音频相关标题', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          resourceType: 'mp3',
          resourcePath: testResourcePath,
        },
      })
      expect(wrapper.text()).toContain('音频资源加载失败')
    })

    it('图片类型错误应该显示图片相关标题', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          resourceType: 'img',
          resourcePath: testResourcePath,
        },
      })
      expect(wrapper.text()).toContain('图片资源加载失败')
    })

    it('JSON类型错误应该显示数据相关标题', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          resourceType: 'json',
          resourcePath: testResourcePath,
        },
      })
      expect(wrapper.text()).toContain('数据资源加载失败')
    })
  })

  describe('错误信息显示测试', () => {
    it('应该正确显示错误来源组件名', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
        },
      })
      expect(wrapper.text()).toContain('组件：')
      expect(wrapper.text()).toContain(testSourceName)
    })

    it('应该正确显示资源路径', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          resourcePath: testResourcePath,
        },
      })
      expect(wrapper.text()).toContain('路径：')
      expect(wrapper.text()).toContain(testResourcePath)
    })

    it('应该正确显示错误原因', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
        },
      })
      expect(wrapper.text()).toContain('原因：')
      expect(wrapper.text()).toContain(testError.message)
    })

    it('应该正确显示字符串类型的错误信息', () => {
      const stringError = 'String error message'
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: stringError,
          source: testSourceName,
        },
      })
      expect(wrapper.text()).toContain(stringError)
    })
  })

  describe('解决方案建议测试', () => {
    it('视频类型错误应该显示视频相关解决方案', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          resourceType: 'video',
        },
      })
      expect(wrapper.text()).toContain('检查视频文件是否存在')
      expect(wrapper.text()).toContain('确认视频格式是否被浏览器支持')
    })

    it('应该显示自定义的解决方案', () => {
      const customSolution = ['Custom solution 1', 'Custom solution 2']
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          solution: customSolution,
        },
      })
      expect(wrapper.text()).toContain('Custom solution 1')
      expect(wrapper.text()).toContain('Custom solution 2')
    })
  })

  describe('事件处理测试', () => {
    it('点击重试按钮应该触发 retry 事件', async () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
        },
      })

      const retryButton = wrapper.find('button')
      await retryButton.trigger('click')

      expect(wrapper.emitted()).toHaveProperty('retry')
      expect(wrapper.emitted('retry')).toHaveLength(1)
    })

    it('当 showRetry 为 false 时，重试按钮应该不显示', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: testError,
          source: testSourceName,
          showRetry: false,
        },
      })

      expect(wrapper.find('button').exists()).toBe(false)
    })
  })

  describe('查看详情功能测试', () => {
    it('应该显示查看详情按钮', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error:
            'This is a very long error message that should trigger the detail button to appear',
          source: testSourceName,
        },
      })

      expect(wrapper.text()).toContain('查看详情')
    })

    it('点击查看详情应该展开显示完整错误', async () => {
      const longError = 'A'.repeat(100) + ' error'
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: longError,
          source: testSourceName,
        },
      })

      const detailButton = wrapper.findAll('button')[1]
      await detailButton.trigger('click')

      expect(wrapper.text()).toContain(longError)
    })
  })
})
