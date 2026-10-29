import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * figmaAssets 单元测试（OSS 地址构造 / 探测缓存 / 目录读取）
 *
 * 这里把 ossBase mock 成绝对域名，验证生产同源前缀下的完整 URL；
 * 目录本身的数据完整性在 figmaScreenCatalog.test.ts 里覆盖。
 */
vi.mock('@/utils/asset', () => ({
  ossBase: 'https://oss.example.com',
}))

import {
  getScreenAssetUrl,
  probeAsset,
  resolveScreenAsset,
  getWenScreenAvatarUrl,
  getWenScreenCharacterCardUrl,
  getWenScreenRoleUrl,
  getWenScreenTextBoxUrl,
} from '../figmaAssets'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getScreenAssetUrl', () => {
  it('按 images/screens/{wenId}/{screenType}/{fileName} 拼接 ossBase', () => {
    expect(getScreenAssetUrl('WEN_02', 'quiz', 'option_a_01.png')).toBe(
      'https://oss.example.com/images/screens/WEN_02/quiz/option_a_01.png',
    )
  })

  it('逐段 encodeURIComponent，文件名有空格/中文时仍可请求', () => {
    expect(getScreenAssetUrl('WEN_02', 'cultural_card', 'proverb text.png')).toBe(
      'https://oss.example.com/images/screens/WEN_02/cultural_card/proverb%20text.png',
    )
  })
})

describe('probeAsset / resolveScreenAsset', () => {
  it('HEAD 200 后写入缓存，重复探测不再发请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const url = getScreenAssetUrl('WEN_01', 'quiz', '__cache_hit__.png')

    await expect(probeAsset(url)).resolves.toBe(true)
    await expect(probeAsset(url)).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(url, { method: 'HEAD', cache: 'no-store' })
  })

  it('网络异常按不存在处理，并把 false 写入缓存', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    const url = getScreenAssetUrl('WEN_01', 'quiz', '__cache_error__.png')

    await expect(probeAsset(url)).resolves.toBe(false)
    await expect(probeAsset(url)).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('并发探测同一 URL 只发一次请求', async () => {
    let finish: (value: { ok: boolean }) => void = () => {}
    const pending = new Promise<{ ok: boolean }>((resolve) => {
      finish = resolve
    })
    const fetchMock = vi.fn().mockReturnValue(pending)
    vi.stubGlobal('fetch', fetchMock)
    const url = getScreenAssetUrl('WEN_01', 'quiz', '__cache_inflight__.png')

    const first = probeAsset(url)
    const second = probeAsset(url)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    finish({ ok: true })
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
  })

  it('resolveScreenAsset：存在返回 URL，404 返回 null', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveScreenAsset('WEN_01', 'quiz', '__resolve_ok__.png')).resolves.toBe(
      'https://oss.example.com/images/screens/WEN_01/quiz/__resolve_ok__.png',
    )
    await expect(resolveScreenAsset('WEN_01', 'quiz', '__resolve_404__.png')).resolves.toBeNull()
  })
})

describe('目录读取（带 ossBase）', () => {
  it('角色按钮与文本框走 images/screens 完整地址', () => {
    expect(getWenScreenRoleUrl('WEN_02', 'btnBack')).toBe(
      'https://oss.example.com/images/screens/WEN_02/quiz/btn_back.png',
    )
    expect(getWenScreenTextBoxUrl('WEN_02', 'homework')).toBe(
      'https://oss.example.com/images/screens/WEN_02/summary/homework_text_box.png',
    )
  })

  it('头像 / 角色名牌按 avatar_ / card_character_ 前缀取键', () => {
    expect(getWenScreenAvatarUrl('WEN_01', 'chen_sheng')).toBe(
      'https://oss.example.com/images/screens/WEN_01/dialogue/avatar_chen_sheng_01.png',
    )
    expect(getWenScreenCharacterCardUrl('WEN_01', 'chen_sheng')).toContain(
      '/images/screens/WEN_01/dialogue/card_character_chen_sheng_01.png',
    )
  })

  it('未登记的角色返回 null', () => {
    expect(getWenScreenTextBoxUrl('WEN_02', 'proverb')).toBeNull()
    expect(getWenScreenAvatarUrl('WEN_02', 'not_a_character')).toBeNull()
  })
})
