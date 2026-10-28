/**
 * BuildStamp 组件单测（发布新鲜度阶段 1）
 *
 * 组件本身只该做一件事：把 utils 算出来的构建号原样摆进页脚。
 * 所以这里只验「渲染的文案 == utils 的输出」和「它不抢页脚里备案号链接的位置」。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import BuildStamp from '@/components/common/BuildStamp.vue'
import { formatBuildStamp, getBuildId } from '@/utils/buildStamp'

describe('BuildStamp 组件', () => {
  it('文案与 data-build-id 同源，抄出来的号就是显示的号', () => {
    const wrapper = mount(BuildStamp)

    expect(wrapper.text()).toBe(formatBuildStamp(getBuildId()))
    expect(wrapper.attributes('data-build-id')).toBe(getBuildId())
  })

  it('只是一个 span：不带链接、不吞点击，备案号那一条照旧', () => {
    const wrapper = mount(BuildStamp)

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('给出可复制的提示（美术/老师要靠这句话知道报 bug 时附上什么）', () => {
    const wrapper = mount(BuildStamp)

    expect(wrapper.attributes('title')).toContain('构建号')
  })
})
