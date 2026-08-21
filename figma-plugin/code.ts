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
 * 逻辑分层：
 *   - 纯逻辑（扫描 / 路径解析 / 超时）位于 ./core.ts，可单测
 *   - 本文件仅负责 Figma API 调用与主/UI 线程通信（esbuild 打包进 code.js）
 */

// 核心纯逻辑（扫描、路径解析、超时）——与单元测试共享同一实现
import { ASSET_TYPE, EXPORT_TIMEOUT_MS, withTimeout, scanExportAssetsFrame, scanTextFrame } from './core'
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
  // 固定命名：顶层 Frame "Export Assets" 为图片资源容器。
  // Fixed NAME: the top-level Frame "Export Assets" is the image container.
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
  // 前缀固定: "文字资源_" 的顶层 Frame 为文字资源容器（导出为 JSON）。
  // Fixed PREFIX: top-level Frames starting with "文字资源_" are text containers (exported as JSON).
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
  allAssets.forEach((a) => logDebug(`  ${a.type === 'image' ? '图片' : '文字'} ${a.ossPath}`))

  // 5. 发送到 UI 显示变更列表
  figma.ui.postMessage({
    type: 'scan-result',
    assets: allAssets,
    total: allAssets.length,
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
      result.push({ ...asset, data } as AssetItem)
    } else {
      // 文字资源：直接传递文本内容
      logDebug(`  → 文字资源, JSON 长度: ${asset.content?.length || 0} 字符`)
      result.push(asset)
    }
  }

  const imageCount = result.filter((a) => a.type === 'image' && (a as any).data && (a as any).data.length > 0).length
  const errorCount = result.filter((a) => a.type === 'image' && (!(a as any).data || (a as any).data.length === 0)).length
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
    msg.summary.errorDetails?.forEach((e: any) => logError(`  失败 ${e.fileName}: ${e.error}`))

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

// 显示 UI（使用 themeColors 支持明暗主题）
figma.showUI(__html__, {
  width: 600,
  height: 500,
  themeColors: true,
})

// 启动扫描
main().catch((err) => {
  logError('主扫描流程异常:', err)
  // 确保错误信息能传递给 UI
  try {
    figma.ui.postMessage({
      type: 'scan-error',
      error: String(err),
    })
  } catch (postErr) {
    // UI 可能尚未初始化，错误已通过 console.error 记录
    logError('无法向 UI 发送错误消息:', postErr)
  }
})