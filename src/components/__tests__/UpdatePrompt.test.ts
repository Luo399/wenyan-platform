/**
 * UpdatePrompt 组件单测（发布新鲜度阶段 4）
 *
 * 这一层只该做「展示 + 把用户的选择交回去」，所以重点全在两个不可能上：
 * 1. 不可能自动刷新：事件到来时只出现提示，没有任何路径替用户刷页面；
 *    刷新只在点击后走 requestManualRefresh（这里整体替换掉，不看真实 location）。
 * 2. 不可能盖掉更要紧的那条：已经加载失败时，「发现新版本」不能把它顶掉。
 * 另外锁住单根节点（阶段 1 在 fragment 上踩过）与「稍后再说」的落库行为。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const refreshSpy = vi.hoisted(() => vi.fn())

vi.mock('@/utils/buildVersion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/buildVersion')>()
  return { ...actual, requestManualRefresh: refreshSpy }
})

import UpdatePrompt from '@/components/common/UpdatePrompt.vue'
import {
  CHUNK_RELOAD_FAILED_EVENT,
  CHUNK_RELOAD_HINT_KEY,
  type ChunkRecoveryHint,
} from '@/utils/chunkRecovery'
import {
  NEW_VERSION_DISMISS_KEY,
  NEW_VERSION_EVENT,
  RECOVERY_HINT_TTL_MS,
  describeRecoveryHint,
  type VersionFingerprint,
} from '@/utils/buildVersion'

const NEW_BUILD: VersionFingerprint = { kind: 'build-id', value: 'a1b2c3d' }

function emitNewVersion(): void {
  window.dispatchEvent(new CustomEvent(NEW_VERSION_EVENT, { detail: NEW_BUILD }))
}

function emitRecovery(hint: ChunkRecoveryHint): void {
  window.dispatchEvent(new CustomEvent(CHUNK_RELOAD_FAILED_EVENT, { detail: hint }))
}

function hint(reason: ChunkRecoveryHint['reason'], at = Date.now()): ChunkRecoveryHint {
  return { path: '/stepone/3', reason, at }
}

describe('UpdatePrompt 组件', () => {
  beforeEach(() => {
    refreshSpy.mockClear()
    window.sessionStorage.clear()
  })

  it('单个 div 根节点，初始不显示', () => {
    const wrapper = mount(UpdatePrompt)

    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.classes()).toContain('is-hidden')
    expect(wrapper.text()).toBe('')
  })

  it('发现新版本只出现提示，不替用户刷新页面', async () => {
    const wrapper = mount(UpdatePrompt)
    emitNewVersion()
    await wrapper.vm.$nextTick()

    expect(wrapper.classes()).not.toContain('is-hidden')
    expect(wrapper.text()).toContain('发现新版本')
    expect(wrapper.text()).toContain('a1b2c3d')
    expect(refreshSpy).not.toHaveBeenCalled()
  })

  it('点「刷新页面」才走刷新；点「稍后再说」记下指纹并收起', async () => {
    const wrapper = mount(UpdatePrompt)
    emitNewVersion()
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="update-dismiss"]').trigger('click')
    expect(wrapper.classes()).toContain('is-hidden')
    expect(window.sessionStorage.getItem(NEW_VERSION_DISMISS_KEY)).toBe('build-id:a1b2c3d')

    emitNewVersion()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="update-refresh"]').trigger('click')
    expect(refreshSpy).toHaveBeenCalledTimes(1)
  })

  it('入口 chunk 口径的指纹不把文件名念给学生', async () => {
    const wrapper = mount(UpdatePrompt)
    window.dispatchEvent(
      new CustomEvent(NEW_VERSION_EVENT, {
        detail: { kind: 'entry-chunk', value: '/assets/index-PXv-Td1Z.js' } satisfies VersionFingerprint,
      }),
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('发现新版本')
    expect(wrapper.text()).not.toContain('index-PXv-Td1Z')
  })

  it('阶段 3 放弃自动重载时，给出那句人话而不是错误码', async () => {
    const wrapper = mount(UpdatePrompt)
    const failure = hint('already-reloaded')
    emitRecovery(failure)
    await wrapper.vm.$nextTick()

    // 只比正文：整条 wrapper.text() 会把两个按钮的字也带上
    expect(wrapper.find('.update-prompt-text').text()).toBe(describeRecoveryHint(failure))

    await wrapper.find('[data-testid="update-dismiss"]').trigger('click')
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_HINT_KEY)).toBeNull()
  })

  it('监听就绪之前就已经失败过的，挂载时从 sessionStorage 补上', () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_HINT_KEY, JSON.stringify(hint('cooldown')))

    const wrapper = mount(UpdatePrompt)
    expect(wrapper.classes()).not.toContain('is-hidden')
    expect(wrapper.text()).toContain('手动刷新')
  })

  it('过期太久的旧记录不再弹（那次失败早就被后面的正常导航盖过去了）', () => {
    window.sessionStorage.setItem(
      CHUNK_RELOAD_HINT_KEY,
      JSON.stringify(hint('offline', Date.now() - RECOVERY_HINT_TTL_MS - 60_000)),
    )

    const wrapper = mount(UpdatePrompt)
    expect(wrapper.classes()).toContain('is-hidden')
    expect(wrapper.text()).toBe('')
  })

  it('加载失败比「发现新版本」更要紧，不能被顶掉', async () => {
    const wrapper = mount(UpdatePrompt)
    const failure = hint('unavailable-storage')
    emitRecovery(failure)
    emitNewVersion()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.update-prompt-text').text()).toBe(describeRecoveryHint(failure))
  })

  it('detail 缺失时回落到 sessionStorage，而不是什么都不显示', async () => {
    const wrapper = mount(UpdatePrompt)
    window.sessionStorage.setItem(CHUNK_RELOAD_HINT_KEY, JSON.stringify(hint('offline')))
    window.dispatchEvent(new CustomEvent(CHUNK_RELOAD_FAILED_EVENT))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('网络')
  })

  it('卸载后不再响应事件，避免多个提示条同时活着', async () => {
    const wrapper = mount(UpdatePrompt)
    wrapper.unmount()
    emitNewVersion()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('')
  })
})
