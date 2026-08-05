/**
 * Figma 资源同步控制器
 *
 * 提供触发 Figma → OSS 同步的 API 端点
 * 需要 Figma Access Token 和 OSS 凭据
 */

const figmaService = require('../services/figmaService')
const logger = require('../utils/logger')

/**
 * POST /api/figma/sync
 * 触发 Figma 资源同步到 OSS
 *
 * Body:
 *   fileKey: Figma 文件 key（必填）
 *   depth: 遍历深度（默认 3）
 *   format: 导出格式（默认 png）
 *   scale: 导出倍率（默认 2）
 *
 * 响应：
 *   success: boolean
 *   data: { assets, errors, total, uploaded, failed }
 */
async function sync(req, res, next) {
  try {
    const { fileKey, depth = 3, format = 'png', scale = 2 } = req.body

    if (!fileKey) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: fileKey',
      })
    }

    logger.info(`[FigmaController] 开始同步: fileKey=${fileKey}`)

    const result = await figmaService.syncFromFigma(fileKey, {
      depth: Number(depth),
      format,
      scale: Number(scale),
    })

    logger.info(
      `[FigmaController] 同步完成: 总计=${result.total}, 成功=${result.uploaded}, 失败=${result.failed}`,
    )

    res.json({
      success: true,
      data: {
        assets: result.assets,
        errors: result.errors,
        total: result.total,
        uploaded: result.uploaded,
        failed: result.failed,
      },
    })
  } catch (err) {
    logger.error('[FigmaController] 同步失败:', err)
    next(err)
  }
}

/**
 * GET /api/figma/status
 * 查询 Figma 同步服务的配置状态
 */
function status(req, res) {
  res.json({
    success: true,
    data: {
      figmaTokenConfigured: !!process.env.FIGMA_ACCESS_TOKEN,
      ossConfigured:
        !!process.env.ALIYUN_OSS_BUCKET &&
        !!process.env.ALIYUN_ACCESS_KEY_ID &&
        !!process.env.ALIYUN_ACCESS_KEY_SECRET,
      ossBucket: process.env.ALIYUN_OSS_BUCKET || null,
      ossRegion: process.env.ALIYUN_OSS_REGION || null,
    },
  })
}

module.exports = {
  sync,
  status,
}