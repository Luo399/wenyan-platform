/**
 * buildStamp 单测（发布新鲜度阶段 1）
 *
 * 锁死两件事：
 * 1. 注入缺失 / 空值 / 'local' 都归一成「本地构建」，页脚不能出现「构建 」这种半截文案。
 * 2. 文案和 data-build-id 都出自同一个 normalize 结果，报 bug 时抄出来的号和看到的号是同一个。
 */
import { describe, it, expect } from 'vitest'

import {
  LOCAL_BUILD_ID,
  formatBuildStamp,
  getBuildId,
  normalizeBuildId,
} from '@/utils/buildStamp'

describe('normalizeBuildId', () => {
  it('空串 / 全空白 / null / undefined 都当本地', () => {
    expect(normalizeBuildId('')).toBe(LOCAL_BUILD_ID)
    expect(normalizeBuildId('   ')).toBe(LOCAL_BUILD_ID)
    expect(normalizeBuildId(null)).toBe(LOCAL_BUILD_ID)
    expect(normalizeBuildId(undefined)).toBe(LOCAL_BUILD_ID)
  })

  it('去首尾空白并统一小写：大小写混用的 sha 不该被当成两个不同版本', () => {
    expect(normalizeBuildId(' AB12Cd3 ')).toBe('ab12cd3')
  })

  it("'LOCAL' 归一后同样落回本地占位", () => {
    expect(normalizeBuildId('LOCAL')).toBe(LOCAL_BUILD_ID)
  })
})

describe('getBuildId', () => {
  it('读到 define 注入的常量（测试环境由 vitest.config.ts 固定成 sha 形态的值）', () => {
    expect(getBuildId()).toBe('abc1234')
  })

  it('返回值已经归一，重复调用稳定', () => {
    expect(getBuildId()).toBe(normalizeBuildId(getBuildId()))
  })
})

describe('formatBuildStamp', () => {
  it('CI 构建显示「构建 <sha>」', () => {
    expect(formatBuildStamp('a1b2c3d')).toBe('构建 a1b2c3d')
  })

  it('本地 / 缺失显示「本地构建」，不带空号', () => {
    expect(formatBuildStamp(LOCAL_BUILD_ID)).toBe('本地构建')
    expect(formatBuildStamp('')).toBe('本地构建')
    expect(formatBuildStamp('  ')).toBe('本地构建')
  })

  it('不传参数时取注入值，页脚文案与 data-build-id 同源', () => {
    expect(formatBuildStamp()).toBe(`构建 ${getBuildId()}`)
  })
})
