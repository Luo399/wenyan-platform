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
 * 4. 显示变更列表，发送到后端 API
 *
 * 使用方式：
 *   在 Figma 中打开任意课文文件/通用文件 → 运行插件 → 自动扫描 → 确认同步
 *
 * OSS 路径规则：
 *   - 图片：Export Assets → 子 Frame 名即为 OSS 路径（如 images/culture_cards/WEN_01/card_bg.png）
 *   - 文字：文字资源_xxx Frame → data/texts/文字资源_xxx.json
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

// 资源类型枚举
const ASSET_TYPE = {
  IMAGE: 'image',
  TEXT: 'text',
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
  // 变更状态
  status: 'new' | 'changed' | 'unchanged'
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

  // 3. 如果没有找到任何资源，提示用户
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

  // 4. 汇总日志
  const imageCount = allAssets.filter((a) => a.type === 'image').length
  const textCount = allAssets.filter((a) => a.type === 'text').length
  logInfo(`===== 扫描完成: 共 ${allAssets.length} 个资源（${imageCount} 图片 + ${textCount} 文字） =====`)
  allAssets.forEach((a) => logDebug(`  ${a.type === 'image' ? '🖼' : '📝'} ${a.ossPath}`))

  // 5. 发送到 UI 显示变更列表
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
      try {
        logDebug(`  → 导出图片节点 ID: ${asset.nodeId}`)
        const node = await figma.getNodeByIdAsync(asset.nodeId) as SceneNode | null
        if (!node) {
          logError(`  ❌ 节点不存在: "${asset.ossPath}"`)
          result.push({ ...asset, data: new Uint8Array(0) })
          continue
        }

        const isSvg = asset.ossPath.toLowerCase().endsWith('.svg')
        const exportOptions: ExportSettings = isSvg
          ? { format: 'SVG' }
          : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } }
        const rawData = await node.exportAsync(exportOptions)
        logInfo(`  ✅ 导出成功: "${asset.fileName}" (${rawData.byteLength} bytes, ${isSvg ? 'SVG' : 'PNG'})`)

        result.push({ ...asset, data: new Uint8Array(rawData) })
      } catch (err) {
        logError(`  ❌ 导出失败: "${asset.ossPath}"`, err)
        result.push({ ...asset, data: new Uint8Array(0) })
      }
    } else {
      // 文字资源：直接传递文本内容
      logDebug(`  → 文字资源, JSON 长度: ${asset.content?.length || 0} 字符`)
      result.push(asset)
    }
  }

  const imageCount = result.filter((a) => a.type === 'image' && a.data && a.data.length > 0).length
  const errorCount = result.filter((a) => a.type === 'image' && (!a.data || a.data.length === 0)).length
  logInfo(`===== 导出完成: ${imageCount} 图片成功, ${errorCount} 图片失败 =====`)

  return result
}

// 监听 UI 消息
figma.ui.onmessage = async (msg) => {
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
  }

  if (msg.type === 'sync-done') {
    // UI 线程上传完成，将结果转发到 UI 显示（同时保留主线程日志）
    logInfo(`===== 同步完成: ${msg.summary.uploaded} 成功, ${msg.summary.errors} 失败 =====`)
    msg.summary.errorDetails?.forEach((e: any) => logError(`  ❌ ${e.fileName}: ${e.error}`))

    figma.ui.postMessage({
      type: 'sync-complete',
      results: msg.results,
      summary: msg.summary,
    })
  }

  if (msg.type === 'cancel') {
    logInfo('用户取消同步')
    figma.closePlugin()
  }
}

// 显示 UI
figma.showUI(__html__, { width: 600, height: 500 })

// 启动扫描
main().catch((err) => {
  figma.ui.postMessage({
    type: 'scan-error',
    error: String(err),
  })
})