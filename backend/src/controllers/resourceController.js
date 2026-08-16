/**
 * 资源上传控制器（资源上传工具专用）
 *
 * 提供端点：
 * - POST /api/upload/resource  上传音视频资源文件（需教师/管理员登录）
 *
 * 与 assetController 的区别：
 * - 使用教师/管理员鉴权（而非 ASSET_SYNC_TOKEN）
 * - 接收标准文件字段名（file + ossPath），而非 Figma 插件格式
 * - 支持 audio/video/image 三种类型
 */

const assetService = require('../services/assetService')
const config = require('../config/app')
const logger = require('../utils/logger')

/** 允许的音频扩展名 */
const ALLOWED_AUDIO_EXT = /\.(mp3|wav|ogg|aac|flac)$/i
/** 允许的视频扩展名 */
const ALLOWED_VIDEO_EXT = /\.(mp4|webm|ogg)$/i
/** 允许的图片扩展名 */
const ALLOWED_IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg)$/i

/**
 * 获取 OSS 配置
 */
function getOssConfig() {
  return {
    region: process.env.ALIYUN_OSS_REGION,
    bucket: process.env.ALIYUN_OSS_BUCKET,
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    publicUrl: process.env.OSS_PUBLIC_URL,
    dataBasePath: config.data.basePath,
  }
}

/**
 * 根据文件扩展名推断资源类型
 */
function inferType(fileName) {
  if (ALLOWED_VIDEO_EXT.test(fileName)) return 'video'
  if (ALLOWED_AUDIO_EXT.test(fileName)) return 'audio'
  if (ALLOWED_IMAGE_EXT.test(fileName)) return 'image'
  return null
}

/**
 * POST /api/upload/resource
 * 上传音视频资源文件
 *
 * Body（multipart/form-data）:
 *   - file: 要上传的文件（单个文件）
 *   - ossPath: OSS 目标路径（如 video/WEN_26_rule_bg.mp4）
 *   - wenId: 篇目 ID（如 WEN_26，仅用于日志）
 */
async function uploadResource(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE',
        message: '未上传文件',
      })
    }

    const ossPath = req.body.ossPath
    if (!ossPath || ossPath.includes('..')) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OSS_PATH',
        message: '无效的 OSS 路径',
      })
    }

    // 推断类型
    const type = inferType(ossPath)
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'UNSUPPORTED_TYPE',
        message: '不支持的文件类型，仅支持音频(mp3/wav/ogg)、视频(mp4/webm)、图片(png/jpg/gif/webp/svg)',
      })
    }

    const ossConfig = getOssConfig()
    const wenId = req.body.wenId || ''

    logger.info(`[ResourceController] 上传资源: ${ossPath} (${type}, ${wenId})`)

    // 上传到 OSS
    const result = await assetService.processFileUpload(
      {
        buffer: req.file.buffer,
        ossPath,
        originalName: req.file.originalname,
        type,
      },
      ossConfig,
    )

    res.json({
      success: true,
      data: {
        ...result,
        ossUrl: result.ossUrl || `${ossConfig.publicUrl?.replace(/\/$/, '') || ''}/${ossPath}`,
      },
    })
  } catch (err) {
    logger.error('[ResourceController] 上传失败:', err)
    next(err)
  }
}

module.exports = {
  uploadResource,
}