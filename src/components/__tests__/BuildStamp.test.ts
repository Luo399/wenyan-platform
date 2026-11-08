/**
 * BuildStamp 组件单测（发布新鲜度阶段 1）
 *
 * 组件本身只该做一件事：把 utils 算出来的构建号原样摆进页脚。
 * 所以这里只验三件事：它是单个 span 根节点（页脚排版靠这个前提）、
 * 文案与 data-build-id 同源（抄出来的号就是看到的号）、自身不含链接不抢点击。
 *
 * 第一次 CI 红在这里的原因是组件当时是 fragment（模板外有一条根级注释）：
 * wrapper.element 返回挂载容器 DIV，attributes() 全是 undefined。
 * 现在把「必须是单根」写成断言，退化成分支会当场报错而不是静默失真。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import BuildStamp from '@/components/common/BuildStamp.vue'
import { formatBuildStamp, getBuildId } from '@/utils/buildStamp'

describe('BuildStamp 组件', () => {
  it('单个 span 根节点：页脚那一行的排版前提', () => {
    const wrapper = mount(BuildStamp)

    expect(wrapper.element.tagName).toBe('SPAN')
  })

  it('文案与 data-build-id 同源', () => {
    const wrapper = mount(BuildStamp)

    expect(wrapper.text()).toBe(formatBuildStamp(getBuildId()))
    expect(wrapper.attributes('data-build-id')).toBe(getBuildId())
  })

  it('自身不含链接、给出可复制的提示：备案号那条 a 仍然是 App.vue 的', () => {
    const wrapper = mount(BuildStamp)

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.attributes('title')).toContain('构建号')
  })
})
