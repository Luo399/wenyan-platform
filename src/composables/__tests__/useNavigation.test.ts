/**
 * useNavigation 回归测试（R140）
 *
 * 覆盖的现象：用户在部分浏览器环境里点「继续」没反应、跳不动。
 * 根因是 rules/rule1/rule2/rule3（以及 stepone/steptwo/stepthree）共用同一个视图组件，
 * vue-router 的 RouterView 不设 vnode key，跨路由时组件实例被复用、setup 不重跑，
 * 旧实现把路由名/篇目 ID 当普通值一次性捕获，于是：
 *   在 /rule1/1 上算出的「下一页」还是按 rules 算 → 正好等于当前地址
 *   → vue-router 按重复导航静默丢弃 → 页面不动。
 * 这组用例刻意在「实例复用」状态下点击，锁死这个行为。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { useNavigation } from '@/composables/useNavigation'

// 埋点与日志在单测里全部静音：只关心路由结果
vi.mock('@/utils/tracking', () => ({
  track: vi.fn(),
  setPendingExitType: vi.fn(),
  markNextEnterFromBackButton: vi.fn(),
}))
vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}))

/** 最小宿主组件：一个按钮点下去就调 goNext，另存 goPrev / 当前导航状态 */
const NavStub = defineComponent({
  name: 'NavStub',
  setup() {
    const nav = useNavigation()
    // hasNext 单独提到 setup 返回值顶层：Vue 只 unwrap 顶层 ref，
    // 嵌套在 nav 里的 computed 取到的是 ref 本身，测试里读布尔值会误判
    return { nav, hasNext: nav.hasNext }
  },
  render() {
    return h('div', [
      h('button', { class: 'next', onClick: () => this.nav.goNext() }, 'next'),
      h('button', { class: 'prev', onClick: () => this.nav.goPrev() }, 'prev'),
    ])
  },
})

/** 与 src/config/navigation.ts 的 pageSequence 路径规则保持一致的路由表 */
function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: NavStub },
      { path: '/rules/:id', name: 'rules', component: NavStub },
      { path: '/rule1/:id', name: 'rule1', component: NavStub },
      { path: '/stepone/:id', name: 'stepone', component: NavStub },
      { path: '/rule2/:id', name: 'rule2', component: NavStub },
      { path: '/steptwo/:id', name: 'steptwo', component: NavStub },
      { path: '/rule3/:id', name: 'rule3', component: NavStub },
      { path: '/stepthree/:id', name: 'stepthree', component: NavStub },
      { path: '/detail/:id', name: 'detail', component: NavStub },
      // 非顺序页面：不在 pageSequence 里，用来验证提示值兜底
      { path: '/student-login', name: 'student-login', component: NavStub },
    ],
  })
}

describe('useNavigation - 组件实例复用时的实时路由', () => {
  let router: Router

  beforeEach(() => {
    router = createTestRouter()
  })

  it('rules → rule1 复用实例后，继续仍然前进到 stepone（不再原地不动）', async () => {
    await router.push('/rules/1')
    const wrapper = mount(NavStub, { global: { plugins: [router] } })

    // 关键：模拟同组件跨路由跳转 —— 实例不重建，setup 不会再执行一次
    await router.push('/rule1/1')
    await nextTick()
    expect(router.currentRoute.value.path).toBe('/rule1/1')

    await wrapper.get('button.next').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    // 旧实现在这里会停在 /rule1/1（目标算成了当前地址，重复导航被丢弃）
    expect(router.currentRoute.value.path).toBe('/stepone/1')
  })

  it('rule2 上点击继续走的是 rule2 的下一页，而不是首次进入页面的下一页', async () => {
    await router.push('/rules/1')
    const wrapper = mount(NavStub, { global: { plugins: [router] } })
    await router.push('/stepone/1')
    await nextTick()

    await wrapper.get('button.next').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    // pageSequence: stepone → rule2
    expect(router.currentRoute.value.name).toBe('rule2')
  })

  it('目标地址与当前地址相同时不重复 push', async () => {
    await router.push('/rules/1')
    const wrapper = mount(NavStub, { global: { plugins: [router] } })
    const pushSpy = vi.spyOn(router, 'push')

    // /rules/1 的下一页是 /rule1/1，先正常跳过去
    await wrapper.get('button.next').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/rule1/1')

    pushSpy.mockClear()
    // 再点一次应该跳到 stepone；无论如何不该对同一个 fullPath 连发两次 push
    await wrapper.get('button.next').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/stepone/1')
  })

  it('最后一页（detail）点继续不跳转、也不报错', async () => {
    await router.push('/detail/1')
    const wrapper = mount(NavStub, { global: { plugins: [router] } })

    await wrapper.get('button.next').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(router.currentRoute.value.path).toBe('/detail/1')
    expect(wrapper.vm.hasNext).toBe(false)
  })

  it('第一页（rules）点返回回到首页', async () => {
    await router.push('/rules/1')
    const wrapper = mount(NavStub, { global: { plugins: [router] } })

    await wrapper.get('button.prev').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('篇目 ID 随路由参数实时更新', async () => {
    await router.push('/rules/1')
    const wrapper = mount(NavStub, { global: { plugins: [router] } })

    // 同一条路由只换参数（router-view 的 key 是 route.name，这种情况实例复用）
    await router.push('/rules/7')
    await nextTick()

    await wrapper.get('button.next').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(router.currentRoute.value.path).toBe('/rule1/7')
  })

  it('非顺序页面：实时路由不在 pageSequence 时不抛错', async () => {
    await router.push('/student-login')
    const wrapper = mount(NavStub, { global: { plugins: [router] } })

    await wrapper.get('button.next').trigger('click')
    await wrapper.get('button.prev').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(router.currentRoute.value.name).toBe('student-login')
  })
})
