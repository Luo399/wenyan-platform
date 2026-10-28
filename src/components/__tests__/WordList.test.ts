import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import WordList from '../WordList.vue'

/**
 * 回归锁：生字注释浮层。
 *
 * 线上故障是 WordList 在 onMounted 里手动给 .article-content 绑 mousemove，
 * 而该节点在 v-else 分支内、挂载时还不存在 → contentRef 为 null → 监听器从未绑上
 * → tooltip 永不出现，同一处理器里的 search_word 埋点也从未上报。
 * 修复方式是把监听改由模板 @mousemove 绑定，因此这里的断言必须走「数据就绪后
 * 节点才出现 → 事件冒泡到容器 → 浮层出现」这条真实路径。
 */

const WORD_LIST = [
  {
    text_id: 'WEN_90',
    word: '阳夏',
    basic_meaning: '阳夏（jiǎ），今河南太康',
    follow_up_questions: [],
  },
  {
    text_id: 'WEN_90',
    word: '鸿鹄',
    basic_meaning: '比喻有远大抱负的人',
    follow_up_questions: [],
  },
]

const BASIC_INFO = {
  text_id: 'WEN_90',
  title: '测试篇目',
  author: '司马迁',
  dynasty: '西汉',
  original_text: '二世元年七月，发闾左適戍渔阳。燕雀安知鸿鹄之志哉。又败走阳夏。',
}

/** useDataLoader 的桩：按 url 里的目录区分两份数据，返回值保持组件期望的 ref 形态 */
const postMock = vi.fn(() => Promise.resolve({ ok: true }))

vi.mock('@/utils/api', () => ({
  post: (...args: unknown[]) => postMock(...args),
}))

vi.mock('@/utils/tracking', () => ({
  getSessionId: () => 'test-session',
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isLoggedIn: false, user: null }),
}))

// 让 getDataUrlWithVersion 同步返回字符串，桩里才能直接按 URL 分派数据
vi.mock('@/utils/asset', () => ({
  getDataUrlWithVersion: (dir: string, file: string) => `/data/${dir}/${file}`,
}))

vi.mock('@/composables/useDataLoader', () => ({
  useDataLoader: (urlFn: () => string) => {
    const url = urlFn()
    const payload = url.includes('word_list') ? WORD_LIST : BASIC_INFO
    return {
      loading: ref(false),
      error: ref(null),
      data: ref(payload),
      retry: vi.fn(),
    }
  },
}))

/** 大于组件内 MOUSE_MOVE_THROTTLE_MS(16ms) 的等待，用于让节流的 trailing 调用落地 */
const TRAILING_WAIT_MS = 40

async function factory(): Promise<VueWrapper> {
  const wrapper = mount(WordList, { props: { wenId: 'WEN_90' } })
  await flushPromises()
  return wrapper
}

/** 在注释词上派发一次会冒泡的 mousemove（监听绑在父容器上，不冒泡就测不到根因） */
async function hoverWord(wrapper: VueWrapper, word: string) {
  const found = wrapper.findAll('.annotated-word').find((w) => w.text() === word)
  if (!found) {
    throw new Error(
      `夹具里「${word}」没有被标注成 .annotated-word，检查 original_text 是否包含该词`,
    )
  }
  const el = found.element as HTMLElement
  el.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 160, view: window }),
  )
  await flushPromises()
  await wrapper.vm.$nextTick()
  return el
}

beforeEach(() => {
  postMock.mockClear()
})

describe('WordList 生字注释浮层', () => {
  it('数据就绪后渲染正文与注释词', async () => {
    const wrapper = await factory()
    expect(wrapper.find('.article-content').exists()).toBe(true)
    expect(wrapper.findAll('.annotated-word').length).toBe(2)
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('悬停注释词 → 浮层出现且内容等于 data-def（根因回归）', async () => {
    const wrapper = await factory()
    const el = await hoverWord(wrapper, '阳夏')
    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toBe(el.getAttribute('data-def'))
    expect(tooltip.attributes('role')).toBe('tooltip')
  })

  it('悬停成功后会上报一次 search_word 埋点', async () => {
    const wrapper = await factory()
    await hoverWord(wrapper, '鸿鹄')
    expect(postMock).toHaveBeenCalledTimes(1)

    /** /api/track 请求体里本测试关心的字段 */
    interface TrackPayload {
      events: Array<{
        event_type: string
        session_id: string
        step_id: string
        properties: { word: string; is_audio: boolean }
      }>
    }

    const [path, body] = postMock.mock.calls[0] as [string, TrackPayload]
    expect(path).toBe('/api/track')
    expect(body.events[0].event_type).toBe('search_word')
    expect(body.events[0].properties).toEqual({ word: '鸿鹄', is_audio: false })
    expect(body.events[0].session_id).toBe('test-session')
    expect(body.events[0].step_id).toBe('WEN_90')
  })

  it('鼠标移到正文空白处 → 浮层收起', async () => {
    const wrapper = await factory()
    await hoverWord(wrapper, '阳夏')
    expect(wrapper.find('.tooltip').exists()).toBe(true)

    const content = wrapper.find('.article-content').element as HTMLElement
    content.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 40, view: window }),
    )
    // mousemove 是 16ms 节流的，紧随其后的第二次事件走 trailing 定时器，
    // 要等真实时间过去一次才能断言「收起」
    await new Promise((resolve) => setTimeout(resolve, TRAILING_WAIT_MS))
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })
})
