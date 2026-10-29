import { describe, it, expect } from 'vitest'
import {
  FIGMA_SCREEN_CATALOG,
  FIGMA_SCREEN_CATALOG_WEN_IDS,
  type FigmaScreenAssetRef,
} from '../figmaScreenCatalog'
import {
  getWenScreenCatalog,
  getWenScreenTitleUrl,
  getWenScreenRoleUrl,
  getWenScreenOptionUrl,
  getWenScreenTextBoxUrl,
  normalizeWenId,
} from '../figmaAssets'

function allRefs(): FigmaScreenAssetRef[] {
  const refs: FigmaScreenAssetRef[] = []
  for (const entry of Object.values(FIGMA_SCREEN_CATALOG)) {
    if (entry.title) refs.push(entry.title)
    for (const group of [entry.roles, entry.options, entry.textBoxes]) {
      for (const ref of Object.values(group)) refs.push(ref)
    }
    for (const group of [entry.backgrounds, entry.avatars, entry.characterCards]) {
      for (const ref of Object.values(group)) refs.push(ref)
    }
  }
  return refs
}

describe('figmaScreenCatalog（Figma 扫描资产目录）', () => {
  it('覆盖生产清单里的 37 篇课文', () => {
    expect(FIGMA_SCREEN_CATALOG_WEN_IDS).toHaveLength(37)
    expect(FIGMA_SCREEN_CATALOG_WEN_IDS).toContain('WEN_01')
    expect(FIGMA_SCREEN_CATALOG_WEN_IDS).toContain('WEN_37')
  })

  it('每条资产都是 images/screens 下的相对路径，且带非零体积', () => {
    const refs = allRefs()
    expect(refs.length).toBeGreaterThan(700)
    for (const ref of refs) {
      expect(ref.path).toMatch(/^WEN_\d{2}\/[a-z_]+\/[^/]+\.png$/)
      expect(ref.path.startsWith('/')).toBe(false)
      expect(ref.size).toBeGreaterThan(0)
    }
  })

  it('同一篇课文的资产归属该篇目录', () => {
    for (const [wenId, entry] of Object.entries(FIGMA_SCREEN_CATALOG)) {
      const refs = [
        entry.title,
        ...Object.values(entry.roles),
        ...Object.values(entry.options),
        ...Object.values(entry.textBoxes),
        ...Object.values(entry.backgrounds),
        ...Object.values(entry.avatars),
        ...Object.values(entry.characterCards),
      ].filter((ref): ref is FigmaScreenAssetRef => !!ref)
      for (const ref of refs) {
        expect(ref.path.startsWith(`${wenId}/`)).toBe(true)
      }
    }
  })

  it('标题图取整篇版本，而不是页面里的重复副本', () => {
    // WEN_02 同时有 article_title_WEN_02.png 和 article_title_WEN_02_01..11.png
    expect(getWenScreenCatalog('WEN_02')?.title?.path).toBe(
      'WEN_02/summary/article_title_WEN_02.png',
    )
    // WEN_01 没有无后缀版本，退化为页码最小的一张
    expect(getWenScreenCatalog('WEN_01')?.title?.path).toBe(
      'WEN_01/explanation/article_title_01_01.png',
    )
  })
})

describe('figmaAssets 目录读取', () => {
  it('归一化篇目 ID（WEN_2 / 2 / WEN_02 → WEN_02）', () => {
    expect(normalizeWenId('WEN_2')).toBe('WEN_02')
    expect(normalizeWenId('2')).toBe('WEN_02')
    expect(normalizeWenId('WEN_02')).toBe('WEN_02')
    expect(normalizeWenId('WEN_37')).toBe('WEN_37')
    expect(normalizeWenId('')).toBe('')
    expect(normalizeWenId(undefined)).toBe('')
  })

  it('拼接 OSS images/screens 地址', () => {
    const titleUrl = getWenScreenTitleUrl('WEN_02')
    expect(titleUrl).toContain('/images/screens/WEN_02/summary/article_title_WEN_02.png')

    const optionUrl = getWenScreenOptionUrl('2', 'A')
    expect(optionUrl).toContain('/images/screens/WEN_02/quiz/option_a_01.png')

    const nextUrl = getWenScreenRoleUrl('WEN_02', 'btnNext')
    expect(nextUrl).toContain('/images/screens/WEN_02/')
    expect(nextUrl).toContain('btn_next')

    const textBoxUrl = getWenScreenTextBoxUrl('WEN_02', 'summary')
    expect(textBoxUrl).toContain('summary_text_box')
  })

  it('未登记的角色/篇目返回 null，组件可回退 CSS', () => {
    expect(getWenScreenCatalog('WEN_99')).toBeUndefined()
    expect(getWenScreenOptionUrl('WEN_99', 'A')).toBeNull()
    expect(getWenScreenRoleUrl('WEN_99', 'btnBack')).toBeNull()
    expect(getWenScreenTitleUrl('')).toBeNull()
  })
})
