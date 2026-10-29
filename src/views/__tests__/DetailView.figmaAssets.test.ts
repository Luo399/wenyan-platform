import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailView from '../DetailView.vue'

/**
 * DetailView × Figma 扫描资产 集成测试
 *
 * 验证课文详情页确实从 OSS images/screens 读取整篇书法标题图，
 * 并在图片加载失败时回退到可见的文字标题（h1 不再 sr-only）。
 */

const h = vi.hoisted(() => ({
  route: { params: { id: '02' } } as { params: { id: string } },
  basicInfo: {
    title: '马说',
    author: '韩愈',
    dynasty: '唐',
    original_text: '世有伯乐，然后有千里马。',
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => h.route,
}))

vi.mock('@/utils/asset', () => ({
  ossBase: 'https://oss.example.com',
  getDataUrlWithVersion: (dir: string, file: string) => `/data/${dir}/${file}`,
}))

vi.mock('@/composables/useDataLoader', async () => {
  const { ref } = await import('vue')
  return {
    useDataLoader: () => ({
      loading: ref(false),
      error: ref(null),
      data: ref(h.basicInfo),
      retry: vi.fn(),
    }),
  }
})

vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => ({ goPrev: vi.fn(), goNext: vi.fn() }),
}))

vi.mock('@/composables/useTracking', () => ({
  useTracking: () => ({ trackInteraction: vi.fn(), trackQuizSubmit: vi.fn() }),
}))

vi.mock('@/utils/tracking', () => ({
  markNextEnterFromBackButton: vi.fn(),
}))

function mountDetail() {
  return mount(DetailView, {
    global: {
      stubs: { AiChatPanel: true, BackContinue: true },
    },
  })
}

beforeEach(() => {
  h.route.params.id = '02'
})

describe('DetailView 标题图接入', () => {
  it('渲染 OSS 上的整篇书法标题图，同时保留读屏文本', () => {
    const wrapper = mountDetail()
    const img = wrapper.find('img.article-title-art')

    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(
      'https://oss.example.com/images/screens/WEN_02/summary/article_title_WEN_02.png',
    )
    expect(img.attributes('aria-hidden')).toBe('true')

    const heading = wrapper.find('h1')
    expect(heading.text()).toBe('马说')
    expect(heading.classes()).toContain('sr-only')
  })

  it('图片加载失败时移除图片并恢复可见文字标题', async () => {
    const wrapper = mountDetail()
    await wrapper.find('img.article-title-art').trigger('error')

    expect(wrapper.find('img.article-title-art').exists()).toBe(false)
    const heading = wrapper.find('h1')
    expect(heading.classes()).not.toContain('sr-only')
    expect(heading.text()).toBe('马说')
  })

  it('目录里没有该篇标题图时直接显示文字标题', () => {
    h.route.params.id = '99'
    const wrapper = mountDetail()

    expect(wrapper.find('img.article-title-art').exists()).toBe(false)
    expect(wrapper.find('h1').classes()).not.toContain('sr-only')
    expect(wrapper.find('h1').text()).toBe('马说')
  })
})
