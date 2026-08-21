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
 * 5. 资源验证和错误提示
 *
 * 逻辑分层：
 *   - 纯逻辑（扫描 / 路径解析 / 超时 / 验证）位于 ./core.ts，可单测
 *   - 本文件仅负责 Figma API 调用与主/UI 线程通信（esbuild 打包进 code.js）
 */

// 核心纯逻辑（扫描、路径解析、超时、验证）——与单元测试共享同一实现
import { ASSET_TYPE, EXPORT_TIMEOUT_MS, withTimeout, scanExportAssetsFrame, scanTextFrame, validateAssets, generateAssetStats } from './core'
import type { AssetItem } from './core'

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

  // 4. 资源验证
  logInfo('===== 开始资源验证 =====')
  const validationResult = validateAssets(allAssets)
  
  // 生成统计信息
  const stats = generateAssetStats(allAssets)
  
  // 记录验证结果
  logInfo(`资源验证完成: ${validationResult.validAssets}/${validationResult.totalAssets} 有效`)
  if (validationResult.warnings.length > 0) {
    logWarn('警告信息:', validationResult.warnings)
  }
  if (validationResult.errors.length > 0) {
    logError('错误信息:', validationResult.errors)
  }

  // 5. 汇总日志
  const imageCount = allAssets.filter((a) => a.type === 'image').length
  const textCount = allAssets.filter((a) => a.type === 'text').length
  logInfo(`===== 扫描完成: 共 ${allAssets.length} 个资源（${imageCount} 图片 + ${textCount} 文字） =====`)
  
  // 6. 发送到 UI 显示变更列表（包含验证结果）
  figma.ui.postMessage({
    type: 'scan-result',
    assets: allAssets,
    total: allAssets.length,
    validation: validationResult,
    stats: stats,
  })
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
 * 批量导出图片资源
 * 返回成功导出的 nodeId -> Uint8Array 映射
 */
async function exportImages(assets: AssetItem[]): Promise<Record<string, Uint8Array>> {
  const results: Record<string, Uint8Array> = {}

  // 只导出图片资源
  const imageAssets = assets.filter((a) => a.type === 'image')
  logInfo(`开始批量导出 ${imageAssets.length} 个图片资源`)

  // 逐个导出（避免同时导出太多导致性能问题）
  for (let i = 0; i < imageAssets.length; i++) {
    const asset = imageAssets[i]
    logDebug(`[${i + 1}/${imageAssets.length}] 导出: ${asset.ossPath}`)

    const rawData = await exportSingleNode(asset.nodeId, asset.ossPath)
    if (rawData.length > 0) {
      results[asset.nodeId] = rawData
    }
  }

  logInfo(`图片导出完成: 成功 ${Object.keys(results).length}/${imageAssets.length}`)
  return results
}

/**
 * 处理 UI 消息
 */
figma.ui.onmessage(async (msg) => {
  switch (msg.type) {
    case 'start-sync':
      try {
        logInfo('用户确认开始同步')
        
        // 重新扫描（确保获取最新状态）
        main()
        
        // 等待扫描完成后，开始导出
        figma.ui.onmessage = async (syncMsg) => {
          if (syncMsg.type === 'scan-result-ready') {
            const { assets } = syncMsg
            
            // 1. 导出图片
            logInfo('开始导出图片...')
            const imageResults = await exportImages(assets)
            
            // 2. 准备上传数据
            const uploadData = {
              apiBase: msg.apiBase || DEFAULT_API_BASE,
              assets: assets.map((asset) => ({
                ...asset,
                // 图片资源添加导出数据
                ...(asset.type === 'image' && { imageData: imageResults[asset.nodeId] }),
              })),
              timestamp: new Date().toISOString(),
            }
            
            // 3. 发送到后端
            logInfo('开始上传到后端...')
            const response = await fetch(`${uploadData.apiBase}/api/figma/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fileKey: figma.fileKey,
                assets: uploadData.assets,
                timestamp: uploadData.timestamp,
              }),
            })
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }
            
            const result = await response.json()
            logInfo('同步完成:', result)
            
            // 通知用户结果
            figma.ui.postMessage({
              type: 'sync-complete',
              success: true,
              data: result,
            })
          }
        }
      } catch (err) {
        logError('同步失败:', err)
        figma.ui.postMessage({
          type: 'sync-complete',
          success: false,
          error: err.message,
        })
      }
      break

    case 'cancel':
      logInfo('用户取消操作')
      figma.closePlugin()
      break

    case 'show-help':
      logInfo('显示帮助信息')
      figma.ui.postMessage({
        type: 'help',
        message: `
使用说明：
1. 确保 Figma 文件中有 Export Assets 或 文字资源_ Frame
2. 点击"开始扫描"查看资源列表
3. 确认无误后点击"开始同步"
4. 等待同步完成

常见问题：
- 未找到资源：检查 Frame 命名是否正确
- 导出失败：检查节点是否被锁定或隐藏
- 上传失败：检查网络连接和 API 配置
        `,
      })
      break
  }
})

// 启动插件
main().catch((err) => {
  logError('插件启动失败:', err)
  figma.ui.postMessage({
    type: 'error',
    message: `插件启动失败: ${err.message}`,
  })
})