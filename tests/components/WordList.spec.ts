import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WordList from '@/components/WordList.vue'

// 版本戳地址要读 OSS 运行时配置，单测里与断言无关：固定映射为可区分的相对路径
vi.mock('@/utils/asset', () => ({
  getDataUrlWithVersion: (type: string, fileName: string) => `/mock/${type}/${fileName}`,
}))

const BASIC_INFO = {
  text_id: 'WEN_01',
  title: '岳阳楼记',
  author: '范仲淹',
  dynasty: '宋',
  original_text: '庆历四年春，滕子京谪守巴陵郡。',
}

function jsonResponse(payload: unknown): Response {
  // useDataLoader 走 arrayBuffer + JSON.parse（大文件更快），这里按同一协议构造
  const body = new TextEncoder().encode(JSON.stringify(payload))
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => body.buffer,
    json: async () => payload,
  } as unknown as Response
}

/** fetch 挂起不返回：URL 生成需要先 await 一次，所以加载态在挂载后才置位 */
function stubPendingFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
}

describe('WordList.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      stubPendingFetch()
      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })
      expect(wrapper.exists()).toBe(true)
      // 卸载会 abort 未完成请求，避免 10s 超时定时器泄漏到后续用例
      wrapper.unmount()
    })

    it('请求未返回时应显示加载中', async () => {
      stubPendingFetch()

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('加载中')

      wrapper.unmount()
    })

    it('数据返回后应渲染标题与正文', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = String(input)
          return Promise.resolve(jsonResponse(url.includes('word_list') ? [] : BASIC_INFO))
        }),
      )

      const wrapper = mount(WordList, {
        props: {
          wenId: 'WEN_01',
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('岳阳楼记')
      expect(wrapper.find('.article-content').exists()).toBe(true)

      wrapper.unmount()
    })
  })
})
