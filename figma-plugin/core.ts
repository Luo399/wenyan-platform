/**
 * 文言文资源同步插件 - 核心逻辑（可单测的纯函数模块）
 *
 * 职责：只包含不依赖 Figma 全局对象（figma / __html__）的纯逻辑：
 *   - 资源扫描（Export Assets → 图片；文字资源_* → JSON）
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