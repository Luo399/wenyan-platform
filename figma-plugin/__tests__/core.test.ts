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
  resolveStyleOssPath,
  extractCornerRadii,
  borderRadiusToCss,
  autoLayoutToCss,
  extractNodeStyle,
  collectStyleNodes,
  scanStyleFrame,
  buildSharedStylesAsset,
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

/** 样式用例节点：视觉属性散落在各 mixin 上，用手搓对象 + 任意扩展字段模拟 */
function makeStyleNode(id: string, name: string, type: string, props: Record<string, any> = {}): any {
  return { id, name, type, visible: true, ...props }
}

/** 一个贴近真实命名方式的 样式_ Frame：Frame 本体带布局，子图层带各种视觉属性 */
function makeStyleFrame(): any {
  return makeStyleNode('1:1', '样式_components/Button', 'FRAME', {
    width: 200,
    height: 80,
    cornerRadius: 0,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
    layoutMode: 'VERTICAL',
    itemSpacing: 20,
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'MIN',
    children: [
      makeStyleNode('1:2', 'bg', 'RECTANGLE', {
        width: 200,
        height: 80,
        rectangleCornerRadii: [16, 0, 0, 16],
        fills: [
          {
            type: 'GRADIENT_LINEAR',
            gradientTransform: [[0, -1, 1], [1, 0, 0]],
            gradientStops: [
              { position: 0, color: { r: 1, g: 0.5, b: 0 } },
              { position: 1, color: { r: 1, g: 0, b: 0.42, a: 0.6 } },
            ],
          },
        ],
        effects: [
          { type: 'DROP_SHADOW', offset: { x: 0, y: 4 }, radius: 12, color: { r: 0, g: 0, b: 0, a: 0.25 } },
          { type: 'LAYER_BLUR', radius: 3 },
        ],
      }),
      makeStyleNode('1:3', 'label', 'TEXT', {
        width: 100,
        height: 24,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }],
        fontName: { family: 'Noto Serif SC', style: 'Bold' },
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: { unit: 'PERCENT', value: 5 },
        lineHeight: { unit: 'PIXELS', value: 24 },
        textAlignHorizontal: 'CENTER',
        textCase: 'UPPER',
      }),
      makeStyleNode('1:4', 'hidden', 'RECTANGLE', { visible: false }),
      // 与 1:2 同名 → 路径需追加 #nodeId 去重
      makeStyleNode('1:5', 'bg', 'FRAME', {
        width: 8,
        height: 8,
        cornerRadius: 4,
        strokeWeight: 2,
        strokeAlign: 'INSIDE',
        strokes: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }],
      }),
    ],
  })
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

// ============ resolveStyleOssPath ============

describe('resolveStyleOssPath', () => {
  it('去掉 样式_ 前缀，子路径与文件名保留，补 .json', () => {
    expect(resolveStyleOssPath('样式_Button')).toBe('styles/Button.json')
    expect(resolveStyleOssPath('样式_components/Button')).toBe('styles/components/Button.json')
  })

  it('折叠连续斜杠、忽略末尾斜杠', () => {
    expect(resolveStyleOssPath('样式_a//b')).toBe('styles/a/b.json')
    expect(resolveStyleOssPath('样式_components/Button/')).toBe('styles/components/Button.json')
  })

  it('前缀后为空时返回空串（调用方跳过并告警）', () => {
    expect(resolveStyleOssPath('样式_')).toBe('')
  })
})

// ============ 圆角（含直角） ============

describe('extractCornerRadii / borderRadiusToCss', () => {
  it('统一圆角', () => {
    const radii = extractCornerRadii({ cornerRadius: 16 })
    expect(radii).toEqual({ uniform: 16 })
    expect(borderRadiusToCss(radii)).toBe('16px')
  })

  it('直角（radius 0）必须留下 0px，不能当成"没读到"', () => {
    const radii = extractCornerRadii({ cornerRadius: 0 })
    expect(radii).toEqual({ uniform: 0 })
    expect(borderRadiusToCss(radii)).toBe('0px')
  })

  it('四角分别值走 rectangleCornerRadii，顺序与 CSS 的 TL TR BR BL 一致', () => {
    const radii = extractCornerRadii({ rectangleCornerRadii: [16, 0, 0, 16] })
    expect(radii).toEqual({ corners: [16, 0, 0, 16] })
    expect(borderRadiusToCss(radii)).toBe('16px 0px 0px 16px')
  })

  it('无圆角属性时不产出 border-radius', () => {
    expect(extractCornerRadii({})).toEqual({})
    expect(borderRadiusToCss(extractCornerRadii({}))).toBeUndefined()
  })
})

// ============ 单节点样式提取 ============

describe('extractNodeStyle', () => {
  it('纯色填充 → background-color（hex）', () => {
    const { css } = extractNodeStyle(makeStyleNode('a', 'a', 'RECTANGLE', { width: 10, height: 10, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] }))
    expect(css['background-color']).toBe('#ffffff')
  })

  it('渐变填充 → background-image（含角度与 rgba 端点）', () => {
    const { css } = extractNodeStyle(
      makeStyleNode('a', 'a', 'RECTANGLE', {
        width: 200,
        height: 80,
        fills: [
          {
            type: 'GRADIENT_LINEAR',
            gradientTransform: [[0, -1, 1], [1, 0, 0]],
            gradientStops: [
              { position: 0, color: { r: 1, g: 0.5, b: 0 } },
              { position: 1, color: { r: 1, g: 0, b: 0.42, a: 0.6 } },
            ],
          },
        ],
      }),
    )
    expect(css['background-image']).toBe('linear-gradient(180deg, #ff8000 0%, rgba(255, 0, 107, 0.6) 100%)')
    expect(css['background-color']).toBeUndefined()
  })

  it('TEXT 的填充是文字颜色，不应产出 background-color', () => {
    const { css } = extractNodeStyle(
      makeStyleNode('t', 't', 'TEXT', { width: 10, height: 10, fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }], fontSize: 14 }),
    )
    expect(css.color).toBe('#1a1a1a')
    expect(css['background-color']).toBeUndefined()
  })

  it('描边 INSIDE → border + box-sizing: border-box', () => {
    const { css } = extractNodeStyle(
      makeStyleNode('s', 's', 'FRAME', {
        width: 8,
        height: 8,
        strokeWeight: 2,
        strokeAlign: 'INSIDE',
        strokes: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }],
      }),
    )
    expect(css.border).toBe('2px solid #808080')
    expect(css['box-sizing']).toBe('border-box')
  })

  it('阴影 / 模糊 / 透明度 / 混合模式', () => {
    const { css } = extractNodeStyle(
      makeStyleNode('e', 'e', 'RECTANGLE', {
        width: 5,
        height: 5,
        opacity: 0.5,
        blendMode: 'MULTIPLY',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        effects: [
          { type: 'BACKGROUND_BLUR', radius: 8 },
          { type: 'DROP_SHADOW', offset: { x: 1, y: 2 }, radius: 3, spread: 4, color: { r: 0, g: 0, b: 0, a: 0.5 } },
        ],
      }),
    )
    expect(css['box-shadow']).toBe('1px 2px 3px 4px rgba(0, 0, 0, 0.5)')
    expect(css['backdrop-filter']).toBe('blur(8px)')
    expect(css.opacity).toBe('0.5')
    expect(css['mix-blend-mode']).toBe('multiply')
  })

  it('内阴影带 inset，图层模糊走 filter', () => {
    const { css } = extractNodeStyle(
      makeStyleNode('e', 'e', 'RECTANGLE', {
        effects: [
          { type: 'INNER_SHADOW', offset: { x: 0, y: 2 }, radius: 6, color: { r: 0, g: 0, b: 0, a: 0.15 } },
          { type: 'LAYER_BLUR', radius: 3 },
        ],
      }),
    )
    expect(css['box-shadow']).toBe('inset 0px 2px 6px rgba(0, 0, 0, 0.15)')
    expect(css.filter).toBe('blur(3px)')
  })

  it('隐藏的 effect 不进产物（美术关掉的效果不是设计意图）', () => {
    const { css } = extractNodeStyle(
      makeStyleNode('e', 'e', 'RECTANGLE', {
        effects: [{ type: 'DROP_SHADOW', visible: false, offset: { x: 0, y: 4 }, radius: 8, color: { r: 0, g: 0, b: 0, a: 0.3 } }],
      }),
    )
    expect(css['box-shadow']).toBeUndefined()
  })

  it('figma.mixed（逐图层不一致）只标记 mixed，不猜值', () => {
    const { raw, css } = extractNodeStyle(makeStyleNode('m', 'm', 'RECTANGLE', { width: 10, height: 10, fills: Symbol('mixed') }))
    expect(raw.fills).toEqual({ mixed: true })
    expect(css['background-color']).toBeUndefined()
  })

  it('ELLIPSE 无圆角属性时给 50%', () => {
    const { css } = extractNodeStyle(makeStyleNode('c', 'c', 'ELLIPSE', { width: 20, height: 20 }))
    expect(css['border-radius']).toBe('50%')
  })

  it('只留宽高，不留绝对坐标', () => {
    const { raw } = extractNodeStyle(makeStyleNode('p', 'p', 'RECTANGLE', { width: 10, height: 10, x: 320, y: 96 }))
    expect(raw.x).toBeUndefined()
    expect(raw.y).toBeUndefined()
    expect(raw.width).toBe(10)
  })
})

// ============ 自动布局 ============

describe('autoLayoutToCss', () => {
  it('纵向布局 → flex column，padding 顺序 T R B L', () => {
    const css = autoLayoutToCss(
      makeStyleNode('f', 'f', 'FRAME', {
        layoutMode: 'VERTICAL',
        itemSpacing: 20,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'MIN',
      }),
    )
    expect(css).toEqual({
      display: 'flex',
      'flex-direction': 'column',
      gap: '20px',
      padding: '24px 24px 24px 24px',
      'justify-content': 'center',
      'align-items': 'flex-start',
    })
  })

  it('itemSpacing 为 0 时保留 gap: 0px', () => {
    const css = autoLayoutToCss(makeStyleNode('f', 'f', 'FRAME', { layoutMode: 'HORIZONTAL', itemSpacing: 0, layoutWrap: 'WRAP' }))
    expect(css.gap).toBe('0px')
    expect(css['flex-wrap']).toBe('wrap')
  })

  it('GRID 布局的行/列间距不要与 CSS 的 row-gap / column-gap 弄反', () => {
    const css = autoLayoutToCss(makeStyleNode('g', 'g', 'FRAME', { layoutMode: 'GRID', gridRowGap: 12, gridColumnGap: 24 }))
    expect(css).toEqual({ display: 'grid', 'column-gap': '24px', 'row-gap': '12px' })
  })

  it('非自动布局节点不产出 display', () => {
    expect(autoLayoutToCss(makeStyleNode('r', 'r', 'RECTANGLE', {}))).toEqual({})
  })
})

// ============ collectStyleNodes ============

describe('collectStyleNodes', () => {
  it('Frame 本体样式单独产出（否则丢掉"容器是直角"这类信息）', () => {
    const { self } = collectStyleNodes(makeStyleFrame())
    expect(self.path).toBe('@frame')
    expect(self.css['border-radius']).toBe('0px')
    expect(self.css['background-color']).toBe('#ffffff')
  })

  it('跳过隐藏图层并计数；同名图层用 #nodeId 去重', () => {
    const { entries, hiddenSkipped } = collectStyleNodes(makeStyleFrame())
    expect(entries.map((e) => e.path)).toEqual(['bg', 'label', 'bg#1:5'])
    expect(hiddenSkipped).toBe(1)
  })

  it('节点数超上限时截断并置 truncated', () => {
    const kids = []
    for (let i = 0; i < 305; i++) kids.push(makeStyleNode('n' + i, 'l' + i, 'RECTANGLE', { width: 10, height: 10 }))
    const res = collectStyleNodes(makeStyleNode('big', '样式_big', 'FRAME', { children: kids }))
    expect(res.entries.length).toBe(300)
    expect(res.truncated).toBe(true)
  })

  it('层级超深时截断并置 truncated', () => {
    const deepest = makeStyleNode('d8', 'n8', 'FRAME', { children: [] })
    let cursor = deepest
    for (let i = 7; i >= 1; i--) {
      cursor = makeStyleNode('d' + i, 'n' + i, 'FRAME', { children: [cursor] })
    }
    const res = collectStyleNodes(cursor)
    expect(res.truncated).toBe(true)
    expect(res.entries.length).toBeLessThan(8)
  })
})

// ============ scanStyleFrame ============

describe('scanStyleFrame', () => {
  it('产出 styles/{路径}.json 的 style 资源，JSON 结构固定', () => {
    const assets = scanStyleFrame(makeStyleFrame())
    expect(assets.length).toBe(1)
    const asset = assets[0]!
    expect(asset.type).toBe(ASSET_TYPE.STYLE)
    expect(asset.ossPath).toBe('styles/components/Button.json')
    expect(asset.fileName).toBe('Button.json')

    const doc = JSON.parse(asset.content!)
    expect(Object.keys(doc)).toEqual(['kind', 'schema', 'source', 'meta', 'self', 'tokens', 'nodes'])
    expect(doc.kind).toBe('figma-style-tokens')
    expect(doc.meta).toEqual({ nodeCount: 3, truncated: false, hiddenSkipped: 1, withRaw: true })
    expect(doc.nodes['bg'].css['border-radius']).toBe('16px 0px 0px 16px')
    expect(doc.nodes['label'].css['font-size']).toBe('16px')
  })

  it('tokens 汇总颜色/圆角/间距/阴影/字阶，供 design-tokens 直接取用', () => {
    const doc = JSON.parse(scanStyleFrame(makeStyleFrame())[0]!.content!)
    expect(doc.tokens.color.map((c: any) => c.value)).toContain('#ffffff')
    expect(doc.tokens.radius.map((c: any) => c.value)).toContain('0px')
    expect(doc.tokens.spacing.map((c: any) => c.value)).toContain('24px')
    expect(doc.tokens.shadow[0].value).toBe('0px 4px 12px rgba(0, 0, 0, 0.25)')
    expect(doc.tokens.font[0].value).toBe('16px / 700 / 24px')
  })

  it('同一输入两次产出字节完全一致（后端靠 MD5 做增量跳过）', () => {
    expect(scanStyleFrame(makeStyleFrame())[0]!.content).toBe(scanStyleFrame(makeStyleFrame())[0]!.content)
  })

  it('前缀后为空名 → 跳过', () => {
    expect(scanStyleFrame(makeStyleNode('x', '样式_', 'FRAME', { children: [] }))).toEqual([])
  })

  it('无可见图层 → 跳过', () => {
    const frame = makeStyleNode('x', '样式_空', 'FRAME', { children: [makeStyleNode('h', 'h', 'RECTANGLE', { visible: false })] })
    expect(scanStyleFrame(frame)).toEqual([])
  })
})

// ============ buildSharedStylesAsset ============

describe('buildSharedStylesAsset', () => {
  function sharedInput() {
    return {
      pageName: '设计稿',
      paintStyles: [{ nodeId: 'S:1', name: 'brand/primary', description: '主色', paints: [{ type: 'SOLID', color: { r: 0.09, g: 0.48, b: 0.97 } }] }],
      textStyles: [
        {
          nodeId: 'S:2',
          name: '标题/大',
          style: { fontFamily: 'Noto Serif SC', fontSize: 24, fontWeight: 600, lineHeight: { unit: 'PIXELS', value: 36 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }] },
        },
      ],
      effectStyles: [{ nodeId: 'S:3', name: '阴影/卡', effects: [{ type: 'INNER_SHADOW', offset: { x: 0, y: 2 }, radius: 6, color: { r: 0, g: 0, b: 0, a: 0.15 } }] }],
      gridStyles: [{ nodeId: 'S:4', name: '12列', layoutGrids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 20, sectionSize: 80 }] }],
      variableCollections: [{ id: 'VC:1', name: '主题', modes: { '0:0': { name: 'light' }, '0:1': { name: 'dark' } } }],
      variables: [
        { id: 'V:1', name: 'color/bg', resolvedType: 'COLOR', variableCollectionId: 'VC:1', valuesByMode: { '0:0': { r: 1, g: 1, b: 1, a: 1 }, '0:1': { r: 0.07, g: 0.07, b: 0.07, a: 1 } } },
        { id: 'V:2', name: 'space/card', resolvedType: 'FLOAT', variableCollectionId: 'VC:1', valuesByMode: { '0:0': 24 } },
      ],
    }
  }

  it('本地共享样式与变量 → styles/_shared.json，模式名保留', () => {
    const assets = buildSharedStylesAsset(sharedInput())
    expect(assets.length).toBe(1)
    expect(assets[0]!.ossPath).toBe('styles/_shared.json')
    expect(assets[0]!.type).toBe(ASSET_TYPE.STYLE)

    const doc = JSON.parse(assets[0]!.content!)
    expect(doc.kind).toBe('figma-local-styles')
    expect(doc.meta).toEqual({ paintCount: 1, textCount: 1, effectCount: 1, gridCount: 1, variableCount: 2 })
    expect(doc.styles.paint[0].css['background-color']).toBe('#177af7')
    expect(doc.styles.text[0].css['line-height']).toBe('36px')
    expect(doc.styles.effect[0].css['box-shadow']).toBe('inset 0px 2px 6px rgba(0, 0, 0, 0.15)')
    expect(doc.variableCollections).toEqual([{ name: '主题', id: 'VC:1', modes: ['light', 'dark'] }])
    // 变量值按 mode 名给 raw + CSS 两种形态
    expect(doc.variables[0].values.light.css).toBe('#ffffff')
    expect(doc.variables[0].values.dark.css).toBe('#121212')
    expect(doc.variables[1].values.light).toEqual({ raw: 24, css: '24px' })
  })

  it('没有任何本地样式/变量时返回空数组', () => {
    expect(buildSharedStylesAsset({ pageName: '空文件' })).toEqual([])
  })

  it('同一输入两次产出字节一致', () => {
    expect(buildSharedStylesAsset(sharedInput())[0]!.content).toBe(buildSharedStylesAsset(sharedInput())[0]!.content)
  })
})