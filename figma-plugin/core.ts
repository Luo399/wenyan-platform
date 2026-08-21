/**
 * 文言文资源同步插件 - 核心逻辑（可单测的纯函数模块）
 *
 * 职责：只包含不依赖 Figma 全局对象（figma / __html__）的纯逻辑：
 *   - 资源扫描（Export Assets → 图片；文字资源_* → JSON）
 *   - OSS 路径解析
 *   - 超时包装器
 *   - 资源验证
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

// 合法文本字段名（防止特殊字符）
const TEXT_FIELD_NAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/

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
  // 验证信息
  validation?: {
    isValid: boolean
    warnings: string[]
    errors: string[]
  }
}

// 资源验证结果
export interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  totalAssets: number
  validAssets: number
  invalidAssets: number
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
  const totalChildren = frame.children?.length || 0
  logDebug(`scanTextFrame: Frame "${frame.name}" 共 ${totalChildren} 个子节点`)

  if (!frame.children) {
    logWarn(`文字资源 Frame "${frame.name}" 没有子节点`)
    return assets
  }

  // 收集所有文本数据
  const jsonData: Record<string, any> = {}

  for (let i = 0; i < frame.children.length; i++) {
    const child = frame.children[i]

    if (child.type === 'TEXT') {
      // 直接 TEXT 节点：节点名 = 字段名，内容 = 文本内容
      const fieldName = child.name
      const textContent = child.characters

      if (!fieldName || fieldName.trim() === '') {
        logDebug(`    [跳过] TEXT 节点未命名`)
        continue
      }

      if (!textContent || textContent.trim() === '') {
        logDebug(`    [跳过] TEXT 节点 "${fieldName}" 内容为空`)
        continue
      }

      // 验证字段名
      if (!TEXT_FIELD_NAME_RE.test(fieldName)) {
        logWarn(`    [警告] TEXT 节点字段名包含特殊字符: "${fieldName}"`)
      }

      jsonData[fieldName] = textContent
      logDebug(`    [字段] "${fieldName}" = "${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}"`)
    } else if (child.type === 'FRAME') {
      // 子 Frame：遍历其下的 TEXT 节点作为嵌套字段
      const subData: Record<string, string> = {}
      const subChildrenCount = child.children?.length || 0

      for (const subChild of child.children || []) {
        if (subChild.type === 'TEXT') {
          const subFieldName = subChild.name
          const subTextContent = subChild.characters

          if (!subFieldName || subFieldName.trim() === '') {
            logDebug(`      [跳过] 子 TEXT 节点未命名`)
            continue
          }

          if (!subTextContent || subTextContent.trim() === '') {
            logDebug(`      [跳过] 子 TEXT 节点 "${subFieldName}" 内容为空`)
            continue
          }

          subData[subFieldName] = subTextContent
          logDebug(`      [子字段] "${subFieldName}" = "${subTextContent.substring(0, 50)}${subTextContent.length > 50 ? '...' : ''}"`)
        } else {
          logDebug(`      [跳过] 非 TEXT 子节点: "${subChild.name}" (${subChild.type})`)
        }
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

/**
 * 验证单个资源项
 * @param asset 资源项
 * @returns 验证结果
 */
export function validateAsset(asset: AssetItem): AssetItem['validation'] {
  const validation = {
    isValid: true,
    warnings: [] as string[],
    errors: [] as string[],
  }

  // 验证 OSS 路径
  if (!asset.ossPath || asset.ossPath.trim() === '') {
    validation.isValid = false
    validation.errors.push('OSS 路径不能为空')
  }

  // 验证文件名
  if (!asset.fileName || asset.fileName.trim() === '') {
    validation.isValid = false
    validation.errors.push('文件名不能为空')
  }

  // 图片资源验证
  if (asset.type === ASSET_TYPE.IMAGE) {
    // 检查文件名格式
    if (!IMAGE_EXT_RE.test(asset.fileName)) {
      validation.isValid = false
      validation.errors.push(`图片文件名必须包含扩展名 (png, jpg, jpeg, gif, webp, svg): ${asset.fileName}`)
    }

    // 检查文件名长度
    if (asset.fileName.length > 255) {
      validation.warnings.push('文件名过长，可能影响兼容性')
    }

    // 检查路径中是否包含特殊字符
    if (/[<>:"|?*]/.test(asset.ossPath)) {
      validation.isValid = false
      validation.errors.push('OSS 路径包含非法字符: < > : " | ? *')
    }
  }

  // 文本资源验证
  if (asset.type === ASSET_TYPE.TEXT) {
    // 检查 JSON 内容
    if (!asset.content) {
      validation.isValid = false
      validation.errors.push('文本资源内容不能为空')
    } else {
      try {
        JSON.parse(asset.content)
      } catch (e) {
        validation.isValid = false
        validation.errors.push(`JSON 格式错误: ${e.message}`)
      }
    }

    // 检查文件大小（JSON 应该小于 1MB）
    if (asset.content && asset.content.length > 1024 * 1024) {
      validation.warnings.push('JSON 文件过大，建议拆分')
    }
  }

  return validation
}

/**
 * 批量验证资源
 * @param assets 资源数组
 * @returns 验证结果汇总
 */
export function validateAssets(assets: AssetItem[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    totalAssets: assets.length,
    validAssets: 0,
    invalidAssets: 0,
  }

  const assetValidations = assets.map(asset => ({
    asset,
    validation: validateAsset(asset)
  }))

  assetValidations.forEach(({ asset, validation }) => {
    if (validation.isValid) {
      result.validAssets++
    } else {
      result.isValid = false
      result.invalidAssets++
      result.errors.push(`${asset.ossPath}: ${validation.errors.join(', ')}`)
    }

    result.warnings.push(...validation.warnings.map(w => `${asset.ossPath}: ${w}`))
  })

  // 添加汇总信息
  if (result.totalAssets === 0) {
    result.isValid = false
    result.errors.push('未找到任何有效资源')
  }

  return result
}

/**
 * 生成资源统计信息
 * @param assets 资源数组
 * @returns 统计信息
 */
export function generateAssetStats(assets: AssetItem[]): {
  total: number
  byType: Record<string, number>
  byExtension: Record<string, number>
  largestFiles: Array<{ name: string; size: number }>
} {
  const byType: Record<string, number> = {}
  const byExtension: Record<string, number> = {}
  const fileSizes: Array<{ name: string; size: number }> = []

  assets.forEach(asset => {
    // 按类型统计
    byType[asset.type] = (byType[asset.type] || 0) + 1

    // 按扩展名统计
    const ext = asset.fileName.split('.').pop()?.toLowerCase() || 'unknown'
    byExtension[ext] = (byExtension[ext] || 0) + 1

    // 估算文件大小（文本资源按内容长度，图片资源按固定大小）
    let size = 0
    if (asset.type === ASSET_TYPE.TEXT && asset.content) {
      size = asset.content.length
    } else if (asset.type === ASSET_TYPE.IMAGE) {
      // 假设图片平均 100KB
      size = 100 * 1024
    }
    fileSizes.push({ name: asset.fileName, size })
  })

  // 排序获取最大的文件
  fileSizes.sort((a, b) => b.size - a.size)
  const largestFiles = fileSizes.slice(0, 5)

  return {
    total: assets.length,
    byType,
    byExtension,
    largestFiles,
  }
}