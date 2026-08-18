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

// ============ 上传白名单校验常量 ============
/** 允许的 JSON 数据目录（与前端消费路径一一对应，白名单之外一律拒绝） */
const ALLOWED_JSON_DIRS = [
  'data/culture_cards',
  'data/text_basic_info',
  'data/level1_quiz',
  'data/texts',
  'data/word_list',  // 字词注释数据（前端通过 getDataUrl('word_list', ...) 消费）
  'styles',  // Figma 插件视觉属性提取（颜色、字体、边框、圆角、自动布局等）
]
/** 允许的图片/媒体根目录（子路径由 Figma Frame 命名决定） */
const ALLOWED_MEDIA_DIRS = ['images/', 'audio/', 'video/']
/** 单个 JSON 文件大小上限（500KB） */
const MAX_JSON_SIZE = 500 * 1024
/** 允许的图片扩展名 */
const ALLOWED_IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg)$/i
/** 允许的音频扩展名 */
const ALLOWED_AUDIO_EXT = /\.(mp3|wav|ogg|aac|flac)$/i
/** 允许的视频扩展名 */
const ALLOWED_VIDEO_EXT = /\.(mp4|webm|ogg)$/i

/**
 * 校验上传文件（字段白名单 + 路径白名单 + 防路径穿越 + JSON 合法性 + 大小限制）
 * @returns {{ ok: true } | { ok: false, reason: string, message: string }}
 */
function validateUpload(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, reason: 'MISSING_FILES', message: '未提供文件数据' }
  }

  for (const f of files) {
    // 字段白名单：只读取允许的字段，忽略多余字段
    const ossPath = String(f.ossPath || '')
    const type = String(f.type || '')

    // 防路径穿越 + 空路径
    if (!ossPath || ossPath.includes('..')) {
      return { ok: false, reason: 'PATH_TRAVERSAL', message: `非法路径: ${ossPath}` }
    }

    if (type === 'text' || type === 'style') {
      // 文字/样式资源：必须在 JSON 白名单目录内
      if (!ALLOWED_JSON_DIRS.some((dir) => ossPath.startsWith(`${dir}/`))) {
        return { ok: false, reason: 'PATH_NOT_ALLOWED', message: `路径不在白名单内: ${ossPath}` }
      }
      // 内容合法性：必须是可解析的 JSON 对象（非数组/标量）
      const content = Buffer.isBuffer(f.buffer)
        ? f.buffer.toString('utf-8')
        : String(f.content || '')
      try {
        const parsed = JSON.parse(content)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { ok: false, reason: 'INVALID_JSON', message: `JSON 顶层必须是对象: ${ossPath}` }
        }
      } catch {
        return { ok: false, reason: 'INVALID_JSON', message: `JSON 无法解析: ${ossPath}` }
      }
      // 大小限制
      if (Buffer.byteLength(content, 'utf-8') > MAX_JSON_SIZE) {
        return {
          ok: false,
          reason: 'TOO_LARGE',
          message: `JSON 超过 ${MAX_JSON_SIZE / 1024}KB: ${ossPath}`,
        }
      }
    } else if (type === 'image') {
      // 图片资源：必须在媒体根目录内，且扩展名合法
      if (!ALLOWED_MEDIA_DIRS.some((dir) => ossPath.startsWith(dir))) {
        return {
          ok: false,
          reason: 'PATH_NOT_ALLOWED',
          message: `图片路径不在白名单内: ${ossPath}`,
        }
      }
      if (!ALLOWED_IMAGE_EXT.test(ossPath)) {
        return { ok: false, reason: 'INVALID_EXT', message: `图片扩展名不合法: ${ossPath}` }
      }
    } else if (type === 'audio') {
      // 音频资源：必须在 audio/ 目录内，且扩展名合法
      if (!ossPath.startsWith('audio/')) {
        return { ok: false, reason: 'PATH_NOT_ALLOWED', message: `音频路径必须在 audio/ 下: ${ossPath}` }
      }
      if (!ALLOWED_AUDIO_EXT.test(ossPath)) {
        return { ok: false, reason: 'INVALID_EXT', message: `音频扩展名不合法: ${ossPath}` }
      }
    } else if (type === 'video') {
      // 视频资源：必须在 video/ 目录内，且扩展名合法
      if (!ossPath.startsWith('video/')) {
        return { ok: false, reason: 'PATH_NOT_ALLOWED', message: `视频路径必须在 video/ 下: ${ossPath}` }
      }
      if (!ALLOWED_VIDEO_EXT.test(ossPath)) {
        return { ok: false, reason: 'INVALID_EXT', message: `视频扩展名不合法: ${ossPath}` }
      }
    } else {
      return { ok: false, reason: 'INVALID_TYPE', message: `未知资源类型: ${type}` }
    }
  }

  return { ok: true }
}

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

    // 白名单校验：路径/类型/内容合法性，任一文件违规则整体拒绝
    const validation = validateUpload(files)
    if (!validation.ok) {
      logger.warn(`[AssetController] 上传被拒绝: ${validation.reason} - ${validation.message}`)
      return res.status(400).json({
        success: false,
        error: validation.reason,
        message: validation.message,
      })
    }

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

/**
 * GET /api/assets/styles/:name
 * 临时端点：读取服务器上的样式文件
 */
async function getStyleFile(req, res, next) {
  try {
    const path = require('path')
    const fs = require('fs')
    const { name } = req.params
    // 防路径穿越
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ success: false, error: 'INVALID_NAME', message: '非法文件名' })
    }
    const config = require('../config/app')
    const filePath = path.join(config.data.basePath, 'styles', name.endsWith('.json') ? name : `${name}.json`)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: `文件不存在: ${name}` })
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ success: true, data: JSON.parse(content) })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  upload,
  getVersion,
  generatePreSignedUrl,
  getStyleFile,
}
