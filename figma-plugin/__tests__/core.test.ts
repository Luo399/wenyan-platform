/**
 * 核心逻辑单元测试（vitest）
 *
 * 被测模块：core.ts（不依赖 Figma 全局对象的纯函数模块）
 * 说明：通过内存构造满足最小形状的节点对象（用 as any 绕过 Figma 完整类型），
 *       验证线上真实逻辑在扫描、文本提取、路径解析、超时处理上的行为。
 *
 * 运行：npm run test（在 figma-plugin 目录下）
 */
import { describe, it, expect, vi } from 'vitest'
import {
  ASSET_TYPE,
  EXPORT_TIMEOUT_MS,
  withTimeout,
  scanExportAssetsFrame,
  scanTextFrame,
  resolveTextOssPath,
} from '../core'

// 日志工具在测试环境打印会较嘈杂，静默掉（被测逻辑内部使用）
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// ============ mock 节点构造工具 ============

interface MockLeaf {
  id: string
  name: string
  type: string
  visible?: boolean
  characters?: string
}

function makeFrame(id: string, name: string, children?: MockLeaf[]): any {
  return { id, name, type: 'FRAME', visible: true, children: children as any }
}

function makeLeaf(id: string, name: string, type: string, visible = true, characters?: string): MockLeaf {
  return { id, name, type, visible, characters }
}

// ============ scanExportAssetsFrame ============

describe('scanExportAssetsFrame', () => {
  it('扫描通用组件文件：过滤隐藏/不支持类型/无扩展名图层', () => {
    const frame = makeFrame('f0', 'Export Assets', [
      makeFrame('d_general', 'images/general/', [
        makeLeaf('l1', 'home_bg.png', 'RECTANGLE'),
        makeLeaf('l2', 'logo.svg', 'VECTOR'),
        // 隐藏图层 → 跳过
        makeLeaf('l3', 'hidden.png', 'RECTANGLE', false),
        // 不支持的类型 → 跳过
        makeLeaf('l4', '说明文字', 'TEXT', true, '说明'),
        // 无扩展名 → 跳过
        makeLeaf('l5', 'no_ext_file', 'RECTANGLE'),
        // 音频不应通过 Figma 导出 → 但 .mp3 不在合法图片扩展名内 → 跳过
        makeLeaf('l6', 'bgm.mp3', 'RECTANGLE'),
      ]),
      makeFrame('d_cover', 'images/cover/', [makeLeaf('l7', 'cover_main.png', 'RECTANGLE')]),
      // 空目录 → 跳过
      makeFrame('d_empty', 'images/empty/'),
    ])

    const assets = scanExportAssetsFrame(frame)
    expect(assets.length).toBe(3)
    expect(assets[0]).toMatchObject({
      ossPath: 'images/general/home_bg.png',
      fileName: 'home_bg.png',
      type: ASSET_TYPE.IMAGE,
      nodeId: 'l1',
      status: 'new',
    })
    expect(assets.some((a) => a.ossPath === 'images/general/logo.svg')).toBe(true)
    expect(assets.some((a) => a.ossPath === 'images/cover/cover_main.png')).toBe(true)
  })

  it('子 Frame 名去掉末尾斜杠作为 OSS 路径前缀', () => {
    const frame = makeFrame('f0', 'Export Assets', [makeFrame('d', 'images/home/', [makeLeaf('l', 'a.png', 'RECTANGLE')])])
    const assets = scanExportAssetsFrame(frame)
    expect(assets[0].ossPath).toBe('images/home/a.png')
  })

  it('无 children 时返回空数组', () => {
    const frame = makeFrame('f0', 'Export Assets')
    expect(scanExportAssetsFrame(frame)).toEqual([])
  })
})

// ============ resolveTextOssPath ============

describe('resolveTextOssPath', () => {
  it('新命名（含斜杠）：解析为 data/{相对路径}.json', () => {
    expect(resolveTextOssPath('文字资源_culture_cards/WEN_01')).toBe('data/culture_cards/WEN_01.json')
  })

  it('旧命名（无斜杠）：保持 data/texts/ 兼容目录', () => {
    expect(resolveTextOssPath('文字资源_论语·学而篇')).toBe('data/texts/文字资源_论语·学而篇.json')
  })
})

// ============ scanTextFrame ============

describe('scanTextFrame', () => {
  it('提取顶层文本字段与子 Frame 嵌套字段，并生成 JSON', () => {
    const frame = makeFrame('t0', '文字资源_论语·学而篇', [
      makeLeaf('a', 'knowledge_text', 'TEXT', true, '学而时习之'),
      makeLeaf('b', 'dynasty', 'TEXT', true, '春秋'),
      makeFrame('g1', 'cards', [
        makeLeaf('c', 'card_name', 'TEXT', true, '人物卡'),
        makeLeaf('d', 'desc', 'TEXT', true, '孔子'),
        // 子 Frame 内的非 TEXT 节点 → 跳过
        makeLeaf('e', 'icon', 'RECTANGLE'),
      ]),
    ])

    const assets = scanTextFrame(frame)
    expect(assets.length).toBe(1)
    const asset = assets[0]!
    expect(asset.type).toBe(ASSET_TYPE.TEXT)
    expect(asset.fileName).toBe('文字资源_论语·学而篇.json')
    expect(asset.nodeId).toBe('t0')

    // 校验 JSON 内容符合预期
    const parsed = JSON.parse(asset.content!)
    expect(parsed).toEqual({
      knowledge_text: '学而时习之',
      dynasty: '春秋',
      cards: { card_name: '人物卡', desc: '孔子' },
    })
  })

  it('无任何文本字段时返回空数组', () => {
    const frame = makeFrame('t0', '文字资源_空', [makeLeaf('x', 'ic', 'RECTANGLE')])
    expect(scanTextFrame(frame)).toEqual([])
  })

  it('空内容 Frame 返回空数组', () => {
    const frame = makeFrame('t0', '文字资源_空')
    expect(scanTextFrame(frame)).toEqual([])
  })
})

// ============ withTimeout ============

describe('withTimeout', () => {
  it('在超时内完成则 resolve', async () => {
    const p = Promise.resolve('ok')
    await expect(withTimeout(p, 1000, '测试')).resolves.toBe('ok')
  })

  it('底层 Promise reject 时透传错误', async () => {
    const p = Promise.reject(new Error('底层失败'))
    await expect(withTimeout(p, 1000, '测试')).rejects.toThrow('底层失败')
  })

  it('超时未完成则 reject 超时错误', async () => {
    const p = new Promise<string>(() => {}) // 永不 resolve
    await expect(withTimeout(p, 20, '挂起任务')).rejects.toThrow('操作超时')
  })

  it('EXPORT_TIMEOUT_MS 默认值为 30 秒', () => {
    expect(EXPORT_TIMEOUT_MS).toBe(30000)
  })
})