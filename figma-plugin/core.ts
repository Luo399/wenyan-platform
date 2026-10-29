/**
 * 文言文资源同步插件 - 核心逻辑（可单测的纯函数模块）
 *
 * 职责：只包含不依赖 Figma 全局对象（figma / __html__）的纯逻辑：
 *   - 资源扫描（Export Assets → 图片；文字资源_* → JSON；样式_* → CSS 参数 JSON）
 *   - OSS 路径解析
 *   - 超时包装器
 *
 * 说明：
 *   - code.ts 通过 import 引用本模块（由 esbuild 打包进 code.js）
 *   - 单元测试（__tests__/core.test.ts）直接 import 本模块，保证测的是线上真实逻辑
 */

// ============ 日志工具（与运行时解耦，测试环境同样可用） ============
export function logDebug(...args: any[]) {
  console.log('[core][调试]', ...args)
}

export function logInfo(...args: any[]) {
  console.log('[core][信息]', ...args)
}

export function logWarn(...args: any[]) {
  console.warn('[core][警告]', ...args)
}

export function logError(...args: any[]) {
  console.error('[core][错误]', ...args)
}

// ============ 常量与类型 ============

// 导出超时时间（毫秒）：单个资源导出超过 30 秒视为失败
export const EXPORT_TIMEOUT_MS = 30000

// 资源类型枚举
export const ASSET_TYPE = {
  IMAGE: 'image',
  TEXT: 'text',
  // style：Figma 视觉属性（圆角/颜色/描边/阴影/布局/文字）提取产物，内容为 JSON
  STYLE: 'style',
} as const

// 允许导出的图层类型
const EXPORTABLE_TYPES = [
  'RECTANGLE',
  'ELLIPSE',
  'VECTOR',
  'IMAGE',
  'INSTANCE',
  'COMPONENT',
  'FRAME',
  'GROUP',
]

// 合法图片扩展名
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg)$/i

// 扫描结果
export interface AssetItem {
  ossPath: string
  fileName: string
  type: string
  nodeId: string
  // 文本内容（仅文字资源）
  content?: string
  // 变更状态
  status: 'new' | 'changed' | 'unchanged'
}

/**
 * 带超时的 Promise 包装器
 * 如果指定时间内未完成，则 reject
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`操作超时: ${label} (超过 ${ms}ms)`))
    }, ms)
    promise.then(
      (val) => {
        clearTimeout(timer)
        resolve(val)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/**
 * 扫描 Export Assets Frame 下的图片资源
 * Scan image assets under the "Export Assets" Frame.
 *
 * 命名映射 / NAMING MAP:
 *   Export Assets 直接子 Frame 名  = OSS 目录      (child Frame name = OSS directory)
 *   目录内图层名                    = 文件名         (layer name = filename, must include ext)
 *
 * 过滤规则 / FILTER RULES:
 *   - 只处理 FRAME 子节点（作为 OSS 目录）/ only FRAME children act as OSS directories
 *   - 隐藏图层跳过 / hidden layers skipped
 *   - 只处理可导出的图层类型（RECTANGLE/ELLIPSE/VECTOR/IMAGE/INSTANCE/COMPONENT/FRAME/GROUP）
 *   - 图层名必须包含合法图片扩展名 / layer name must include a valid image extension
 */
export function scanExportAssetsFrame(frame: FrameNode): AssetItem[] {
  const assets: AssetItem[] = []
  const totalChildren = frame.children?.length || 0
  logDebug(`scanExportAssetsFrame: 共 ${totalChildren} 个子节点`)

  if (!frame.children) {
    logWarn('Export Assets Frame 没有子节点')
    return assets
  }

  for (let i = 0; i < frame.children.length; i++) {
    const child = frame.children[i]
    if (child.type !== 'FRAME') {
      logDebug(`  [${i + 1}/${totalChildren}] 跳过非 Frame 节点: "${child.name}" (${child.type})`)
      continue
    }

    // 子 Frame 名称作为 OSS 路径（去掉末尾斜杠）
    // Child Frame NAME = OSS DIR. Defines the prefix for every file inside this dir.
    const ossPath = child.name.replace(/\/$/, '')
    const subChildrenCount = child.children?.length || 0
    logDebug(`  [${i + 1}/${totalChildren}] 处理目录 "${child.name}" → OSS "${ossPath}" (${subChildrenCount} 个子节点)`)

    if (!child.children) {
      logDebug(`    → 空目录，跳过`)
      continue
    }

    let hitCount = 0
    let skipCount = 0

    for (const leaf of child.children) {
      // 跳过非可视节点
      if (leaf.visible === false) {
        logDebug(`    → [跳过] 隐藏图层: "${leaf.name}"`)
        skipCount++
        continue
      }

      // 只处理可导出的图层类型
      if (!EXPORTABLE_TYPES.includes(leaf.type)) {
        logDebug(`    → [跳过] 不支持的图层类型(${leaf.type}): "${leaf.name}"`)
        skipCount++
        continue
      }

      // 文件名 = 图层名（必须包含扩展名）
      // FILENAME = LAYER NAME (extension required, e.g. home_bg.png).
      const fileName = leaf.name
      if (!IMAGE_EXT_RE.test(fileName)) {
        logDebug(`    → [跳过] 无有效图片扩展名: "${leaf.name}"`)
        skipCount++
        continue
      }

      const fullPath = `${ossPath}/${fileName}`
      logDebug(`    → [命中] ${leaf.type} → "${fullPath}"`)
      hitCount++

      assets.push({
        ossPath: fullPath,
        fileName,
        type: ASSET_TYPE.IMAGE,
        nodeId: leaf.id,
        status: 'new',
      })
    }

    logDebug(`    → 目录 "${child.name}" 处理完成: ${hitCount} 命中, ${skipCount} 跳过`)
  }

  logDebug(`scanExportAssetsFrame 完成: 共 ${assets.length} 个图片资源`)
  return assets
}

/**
 * 解析文字资源 Frame 的目标 OSS 路径
 * Resolve the target OSS path for a text-resource Frame name.
 *
 * 命名两种形态 / TWO NAMING FORMS:
 *   新命名（推荐）/ NEW (recommended): Frame 名含 "/" = 相对路径，如 文字资源_culture_cards_WEN_01
 *     → data/culture_cards/WEN_01.json
 *   旧命名（兼容）/ LEGACY (compat): 文字资源_论语·学而篇（不含 "/"）
 *     → data/texts/文字资源_论语·学而篇.json
 */
export function resolveTextOssPath(frameName: string): string {
  const rest = frameName.replace(/^文字资源_/, '').replace(/\/+$/, '')
  if (rest.includes('/')) {
    // 新命名：去掉前缀后的剩余部分即相对目录，拼接为 data/{相对路径}.json
    // NEW: strip prefix; the remainder (containing '/') is the relative dir → data/{rel}.json
    return `data/${rest}.json`
  }
  // 旧命名兼容：保持 data/texts/ 目录结构
  // LEGACY: keep legacy data/texts/ layout
  return `data/texts/${frameName}.json`
}

/**
 * 扫描文字资源 Frame 下的文本节点
 * Scan TEXT nodes inside a "文字资源_*" Frame.
 *
 * 命名映射 / NAMING MAP:
 *   Frame 名        = 目标 JSON 路径（见 resolveTextOssPath）
 *   TEXT 节点名     = JSON 字段 key   (TEXT node name = JSON key)
 *   子 Frame 名     = JSON 子对象 key  (nested child FRAME name = nested object key)
 * Frame 命名格式：文字资源_{名称}（如 文字资源_论语·学而篇）
 * 子节点命名格式：{field_name}（如 knowledge_text, card_name）
 * 子 Frame 命名格式：{group_name}，其下 TEXT 节点作为嵌套字段
 */
export function scanTextFrame(frame: FrameNode): AssetItem[] {
  const assets: AssetItem[] = []
  logDebug(`scanTextFrame: "${frame.name}" (${frame.children?.length || 0} 个子节点)`)

  // 构建 JSON 对象
  const jsonData: Record<string, any> = {}

  if (!frame.children) {
    logWarn(`文字资源 Frame "${frame.name}" 没有子节点`)
    return assets
  }

  for (const child of frame.children) {
    if (child.type === 'TEXT') {
      // 直接读取 TextNode.characters
      const textNode = child as TextNode
      const fieldName = child.name
      const textContent = textNode.characters
      jsonData[fieldName] = textContent
      logDebug(`  [字段] "${fieldName}" = "${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}" (${textContent.length} 字)`)
    } else if (child.type === 'FRAME') {
      // 子 Frame 中的文本节点
      const subFrame = child as FrameNode
      logDebug(`  [子组] 发现子 Frame: "${child.name}" (${subFrame.children?.length || 0} 个子节点)`)
      const subData: Record<string, any> = {}

      if (subFrame.children) {
        for (const subChild of subFrame.children) {
          if (subChild.type === 'TEXT') {
            const subText = subChild as TextNode
            const subFieldName = subChild.name
            const subTextContent = subText.characters
            subData[subFieldName] = subTextContent
            logDebug(`    [子字段] "${subFieldName}" = "${subTextContent.substring(0, 50)}${subTextContent.length > 50 ? '...' : ''}"`)
          } else {
            logDebug(`    [跳过] 非 TEXT 子节点: "${subChild.name}" (${subChild.type})`)
          }
        }
      } else {
        logDebug(`    [跳过] 子 Frame 为空`)
      }

      if (Object.keys(subData).length > 0) {
        jsonData[child.name] = subData
        logDebug(`  [子组] "${child.name}" 已添加 ${Object.keys(subData).length} 个字段`)
      } else {
        logDebug(`  [子组] "${child.name}" 无有效文本字段，跳过`)
      }
    } else {
      logDebug(`  [跳过] 非 TEXT/FRAME 节点: "${child.name}" (${child.type})`)
    }
  }

  if (Object.keys(jsonData).length > 0) {
    const fieldCount = Object.keys(jsonData).length
    const jsonContent = JSON.stringify(jsonData, null, 2)
    // 解析目标路径：使导出的 JSON 路径与前端消费路径一致
    const ossPath = resolveTextOssPath(frame.name)
    logInfo(`  [产出] JSON: "${ossPath}" (${fieldCount} 个字段)`)

    assets.push({
      ossPath,
      fileName: `${frame.name}.json`,
      type: ASSET_TYPE.TEXT,
      nodeId: frame.id,
      content: jsonContent,
      status: 'new',
    })
  } else {
    logWarn(`文字资源 Frame "${frame.name}" 未提取到任何文本内容`)
  }

  return assets
}

// ============ 样式资源（Figma 视觉属性 → CSS 参数） ============
/**
 * 约定（与 文字资源_ 同构：命名即路径）/ NAMING MAP:
 *   顶层 Frame 名以 `样式_` 开头，Frame 内的图层名 = JSON 的 key，子 Frame 产生嵌套 key。
 *     样式_Button            → styles/Button.json
 *     样式_components/Button → styles/components/Button.json
 *   产物落在 styles/ —— 后端 assetController.js 的 ALLOWED_JSON_DIRS 已含 'styles'，
 *   validateUpload 也已认 type === 'style'，因此插件端产样式**不需要改后端**。
 *
 * 为什么参数类型用 StyleNode = any 而不是 SceneNode + Mixin 窄化：
 *   1) 单元测试传的是手搓 mock 节点，不可能满足 Figma 的联合类型；
 *   2) 这些属性散落在 GeometryMixin / BlendMixin / TextMixin 上，strict 下的 'x' in node
 *      窄化写法冗长却不提供任何额外保障；
 *   3) 真实节点与 mock 节点在本模块里的读取方式完全一致。
 *
 * 铁律：产物内不得出现时间戳或随机值。后端靠 MD5 比对做增量跳过，
 * 一旦写入 generatedAt，每次同步都会被判成"变更"并重复上传，污染生产桶。
 */
export type StyleNode = any

export const STYLE_FRAME_PREFIX = '样式_'
/** 页面级共享样式与变量的固定产物名（不来自 Frame 名，与按 Frame 产出的文件区分） */
export const STYLE_SHARED_BASE_NAME = '_shared'
/** 单个 样式_ Frame 最多提取的节点数（后端 JSON 上限 500KB，先按节点数封顶） */
export const STYLE_MAX_NODES = 300
/** 递归深度上限 */
export const STYLE_MAX_DEPTH = 6
/** 内容字节上限（对后端 500KB 硬限留 20KB 余量） */
export const STYLE_MAX_JSON_BYTES = 480 * 1024

/**
 * 解析样式 Frame 的目标 OSS 路径
 * Resolve the target OSS path for a style-resource Frame name.
 *
 *   样式_Button            → styles/Button.json
 *   样式_components/Button → styles/components/Button.json
 *   样式_（空名）          → ''（调用方跳过并告警）
 *
 * 空格按命名规范转下划线；连续斜杠折叠；末尾斜杠忽略。
 */
export function resolveStyleOssPath(frameName: string): string {
  const rest = String(frameName || '')
    .replace(new RegExp(`^${STYLE_FRAME_PREFIX}`), '')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '')
    .replace(/\s+/g, '_')
  if (!rest) return ''
  return `styles/${rest}.json`
}

/** Figma 的 mixed 是一个 Symbol；用 typeof 判断，避免本模块引用 figma 全局 */
function isMixed(value: unknown): boolean {
  return typeof value === 'symbol'
}

/** 保留有效小数位，避免 0.1 的浮点噪声写进产物 */
function round(value: number, digits = 3): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** 数值 → px 串；非数字（含 undefined/mixed）返回 undefined */
function px(value: unknown): string | undefined {
  return typeof value === 'number' && !isNaN(value) ? `${round(value, 2)}px` : undefined
}

/** 0~1 的 RGB 分量 → #rrggbb（Figma 用 0~1 浮点，CSS 用 0~255） */
export function rgbToHex(r: number, g: number, b: number): string {
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)
  const hex2 = (v: number) => v.toString(16).padStart(2, '0')
  return `#${hex2(to255(r))}${hex2(to255(g))}${hex2(to255(b))}`
}

/** 纯色 → CSS 颜色串：完全不透明给 #rrggbb，半透明给 rgba() */
export function solidToCss(color: StyleNode, opacity?: number): string | undefined {
  if (!color || typeof color.r !== 'number' || typeof color.g !== 'number' || typeof color.b !== 'number') {
    return undefined
  }
  const alpha = typeof opacity === 'number' ? opacity : typeof color.a === 'number' ? color.a : 1
  const hex = rgbToHex(color.r, color.g, color.b)
  if (alpha >= 1) return hex
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${round(alpha)})`
}

/**
 * 由 Figma 2x3 渐变仿射矩阵推 CSS linear-gradient 角度（近似值）
 * Figma 渐变单位空间的 +x 轴映射到节点空间后即渐变方向；CSS 角度 0deg 朝上、顺时针为正。
 * 传入节点宽高可修正非等比拉伸下的真实视觉角度；CSS 渐变无法表达非均匀变换，
 * 故 raw 里始终保留原始矩阵，需要精确复用时按矩阵还原。
 */
export function gradientAngleToCss(matrix: StyleNode, width?: number, height?: number): number {
  if (!Array.isArray(matrix) || matrix.length < 6) return 180
  const dx = matrix[0] * (typeof width === 'number' && width > 0 ? width : 1)
  const dy = matrix[1] * (typeof height === 'number' && height > 0 ? height : 1)
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  return Math.round(((deg % 360) + 360) % 360)
}

/** 渐变 Paint → CSS 背景片段；GRADIENT_DIAMOND 无 CSS 对应，返回 undefined */
export function gradientToCss(paint: StyleNode, width?: number, height?: number): string | undefined {
  const stops = paint && paint.gradientStops
  if (!Array.isArray(stops) || stops.length === 0) return undefined
  const parts = stops.map((s: StyleNode) => {
    const color = solidToCss(s.color, s.color && typeof s.color.a === 'number' ? s.color.a : undefined) || 'rgba(0, 0, 0, 0)'
    const pos = typeof s.position === 'number' ? `${round(s.position * 100, 2)}%` : '0%'
    return `${color} ${pos}`
  })
  if (paint.type === 'GRADIENT_RADIAL') return `radial-gradient(${parts.join(', ')})`
  if (paint.type === 'GRADIENT_ANGULAR') return `conic-gradient(${parts.join(', ')})`
  if (paint.type === 'GRADIENT_LINEAR') {
    return `linear-gradient(${gradientAngleToCss(paint.gradientTransform, width, height)}deg, ${parts.join(', ')})`
  }
  return undefined
}

/** 单个 Paint → 结构化条目（保留 raw 数值 + 可直接用的 CSS 串） */
export function paintToEntry(paint: StyleNode, width?: number, height?: number): Record<string, any> {
  const entry: Record<string, any> = { type: String(paint.type) }
  if (typeof paint.opacity === 'number') entry.opacity = round(paint.opacity, 4)
  if (paint.type === 'SOLID' && paint.color) {
    entry.color = {
      r: round(paint.color.r, 5),
      g: round(paint.color.g, 5),
      b: round(paint.color.b, 5),
      ...(typeof paint.color.a === 'number' ? { a: round(paint.color.a, 5) } : {}),
    }
    entry.hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b)
    entry.css = solidToCss(paint.color, paint.opacity)
  } else if (String(paint.type).startsWith('GRADIENT')) {
    entry.gradientStops = Array.isArray(paint.gradientStops)
      ? paint.gradientStops.map((s: StyleNode) => ({
          position: round(s.position, 4),
          color: {
            r: round(s.color.r, 5),
            g: round(s.color.g, 5),
            b: round(s.color.b, 5),
            ...(typeof s.color.a === 'number' ? { a: round(s.color.a, 5) } : {}),
          },
        }))
      : []
    if (Array.isArray(paint.gradientTransform)) entry.gradientTransform = paint.gradientTransform.map((v: number) => round(v, 6))
    entry.css = gradientToCss(paint, width, height)
  } else if (paint.type === 'IMAGE') {
    if (paint.imageRef) entry.imageRef = paint.imageRef
    if (paint.scaleMode) entry.scaleMode = paint.scaleMode
  }
  return entry
}

/**
 * Paint[] → 条目列表；figma.mixed（逐图层不一致）时返回 { mixed: true }
 * 不可见 paint 直接剔除，避免把"关掉的效果"当成设计意图传下去。
 */
export function extractPaints(paints: StyleNode, width?: number, height?: number): { mixed: true } | { list: Record<string, any>[] } {
  if (isMixed(paints)) return { mixed: true }
  if (!Array.isArray(paints)) return { list: [] }
  return { list: paints.filter((p: StyleNode) => p && p.visible !== false).map((p: StyleNode) => paintToEntry(p, width, height)) }
}

/**
 * Paint 条目列表 → CSS 背景声明
 * Figma 的 paints[0] 在最上层，CSS background 也是先写的盖在上面，顺序可直接沿用。
 */
export function paintsToBackgroundCss(list: Record<string, any>[]): Record<string, string> {
  const css: Record<string, string> = {}
  const solids = list.filter((p) => p.type === 'SOLID' && p.css)
  const gradients = list.filter((p) => String(p.type).startsWith('GRADIENT') && p.css)
  if (solids.length) css['background-color'] = solids[0].css
  if (gradients.length) css['background-image'] = gradients.map((g) => g.css).join(', ')
  return css
}

/**
 * 圆角读取：统一值 / 四角分别值
 * 0 是有效值必须记录——否则"美术刻意做直角"与"插件没读出来"无法区分。
 */
export function extractCornerRadii(node: StyleNode): { uniform?: number; corners?: number[] } {
  if (typeof node.cornerRadius === 'number' && !isNaN(node.cornerRadius)) {
    return { uniform: round(node.cornerRadius, 2) }
  }
  const CORNER_ORDER = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']
  const rect = node.rectangleCornerRadii
  if (Array.isArray(rect) && rect.length === 4 && rect.every((v: unknown) => typeof v === 'number')) {
    return { corners: rect.map((v: number) => round(v, 2)) }
  }
  if (CORNER_ORDER.every((k) => typeof node[k] === 'number')) {
    return { corners: CORNER_ORDER.map((k) => round(node[k], 2)) }
  }
  return {}
}

/** 圆角 → border-radius（Figma 四角顺序与 CSS 的 TL TR BR BL 一致） */
export function borderRadiusToCss(radii: { uniform?: number; corners?: number[] }): string | undefined {
  if (typeof radii.uniform === 'number') return `${radii.uniform}px`
  if (Array.isArray(radii.corners) && radii.corners.length === 4) {
    return radii.corners.map((v) => `${v}px`).join(' ')
  }
  return undefined
}

/** 效果（阴影/模糊）→ CSS 声明 */
export function effectsToCss(effects: StyleNode): Record<string, string> {
  const css: Record<string, string> = {}
  if (!Array.isArray(effects)) return css
  const shadows: string[] = []
  const blurs: string[] = []
  const bgBlurs: string[] = []
  for (const e of effects) {
    if (!e || e.visible === false) continue
    const radius = px(e.radius) || '0px'
    if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
      const x = px(e.offset && e.offset.x) || '0px'
      const y = px(e.offset && e.offset.y) || '0px'
      const spread = typeof e.spread === 'number' ? ` ${px(e.spread)}` : ''
      const color = solidToCss(e.color) || 'rgba(0, 0, 0, 0.3)'
      const inset = e.type === 'INNER_SHADOW' ? 'inset ' : ''
      shadows.push(`${inset}${x} ${y} ${radius}${spread} ${color}`)
    } else if (e.type === 'LAYER_BLUR') {
      blurs.push(`blur(${radius})`)
    } else if (e.type === 'BACKGROUND_BLUR') {
      bgBlurs.push(`blur(${radius})`)
    }
  }
  if (shadows.length) css['box-shadow'] = shadows.join(', ')
  if (blurs.length) css.filter = blurs.join(' ')
  if (bgBlurs.length) css['backdrop-filter'] = bgBlurs.join(' ')
  return css
}

/** 效果列表 → raw 结构 */
export function effectsToRaw(effects: StyleNode): Record<string, any>[] {
  if (!Array.isArray(effects) || isMixed(effects)) return []
  return effects
    .filter((e: StyleNode) => e && e.visible !== false)
    .map((e: StyleNode) => ({
      type: String(e.type),
      ...(typeof e.radius === 'number' ? { radius: round(e.radius, 2) } : {}),
      ...(typeof e.spread === 'number' ? { spread: round(e.spread, 2) } : {}),
      ...(e.offset ? { offset: { x: round(e.offset.x, 2), y: round(e.offset.y, 2) } } : {}),
      ...(e.color ? { color: { r: round(e.color.r, 5), g: round(e.color.g, 5), b: round(e.color.b, 5), a: round(typeof e.color.a === 'number' ? e.color.a : 1, 5) } } : {}),
    }))
}

/** 自动布局的对齐枚举 → CSS 值 */
const ALIGN_TO_CSS: Record<string, string> = {
  MIN: 'flex-start',
  MAX: 'flex-end',
  CENTER: 'center',
  SPACE_BETWEEN: 'space-between',
  BASELINE: 'baseline',
}

/**
 * 自动布局 / CSS Grid → CSS 声明
 * 同时把 Figma 独有、CSS 无对应的概念（sizingMode、counterAxisSpacing、min/max）留在 raw 里。
 */
export function autoLayoutToCss(node: StyleNode): Record<string, string> {
  const css: Record<string, string> = {}
  const mode = node.layoutMode
  if (!mode || mode === 'NONE') return css

  if (mode === 'GRID') {
    css.display = 'grid'
    // Figma 的 gridRowGap 是"行与行之间的间距"，对应 CSS row-gap；列间距同理
    const cg = px(node.gridColumnGap)
    const rg = px(node.gridRowGap)
    if (cg) css['column-gap'] = cg
    if (rg) css['row-gap'] = rg
    return css
  }

  css.display = 'flex'
  css['flex-direction'] = mode === 'VERTICAL' ? 'column' : 'row'
  const gap = px(node.itemSpacing)
  if (gap) css.gap = gap
  const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
  if (pad.every((v) => typeof v === 'number')) {
    // CSS padding 顺序同样是 T R B L
    css.padding = pad.map((v) => `${round(v as number, 2)}px`).join(' ')
  }
  const justify = ALIGN_TO_CSS[String(node.primaryAxisAlignItems)]
  if (justify) css['justify-content'] = justify
  const alignItems = ALIGN_TO_CSS[String(node.counterAxisAlignItems)]
  if (alignItems) css['align-items'] = alignItems
  if (node.layoutWrap === 'WRAP') css['flex-wrap'] = 'wrap'
  return css
}

/** 自动布局 raw 结构（只收有值的项，0 保留） */
export function autoLayoutToRaw(node: StyleNode): Record<string, any> | undefined {
  const mode = node.layoutMode
  if (!mode || mode === 'NONE') return undefined
  const raw: Record<string, any> = { layoutMode: mode }
  const numKeys = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'itemSpacing', 'counterAxisSpacing', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight']
  for (const k of numKeys) {
    if (typeof node[k] === 'number') raw[k] = round(node[k], 2)
  }
  if (node.primaryAxisAlignItems) raw.primaryAxisAlignItems = node.primaryAxisAlignItems
  if (node.counterAxisAlignItems) raw.counterAxisAlignItems = node.counterAxisAlignItems
  if (node.primaryAxisSizingMode) raw.primaryAxisSizingMode = node.primaryAxisSizingMode
  if (node.counterAxisSizingMode) raw.counterAxisSizingMode = node.counterAxisSizingMode
  if (node.layoutWrap) raw.layoutWrap = node.layoutWrap
  return raw
}

/** letterSpacing / lineHeight 的 Figma 单位 → CSS 值 */
export function letterSpacingToCss(v: StyleNode): string | undefined {
  if (!v || typeof v !== 'object') return undefined
  if (v.unit === 'AUTO') return 'normal'
  if (v.unit === 'PIXELS' && typeof v.value === 'number') return `${round(v.value, 3)}px`
  if (v.unit === 'PERCENT' && typeof v.value === 'number') return `${round(v.value / 100, 4)}em`
  return undefined
}

export function lineHeightToCss(v: StyleNode): string | undefined {
  if (!v || typeof v !== 'object') return undefined
  if (v.unit === 'AUTO') return 'normal'
  if (v.unit === 'PIXELS' && typeof v.value === 'number') return `${round(v.value, 2)}px`
  if (v.unit === 'PERCENT' && typeof v.value === 'number') return `${round(v.value / 100, 4)}`
  return undefined
}

const TEXT_CASE_TO_CSS: Record<string, string> = {
  UPPER: 'uppercase',
  LOWER: 'lowercase',
  TITLE: 'capitalize',
  ORIGINAL: 'none',
}

const TEXT_ALIGN_TO_CSS: Record<string, string> = {
  LEFT: 'left',
  RIGHT: 'right',
  CENTER: 'center',
  JUSTIFIED: 'justify',
}

/**
 * 文本节点 → 字体相关 raw 与 CSS
 * 优先用 getRange*(0, 1) 读首字符（逐字符不一致时 Figma 会返回 mixed），
 * 读不到再退回节点属性；mock 节点没有 getRange* 方法时同样走退回分支。
 */
export function extractTextStyle(node: StyleNode): { raw: Record<string, any>; css: Record<string, string> } {
  const raw: Record<string, any> = {}
  const css: Record<string, string> = {}

  const read = (prop: string, rangeGetter: string): StyleNode => {
    if (typeof node[rangeGetter] === 'function') {
      try {
        const v = node[rangeGetter](0, 1)
        if (!isMixed(v)) return v
      } catch {
        /* 节点不支持 range 读取时忽略 */
      }
    }
    const v = node[prop]
    return isMixed(v) ? undefined : v
  }

  const fontName = read('fontName', 'getRangeFontName')
  if (fontName && typeof fontName === 'object' && fontName.family) {
    raw.fontName = { family: fontName.family, style: fontName.style }
    css['font-family'] = `"${fontName.family}", sans-serif`
    if (typeof fontName.style === 'string' && /italic|oblique/i.test(fontName.style)) {
      css['font-style'] = 'italic'
    }
  }

  const fontSize = read('fontSize', 'getRangeFontSize')
  if (typeof fontSize === 'number') {
    raw.fontSize = round(fontSize, 2)
    css['font-size'] = `${round(fontSize, 2)}px`
  }

  const weight = read('fontWeight', 'getRangeFontWeight')
  if (typeof weight === 'number') {
    raw.fontWeight = weight
    css['font-weight'] = String(weight)
  }

  const ls = read('letterSpacing', 'getRangeLetterSpacing')
  const lsCss = letterSpacingToCss(ls)
  if (lsCss) {
    raw.letterSpacing = ls
    css['letter-spacing'] = lsCss
  }

  const lh = read('lineHeight', 'getRangeLineHeight')
  const lhCss = lineHeightToCss(lh)
  if (lhCss) {
    raw.lineHeight = lh
    css['line-height'] = lhCss
  }

  if (typeof node.paragraphSpacing === 'number' && node.paragraphSpacing !== 0) {
    raw.paragraphSpacing = round(node.paragraphSpacing, 2)
    css['margin-bottom'] = `${round(node.paragraphSpacing, 2)}px`
  }

  const align = TEXT_ALIGN_TO_CSS[String(node.textAlignHorizontal)]
  if (align) {
    raw.textAlignHorizontal = node.textAlignHorizontal
    css['text-align'] = align
  }
  if (node.textCase && TEXT_CASE_TO_CSS[String(node.textCase)]) {
    raw.textCase = node.textCase
    css['text-transform'] = TEXT_CASE_TO_CSS[String(node.textCase)]
  }
  if (node.textDecoration === 'UNDERLINE') {
    raw.textDecoration = node.textDecoration
    css['text-decoration-line'] = 'underline'
  } else if (node.textDecoration === 'STRIKETHROUGH') {
    raw.textDecoration = node.textDecoration
    css['text-decoration-line'] = 'line-through'
  }

  // 文字颜色：取第一个可见纯色填充
  const fills = extractPaints(node.fills, node.width, node.height)
  if (!('mixed' in fills)) {
    const solid = fills.list.find((p) => p.type === 'SOLID' && p.css)
    if (solid) {
      css.color = solid.css
      raw.colorHex = solid.hex
    }
  }

  return { raw, css }
}

const BLEND_MODE_TO_CSS: Record<string, string> = {
  NORMAL: 'normal',
  MULTIPLY: 'multiply',
  SCREEN: 'screen',
  OVERLAY: 'overlay',
  DARKEN: 'darken',
  LIGHTEN: 'lighten',
  COLOR_DODGE: 'color-dodge',
  COLOR_BURN: 'color-burn',
  HARD_LIGHT: 'hard-light',
  SOFT_LIGHT: 'soft-light',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
}

/**
 * 单节点视觉属性提取 → { raw, css }
 * raw  = Figma 原值（0~1 的浮点、枚举名、mixed 标记、矩阵等），用于精确复用与排查；
 * css  = 可直接抄进样式表的声明块（kebab-case 键名，值已换算成 px / hex / rgba）。
 */
export function extractNodeStyle(node: StyleNode): { raw: Record<string, any>; css: Record<string, string> } {
  const raw: Record<string, any> = {}
  const css: Record<string, string> = {}

  // 几何：只留宽高；x/y 绝对坐标对写 CSS 无用，且会让同类节点产物无法去重
  const w = px(node.width)
  const h = px(node.height)
  if (w) {
    raw.width = round(node.width, 2)
    css.width = w
  }
  if (h) {
    raw.height = round(node.height, 2)
    css.height = h
  }
  if (typeof node.rotation === 'number' && node.rotation !== 0) {
    raw.rotation = round(node.rotation, 3)
    css.transform = `rotate(${round(node.rotation, 3)}deg)`
  }

  // 圆角 / 直角
  const radii = extractCornerRadii(node)
  if (typeof radii.uniform === 'number') raw.cornerRadius = radii.uniform
  if (radii.corners) raw.cornerRadii = { order: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'], values: radii.corners }
  const radiusCss = borderRadiusToCss(radii) ?? (node.type === 'ELLIPSE' ? '50%' : undefined)
  if (radiusCss) css['border-radius'] = radiusCss

  // 填充：背景色 / 背景图（渐变）
  // TEXT 的 fills 是"文字颜色"而非背景，交给 extractTextStyle 落到 color，
  // 否则会同时产出 background-color 与 color 两个同名值，token 统计也会重复。
  const fills = extractPaints(node.fills, node.width, node.height)
  if ('mixed' in fills) {
    raw.fills = { mixed: true }
  } else if (fills.list.length) {
    raw.fills = fills.list
    if (node.type !== 'TEXT') Object.assign(css, paintsToBackgroundCss(fills.list))
  }

  // 描边：宽度 + 对齐 + 颜色 → border
  const strokes = extractPaints(node.strokes, node.width, node.height)
  if ('mixed' in strokes) {
    raw.strokes = { mixed: true }
  } else if (strokes.list.length) {
    raw.strokes = strokes.list
    const solid = strokes.list.find((p) => p.type === 'SOLID' && p.css)
    const strokeWidth = isMixed(node.strokeWeight) ? undefined : node.strokeWeight
    if (typeof strokeWidth === 'number') raw.strokeWeight = round(strokeWidth, 2)
    if (node.strokeAlign) raw.strokeAlign = node.strokeAlign
    if (Array.isArray(node.dashPattern)) raw.dashPattern = node.dashPattern.map((v: number) => round(v, 2))
    const widthCss = px(strokeWidth)
    if (widthCss && solid) {
      css.border = `${widthCss} solid ${solid.css}`
      // Figma 的 INSIDE 等价 CSS 的 border-box；CENTER/OUTSIDE 需按半宽/零宽理解，故不猜
      if (node.strokeAlign === 'INSIDE') css['box-sizing'] = 'border-box'
    }
  }

  // 效果：阴影 / 模糊
  const effects = effectsToRaw(node.effects)
  if (effects.length) {
    raw.effects = effects
    Object.assign(css, effectsToCss(node.effects))
  }

  // 混合与透明度
  if (typeof node.opacity === 'number' && !isNaN(node.opacity)) {
    raw.opacity = round(node.opacity, 4)
    if (node.opacity < 1) css.opacity = String(round(node.opacity, 3))
  }
  if (node.blendMode && node.blendMode !== 'NORMAL') {
    raw.blendMode = node.blendMode
    const blend = BLEND_MODE_TO_CSS[String(node.blendMode)]
    if (blend && blend !== 'normal') css['mix-blend-mode'] = blend
  }
  if (node.isMask === true) raw.isMask = true

  // 自动布局 / Grid
  const autoLayout = autoLayoutToRaw(node)
  if (autoLayout) {
    raw.autoLayout = autoLayout
    Object.assign(css, autoLayoutToCss(node))
  }

  // 文本
  if (node.type === 'TEXT') {
    const text = extractTextStyle(node)
    raw.text = text.raw
    Object.assign(css, text.css)
  }

  return { raw, css }
}

/** 单个节点的样式条目 */
export interface StyleNodeEntry {
  /** Frame 内的路径，如 Button/primary/bg；同名冲突时追加 #nodeId */
  path: string
  nodeId: string
  nodeName: string
  nodeType: string
  raw: Record<string, any>
  css: Record<string, string>
}

/**
 * 深度遍历 样式_ Frame，收集每个图层的样式条目
 * 跳过隐藏图层；受 STYLE_MAX_NODES / STYLE_MAX_DEPTH 约束，超限置 truncated。
 * self 是 Frame 自身的样式——美术常把圆角/背景/自动布局挂在 Frame 本层，
 * 只统计子图层会丢掉"这个容器是直角"这类关键信息。
 */
export function collectStyleNodes(frame: StyleNode): {
  self: StyleNodeEntry
  entries: StyleNodeEntry[]
  truncated: boolean
  hiddenSkipped: number
} {
  const entries: StyleNodeEntry[] = []
  const usedPaths = new Set<string>()
  let hiddenSkipped = 0
  let truncated = false

  const uniquePath = (base: string, id: string) => {
    if (!usedPaths.has(base)) {
      usedPaths.add(base)
      return base
    }
    const withId = `${base}#${id}`
    usedPaths.add(withId)
    return withId
  }

  const selfStyle = extractNodeStyle(frame)
  const self: StyleNodeEntry = {
    // tokens 的 usedBy 里用固定标记代表 Frame 本体（子图层是 child/... 路径）
    path: '@frame',
    nodeId: String(frame.id || ''),
    nodeName: String(frame.name || ''),
    nodeType: String(frame.type || ''),
    raw: selfStyle.raw,
    css: selfStyle.css,
  }

  const walk = (node: StyleNode, prefix: string, depth: number): boolean => {
    const children = node && node.children
    if (!Array.isArray(children)) return true
    for (const child of children) {
      if (truncated) return false
      if (!child || child.visible === false) {
        if (child) hiddenSkipped++
        continue
      }
      if (entries.length >= STYLE_MAX_NODES) {
        truncated = true
        logWarn(`样式提取达到节点上限 ${STYLE_MAX_NODES}，已截断`)
        return false
      }
      if (depth > STYLE_MAX_DEPTH) {
        truncated = true
        logWarn(`样式提取达到深度上限 ${STYLE_MAX_DEPTH}，已截断`)
        return false
      }
      const name = String(child.name || '(未命名)')
      const path = uniquePath(prefix ? `${prefix}/${name}` : name, String(child.id || ''))
      const style = extractNodeStyle(child)
      entries.push({
        path,
        nodeId: String(child.id || ''),
        nodeName: name,
        nodeType: String(child.type || ''),
        raw: style.raw,
        css: style.css,
      })
      if (!walk(child, path, depth + 1)) return false
    }
    return true
  }

  walk(frame, '', 1)
  return { self, entries, truncated, hiddenSkipped }
}

/** 把 CSS 声明里的候选值按"使用它的节点数"汇总（供 design-tokens 直接取用） */
function tally(values: [string, string][]): { value: string; count: number; usedBy: string[] }[] {
  // 同一节点可能通过多个属性贡献同一个值（如 border 与 background-color 同色），
  // 先按 (value, path) 去重，count 才是"多少个节点在用"而不是"出现了多少次"
  const seen = new Set<string>()
  const map = new Map<string, { value: string; count: number; usedBy: string[] }>()
  for (const [value, path] of values) {
    if (!value) continue
    const pairKey = `${value}\u0000${path}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)
    const hit = map.get(value)
    if (hit) {
      hit.count++
      if (hit.usedBy.length < 3) hit.usedBy.push(path)
    } else {
      map.set(value, { value, count: 1, usedBy: [path] })
    }
  }
  // 次数降序、同值按字符串升序 —— 保证同样输入产出同样字节（后端 MD5 增量依赖这点）
  return [...map.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/**
 * 样式条目 → tokens 汇总（颜色/圆角/间距/阴影/字号字重）
 * 这是能直接填进 src/assets/styles/design-tokens.css 的部分。
 */
export function buildStyleTokens(entries: StyleNodeEntry[]): Record<string, any> {
  const colors: [string, string][] = []
  const radii: [string, string][] = []
  const spacing: [string, string][] = []
  const shadows: [string, string][] = []
  const fonts: [string, string][] = []

  for (const e of entries) {
    const colorKeys = ['background-color', 'color', 'border']
    for (const k of colorKeys) {
      const v = e.css[k]
      if (!v) continue
      if (k === 'border') {
        const m = v.match(/(#[0-9a-f]{6}|rgba?\([^)]*\))/i)
        if (m) colors.push([m[1], e.path])
      } else {
        // background-color 可能含多值，拆开再收
        for (const part of v.split(',')) {
          const t = part.trim()
          if (/^(#|rgba?\()/i.test(t)) colors.push([t, e.path])
        }
      }
    }
    if (e.css['background-image']) colors.push([e.css['background-image'], e.path])

    const radius = e.css['border-radius']
    if (radius) for (const part of radius.split(',')) radii.push([part.trim(), e.path])

    if (e.css.padding) for (const part of e.css.padding.split(' ')) spacing.push([part.trim(), e.path])
    if (e.css.gap) for (const part of e.css.gap.split(' ')) spacing.push([part.trim(), e.path])

    // 阴影整串作为 token：拆开会把 rgba(0, 0, 0, 0.25) 切碎成无意义片段
    if (e.css['box-shadow']) shadows.push([e.css['box-shadow'], e.path])

    const fs = e.css['font-size']
    const fw = e.css['font-weight']
    const lh = e.css['line-height']
    if (fs || fw || lh) {
      fonts.push([[fs, fw, lh].filter(Boolean).join(' / '), e.path])
    }
  }

  return {
    color: tally(colors),
    radius: tally(radii),
    spacing: tally(spacing),
    shadow: tally(shadows),
    font: tally(fonts),
  }
}

/** 样式文档的顶层结构（键顺序固定，保证同输入产出同字节，否则 MD5 增量会失效） */
function buildStyleDoc(
  frame: StyleNode,
  self: StyleNodeEntry,
  entries: StyleNodeEntry[],
  meta: { truncated: boolean; hiddenSkipped: number; withRaw: boolean },
): Record<string, any> {
  const nodes: Record<string, any> = {}
  for (const e of entries) {
    nodes[e.path] = {
      nodeId: e.nodeId,
      nodeType: e.nodeType,
      css: e.css,
      ...(meta.withRaw ? { raw: e.raw } : {}),
    }
  }
  return {
    kind: 'figma-style-tokens',
    schema: 1,
    source: {
      frame: String(frame.name || ''),
      nodeId: String(frame.id || ''),
      page: frame.parent && frame.parent.name ? String(frame.parent.name) : '',
    },
    meta: {
      nodeCount: entries.length,
      truncated: meta.truncated,
      hiddenSkipped: meta.hiddenSkipped,
      withRaw: meta.withRaw,
    },
    // self = 样式_ Frame 本体（容器圆角/背景/自动布局常挂在这一层）
    self: {
      nodeId: self.nodeId,
      nodeType: self.nodeType,
      css: self.css,
      ...(meta.withRaw ? { raw: self.raw } : {}),
    },
    tokens: buildStyleTokens([self, ...entries]),
    nodes,
  }
}

/** UTF-8 字节数（不依赖 TextEncoder，插件沙箱与测试环境都能算） */
function utf8ByteLength(str: string): number {
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      // 代理对：一个码点占 4 字节，跳过后一个 code unit
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

/** 序列化并逐级瘦身，确保不撑爆后端 500KB JSON 上限 */
function serializeStyleDoc(
  frame: StyleNode,
  self: StyleNodeEntry,
  entries: StyleNodeEntry[],
  truncated: boolean,
  hiddenSkipped: number,
): string {
  const full = JSON.stringify(buildStyleDoc(frame, self, entries, { truncated, hiddenSkipped, withRaw: true }), null, 2)
  if (utf8ByteLength(full) <= STYLE_MAX_JSON_BYTES) return full

  logWarn('样式 JSON 超出字节上限，先去掉 raw 再试')
  const withoutRaw = JSON.stringify(buildStyleDoc(frame, self, entries, { truncated: true, hiddenSkipped, withRaw: false }), null, 2)
  if (utf8ByteLength(withoutRaw) <= STYLE_MAX_JSON_BYTES) return withoutRaw

  logWarn('仍然超限，逐步裁剪节点条目')
  let step = Math.max(20, Math.floor(entries.length / 3))
  let shrunk = withoutRaw
  while (step > 0) {
    const head = entries.slice(0, step)
    const candidate = JSON.stringify(buildStyleDoc(frame, self, head, { truncated: true, hiddenSkipped, withRaw: false }), null, 2)
    if (utf8ByteLength(candidate) <= STYLE_MAX_JSON_BYTES || step <= 20) {
      shrunk = candidate
      break
    }
    step = Math.floor(step / 2)
  }
  return shrunk
}

/**
 * 扫描单个 样式_ Frame，产出一个 styles/**.json 资源
 * 与 scanTextFrame 一样走 content（JSON 字符串）上传，不占用 exportAsync。
 */
export function scanStyleFrame(frame: StyleNode): AssetItem[] {
  const ossPath = resolveStyleOssPath(frame.name)
  if (!ossPath) {
    logWarn(`样式 Frame "${frame.name}" 去掉 样式_ 前缀后为空，跳过（请命名为 样式_<模块>）`)
    return []
  }

  const { self, entries, truncated, hiddenSkipped } = collectStyleNodes(frame)
  if (entries.length === 0) {
    logWarn(`样式 Frame "${frame.name}" 内没有可见图层，跳过`)
    return []
  }

  const content = serializeStyleDoc(frame, self, entries, truncated, hiddenSkipped)
  const fileName = ossPath.split('/').pop() as string
  logInfo(`  [样式] "${frame.name}" → "${ossPath}"（${entries.length} 个节点${truncated ? '，已截断' : ''}）`)

  return [
    {
      ossPath,
      fileName,
      type: ASSET_TYPE.STYLE,
      nodeId: String(frame.id || ''),
      content,
      status: 'new',
    },
  ]
}

/** 变量值 → CSS 值（COLOR 换算，FLOAT 给 px 便利串但不做单位断言） */
export function variableValueToCss(resolvedType: string, value: StyleNode): string | undefined {
  if (resolvedType === 'COLOR') return solidToCss(value)
  if (resolvedType === 'FLOAT') {
    return typeof value === 'number' ? `${round(value, 2)}px` : undefined
  }
  if (resolvedType === 'STRING') return typeof value === 'string' ? value : undefined
  if (resolvedType === 'BOOLEAN') return typeof value === 'boolean' ? String(value) : undefined
  return undefined
}

/**
 * 汇总页面级共享样式与变量 → styles/_shared.json
 *
 * 入参由 code.ts 从 Figma API 取好后以普通数组传入（本模块不引用 figma 全局，便于单测）：
 *   paintStyles / textStyles / effectStyles / gridStyles / variables / variableCollections
 */
export function buildSharedStylesAsset(input: {
  paintStyles?: StyleNode[]
  textStyles?: StyleNode[]
  effectStyles?: StyleNode[]
  gridStyles?: StyleNode[]
  variables?: StyleNode[]
  variableCollections?: StyleNode[]
  pageName?: string
}): AssetItem[] {
  const paint = (input.paintStyles || []).map((s: StyleNode) => {
    const paints = extractPaints(s && s.paints)
    const list = 'mixed' in paints ? [] : paints.list
    const css = { ...paintsToBackgroundCss(list) }
    if (s && s.color && typeof s.color.r === 'number') {
      css['background-color'] = solidToCss(s.color) || ''
    }
    return {
      name: String((s && s.name) || ''),
      nodeId: String((s && s.nodeId) || ''),
      description: (s && s.description) || '',
      css,
      raw: { paints },
    }
  })

  const text = (input.textStyles || []).map((s: StyleNode) => {
    // TextStyle.style 是 Partial<TypeStyle>，字段可能缺省
    const st = (s && s.style) || {}
    const pseudo = {
      type: 'TEXT',
      ...st,
      fills: st.fills,
      width: undefined,
      height: undefined,
    }
    const extracted = extractTextStyle(pseudo)
    return {
      name: String((s && s.name) || ''),
      nodeId: String((s && s.nodeId) || ''),
      description: (s && s.description) || '',
      css: extracted.css,
      raw: extracted.raw,
    }
  })

  const effect = (input.effectStyles || []).map((s: StyleNode) => {
    const effects = (s && s.effects) || []
    return {
      name: String((s && s.name) || ''),
      nodeId: String((s && s.nodeId) || ''),
      description: (s && s.description) || '',
      css: effectsToCss(effects),
      raw: { effects: effectsToRaw(effects) },
    }
  })

  const grid = (input.gridStyles || []).map((s: StyleNode) => ({
    name: String((s && s.name) || ''),
    nodeId: String((s && s.nodeId) || ''),
    description: (s && s.description) || '',
    css: {},
    raw: { layoutGrids: (s && s.layoutGrids) || [] },
  }))

  // 集合与模式名：变量值按 modeId 存，需要名字才能读
  const modeNames = new Map<string, string>()
  const collections = (input.variableCollections || []).map((c: StyleNode) => {
    for (const modeId of Object.keys((c && c.modes) || {})) {
      modeNames.set(String(modeId), String(c.modes[modeId].name))
    }
    return {
      name: String((c && c.name) || ''),
      id: String((c && c.id) || ''),
      modes: Object.keys((c && c.modes) || {}).map((k: string) => String(c.modes[k].name)),
    }
  })

  const variables = (input.variables || []).map((v: StyleNode) => {
    const valuesByMode = (v && v.valuesByMode) || {}
    const values: Record<string, any> = {}
    for (const modeId of Object.keys(valuesByMode)) {
      const key = modeNames.get(String(modeId)) || String(modeId)
      const raw = valuesByMode[modeId]
      values[key] = {
        raw: raw && typeof raw === 'object' && typeof raw.r === 'number'
          ? { r: round(raw.r, 5), g: round(raw.g, 5), b: round(raw.b, 5), a: round(typeof raw.a === 'number' ? raw.a : 1, 5) }
          : raw,
        css: variableValueToCss(String(v.resolvedType), raw),
      }
    }
    return {
      name: String((v && v.name) || ''),
      resolvedType: String((v && v.resolvedType) || ''),
      collectionId: String((v && v.variableCollectionId) || ''),
      description: (v && v.description) || '',
      values,
    }
  })

  const total = paint.length + text.length + effect.length + grid.length + variables.length
  if (total === 0) return []

  // tokens：把共享样式与变量的色板/字阶/阴影单独汇总一份，方便直接生成 CSS 变量
  const entries: StyleNodeEntry[] = [
    ...paint.map((p) => ({ path: `paint:${p.name}`, nodeId: p.nodeId, nodeName: p.name, nodeType: 'PAINT_STYLE', raw: p.raw, css: p.css })),
    ...text.map((t) => ({ path: `text:${t.name}`, nodeId: t.nodeId, nodeName: t.name, nodeType: 'TEXT_STYLE', raw: t.raw, css: t.css })),
    ...effect.map((e) => ({ path: `effect:${e.name}`, nodeId: e.nodeId, nodeName: e.name, nodeType: 'EFFECT_STYLE', raw: e.raw, css: e.css })),
    ...variables
      .filter((v) => v.resolvedType === 'COLOR')
      .map((v) => {
        const first = Object.values(v.values)[0] as { css?: string }
        return { path: `var:${v.name}`, nodeId: v.collectionId, nodeName: v.name, nodeType: 'VARIABLE', raw: v.values, css: { 'background-color': (first && first.css) || '' } }
      }),
  ]

  const doc = {
    kind: 'figma-local-styles',
    schema: 1,
    source: { page: String(input.pageName || ''), file: '当前 Figma 文件' },
    meta: {
      paintCount: paint.length,
      textCount: text.length,
      effectCount: effect.length,
      gridCount: grid.length,
      variableCount: variables.length,
    },
    tokens: buildStyleTokens(entries),
    styles: { paint, text, effect, grid },
    variableCollections: collections,
    variables,
  }

  const content = JSON.stringify(doc, null, 2)
  if (utf8ByteLength(content) > STYLE_MAX_JSON_BYTES) {
    logWarn('共享样式与变量产物超出字节上限，跳过上传（可精简本地样式/变量）')
    return []
  }

  const ossPath = `styles/${STYLE_SHARED_BASE_NAME}.json`
  logInfo(`  [样式] 共享样式与变量 → "${ossPath}"（${total} 项）`)
  return [{ ossPath, fileName: `${STYLE_SHARED_BASE_NAME}.json`, type: ASSET_TYPE.STYLE, nodeId: '', content, status: 'new' }]
}

// ============ 资源清单（按课文 WEN 汇总） ============
// 说明：与"上传清单（扫描结果）"不同，资源清单是"全量清单"——
// 由当前扫描结果 + 后端已上传 version 合并，按课文(WEN) 维度汇总各类资源的存在情况。

/** 从 OSS 路径提取课文编号，如 WEN_01；无则返回 null */
export function extractWen(ossPath: string): string | null {
  const m = String(ossPath).match(/WEN_\d{2}/)
  return m ? m[0] : null
}

/** 资源类别：数据文件 / 文字资源 / 图片 / 样式 / 其他 */
function classifyResourceCategory(ossPath: string): string {
  if (ossPath.startsWith('data/texts/')) return '文字资源'
  if (ossPath.startsWith('data/')) return '数据文件'
  if (ossPath.startsWith('images/')) return '图片'
  if (ossPath.startsWith('styles/')) return '样式'
  return '其他'
}

/** 单个课文（或无课文）的资源组 */
export interface WenGroup {
  wen: string
  categories: {
    name: string
    uploaded: number
    scanned: number
    examples: string[]
  }[]
}

/** 全量资源清单（按课文汇总） */
export interface ResourceInventory {
  uploadedTotal: number
  scannedTotal: number
  groups: WenGroup[]
}

/**
 * 构建资源清单：合并当前扫描结果与后端已上传 version，按 WEN 汇总。
 *
 * @param scanned  当前 Figma 文件扫描出的资源（上传清单的数据源）
 * @param version  后端 /api/assets/version 返回结构 { assets: { ossPath: record } }
 */
export function buildResourceInventory(
  scanned: AssetItem[],
  version: { assets?: Record<string, any> } | null,
): ResourceInventory {
  // 后端已上传清单：只取路径集合用于对比
  const uploadedPaths = new Set<string>()
  if (version && version.assets && typeof version.assets === 'object') {
    for (const key of Object.keys(version.assets)) uploadedPaths.add(key)
  }

  // Map<wen, Map<category, {uploaded:Set, scanned:Set}>>
  const wenMap = new Map<string, Map<string, { uploaded: Set<string>; scanned: Set<string> }>>()
  const ensure = (wen: string, category: string) => {
    if (!wenMap.has(wen)) wenMap.set(wen, new Map())
    const catMap = wenMap.get(wen)!
    if (!catMap.has(category)) catMap.set(category, { uploaded: new Set(), scanned: new Set() })
    return catMap.get(category)!
  }

  for (const path of uploadedPaths) {
    const wen = extractWen(path) ?? '（无课文）'
    ensure(wen, classifyResourceCategory(path)).uploaded.add(path)
  }

  for (const s of scanned) {
    const wen = extractWen(s.ossPath) ?? '（无课文）'
    ensure(wen, classifyResourceCategory(s.ossPath)).scanned.add(s.ossPath)
  }

  // 排序：WEN 数字升序，无课文放最后
  const numOr = (s: string) => {
    const m = s.match(/\d+/)
    return m ? parseInt(m[0], 10) : -1
  }
  const sortedWen = [...wenMap.keys()].sort((a, b) => {
    const diff = numOr(a) - numOr(b)
    return diff !== 0 ? diff : a.localeCompare(b)
  })
  const categoryOrder = ['数据文件', '文字资源', '图片', '样式', '其他']

  const groups: WenGroup[] = []
  let uploadedTotal = 0
  let scannedTotal = 0

  for (const wen of sortedWen) {
    const catMap = wenMap.get(wen)!
    const categories = categoryOrder
      .filter((c) => catMap.has(c))
      .map((c) => {
        const item = catMap.get(c)!
        return {
          name: c,
          uploaded: item.uploaded.size,
          scanned: item.scanned.size,
          examples: [...item.uploaded].slice(0, 3),
        }
      })
    uploadedTotal += categories.reduce((acc, c) => acc + c.uploaded, 0)
    scannedTotal += categories.reduce((acc, c) => acc + c.scanned, 0)
    groups.push({ wen, categories })
  }

  return { uploadedTotal, scannedTotal, groups }
}