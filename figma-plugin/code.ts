/**
 * 文言文预习平台 - Figma 资源同步插件
 *
 * 功能：
 * 1. 扫描当前页中名为 "Export Assets" 的 Frame
 * 2. 扫描 "文字资源_" 开头的 Frame
 * 3. 按子 Frame 命名解析 OSS 路径，导出 PNG/SVG
 * 4. 读取文字资源 TextNode.characters 生成 JSON
 * 5. 显示变更列表，发送到后端 API
 *
 * 使用方式：
 *   在 Figma 中运行插件 → 自动扫描 → 显示变更列表 → 确认同步
 */

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
  // 变更状态
  status: 'new' | 'changed' | 'unchanged'
}

// 导出结果
interface ExportResult {
  ossPath: string
  fileName: string
  type: string
  size: number
  status: 'uploaded' | 'skipped' | 'error'
  error?: string
}

/**
 * 主入口
 */
async function main() {
  // 获取当前页面
  const page = figma.currentPage
  const allAssets: AssetItem[] = []

  // 1. 扫描 Export Assets Frame
  const exportAssetsFrame = page.findOne(
    (node) => node.type === 'FRAME' && node.name === 'Export Assets',
  ) as FrameNode | null

  if (exportAssetsFrame) {
    const assets = scanExportAssetsFrame(exportAssetsFrame)
    allAssets.push(...assets)
  }

  // 2. 扫描 文字资源_ Frame
  const textFrames = page.findAll(
    (node) => node.type === 'FRAME' && node.name.startsWith('文字资源_'),
  ) as FrameNode[]

  for (const frame of textFrames) {
    const textAssets = scanTextFrame(frame)
    allAssets.push(...textAssets)
  }

  // 3. 如果没有找到任何资源，提示用户
  if (allAssets.length === 0) {
    figma.ui.onmessage = () => {
      figma.closePlugin()
    }
    figma.ui.postMessage({
      type: 'no-assets',
      message: '未找到 Export Assets 或 文字资源_ Frame\n请在当前页面中创建并命名相应的 Frame。',
    })
    return
  }

  // 4. 发送到 UI 显示变更列表
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

  if (!frame.children) return assets

  for (const child of frame.children) {
    if (child.type !== 'FRAME') continue

    // 子 Frame 名称作为 OSS 路径
    const ossPath = child.name.replace(/\/$/, '')

    if (!child.children) continue

    for (const leaf of child.children) {
      // 跳过非可视节点
      if (leaf.visible === false) continue

      // 只处理可导出的图层类型
      const exportableTypes = [
        'RECTANGLE', 'ELLIPSE', 'VECTOR', 'IMAGE',
        'INSTANCE', 'COMPONENT', 'FRAME', 'GROUP',
      ]
      if (!exportableTypes.includes(leaf.type)) continue

      // 文件名 = 图层名（必须包含扩展名）
      const fileName = leaf.name
      if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) continue

      assets.push({
        ossPath: `${ossPath}/${fileName}`,
        fileName,
        type: ASSET_TYPE.IMAGE,
        nodeId: leaf.id,
        status: 'new',
      })
    }
  }

  return assets
}

/**
 * 扫描文字资源 Frame 下的文本节点
 * Frame 命名格式：文字资源_{wenId}_{resourceName}
 * 子节点命名格式：{field_name}（如 knowledge_text, card_name）
 */
function scanTextFrame(frame: FrameNode): AssetItem[] {
  const assets: AssetItem[] = []

  // 解析 Frame 名称：文字资源_WEN_01_culture_cards
  const nameParts = frame.name.replace('文字资源_', '').split('_')
  const wenId = nameParts[0] || ''
  const resourceName = nameParts.slice(1).join('_') || 'culture_cards'

  // 构建 JSON 对象
  const jsonData: Record<string, any> = {}

  if (!frame.children) return assets

  for (const child of frame.children) {
    if (child.type === 'TEXT') {
      // 直接读取 TextNode.characters
      const textNode = child as TextNode
      const fieldName = child.name
      jsonData[fieldName] = textNode.characters
    } else if (child.type === 'FRAME') {
      // 子 Frame 中的文本节点
      const subFrame = child as FrameNode
      const subData: Record<string, any> = {}

      if (subFrame.children) {
        for (const subChild of subFrame.children) {
          if (subChild.type === 'TEXT') {
            const subText = subChild as TextNode
            subData[subChild.name] = subText.characters
          }
        }
      }

      if (Object.keys(subData).length > 0) {
        jsonData[child.name] = subData
      }
    }
  }

  if (Object.keys(jsonData).length > 0) {
    // 添加 text_id
    jsonData.text_id = wenId

    // 生成 JSON 文件
    const jsonContent = JSON.stringify(jsonData, null, 2)
    const ossPath = `data/${resourceName}/${wenId}.json`

    assets.push({
      ossPath,
      fileName: `${wenId}.json`,
      type: ASSET_TYPE.TEXT,
      nodeId: frame.id,
      content: jsonContent,
      status: 'new',
    })
  }

  return assets
}

/**
 * 导出图片资源
 */
async function exportImageAsset(node: SceneNode, ossPath: string): Promise<ExportResult> {
  try {
    // 判断导出格式
    const isSvg = ossPath.toLowerCase().endsWith('.svg')
    const format = isSvg ? 'SVG' : 'PNG'

    const exportOptions: ExportSettings = isSvg
      ? { format: 'SVG' }
      : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } }

    const data = await node.exportAsync(exportOptions)

    return {
      ossPath,
      fileName: ossPath.split('/').pop() || ossPath,
      type: ASSET_TYPE.IMAGE,
      size: data.byteLength,
      status: 'uploaded',
    }
  } catch (err) {
    return {
      ossPath,
      fileName: ossPath.split('/').pop() || ossPath,
      type: ASSET_TYPE.IMAGE,
      size: 0,
      status: 'error',
      error: String(err),
    }
  }
}

/**
 * 上传到后端
 */
async function uploadToBackend(apiBase: string, assets: AssetItem[]): Promise<ExportResult[]> {
  const results: ExportResult[] = []

  for (const asset of assets) {
    if (asset.type === ASSET_TYPE.TEXT) {
      // 文字资源：JSON 格式上传
      try {
        const response = await fetch(`${apiBase}/api/assets/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{
              ossPath: asset.ossPath,
              type: 'text',
              content: asset.content,
              encoding: 'utf-8',
            }],
          }),
        })

        const result = await response.json()
        if (result.success) {
          results.push({
            ossPath: asset.ossPath,
            fileName: asset.fileName,
            type: ASSET_TYPE.TEXT,
            size: new Blob([asset.content || '']).size,
            status: 'uploaded',
          })
        } else {
          results.push({
            ossPath: asset.ossPath,
            fileName: asset.fileName,
            type: ASSET_TYPE.TEXT,
            size: 0,
            status: 'error',
            error: result.message || '上传失败',
          })
        }
      } catch (err) {
        results.push({
          ossPath: asset.ossPath,
          fileName: asset.fileName,
          type: ASSET_TYPE.TEXT,
          size: 0,
          status: 'error',
          error: String(err),
        })
      }
    } else {
      // 图片资源：导出后再上传
      try {
        const node = figma.getNodeById(asset.nodeId) as SceneNode
        if (!node) {
          results.push({
            ossPath: asset.ossPath,
            fileName: asset.fileName,
            type: ASSET_TYPE.IMAGE,
            size: 0,
            status: 'error',
            error: '节点不存在',
          })
          continue
        }

        const exportResult = await exportImageAsset(node, asset.ossPath)
        if (exportResult.status === 'error') {
          results.push(exportResult)
          continue
        }

        // 上传到后端
        const formData = new FormData()
        const blob = new Blob([new Uint8Array(await (node.exportAsync(
          asset.ossPath.toLowerCase().endsWith('.svg')
            ? { format: 'SVG' }
            : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } },
        )))])

        formData.append('files', blob, asset.fileName)
        formData.append('ossPath', asset.ossPath)
        formData.append('type', ASSET_TYPE.IMAGE)

        const response = await fetch(`${apiBase}/api/assets/upload`, {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()
        if (result.success) {
          results.push({
            ...exportResult,
            status: 'uploaded',
          })
        } else {
          results.push({
            ...exportResult,
            status: 'error',
            error: result.message || '上传失败',
          })
        }
      } catch (err) {
        results.push({
          ossPath: asset.ossPath,
          fileName: asset.fileName,
          type: ASSET_TYPE.IMAGE,
          size: 0,
          status: 'error',
          error: String(err),
        })
      }
    }
  }

  return results
}

// 监听 UI 消息
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'sync') {
    const apiBase = msg.apiBase || DEFAULT_API_BASE
    const assets: AssetItem[] = msg.assets

    figma.ui.postMessage({ type: 'sync-start', total: assets.length })

    try {
      const results = await uploadToBackend(apiBase, assets)

      const uploaded = results.filter((r) => r.status === 'uploaded').length
      const skipped = results.filter((r) => r.status === 'skipped').length
      const errors = results.filter((r) => r.status === 'error')

      figma.ui.postMessage({
        type: 'sync-complete',
        results,
        summary: {
          total: assets.length,
          uploaded,
          skipped,
          errors: errors.length,
          errorDetails: errors,
        },
      })
    } catch (err) {
      figma.ui.postMessage({
        type: 'sync-error',
        error: String(err),
      })
    }
  }

  if (msg.type === 'cancel') {
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