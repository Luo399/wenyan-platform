/**
 * 资产同步控制器（Figma 插件 → 后端）
 *
 * 提供以下端点：
 * - POST /api/assets/upload     接收 Figma 插件上传的文件（multipart/form-data）
 * - GET  /api/assets/version    获取版本信息（version.json）
 * - POST /api/assets/pre-signed 生成 OSS 预签名 URL（直传模式）
 */

const assetService = require('../services/assetService')
const config = require('../config/app')
const logger = require('../utils/logger')

/**
 * 获取 OSS 配置
 */
function getOssConfig() {
  return {
    region: process.env.ALIYUN_OSS_REGION,
    bucket: process.env.ALIYUN_OSS_BUCKET,
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    dataBasePath: config.data.basePath,
  }
}

/**
 * POST /api/assets/upload
 * 接收 Figma 插件上传的文件
 *
 * Body（multipart/form-data）:
 *   files[] - 文件数组（每个文件必须包含元数据）
 *   ossPath[] - 对应的 OSS 路径数组（如 images/general/home_bg.png）
 *   type[] - 资源类型数组（image / text）
 *
 * 或 JSON body（文字资源）:
 *   { files: [{ ossPath, type, content, encoding }] }
 *   content 为文件内容（base64 编码），encoding 为 'base64'
 */
async function upload(req, res, next) {
  try {
    const ossConfig = getOssConfig()
    let files = []

    if (req.is('multipart/form-data')) {
      // 文件上传模式
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_FILES',
          message: '未上传文件',
        })
      }

      // 解析 ossPath 和 type（可能为数组或重复字段）
      const ossPaths = parseArrayField(req.body, 'ossPath')
      const types = parseArrayField(req.body, 'type')

      files = req.files.map((file, index) => ({
        buffer: file.buffer,
        ossPath: ossPaths[index] || file.originalname,
        originalName: file.originalname,
        type: types[index] || 'image',
      }))
    } else if (req.is('json')) {
      // JSON 文字资源模式
      const body = req.body
      if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_FILES',
          message: '未提供文件数据',
        })
      }

      files = body.files.map((f) => ({
        buffer: Buffer.from(f.content || '', f.encoding || 'utf-8'),
        ossPath: f.ossPath,
        originalName: f.ossPath.split('/').pop() || f.ossPath,
        type: f.type || 'text',
      }))
    } else {
      return res.status(400).json({
        success: false,
        error: 'UNSUPPORTED_CONTENT_TYPE',
        message: '仅支持 multipart/form-data 和 application/json',
      })
    }

    logger.info(`[AssetController] 收到 ${files.length} 个文件上传请求`)

    // 批量处理
    const results = await assetService.batchProcessFiles(files, ossConfig)

    res.json({
      success: true,
      data: {
        total: files.length,
        uploaded: results.uploaded,
        skipped: results.skipped,
        errors: results.errors,
        versionUrl: '/api/assets/version',
      },
    })
  } catch (err) {
    logger.error('[AssetController] 上传失败:', err)
    next(err)
  }
}

/**
 * GET /api/assets/version
 * 获取版本信息
 */
async function getVersion(req, res, next) {
  try {
    const ossConfig = getOssConfig()
    const versionInfo = assetService.getVersionInfo(ossConfig.dataBasePath)
    res.json({
      success: true,
      data: versionInfo,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/assets/pre-signed
 * 生成 OSS 预签名 URL（供 Figma 插件直传）
 *
 * Body:
 *   { ossPath: string, expiresIn?: number }
 *
 * 响应：
 *   { success: true, data: { url: string, ossPath: string } }
 */
async function generatePreSignedUrl(req, res, next) {
  try {
    const { ossPath, expiresIn = 3600 } = req.body

    if (!ossPath) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_OSS_PATH',
        message: '缺少 ossPath 参数',
      })
    }

    const ossConfig = getOssConfig()
    if (!ossConfig.bucket) {
      return res.status(400).json({
        success: false,
        error: 'OSS_NOT_CONFIGURED',
        message: 'OSS 未配置，无法生成预签名 URL',
      })
    }

    const OSS = require('ali-oss')
    const store = new OSS({
      region: ossConfig.region || 'oss-cn-guangzhou',
      bucket: ossConfig.bucket,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      secure: true,
    })

    // 生成预签名 PUT URL
    const url = store.signatureUrl(ossPath, {
      expires: expiresIn,
      method: 'PUT',
    })

    res.json({
      success: true,
      data: { url, ossPath, expiresIn },
    })
  } catch (err) {
    logger.error('[AssetController] 生成预签名 URL 失败:', err)
    next(err)
  }
}

/**
 * 解析数组字段（支持单个值、重复字段、JSON 数组）
 */
function parseArrayField(body, fieldName) {
  if (Array.isArray(body[fieldName])) return body[fieldName]
  if (typeof body[fieldName] === 'string') {
    try {
      const parsed = JSON.parse(body[fieldName])
      if (Array.isArray(parsed)) return parsed
    } catch {
      // 不是 JSON 数组，作为单个值
    }
    return [body[fieldName]]
  }
  return []
}

module.exports = {
  upload,
  getVersion,
  generatePreSignedUrl,
}