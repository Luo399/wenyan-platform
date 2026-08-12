/**
 * 文言文预习平台 - Figma 资源同步插件
 *
 * 架构说明：
 *   - 通用组件文件：一个 Figma 文件，Export Assets 内放 images/general/ 等全局资源
 *   - 按课文分文件：每个课文一个 Figma 文件，每个文件包含 Export Assets + 文字资源_ Frame
 *   - 插件通用：同一个插件可在任意课文/通用文件中使用
 *
 * 功能：
 * 1. 扫描当前文件顶层 Frame：Export Assets（图片）和 文字资源_（文字）
 * 2. 子 Frame 命名决定 OSS 路径，导出 PNG/SVG
 * 3. 读取文字资源 TextNode.characters 生成 JSON
 * 4. 提取视觉属性：颜色、字体、边框、圆角、尺寸等
 * 5. 显示变更列表，发送到后端 API
 *
 * 使用方式：
 *   在 Figma 中打开任意课文文件/通用文件 → 运行插件 → 自动扫描 → 确认同步
 *
 * OSS 路径规则：
 *   - 图片：Export Assets → 子 Frame 名即为 OSS 路径（如 images/culture_cards/WEN_01/card_bg.png）
 *   - 文字：文字资源_xxx Frame → data/texts/文字资源_xxx.json
 *   - 样式：styles/{Frame名}.json
 */

// ============ 日志工具 ============
// 在 Figma 中通过 Plugins → Development → Open Console 查看日志
const LOG_PREFIX = '[文言文同步]'

function logDebug(...args: any[]) {
  console.log(LOG_PREFIX, '[调试]', ...args)
}

function logInfo(...args: any[]) {
  console.log(LOG_PREFIX, '[信息]', ...args)
}

function logWarn(...args: any[]) {
  console.warn(LOG_PREFIX, '[警告]', ...args)
}

function logError(...args: any[]) {
  console.error(LOG_PREFIX, '[错误]', ...args)
}

// 后端 API 地址（可在插件 UI 中配置）
const DEFAULT_API_BASE = 'https://api.classicalab.cn'

// 导出超时时间（毫秒）：单个资源导出超过 30 秒视为失败
const EXPORT_TIMEOUT_MS = 30000

// 资源类型枚举
const ASSET_TYPE = {
  IMAGE: 'image',
  TEXT: 'text',
  STYLE: 'style',
}

// 扫描结果
interface AssetItem {
  ossPath: string
  fileName: string
  type: string
  nodeId: string
  // 文本内容（仅文字资源）
  content?: string
  // 图片二进制数据（仅图片资源，由 code.ts 导出后发往 UI 线程上传）
  data?: Uint8Array
  // 样式属性（仅样式资源）
  styleData?: Record<string, any>
  // 变更状态
  status: 'new' | 'changed' | 'unchanged'
}

/** 扫描阶段：当前正在进行的扫描类型 */
type ScanPhase = 'scanning' | 'exporting' | 'idle'

/**
 * 带超时的 Promise 包装器
 * 如果指定时间内未完成，则 reject
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
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
 * 提取节点视觉属性：颜色、字体、边框、圆角、尺寸等
 * 跳过视频和音频节点
 */
function extractNodeStyle(node: SceneNode): Record<string, any> {
  const style: Record<string, any> = {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    visible: node.visible,
    locked: node.locked,
    // 位置与尺寸
    x: 'x' in node ? (node as any).x : undefined,
    y: 'y' in node ? (node as any).y : undefined,
    width: 'width' in node ? (node as any).width : undefined,
    height: 'height' in node ? (node as any).height : undefined,
    rotation: 'rotation' in node ? (node as any).rotation : undefined,
    opacity: 'opacity' in node ? (node as BlendMixin).opacity : undefined,
  }

  // 清理 undefined 值
  for (const key of Object.keys(style)) {
    if (style[key] === undefined) delete style[key]
  }

  // 填充颜色（仅读取 solid 类型的纯色）
  if ('fills' in node) {
    const fills = (node as GeometryMixin).fills
    if (fills && typeof fills !== 'symbol') {
      style.fills = (fills as Paint[]).map((f) => {
        const fill: Record<string, any> = { type: f.type, visible: f.visible, opacity: f.opacity }
        if (f.type === 'SOLID' && 'color' in f) {
          fill.color = f.color
          // RGB 百分比转十六进制
          fill.hex = rgbToHex(f.color.r, f.color.g, f.color.b)
        }
        return fill
      }).filter((f) => f.visible !== false)
    }
  }

  // 描边
  if ('strokes' in node) {
    const strokes = (node as GeometryMixin).strokes as Paint[]
    if (strokes && strokes.length > 0) {
      style.strokes = strokes.map((s) => {
        const stroke: Record<string, any> = { type: s.type, visible: s.visible }
        if (s.type === 'SOLID' && 'color' in s) {
          stroke.color = s.color
          stroke.hex = rgbToHex(s.color.r, s.color.g, s.color.b)
        }
        return stroke
      }).filter((s) => s.visible !== false)
    }
  }

  // 描边宽度
  if ('strokeWeight' in node) {
    const sw = (node as GeometryMixin).strokeWeight
    if (sw !== figma.mixed) {
      style.strokeWeight = sw
    }
  }

  // 描边对齐
  if ('strokeAlign' in node) {
    style.strokeAlign = (node as GeometryMixin).strokeAlign
  }

  // 圆角
  if ('cornerRadius' in node) {
    const cr = (node as any).cornerRadius
    if (typeof cr === 'number') {
      style.cornerRadius = cr
    }
  }

  if ('topLeftRadius' in node) {
    const r = node as RectangleCornerMixin
    if (r.topLeftRadius !== undefined) {
      style.cornerRadii = {
        topLeft: r.topLeftRadius,
        topRight: r.topRightRadius,
        bottomRight: r.bottomRightRadius,
        bottomLeft: r.bottomLeftRadius,
      }
    }
  }

  // 效果（阴影、模糊等）
  if ('effects' in node) {
    const effects = (node as BlendMixin).effects
    if (effects && effects.length > 0) {
      style.effects = effects.map((e) => {
        const effect: Record<string, any> = { type: e.type, visible: e.visible }
        // radius 存在于部分效果类型
        if ('radius' in e) effect.radius = (e as any).radius
        // 阴影偏移和颜色
        if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
          const shadow = e as DropShadowEffect
          effect.offset = { x: shadow.offset.x, y: shadow.offset.y }
          effect.color = shadow.color
        }
        return effect
      }).filter((e) => e.visible !== false)
    }
  }

  // 自动布局
  if ('layoutMode' in node) {
    const autoLayout = node as AutoLayoutMixin
    style.layoutMode = autoLayout.layoutMode
    if (autoLayout.layoutMode !== 'NONE') {
      style.paddingLeft = autoLayout.paddingLeft
      style.paddingRight = autoLayout.paddingRight
      style.paddingTop = autoLayout.paddingTop
      style.paddingBottom = autoLayout.paddingBottom
      style.itemSpacing = autoLayout.itemSpacing
      style.primaryAxisAlignItems = autoLayout.primaryAxisAlignItems
      style.counterAxisAlignItems = autoLayout.counterAxisAlignItems
    }
  }

  // 文本属性
  if (node.type === 'TEXT') {
    const textNode = node as TextNode
    // 字号（可能为混合值）
    const fontSize = textNode.getRangeFontSize(0, 1)
    if (fontSize !== figma.mixed) style.fontSize = fontSize

    // 字体名称
    const fontName = textNode.getRangeFontName(0, 1)
    if (fontName !== figma.mixed) {
      style.fontFamily = fontName.family
      style.fontStyle = fontName.style
    }

    // 字重
    const fontWeight = textNode.getRangeFontWeight(0, 1)
    if (fontWeight !== figma.mixed) style.fontWeight = fontWeight

    // 行高
    const lineHeight = textNode.getRangeLineHeight(0, 1)
    if (lineHeight !== figma.mixed) {
      style.lineHeight = lineHeight
    }

    // 字间距
    const letterSpacing = textNode.getRangeLetterSpacing(0, 1)
    if (letterSpacing !== figma.mixed) {
      style.letterSpacing = letterSpacing
    }

    // 文本对齐
    style.textAlignHorizontal = textNode.textAlignHorizontal
    style.textAlignVertical = textNode.textAlignVertical

    // 文本颜色
    const textFills = textNode.getRangeFills(0, 1)
    if (textFills !== figma.mixed && textFills.length > 0) {
      style.textFills = textFills.map((f) => {
        const fill: Record<string, any> = { type: f.type }
        if (f.type === 'SOLID' && 'color' in f) {
          fill.color = f.color
          fill.hex = rgbToHex(f.color.r, f.color.g, f.color.b)
        }
        return fill
      })
    }
  }

  return style
}

/**
 * RGB 0-1 值转十六进制颜色字符串
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * 扫描页面中所有节点的视觉属性
 * 跳过视频（VIDEO）和音频节点，扫描颜色、字体、边框、圆角等
 */
function scanAllStyles(page: PageNode): AssetItem[] {
  const assets: AssetItem[] = []
  logDebug('scanAllStyles: 开始扫描所有节点样式')

  // 递归遍历所有节点
  const allNodes = page.findAll(() => true) as SceneNode[]

  // 按 Frame 组织样式数据
  const frameStyles: Record<string, { frameName: string; nodes: Record<string, any>[] }> = {}

  for (const node of allNodes) {
    // 跳过视频和音频节点（使用字符串比较避免类型错误）
    const nodeType = node.type as string
    if (nodeType === 'VIDEO' || nodeType === 'AUDIO' || nodeType === 'MEDIA') {
      logDebug(`  [跳过] 媒体节点: "${node.name}" (${nodeType})`)
      continue
    }

    // 跳过隐藏节点
    if (node.visible === false) continue

    // 跳过组件定义（ComponentSetItem 等内部节点）
    if (node.type === 'COMPONENT_SET' || node.parent?.type === 'COMPONENT_SET') continue

    try {
      const style = extractNodeStyle(node)
      // 确定所属 Frame（顶层容器）
      const frameId = findTopFrameId(node)
      const frameName = findTopFrameName(node)

      if (!frameStyles[frameId]) {
        frameStyles[frameId] = { frameName, nodes: [] }
      }
      frameStyles[frameId].nodes.push(style)
    } catch (err) {
      logDebug(`  [跳过] 提取样式失败: "${node.name}"`, err)
    }
  }

  // 生成样式资产
  for (const [frameId, data] of Object.entries(frameStyles)) {
    // 跳过没有有效节点的 Frame
    if (data.nodes.length === 0) continue

    const fileName = `styles.json`
    const ossPath = `styles/${data.frameName}.json`
    const jsonContent = JSON.stringify({
      frameName: data.frameName,
      frameId,
      exportTime: new Date().toISOString(),
      nodes: data.nodes,
    }, null, 2)

    logDebug(`  [样式] "${data.frameName}" → ${data.nodes.length} 个节点`)
    assets.push({
      ossPath,
      fileName,
      type: ASSET_TYPE.STYLE,
      nodeId: frameId,
      content: jsonContent,
      styleData: { nodeCount: data.nodes.length },
      status: 'new',
    })
  }

  logInfo(`scanAllStyles 完成: 共 ${assets.length} 个样式文件`)
  return assets
}

/**
 * 查找节点所属的顶层 Frame 名称
 */
function findTopFrameId(node: SceneNode): string {
  let current: BaseNode | null = node
  while (current) {
    if (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'PAGE') {
      return current.id
    }
    current = current.parent
  }
  return node.id
}

/**
 * 查找节点所属的顶层 Frame 名称
 */
function findTopFrameName(node: SceneNode): string {
  let current: BaseNode | null = node
  while (current) {
    if (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'PAGE') {
      return current.name
    }
    current = current.parent
  }
  return node.name.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_')
}

/**
 * 主入口
 */
async function main() {
  logInfo('===== 开始扫描 =====')
  logInfo('当前文件页面:', figma.currentPage.name)

  // 获取当前页面
  const page = figma.currentPage
  const allAssets: AssetItem[] = []

  // 通知 UI 开始扫描
  figma.ui.postMessage({ type: 'scan-phase', phase: 'scanning', message: '扫描 Export Assets...' })

  // 1. 扫描 Export Assets Frame
  logDebug('查找 Export Assets Frame...')
  const exportAssetsFrame = page.findOne(
    (node) => node.type === 'FRAME' && node.name === 'Export Assets',
  ) as FrameNode | null

  if (exportAssetsFrame) {
    logInfo('找到 Export Assets Frame，开始扫描子节点')
    const assets = scanExportAssetsFrame(exportAssetsFrame)
    logInfo(`Export Assets 扫描完成，找到 ${assets.length} 个图片资源`)
    allAssets.push(...assets)
  } else {
    logWarn('未找到 Export Assets Frame（如不需要图片资源可忽略）')
  }

  // 2. 扫描 文字资源_ Frame
  figma.ui.postMessage({ type: 'scan-phase', phase: 'scanning', message: '扫描文字资源...' })
  logDebug('查找文字资源 Frame...')
  const textFrames = page.findAll(
    (node) => node.type === 'FRAME' && node.name.startsWith('文字资源_'),
  ) as FrameNode[]

  if (textFrames.length > 0) {
    logInfo(`找到 ${textFrames.length} 个文字资源 Frame: ${textFrames.map((f) => f.name).join(', ')}`)
    for (const frame of textFrames) {
      logDebug(`扫描文字资源 Frame: "${frame.name}"`)
      const textAssets = scanTextFrame(frame)
      logInfo(`文字资源 "${frame.name}" 扫描完成，导出 ${textAssets.length} 个 JSON`)
      allAssets.push(...textAssets)
    }
  } else {
    logWarn('未找到文字资源 Frame（如不需要文字资源可忽略）')
  }

  // 3. 扫描视觉属性（颜色、字体、边框等）
  figma.ui.postMessage({ type: 'scan-phase', phase: 'scanning', message: '提取视觉属性...' })
  logDebug('开始扫描视觉属性...')
  const styleAssets = scanAllStyles(page)
  logInfo(`视觉属性扫描完成，生成 ${styleAssets.length} 个样式文件`)
  allAssets.push(...styleAssets)

  // 4. 如果没有找到任何资源，提示用户
  if (allAssets.length === 0) {
    logWarn('未找到任何资源，扫描结束')
    figma.ui.onmessage = () => {
      figma.closePlugin()
    }
    figma.ui.postMessage({
      type: 'no-assets',
      message: '未找到 Export Assets 或 文字资源_ Frame\n请在当前文件中创建以下 Frame：\n\n1. Export Assets（图片资源，子 Frame 名即 OSS 路径）\n2. 文字资源_{名称}（文字资源，导出为 JSON）',
    })
    return
  }

  // 6. 汇总日志
  const imageCount = allAssets.filter((a) => a.type === 'image').length
  const textCount = allAssets.filter((a) => a.type === 'text').length
  const styleCount = allAssets.filter((a) => a.type === 'style').length
  logInfo(`===== 扫描完成: 共 ${allAssets.length} 个资源（${imageCount} 图片 + ${textCount} 文字 + ${styleCount} 样式） =====`)
  allAssets.forEach((a) => logDebug(`  ${a.type === 'image' ? '图片' : a.type === 'text' ? '文字' : '样式'} ${a.ossPath}`))

  // 7. 发送到 UI 显示变更列表
  figma.ui.postMessage({
    type: 'scan-result',
    assets: allAssets,
    total: allAssets.length,
  })
}

/**
 * 扫描 Export Assets Frame 下的图片资源
 * 子 Frame 名称 = OSS 路径，图层名称 = 文件名
 */
function scanExportAssetsFrame(frame: FrameNode): AssetItem[] {
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

    // 子 Frame 名称作为 OSS 路径
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
      const exportableTypes = [
        'RECTANGLE', 'ELLIPSE', 'VECTOR', 'IMAGE',
        'INSTANCE', 'COMPONENT', 'FRAME', 'GROUP',
      ]
      if (!exportableTypes.includes(leaf.type)) {
        logDebug(`    → [跳过] 不支持的图层类型(${leaf.type}): "${leaf.name}"`)
        skipCount++
        continue
      }

      // 文件名 = 图层名（必须包含扩展名）
      const fileName = leaf.name
      if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
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
 * 扫描文字资源 Frame 下的文本节点
 * Frame 命名格式：文字资源_{名称}（如 文字资源_论语·学而篇）
 * 子节点命名格式：{field_name}（如 knowledge_text, card_name）
 * 导出路径：data/texts/文字资源_{名称}.json
 */
function scanTextFrame(frame: FrameNode): AssetItem[] {
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
    const jsonFileName = `${frame.name}.json`
    const fieldCount = Object.keys(jsonData).length
    const jsonContent = JSON.stringify(jsonData, null, 2)
    // 解析目标路径：使导出的 JSON 路径与前端消费路径一致（见方案文档 §8.2）
    const ossPath = resolveTextOssPath(frame.name)
    logInfo(`  [产出] JSON: "${ossPath}" (${fieldCount} 个字段, ${jsonContent.length} 字节)`)

    assets.push({
      ossPath,
      fileName: jsonFileName,
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

/**
 * 解析文字资源 Frame 的目标 OSS 路径
 *
 * 新命名（推荐）：Frame 名 = 相对路径，如 文字资源_culture_cards_WEN_01
 *   → data/culture_cards/WEN_01.json
 * 旧命名（兼容）：文字资源_论语·学而篇
 *   → data/texts/文字资源_论语·学而篇.json
 */
function resolveTextOssPath(frameName: string): string {
  const rest = frameName.replace(/^文字资源_/, '').replace(/\/+$/, '')
  if (rest.includes('/')) {
    // 新命名：去掉前缀后的剩余部分即相对目录，拼接为 data/{相对路径}.json
    return `data/${rest}.json`
  }
  // 旧命名兼容：保持 data/texts/ 目录结构
  return `data/texts/${frameName}.json`
}

/**
 * 导出单个图片节点，带超时保护
 * 返回 Uint8Array，失败时返回空数组
 */
async function exportSingleNode(nodeId: string, ossPath: string): Promise<Uint8Array> {
  try {
    const node = await figma.getNodeByIdAsync(nodeId) as SceneNode | null
    if (!node) {
      logError(`  节点不存在或不可访问: "${ossPath}" (nodeId: ${nodeId})`)
      return new Uint8Array(0)
    }

    // 检查节点是否仍在场景中（removed 为 true 表示已被删除）
    if ('removed' in node && (node as any).removed === true) {
      logError(`  节点已被删除: "${ossPath}"`)
      return new Uint8Array(0)
    }

    const isSvg = ossPath.toLowerCase().endsWith('.svg')
    const exportOptions: ExportSettings = isSvg
      ? { format: 'SVG' }
      : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } }

    logDebug(`  → 正在导出: "${ossPath}" (${isSvg ? 'SVG' : 'PNG'})`)
    const rawData = await withTimeout(
      node.exportAsync(exportOptions),
      EXPORT_TIMEOUT_MS,
      `exportAsync(${ossPath})`,
    )
    logInfo(`  导出成功: "${ossPath}" (${rawData.byteLength} bytes)`)
    return new Uint8Array(rawData)
  } catch (err) {
    logError(`  导出失败: "${ossPath}"`, err)
    return new Uint8Array(0)
  }
}

/**
 * 导出所有图片节点，准备发往 UI 线程上传
 *
 * 架构说明：
 *   - 主线程（code.ts）负责 Figma API 调用（如导出节点）
 *   - UI 线程（ui.html）负责网络请求（支持 FormData / Blob 等浏览器 API）
 *   - 二进制数据通过 postMessage 结构化克隆传递
 */
async function prepareAssetsForUpload(assets: AssetItem[]): Promise<AssetItem[]> {
  logInfo(`===== 准备导出: ${assets.length} 个资源 =====`)
  const result: AssetItem[] = []

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    logDebug(`[${i + 1}/${assets.length}] 处理: "${asset.ossPath}" (${asset.type})`)

    if (asset.type === ASSET_TYPE.IMAGE) {
      // 图片资源：在主线程导出节点，二进制数据发往 UI 线程上传
      const data = await exportSingleNode(asset.nodeId, asset.ossPath)
      result.push({ ...asset, data })
    } else {
      // 文字/样式资源：直接传递文本内容
      logDebug(`  → ${asset.type} 资源, 内容长度: ${asset.content?.length || 0} 字符`)
      result.push(asset)
    }
  }

  const imageCount = result.filter((a) => a.type === 'image' && a.data && a.data.length > 0).length
  const errorCount = result.filter((a) => a.type === 'image' && (!a.data || a.data.length === 0)).length
  logInfo(`===== 导出完成: ${imageCount} 图片, ${errorCount} 失败 =====`)

  return result
}

// ============ 初始化流程 ============

// 等待 UI 就绪的 Promise
let uiReadyResolve: () => void
const uiReady = new Promise<void>((resolve) => {
  uiReadyResolve = resolve
})

// 监听 UI 消息
figma.ui.onmessage = async (msg) => {
  try {
    // UI 就绪信号
    if (msg.type === 'ui-ready') {
      logInfo('UI 就绪，开始扫描')
      uiReadyResolve()
      return
    }

    if (msg.type === 'sync') {
      // 用户点击"同步"：在主线程导出图片节点，发往 UI 线程上传
      const apiBase = msg.apiBase || DEFAULT_API_BASE
      const apiToken = typeof msg.apiToken === 'string' ? msg.apiToken.trim() : ''
      const assets: AssetItem[] = msg.assets

      logInfo(`===== 收到同步请求: ${assets.length} 个资源, API: ${apiBase} =====`)
      logDebug(`令牌: ${apiToken ? '已配置（长度 ' + apiToken.length + '）' : '未配置'}`)

      figma.ui.postMessage({ type: 'sync-start', total: assets.length })

      try {
        // 导出所有图片节点，附加二进制数据
        const exportData = await prepareAssetsForUpload(assets)

        // 发往 UI 线程，由 UI 完成上传（UI 浏览器环境支持 FormData）
        figma.ui.postMessage({
          type: 'sync-data',
          apiBase,
          apiToken,
          assets: exportData,
        })
      } catch (err) {
        logError('prepareAssetsForUpload 失败:', err)
        figma.ui.postMessage({
          type: 'sync-error',
          error: String(err),
        })
      }
      return
    }

    if (msg.type === 'sync-done') {
      // UI 线程上传完成，将结果转发到 UI 显示（同时保留主线程日志）
      logInfo(`===== 同步完成: ${msg.summary.uploaded} 成功, ${msg.summary.errors} 失败 =====`)
      msg.summary.errorDetails?.forEach((e: any) => logError(`  失败 ${e.fileName}: ${e.error}`))

      figma.ui.postMessage({
        type: 'sync-complete',
        results: msg.results,
        summary: msg.summary,
      })
      return
    }

    if (msg.type === 'cancel') {
      logInfo('用户取消同步')
      figma.closePlugin()
      return
    }
  } catch (err) {
    logError('消息处理异常:', err)
    try {
      figma.ui.postMessage({
        type: 'sync-error',
        error: `消息处理异常: ${String(err)}`,
      })
    } catch (_) {
      // 忽略发送错误
    }
  }
}

// 显示 UI（使用 themeColors 支持明暗主题）
figma.showUI(__html__, {
  width: 600,
  height: 500,
  themeColors: true,
})

// 等待 UI 就绪后启动扫描
uiReady.then(() => {
  main().catch((err) => {
    logError('主扫描流程异常:', err)
    try {
      figma.ui.postMessage({
        type: 'scan-error',
        error: String(err),
      })
    } catch (postErr) {
      logError('无法向 UI 发送错误消息:', postErr)
    }
  })
})