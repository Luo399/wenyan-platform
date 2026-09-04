// @ts-nocheck
import { describe, it, expect } from 'vitest'
import {
  getEnvDefaults,
  classifyPath,
  computePending,
  dedupeItems,
  makeNewComponentsJson,
  makeLastStateJson,
  buildUploadBody,
} from '../scripts/oss-auto-sync-core.js'

describe('oss-auto-sync-core', () => {
  it('getEnvDefaults 返回测试/生产两组域名', () => {
    expect(getEnvDefaults('test')).toEqual({
      apiBase: 'https://test-api.classicalab.cn',
      ossPublicBase: 'https://test.classicalab.cn',
    })
    expect(getEnvDefaults('prod')).toEqual({
      apiBase: 'https://api.classicalab.cn',
      ossPublicBase: 'https://www.classicalab.cn',
    })
  })

  it('classifyPath 放行已知 data 目录与媒体目录', () => {
    expect(classifyPath('data/culture_cards/WEN_01.json').decision).toBe('release')
    expect(classifyPath('images/general/home_bg.png').decision).toBe('release')
    expect(classifyPath('audio/WEN_01.mp3').decision).toBe('release')
  })

  it('classifyPath 把 styles/ 与未知路径进新增组件清单', () => {
    const s = classifyPath('styles/hero_card.json')
    expect(s.decision).toBe('component')
    expect(s.reason).toContain('样式')
    expect(classifyPath('foo/bar.json').decision).toBe('component')
  })

  it('computePending 只返回新增或 updatedAt 更晚的路径', () => {
    const assets = {
      a: { updatedAt: '2026-09-01T00:00:00Z' },
      b: { updatedAt: '2026-09-03T00:00:00Z' },
      c: { updatedAt: '2026-09-02T00:00:00Z' },
    }
    const processed = {
      a: '2026-09-01T00:00:00Z',
      b: '2026-09-02T00:00:00Z',
      c: '2026-09-02T00:00:00Z',
    }
    // c 已存在但更老 → 不算; b 更新 → 算; a 相同时间且已处理 → 不算
    expect(computePending(assets, processed)).toEqual(['b'])
  })

  it('dedupeItems 按 ossPath 去重，已存在项跳过', () => {
    const existing = [{ ossPath: 'styles/x.json', reason: 'r' }]
    const incoming = [
      { ossPath: 'styles/x.json', reason: 'again' },
      { ossPath: 'styles/y.json', reason: 'new' },
    ]
    expect(dedupeItems(incoming, existing)).toEqual([
      { ossPath: 'styles/x.json', reason: 'r' },
      { ossPath: 'styles/y.json', reason: 'new' },
    ])
  })

  it('makeNewComponentsJson 与 makeLastStateJson 结构正确', () => {
    const items = [
      { ossPath: 'styles/x.json', type: 'style', wen: 'general', reason: 'r', firstSeenAt: 'T' },
    ]
    expect(makeNewComponentsJson(items, 'NOW')).toEqual({ updatedAt: 'NOW', items })
    const assets = { a: { updatedAt: 'U1' } }
    expect(makeLastStateJson(assets, 'NOW')).toEqual({
      lastProcessedAt: 'NOW',
      processed: { a: 'U1' },
    })
  })

  it('buildUploadBody 生成 base64 上传体', () => {
    const body = buildUploadBody([
      { ossPath: 'data/sync_watch/new_components.json', jsonObject: { updatedAt: 'T', items: [] } },
    ])
    expect(body.files[0].ossPath).toBe('data/sync_watch/new_components.json')
    expect(body.files[0].type).toBe('text')
    expect(body.files[0].encoding).toBe('base64')
    expect(() => Buffer.from(body.files[0].content, 'base64').toString('utf-8')).not.toThrow()
  })
})
