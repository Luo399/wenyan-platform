/**
 * Figma 资源同步服务
 *
 * 功能：
 * 1. 通过 Figma REST API 获取指定文件节点树
 * 2. 解析「Export Assets」Frame 下子节点的命名规则（OSS 路径）
 * 3. 批量导出图片资源下载链接
 * 4. 流式上传到阿里云 OSS
 *
 * 使用方式：
 *   const figmaService = require('./figmaService')
 *   const result = await figmaService.syncFromFigma('fileKey', 'nodeId')
 *
 * 环境变量：
 *   FIGMA_ACCESS_TOKEN  - Figma Personal Access Token（必填）
 *   ALIYUN_OSS_REGION   - OSS 地域（如 oss-cn-guangzhou）
 *   ALIYUN_OSS_BUCKET   - OSS Bucket 名称
 *   ALIYUN_ACCESS_KEY_ID     - OSS Access Key ID
 *   ALIYUN_ACCESS_KEY_SECRET - OSS Access Key Secret
 */

const logger = require('../utils/logger')

const FIGMA_API_BASE = 'https://api.figma.com/v1'

/**
 * Figma REST API 请求（带认证头）
 */
async function figmaFetch(path, options = {}) {
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) {
    throw new Error('FIGMA_ACCESS_TOKEN 未配置')
  }
  const url = `${FIGMA_API_BASE}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Figma-Token': token,
      ...options.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Figma API ${response.status}: ${text}`)
  }
  return response.json()
}

/**
 * 获取 Figma 文件节点树
 * @param {string} fileKey - Figma 文件 key
 * @param {number} [depth=3] - 遍历深度
 */
async function getFileNodes(fileKey, depth = 3) {
  return figmaFetch(`/files/${fileKey}?depth=${depth}`)
}

/**
 * 获取指定节点的图片导出链接
 * @param {string} fileKey - Figma 文件 key
 * @param {string[]} nodeIds - 节点 ID 数组
 * @param {string} [format='png'] - 导出格式（png/svg/jpg）
 * @param {number} [scale=2] - 导出倍率
 */
async function getImageUrls(fileKey, nodeIds, format = 'png', scale = 2) {
  const ids = nodeIds.join(',')
  const data = await figmaFetch(
    `/images/${fileKey}?ids=${ids}&format=${format}&scale=${scale}`,
  )
  return data.images || {}
}

/**
 * 解析节点树，提取「Export Assets」Frame 下的资源映射
 *
 * 节点命名约定：
 *   - 子 Frame 名称 = OSS 路径（如 images/general/）
 *   - 图层名称 = 文件名（如 home_bg.png）
 *
 * @param {object} document - Figma 文档根节点
 * @returns {Array<{ ossPath: string, nodeId: string, fileName: string }>}
 */
function parseExportAssets(document) {
  const assets = []

  /**
   * 递归遍历节点，收集资源信息
   */
  function traverse(node, parentPath = '') {
    if (!node || !node.id) return

    // 跳过非可见节点
    if (node.visible === false) return

    // 顶层 Canvas 的子节点
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child.name === 'Export Assets') {
          // 进入 Export Assets 容器
          traverseExportAssets(child, '')
          return
        }
        // 继续在其他 Canvas 中查找
        traverse(child, parentPath)
      }
    }
  }

  /**
   * 遍历 Export Assets 下的子 Frame
   * 子 Frame 名称 = OSS 路径，图层名称 = 文件名
   */
  function traverseExportAssets(node, currentPath) {
    if (!node.children) return

    for (const child of node.children) {
      // 子 Frame 名称作为路径段
      const childPath = currentPath ? `${currentPath}${child.name}/` : `${child.name}/`

      if (child.children && child.children.length > 0) {
        // 有子节点：继续深入
        // 判断是否为叶子节点（包含图片/资源图层）
        const hasLeafNodes = child.children.some((c) => {
          const type = c.type || ''
          return (
            type === 'RECTANGLE' ||
            type === 'ELLIPSE' ||
            type === 'VECTOR' ||
            type === 'FRAME' ||
            type === 'INSTANCE' ||
            type === 'COMPONENT'
          )
        })

        if (hasLeafNodes && child.children.length > 0) {
          // 收集当前 Frame 下的所有资源图层
          for (const leaf of child.children) {
            const leafType = leaf.type || ''
            // 资源图层：矩形/椭圆/矢量/实例等
            if (
              leafType === 'RECTANGLE' ||
              leafType === 'ELLIPSE' ||
              leafType === 'VECTOR' ||
              leafType === 'IMAGE' ||
              leafType === 'INSTANCE'
            ) {
              // 文件名必须包含扩展名
              const fileName = leaf.name
              if (/\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|ogg|mp3|wav)$/i.test(fileName)) {
                assets.push({
                  ossPath: childPath.replace(/\/$/, ''),
                  nodeId: leaf.id,
                  fileName,
                  // 保留原始路径用于后续多级递归
                  fullPath: childPath,
                })
              }
            }
          }
        }

        // 递归子节点
        traverseExportAssets(child, childPath)
      }
    }
  }

  traverse(document)

  return assets
}

/**
 * 主入口：从 Figma 同步资源到 OSS
 *
 * @param {string} fileKey - Figma 文件 key
 * @param {object} [options]
 * @param {number} [options.depth=3] - 遍历深度
 * @param {string} [options.format='png'] - 导出格式
 * @param {number} [options.scale=2] - 导出倍率
 * @returns {Promise<{ success: boolean, assets: Array, errors: Array }>}
 */
async function syncFromFigma(fileKey, options = {}) {
  const { depth = 3, format = 'png', scale = 2 } = options
  const errors = []
  const assets = []

  try {
    // 1. 获取文件节点树
    logger.info(`[FigmaService] 获取文件节点树: ${fileKey}`)
    const fileData = await getFileNodes(fileKey, depth)
    const document = fileData.document

    if (!document) {
      throw new Error('无法获取文档根节点')
    }

    // 2. 解析 Export Assets 下的资源
    const exportAssets = parseExportAssets(document)
    logger.info(`[FigmaService] 解析到 ${exportAssets.length} 个资源`)

    if (exportAssets.length === 0) {
      return {
        success: true,
        assets: [],
        errors: [],
        message: '未找到 Export Assets 容器下的资源',
      }
    }

    // 3. 获取图片下载链接（按格式分组）
    const imageNodeIds = exportAssets
      .filter((a) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.fileName))
      .map((a) => a.nodeId)

    if (imageNodeIds.length > 0) {
      const imageUrls = await getImageUrls(fileKey, imageNodeIds, format, scale)

      // 4. 如果有 OSS 配置，上传到 OSS
      const hasOssConfig =
        process.env.ALIYUN_OSS_BUCKET &&
        process.env.ALIYUN_ACCESS_KEY_ID &&
        process.env.ALIYUN_ACCESS_KEY_SECRET

      if (hasOssConfig) {
        // 动态导入 ali-oss
        let OSS
        try {
          OSS = require('ali-oss')
        } catch (e) {
          throw new Error('请安装 ali-oss 依赖: npm install ali-oss')
        }

        const store = new OSS({
          region: process.env.ALIYUN_OSS_REGION || 'oss-cn-guangzhou',
          bucket: process.env.ALIYUN_OSS_BUCKET,
          accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
          accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
          secure: true,
        })

        // 逐资源上传
        for (const asset of exportAssets) {
          const downloadUrl = imageUrls[asset.nodeId]
          if (!downloadUrl) {
            errors.push({
              nodeId: asset.nodeId,
              fileName: asset.fileName,
              error: '无下载链接',
            })
            continue
          }

          try {
            // 下载图片
            const response = await fetch(downloadUrl)
            if (!response.ok) {
              errors.push({
                nodeId: asset.nodeId,
                fileName: asset.fileName,
                error: `下载失败: ${response.status}`,
              })
              continue
            }

            // 流式上传到 OSS
            const ossPath = `${asset.ossPath}/${asset.fileName}`
            const buffer = Buffer.from(await response.arrayBuffer())
            await store.put(ossPath, buffer, {
              headers: {
                'x-oss-object-acl': 'public-read',
              },
            })

            assets.push({
              ossPath,
              fileName: asset.fileName,
              size: buffer.length,
            })

            logger.info(`[FigmaService] 已上传: ${ossPath} (${buffer.length} bytes)`)
          } catch (uploadErr) {
            errors.push({
              nodeId: asset.nodeId,
              fileName: asset.fileName,
              error: uploadErr.message,
            })
            logger.error(`[FigmaService] 上传失败: ${asset.fileName}`, uploadErr)
          }
        }
      } else {
        // 无 OSS 配置时，仅返回下载链接
        for (const asset of exportAssets) {
          const downloadUrl = imageUrls[asset.nodeId]
          assets.push({
            ossPath: `${asset.ossPath}/${asset.fileName}`,
            fileName: asset.fileName,
            downloadUrl: downloadUrl || null,
            nodeId: asset.nodeId,
          })
        }
        logger.info('[FigmaService] 未配置 OSS，仅返回下载链接')
      }
    }

    return {
      success: true,
      assets,
      errors,
      total: exportAssets.length,
      uploaded: assets.length,
      failed: errors.length,
    }
  } catch (err) {
    logger.error('[FigmaService] 同步失败:', err)
    throw err
  }
}

module.exports = {
  syncFromFigma,
  getFileNodes,
  getImageUrls,
  parseExportAssets,
}