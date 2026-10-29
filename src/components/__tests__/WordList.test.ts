import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import WordList from '../WordList.vue'

/**
 * 回归锁：生字注释浮层。
 *
 * 线上故障是 WordList 在 onMounted 里手动给 .article-content 绑 mousemove，
 * 而该节点在 v-else 分支内、挂载时两份 JSON 还在加载 → contentRef 为 null → 监听器从未绑上
 * → tooltip 永不出现，同一处理器里的 search_word 埋点也从未上报。
 * 修复方式是把监听改由模板 @mousemove 绑定，所以核心用例必须走
 * 「数据就绪 → 正文节点才出现 → 事件冒泡到容器 → 浮层出现」这条真实路径。
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

/** 释义为空的一条：适配器会直接丢掉，绝不该出现空 data-def 的 span */
const WORD_WITH_EMPTY_MEANING = {
  text_id: 'WEN_90',
  word: '燕雀',
  basic_meaning: '',
  follow_up_questions: [],
}

const BASIC_INFO = {
  text_id: 'WEN_90',
  title: '测试篇目',
  author: '司马迁',
  dynasty: '西汉',
  original_text: '二世元年七月，发闾左適戍渔阳。燕雀安知鸿鹄之志哉。又败走阳夏。',
}

// ============================================================
// 依赖桩
// ============================================================

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

/** 一个 useDataLoader 实例的返回值（ref 用结构类型描述，测试里可直接改 .value） */
interface LoaderHandle {
  loading: { value: boolean }
  error: { value: string | null }
  data: { value: unknown }
  retry: ReturnType<typeof vi.fn>
}

interface LoaderSlice {
  loading: boolean
  error: string | null
  data: unknown
}

/**
 * 可控的 useDataLoader 桩。
 *
 * 组件 setup 里会调用两次（先 word_list 后 text_basic_info），每次返回**新建的 ref**，
 * 并把句柄登记进 ctrl.handles —— 这样测试既能造 loading/error/empty 三态，
 * 也能在同一实例上做"加载中 → 数据就绪"的切换（那正是原 bug 的发生条件）。
 */
const ctrl = vi.hoisted(() => ({
  handles: [] as unknown[],
  wordList: { loading: false, error: null, data: null } as LoaderSlice,
  basicInfo: { loading: false, error: null, data: null } as LoaderSlice,
}))

vi.mock('@/composables/useDataLoader', async () => {
  const { ref } = await import('vue')
  const useDataLoader = (urlFn: () => string): unknown => {
    const slice = urlFn().includes('word_list') ? ctrl.wordList : ctrl.basicInfo
    const handle = {
      loading: ref(slice.loading),
      error: ref(slice.error),
      data: ref(slice.data),
      retry: vi.fn(),
    }
    ctrl.handles.push(handle)
    return handle
  }
  return { useDataLoader }
})

/** 大于组件内 MOUSE_MOVE_THROTTLE_MS(16ms) 的等待，让节流的 trailing 调用落地 */
const TRAILING_WAIT_MS = 40

function setLoaders(wordList: Partial<LoaderSlice>, basicInfo: Partial<LoaderSlice>): void {
  ctrl.wordList = { loading: false, error: null, data: null, ...wordList }
  ctrl.basicInfo = { loading: false, error: null, data: null, ...basicInfo }
}

/** 数据就绪的默认形态；三态用例各自覆盖其中一格 */
function ready(): void {
  setLoaders({ data: WORD_LIST }, { data: BASIC_INFO })
}

/**
 * 挂载并返回组件包装器 + 两个 loader 句柄。
 * 传 'auto' 时只挂载到 loading 态（正文节点还不存在），由用例自己切就绪。
 */
function factory(): { wrapper: VueWrapper; handles: LoaderHandle[] } {
  const wrapper = mount(WordList, { props: { wenId: 'WEN_90' } })
  const handles = ctrl.handles as LoaderHandle[]
  return { wrapper, handles }
}

async function factoryReady(): Promise<VueWrapper> {
  ready()
  const { wrapper } = factory()
  await flushPromises()
  return wrapper
}

/**
 * 在注释词上派发一次会冒泡的 mousemove（监听绑在父容器上，不冒泡就测不到根因）。
 *
 * 用 `[data-def]` 选而不是类名：适配器与组件之间的契约就是
 * 「注释词 = 带 data-def 的 span」，按契约查比按样式钩子查更稳。
 */
async function hoverWord(
  wrapper: VueWrapper,
  word: string,
  point = { x: 120, y: 160 },
): Promise<HTMLElement> {
  const found = wrapper.findAll('[data-def]').find((w) => w.text() === word)
  if (!found) {
    throw new Error(
      `夹具里「${word}」没有被标注成 .annotated-word，检查 original_text 是否包含该词`,
    )
  }
  const el = found.element as HTMLElement
  el.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      view: window,
    }),
  )
  await flushPromises()
  await wrapper.vm.$nextTick()
  return el
}

/**
 * 往正文容器里补一个适配器产不出的注释词节点，用于造异常数据
 * （data-def 为空串 / 压根没有 data-def）。
 *
 * 用 DOM API 构造节点，不再拼 innerHTML 字符串：测试只关心
 * 「这个节点在不在、data-def 是什么」，不该顺带复制组件的渲染结构。
 * class 仍要挂上，因为组件的命中判据就是 annotated-word。
 */
async function hoverInjectedWord(
  wrapper: VueWrapper,
  def: string | null,
  point = { x: 120, y: 160 },
): Promise<void> {
  const content = wrapper.find('.article-content').element as HTMLElement
  const span = document.createElement('span')
  span.className = 'annotated-word'
  span.textContent = '占位'
  if (def !== null) span.setAttribute('data-def', def)
  content.appendChild(span)
  span.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      view: window,
    }),
  )
  await flushPromises()
  await wrapper.vm.$nextTick()
}

function setViewport(width: number, height: number): void {
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('innerHeight', height)
}

/** 让所有元素的 getBoundingClientRect 返回固定尺寸（happy-dom 不做布局，全是 0） */
function stubRect(size: { width: number; height: number }): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    ...size,
    left: 0,
    top: 0,
    right: size.width,
    bottom: size.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

function restoreRect(): void {
  vi.restoreAllMocks()
  // restoreAllMocks 会把 postMock 的实现一起清掉，这里补回来
  postMock.mockImplementation(() => Promise.resolve({ ok: true }))
}

beforeEach(() => {
  postMock.mockClear()
  ctrl.handles.length = 0
  ready()
  // 视口给个确定值，别让 happy-dom 的默认尺寸影响定位断言
  setViewport(800, 600)
})

describe('WordList 渲染分支', () => {
  it('数据就绪后渲染正文与注释词，且默认不显示浮层', async () => {
    const wrapper = await factoryReady()
    expect(wrapper.find('.article-content').exists()).toBe(true)
    expect(wrapper.findAll('[data-def]').length).toBe(2)
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('loading 时只出加载态，正文节点还不存在（原 bug 的触发条件）', async () => {
    setLoaders({ loading: true }, { loading: true })
    const { wrapper } = factory()
    await flushPromises()
    expect(wrapper.find('.loading-state').exists()).toBe(true)
    expect(wrapper.find('.article-content').exists()).toBe(false)
  })

  it('两份数据都到齐才渲染正文：只到一份时仍是加载/空态', async () => {
    setLoaders({ data: WORD_LIST }, { loading: true })
    const { wrapper } = factory()
    await flushPromises()
    expect(wrapper.find('.article-content').exists()).toBe(false)
    expect(wrapper.find('.loading-state').exists()).toBe(true)

    wrapper.unmount()
  })

  it('error 态展示错误文案，点「重试」会把两个数据源都重新拉起', async () => {
    setLoaders({ error: '请求超时' }, {})
    const { wrapper, handles } = factory()
    await flushPromises()
    expect(wrapper.find('.error-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('请求超时')
    expect(wrapper.find('.article-content').exists()).toBe(false)

    await wrapper.find('.retry-btn').trigger('click')
    expect(handles).toHaveLength(2)
    expect(handles[0].retry).toHaveBeenCalledTimes(1)
    expect(handles[1].retry).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('数据为空（既没 loading 也没 error 也没 data）走空态而不是白屏', async () => {
    setLoaders({}, {})
    const { wrapper, handles } = factory()
    await flushPromises()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('暂无数据')
    expect(handles).toHaveLength(2)

    wrapper.unmount()
  })

  it('释义为空的条目被适配器丢掉，正文里不会留下悬停没反应的注释词', async () => {
    setLoaders({ data: [...WORD_LIST, WORD_WITH_EMPTY_MEANING] }, { data: BASIC_INFO })
    const { wrapper } = factory()
    await flushPromises()
    const texts = wrapper.findAll('[data-def]').map((w) => w.text())
    expect(texts).toHaveLength(2)
    expect(new Set(texts)).toEqual(new Set(['阳夏', '鸿鹄']))
    expect(texts).not.toContain('燕雀')
    wrapper.unmount()
  })

  it('加载完成之后才出现的正文节点，鼠标一样能触发浮层（根因回归主用例）', async () => {
    setLoaders({ loading: true }, { loading: true })
    const { wrapper, handles } = factory()
    await flushPromises()
    expect(wrapper.find('.article-content').exists()).toBe(false)

    // 数据到达：正文节点被创建，Vue 在创建时才把 @mousemove 绑上去
    handles[0].loading.value = false
    handles[0].data.value = WORD_LIST
    handles[1].loading.value = false
    handles[1].data.value = BASIC_INFO
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.article-content').exists()).toBe(true)
    await hoverWord(wrapper, '阳夏')
    expect(wrapper.find('.tooltip').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('WordList 生字注释浮层', () => {
  it('悬停注释词 → 浮层出现且内容等于该词的释义（根因回归）', async () => {
    const wrapper = await factoryReady()
    await hoverWord(wrapper, '阳夏')
    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.exists()).toBe(true)
    // 直接对夹具里的释义断言，而不是回读同一个 data-def —— 后者断言恒真，测不出串词
    expect(tooltip.text()).toBe('阳夏（jiǎ），今河南太康')
  })

  it('浮层带无障碍语义：role=tooltip + aria-live=polite', async () => {
    const wrapper = await factoryReady()
    await hoverWord(wrapper, '阳夏')
    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.attributes('role')).toBe('tooltip')
    expect(tooltip.attributes('aria-live')).toBe('polite')
  })

  it('监听绑在正文容器上：事件不冒泡就不会误触发（也是 hover 助手必须 bubbles 的原因）', async () => {
    const wrapper = await factoryReady()
    const el = wrapper.findAll('[data-def]').find((w) => w.text() === '阳夏')!.element
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 160 }))
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('悬停普通正文（非注释词）不弹浮层', async () => {
    const wrapper = await factoryReady()
    const content = wrapper.find('.article-content').element as HTMLElement
    content.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 160, view: window }),
    )
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('data-def 为空的注释词不弹浮层（防御：v-html 内容未必都来自适配器）', async () => {
    const wrapper = await factoryReady()
    await hoverInjectedWord(wrapper, '')
    expect(wrapper.find('.tooltip').exists()).toBe(false)

    await hoverInjectedWord(wrapper, null)
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('鼠标移到正文空白处 → 浮层收起', async () => {
    const wrapper = await factoryReady()
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

  it('在节流窗口内连发一串事件，trailing 用的仍是坐标/词形快照而不是已失效的 MouseEvent', async () => {
    const wrapper = await factoryReady()
    // 按词形取节点，不按位置解构：正文里「鸿鹄」出现在「阳夏」之前
    // （夹具原文「燕雀安知鸿鹄之志哉。又败走阳夏。」），位置假设一改就假失败
    const elByWord = (word: string) =>
      wrapper.findAll('[data-def]').find((w) => w.text() === word)!.element as HTMLElement
    const 阳夏 = elByWord('阳夏')
    const 鸿鹄 = elByWord('鸿鹄')

    // 24 次连发全部落在 16ms 窗口内 ⇒ 除首次外都由 trailing 定时器处理；
    // 修复前 trailing 读 e.target 拿到 null，这里会抛 TypeError（未捕获异常会让整个用例失败）
    for (let i = 0; i < 24; i++) {
      const el = i % 3 === 2 ? 阳夏 : 鸿鹄
      el.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 100 + i,
          clientY: 200 + i,
          view: window,
        }),
      )
    }
    await new Promise((resolve) => setTimeout(resolve, TRAILING_WAIT_MS))
    await flushPromises()
    await wrapper.vm.$nextTick()

    // 最后一次事件是「阳夏」⇒ 浮层显示它，而不是中途的某个词
    expect(wrapper.find('.tooltip').exists()).toBe(true)
    expect(wrapper.find('.tooltip').text()).toBe('阳夏（jiǎ），今河南太康')

    // 卸载只该清掉节流器里还没落地的 trailing 定时器，不能碰已销毁实例的状态
    expect(() => wrapper.unmount()).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, TRAILING_WAIT_MS))
  })

  it('卸载时还有未触发的 trailing 定时器，也不会抛错', async () => {
    const wrapper = await factoryReady()
    await hoverWord(wrapper, '鸿鹄')
    // 紧接着第二次事件走 trailing 定时器，此刻定时器还挂着
    const el = wrapper.findAll('[data-def]').find((w) => w.text() === '阳夏')!.element
    el.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 200, view: window }),
    )
    expect(() => wrapper.unmount()).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, TRAILING_WAIT_MS))
  })

  it('交替悬停两个词 → 浮层内容跟着切', async () => {
    const wrapper = await factoryReady()
    await hoverWord(wrapper, '阳夏')
    expect(wrapper.find('.tooltip').text()).toContain('阳夏（jiǎ）')

    await new Promise((resolve) => setTimeout(resolve, TRAILING_WAIT_MS))
    await hoverWord(wrapper, '鸿鹄')
    expect(wrapper.find('.tooltip').text()).toBe('比喻有远大抱负的人')
  })

  it('首次显示会按估算尺寸定位，渲染完成后用实测尺寸校正一次（R23）', async () => {
    const wrapper = await factoryReady()
    await hoverWord(wrapper, '阳夏')
    // tooltipRef 此刻已有 rect（happy-dom 返回全 0），correctWithRealSize 跑过一轮
    const style = wrapper.find('.tooltip').attributes('style') ?? ''
    expect(style).toContain('left: 130px')
    expect(style).toContain('top: 170px')
  })

  it('实测尺寸很大时翻到光标左上，避免压住「返回 / 继续」按钮', async () => {
    const wrapper = await factoryReady()
    // 300×300 的长注释 + 800×600 视口 + 光标 (700,500)：右下放不下 ⇒ 翻到左上
    stubRect({ width: 300, height: 300 })
    await hoverWord(wrapper, '阳夏', { x: 700, y: 500 })
    const style = wrapper.find('.tooltip').attributes('style') ?? ''
    expect(style).toContain('left: 390px')
    expect(style).toContain('top: 190px')
    restoreRect()
  })
})

describe('WordList 字词查询埋点', () => {
  it('悬停成功后上报一次 search_word，字段齐全', async () => {
    const wrapper = await factoryReady()
    await hoverWord(wrapper, '鸿鹄')
    expect(postMock).toHaveBeenCalledTimes(1)

    /** /api/track 请求体里本测试关心的字段 */
    interface TrackPayload {
      events: Array<{
        event_type: string
        user_id: string
        session_id: string
        step_id: string
        properties: { word: string; is_audio: boolean }
        page_url: string
        timestamp: string
      }>
    }

    const [path, body] = postMock.mock.calls[0] as [string, TrackPayload]
    expect(path).toBe('/api/track')
    const event = body.events[0]
    expect(event.event_type).toBe('search_word')
    expect(event.properties).toEqual({ word: '鸿鹄', is_audio: false })
    expect(event.session_id).toBe('test-session')
    expect(event.step_id).toBe('WEN_90')
    expect(event.user_id).toBe('')
    expect(event.page_url).toBe(window.location.pathname + window.location.search)
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false)
  })

  it('同一个词连续悬停只上报一次，换词才再报', async () => {
    const wrapper = await factoryReady()
    for (let i = 0; i < 3; i++) {
      await hoverWord(wrapper, '鸿鹄')
      await new Promise((resolve) => setTimeout(resolve, TRAILING_WAIT_MS))
    }
    expect(postMock).toHaveBeenCalledTimes(1)

    await hoverWord(wrapper, '阳夏')
    expect(postMock).toHaveBeenCalledTimes(2)
    const [, body] = postMock.mock.calls[1] as [string, { events: [{ word?: string }] }]
    expect(body.events[0].event_type).toBe('search_word')
  })

  it('埋点上报失败不影响浮层显示（fire-and-forget）', async () => {
    postMock.mockImplementationOnce(() => Promise.reject(new Error('网络断开')))
    const wrapper = await factoryReady()
    await hoverWord(wrapper, '鸿鹄')
    await flushPromises()
    expect(wrapper.find('.tooltip').exists()).toBe(true)
  })

  it('没悬停到注释词时不产生埋点', async () => {
    const wrapper = await factoryReady()
    const content = wrapper.find('.article-content').element as HTMLElement
    content.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10, view: window }),
    )
    await new Promise((resolve) => setTimeout(resolve, TRAILING_WAIT_MS))
    expect(postMock).not.toHaveBeenCalled()
  })
})

describe('WordList 样式契约（本次修改的两个产品决策）', () => {
  // 这两条是"源码级"断言：scoped CSS 在单测里不会真的应用到 DOM，
  // 但 cursor: help → pointer、长注释限宽这两个决策不该被无声改回去。
  const sfcSource = (): string => {
    let dir = process.cwd()
    for (let i = 0; i < 6; i++) {
      const candidate = resolve(dir, 'src/components/WordList.vue')
      try {
        return readFileSync(candidate, 'utf8')
      } catch {
        dir = resolve(dir, '..')
      }
    }
    throw new Error('找不到 src/components/WordList.vue')
  }

  const styleBlock = (): string => {
    const src = sfcSource()
    return src.slice(src.indexOf('<style'), src.indexOf('</style>'))
  }

  it('注释词的指针是 pointer，不再用会被误解成帮助标记的 help', () => {
    const css = styleBlock()
    expect(css).not.toContain('cursor: help')
    expect(css).toMatch(
      /\.article-content\s+:deep\(\.annotated-word\)[^{]*\{[^}]*cursor:\s*pointer/,
    )
  })

  it('浮层限宽换行：max-width 同时受 320px 与视口宽度约束', () => {
    const css = styleBlock()
    expect(css).toMatch(/\.tooltip\s*\{[^}]*max-width:\s*min\(320px,\s*calc\(100vw\s*-\s*16px\)\)/)
    expect(css).toMatch(/\.tooltip\s*\{[^}]*white-space:\s*normal/)
    expect(css).toMatch(/\.tooltip\s*\{[^}]*overflow-wrap:\s*break-word/)
  })

  it('浮层不吃掉鼠标事件（否则鼠标移进去会卡在原地）', () => {
    expect(styleBlock()).toMatch(/\.tooltip\s*\{[^}]*pointer-events:\s*none/)
  })
})
