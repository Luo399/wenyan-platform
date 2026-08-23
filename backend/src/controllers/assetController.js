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

    // 拒绝 0 字节文件：血泪教训——插件导出失败的图片会传空 buffer，
    // 若不拦截会产生 OSS 0b 空对象 + version.json 0 字节记录（假上传/占位坏文件）。
    const byteSize = Buffer.isBuffer(f.buffer) ? f.buffer.length : Buffer.byteLength(String(f.content || ''), 'utf-8')
    if (byteSize === 0) {
      return { ok: false, reason: 'EMPTY_FILE', message: `文件内容为空（0 字节）: ${ossPath}` }
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
 *   { ossPath: string, contentType?: string, expiresIn?: number }
 *
 * 响应：
 *   { success: true, data: { url: string, ossPath: string, contentType?: string, expiresIn: number } }
 *
 * 说明：
 *   - 将 contentType 纳入 OSS 签名，否则 PUT 直传携带的 Content-Type 会使签名校验失败
 */
async function generatePreSignedUrl(req, res, next) {
  try {
    const { ossPath, contentType, expiresIn = 3600 } = req.body

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

    // 生成预签名 PUT URL（把 contentType 一并签名，避免直传时 Content-Type 不符导致 403）
    const signOptions = {
      expires: expiresIn,
      method: 'PUT',
    }
    if (contentType) {
      signOptions.contentType = String(contentType)
    }
    const url = store.signatureUrl(ossPath, signOptions)

    res.json({
      success: true,
      data: { url, ossPath, contentType: contentType || null, expiresIn },
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

/**
 * 按资源类型和 WEN 分组，构建资源清单（列表结构）
 *
 * @param {Array<{ ossPath: string, type: string, size: number, updatedAt: string|null }>} entryList
 *   资源条目——来自 version.json（上传清单）或 OSS 桶（真实文件）两种数据源均可。
 * @param {string|null} lastSyncAt - 最近同步时间戳（version.json 传入；OSS 传入桶内最后修改时间）
 * @returns {object} inventory 结构 { meta, general, wen_list }
 */
/**
 * 从本地 data 目录动态读取课文标题（text_basic_info/WEN_xx.json 的 title 字段）
 *
 * 实现"资源 id → 标题"的动态绑定：只要某篇课文被扫描/上传、data 中存在其 JSON，
 * 即可据此得到标题，无需依赖人工维护的硬编码表。读取失败或文件缺失时返回 null，
 * 由调用方回退到内置标题表（见 buildInventory 内 POEMS）。
 *
 * @param {string} dataBasePath - 后端数据目录（ossConfig.dataBasePath）
 * @returns {Record<string, string>} 形如 { WEN_06: '诫子书', ... }
 */
function loadWenTitles(dataBasePath) {
  const fs = require('fs')
  const path = require('path')
  const titles = {}
  if (!dataBasePath) return titles
  for (let i = 1; i <= 37; i++) {
    const wenId = `WEN_${String(i).padStart(2, '0')}`
    const filePath = path.join(dataBasePath, 'text_basic_info', `${wenId}.json`)
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        if (parsed && typeof parsed.title === 'string' && parsed.title) {
          titles[wenId] = parsed.title
        }
      }
    } catch (e) {
      // 单篇读取失败不影响整体，回退到内置表
    }
  }
  return titles
}

function buildInventory(entryList, lastSyncAt, dataBasePath) {
  // 37篇诗文列表
  const POEMS = {
    'WEN_01': '陈涉世家', 'WEN_02': '马说', 'WEN_03': '岳阳楼记', 'WEN_04': '庄子与惠子',
    'WEN_05': '论语十二章', 'WEN_06': '诫子书', 'WEN_07': '陋室铭', 'WEN_08': '爱莲说',
    'WEN_09': '孟子三章', 'WEN_10': '虽有嘉肴', 'WEN_11': '大道之行', 'WEN_12': '鱼我所欲也',
    'WEN_13': '送东阳马生序', 'WEN_14': '出师表', 'WEN_15': '三峡', 'WEN_16': '答谢中书书',
    'WEN_17': '记承天寺夜游', 'WEN_18': '与朱元思书', 'WEN_19': '桃花源记', 'WEN_20': '小石潭记',
    'WEN_21': '核舟记', 'WEN_22': '醉翁亭记', 'WEN_23': '湖心亭看雪', 'WEN_24': '孙权劝学',
    'WEN_25': '卖油翁', 'WEN_26': '周亚夫军细柳', 'WEN_27': '唐雎不辱使命', 'WEN_28': '曹刿论战',
    'WEN_29': '邹忌讽齐王纳谏', 'WEN_30': '穿井得一人', 'WEN_31': '杞人忧天', 'WEN_32': '愚公移山',
    'WEN_33': '北冥有鱼', 'WEN_34': '咏雪', 'WEN_35': '陈太丘与友期行', 'WEN_36': '狼', 'WEN_37': '活板',
  }

  // 动态标题：优先从 data JSON 读取（资源扫描/上传后即可得到），内置表仅作兜底
  const wenTitles = loadWenTitles(dataBasePath)

  // 资源类型映射
  const TYPE_LABELS = {
    image: '图片',
    text: '文字',
    style: '样式',
  }

  // 按资源分类整理（通用资源）
  const generalResources = {
    styles: [],
    images: [],
    texts: [],
  }

  // WEN 资源 { wen_id: { screens: [], culture_cards: [], other: [], styles: [], texts: [] } }
  const wenResources = {}

  // 初始化 37 个 WEN
  for (let i = 1; i <= 37; i++) {
    const wenId = `WEN_${String(i).padStart(2, '0')}`
    wenResources[wenId] = {
      title: wenTitles[wenId] || POEMS[wenId] || '未知',
      screens: [],       // 按 screen 类型分组的图片
      culture_cards: [], // 文化卡片图片
      other_images: [],  // 其他图片
      styles: [],        // 样式
      texts: [],         // 文字
    }
  }

  // 遍历所有资源条目
  for (const asset of entryList) {
    const ossPath = asset.ossPath
    const infoType = asset.type || 'image'
    const updatedAt = asset.updatedAt || null
    const displayTime = updatedAt ? formatTime(updatedAt) : '-'

    const entry = {
      oss_path: ossPath,
      type: infoType,
      type_label: TYPE_LABELS[infoType] || infoType,
      size: asset.size || 0,
      md5: '',
      updated_at: displayTime,
    }

    // 检查是否属于某个 WEN
    let matchedWen = null
    for (const wenId of Object.keys(POEMS)) {
      if (ossPath.includes(wenId)) {
        matchedWen = wenId
        break
      }
    }

    if (matchedWen) {
      const wen = wenResources[matchedWen]

      // 分类
      if (infoType === 'text' || ossPath.startsWith('data/texts/')) {
        wen.texts.push(entry)
      } else if (infoType === 'style' || ossPath.startsWith('styles/')) {
        // 按 screen 分组
        const screenMatch = ossPath.match(/styles\/images\/screens\/\w+\/([^/]+)\//)
        if (screenMatch) {
          const screenType = screenMatch[1]
          const existingScreen = wen.screens.find(s => s.screen_type === screenType)
          if (existingScreen) {
            existingScreen.styles.push(entry)
          } else {
            wen.screens.push({
              screen_type: screenType,
              screen_label: getScreenLabel(screenType),
              images: [],
              styles: [entry],
            })
          }
        } else {
          wen.styles.push(entry)
        }
      } else if (ossPath.includes('culture_cards')) {
        wen.culture_cards.push(entry)
      } else if (ossPath.startsWith('images/screens/')) {
        // 按 screen 分组
        const screenMatch = ossPath.match(/images\/screens\/\w+\/([^/]+)\//)
        if (screenMatch) {
          const screenType = screenMatch[1]
          let screenEntry = wen.screens.find(s => s.screen_type === screenType)
          if (!screenEntry) {
            screenEntry = {
              screen_type: screenType,
              screen_label: getScreenLabel(screenType),
              images: [],
              styles: [],
            }
            wen.screens.push(screenEntry)
          }
          screenEntry.images.push(entry)
        } else {
          wen.other_images.push(entry)
        }
      } else {
        wen.other_images.push(entry)
      }
    } else {
      // 通用资源
      if (infoType === 'text' || ossPath.startsWith('data/texts/')) {
        generalResources.texts.push(entry)
      } else if (infoType === 'style' || ossPath.startsWith('styles/')) {
        generalResources.styles.push(entry)
      } else {
        generalResources.images.push(entry)
      }
    }
  }

  // 构建响应
  const inventory = {
    meta: {
      last_sync_at: lastSyncAt ? formatTime(lastSyncAt) : '-',
      total_assets: entryList.length,
      general_count: generalResources.styles.length + generalResources.images.length + generalResources.texts.length,
      wen_count: Object.keys(POEMS).length,
    },
    general: {
      styles: generalResources.styles.sort((a, b) => a.oss_path.localeCompare(b.oss_path)),
      images: generalResources.images.sort((a, b) => a.oss_path.localeCompare(b.oss_path)),
      texts: generalResources.texts.sort((a, b) => a.oss_path.localeCompare(b.oss_path)),
    },
    wen_list: [],
  }

  // 构建 WEN 列表
  for (let i = 1; i <= 37; i++) {
    const wenId = `WEN_${String(i).padStart(2, '0')}`
    const wen = wenResources[wenId]
    const screens = wen.screens.sort((a, b) => {
      const order = { video: 0, explanation: 1, dialogue: 2, quiz: 3, summary: 4 }
      return (order[a.screen_type] || 99) - (order[b.screen_type] || 99)
    })

    inventory.wen_list.push({
      wen_id: wenId,
      title: wen.title,
      screens: screens.map(s => ({
        screen_type: s.screen_type,
        screen_label: s.screen_label,
        image_count: s.images.length,
        style_count: s.styles.length,
        images: s.images,
        styles: s.styles,
      })),
      culture_cards: wen.culture_cards,
      other_images: wen.other_images,
      styles: wen.styles,
      texts: wen.texts,
    })
  }

  return inventory
}

/**
 * GET /api/assets/inventory
 * 获取完整资源清单（带最近更新时间）
 *
 * 数据源：version.json（上传清单）——记录"声称已上传"的资源。
 */
async function getInventory(req, res, next) {
  try {
    const ossConfig = getOssConfig()
    const versionData = assetService.getVersionInfo(ossConfig.dataBasePath)
    const assets = versionData.assets || {}
    const entryList = Object.keys(assets).map((ossPath) => {
      const info = assets[ossPath]
      return { ossPath, type: info.type || 'image', size: info.size || 0, updatedAt: info.updatedAt || null }
    })
    res.json({
      success: true,
      data: buildInventory(entryList, versionData.lastSyncAt, ossConfig.dataBasePath),
    })
  } catch (err) {
    logger.error('[AssetController] 获取资源清单失败:', err)
    next(err)
  }
}

/**
 * 根据 OSS 路径推断资源类型（样式/文字/图片/其他）
 * @param {string} ossPath
 * @returns {string}
 */
function inferAssetType(ossPath) {
  if (ossPath.startsWith('styles/')) return 'style'
  if (ossPath.endsWith('.json')) return 'text'
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(ossPath)) return 'image'
  return '其他'
}

/**
 * GET /api/assets/oss-list
 * 直读 OSS 桶真实文件的资源清单（与上传清单是不同数据源）
 *
 * 用途：排查"显示上传成功、但实际未上传到 OSS"的情况——
 * 此接口列出 OSS 桶里【真实存在】的对象，按 WEN 分组返回。
 */
async function getOssList(req, res, next) {
  try {
    const ossConfig = getOssConfig()
    const objects = await assetService.listOssObjects(ossConfig)

    const entryList = objects.map((obj) => ({
      ossPath: obj.name,
      type: inferAssetType(obj.name),
      size: obj.size || 0,
      updatedAt: obj.lastModified || null,
    }))

    // 最近同步时间 = 桶内最后一个对象的最后修改时间（ISO 字符串可直接比较）
    let lastSyncAt = null
    for (const e of entryList) {
      if (e.updatedAt && (!lastSyncAt || e.updatedAt > lastSyncAt)) lastSyncAt = e.updatedAt
    }

    res.json({
      success: true,
      data: buildInventory(entryList, lastSyncAt, ossConfig.dataBasePath),
    })
  } catch (err) {
    logger.error('[AssetController] 获取 OSS 资源清单失败:', err)
    next(err)
  }
}

/**
 * 格式化时间字符串为可读格式
 */
function formatTime(isoStr) {
  try {
    const date = new Date(isoStr)
    if (isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch {
    return '-'
  }
}

/**
 * 获取 Screen 类型中文标签
 */
function getScreenLabel(screenType) {
  const labels = {
    video: '逐句讲解视频页',
    explanation: '逐句讲解页',
    dialogue: '多角色对话页',
    quiz: '课后测验页',
    summary: '学习总结页',
  }
  return labels[screenType] || screenType
}

/**
 * POST /api/assets/cleanup
 * 清理误传/非业务资源：删除 OSS 对象并从 version.json 移除记录
 *
 * Body（JSON）: { paths: ['styles/Shopping cart.json', ...] }
 * 说明：与上传共用 assetAuthMiddleware（X-API-Key 鉴权），
 * 用于清理 Figma 工作文件等误传进上传清单的样式资源。
 */
async function cleanup(req, res, next) {
  try {
    const body = req.body || {}
    const paths = Array.isArray(body.paths) ? body.paths : []
    if (paths.length === 0) {
      return res.status(400).json({ success: false, error: 'EMPTY_PATHS', message: '未提供要清理的路径列表' })
    }

    const ossConfig = getOssConfig()
    const deleted = []
    const errors = []

    for (const rawPath of paths) {
      const ossPath = String(rawPath || '').replace(/^\/+/, '')
      // 防路径穿越 + 空路径
      if (!ossPath || ossPath.includes('..')) {
        errors.push({ ossPath: String(rawPath), error: '非法路径' })
        continue
      }
      try {
        await assetService.deleteOssObject(ossConfig, ossPath)
        assetService.removeVersionRecord(ossConfig.dataBasePath, ossPath)
        deleted.push(ossPath)
      } catch (err) {
        errors.push({ ossPath, error: err.message })
        logger.error(`[AssetController] 清理失败: ${ossPath}`, err)
      }
    }

    res.json({
      success: true,
      data: { deleted, errors },
    })
  } catch (err) {
    logger.error('[AssetController] 清理接口异常:', err)
    next(err)
  }
}

module.exports = {
  upload,
  getVersion,
  getInventory,
  getOssList,
  cleanup,
  generatePreSignedUrl,
  getStyleFile,
}
