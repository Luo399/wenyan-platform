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
 * 子 Frame 名称 = OSS 路径，图层名称 = 文件名
 *
 * 过滤规则：
 *   - 只处理 FRAME 子节点（作为 OSS 目录）
 *   - 隐藏图层跳过
 *   - 只处理可导出的图层类型（RECTANGLE/ELLIPSE/VECTOR/IMAGE/INSTANCE/COMPONENT/FRAME/GROUP）
 *   - 图层名必须包含合法图片扩展名
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
 *
 * 新命名（推荐）：Frame 名 = 相对路径，如 文字资源_culture_cards_WEN_01
 *   → data/culture_cards/WEN_01.json
 * 旧命名（兼容）：文字资源_论语·学而篇
 *   → data/texts/文字资源_论语·学而篇.json
 */
export function resolveTextOssPath(frameName: string): string {
  const rest = frameName.replace(/^文字资源_/, '').replace(/\/+$/, '')
  if (rest.includes('/')) {
    // 新命名：去掉前缀后的剩余部分即相对目录，拼接为 data/{相对路径}.json
    return `data/${rest}.json`
  }
  // 旧命名兼容：保持 data/texts/ 目录结构
  return `data/texts/${frameName}.json`
}

/**
 * 扫描文字资源 Frame 下的文本节点
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