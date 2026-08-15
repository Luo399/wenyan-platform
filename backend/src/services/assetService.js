/**
 * 资产同步服务（Figma 插件 → 后端 → OSS）
 *
 * 功能：
 * 1. 接收 Figma 插件上传的图片/文字资源
 * 2. MD5 比对，相同则跳过
 * 3. 上传到 OSS（public-read）
 * 4. 自动更新 version.json 版本戳
 *
 * 数据流：
 *   Figma 插件 → POST /api/assets/upload → assetService → OSS
 *                                              ↕
 *                                        version.json
 */

const crypto = require('crypto')
const path = require('path')
const logger = require('../utils/logger')

// 版本文件路径（相对于后端 data 目录）
const VERSION_FILE = 'version.json'

/**
 * 计算 Buffer 的 MD5 哈希值
 * @param {Buffer} buffer
 * @returns {string} 小写 MD5 十六进制字符串
 */
function computeMd5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

/**
 * 获取当前版本文件路径
 * @param {string} dataBasePath - 数据目录路径
 * @returns {string} 版本文件绝对路径
 */
function getVersionFilePath(dataBasePath) {
  return path.join(dataBasePath, VERSION_FILE)
}

/**
 * 读取现有 version.json
 * @param {string} dataBasePath
 * @returns {object} 当前版本数据
 */
function readVersionFile(dataBasePath) {
  const fs = require('fs')
  const filePath = getVersionFilePath(dataBasePath)
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    logger.warn('[AssetService] 读取 version.json 失败，将重新创建:', err.message)
  }
  return { assets: {}, lastSyncAt: null }
}

/**
 * 写入 version.json
 * @param {string} dataBasePath
 * @param {object} versionData - 版本数据
 */
function writeVersionFile(dataBasePath, versionData) {
  const fs = require('fs')
  const filePath = getVersionFilePath(dataBasePath)
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, JSON.stringify(versionData, null, 2), 'utf-8')
  logger.info(`[AssetService] version.json 已更新，共 ${Object.keys(versionData.assets).length} 个资产`)
}

/**
 * 获取 OSS 公开访问 URL
 * @param {object} ossConfig
 * @param {string} ossPath - OSS 路径
 * @returns {string|null} 公开 URL，无法确定时返回 null
 */
function getOssPublicUrl(ossConfig, ossPath) {
  if (ossConfig.publicUrl) {
    return `${ossConfig.publicUrl.replace(/\/$/, '')}/${ossPath}`
  }
  if (ossConfig.bucket && ossConfig.region) {
    return `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${ossPath}`
  }
  return null
}

/**
 * 检查文件是否已存在且 MD5 相同（跳过上传）
 * @param {string} dataBasePath
 * @param {string} ossPath - OSS 路径（如 images/general/home_bg.png）
 * @param {string} md5 - 新文件的 MD5
 * @returns {boolean} 是否已存在且相同
 */
function isFileUnchanged(dataBasePath, ossPath, md5) {
  const versionData = readVersionFile(dataBasePath)
  const existing = versionData.assets[ossPath]
  if (existing && existing.md5 === md5) {
    logger.info(`[AssetService] 文件未变更，跳过: ${ossPath}`)
    return true
  }
  return false
}

/**
 * 上传文件到 OSS
 * @param {Buffer} buffer - 文件内容
 * @param {string} ossPath - OSS 目标路径
 * @param {object} ossConfig - OSS 配置
 * @returns {Promise<boolean>} 是否成功
 */
async function uploadToOss(buffer, ossPath, ossConfig) {
  if (!ossConfig.bucket) {
    // 无 OSS 配置时保存到本地 data 目录（开发/测试环境）
    const fs = require('fs')
    const localPath = path.join(ossConfig.dataBasePath || '.', ossPath)
    const dir = path.dirname(localPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(localPath, buffer)
    logger.info(`[AssetService] 已保存到本地: ${localPath} (${buffer.length} bytes)`)
    return true
  }

  // 有 OSS 配置时上传到阿里云 OSS
  try {
    const OSS = require('ali-oss')
    const store = new OSS({
      region: ossConfig.region || 'oss-cn-guangzhou',
      bucket: ossConfig.bucket,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      secure: true,
    })
    await store.put(ossPath, buffer, {
      headers: { 'x-oss-object-acl': 'public-read' },
    })
    logger.info(`[AssetService] 已上传到 OSS: ${ossPath} (${buffer.length} bytes)`)
    return true
  } catch (err) {
    logger.error(`[AssetService] OSS 上传失败: ${ossPath}`, err)
    throw err
  }
}

/**
 * 更新 version.json 中的资产记录
 * @param {string} dataBasePath
 * @param {string} ossPath - OSS 路径
 * @param {string} md5 - 文件 MD5
 * @param {number} size - 文件大小
 * @param {string} [type] - 资源类型（image/text）
 */
function updateVersionRecord(dataBasePath, ossPath, md5, size, type) {
  const versionData = readVersionFile(dataBasePath)
  versionData.assets[ossPath] = {
    md5,
    size,
    type: type || 'image',
    updatedAt: new Date().toISOString(),
  }
  versionData.lastSyncAt = new Date().toISOString()
  writeVersionFile(dataBasePath, versionData)
}

/**
 * 主入口：处理单文件上传
 *
 * @param {object} options
 * @param {Buffer} options.buffer - 文件内容
 * @param {string} options.ossPath - OSS 目标路径（如 images/general/home_bg.png）
 * @param {string} [options.originalName] - 原始文件名（仅用于日志）
 * @param {string} [options.type] - 资源类型（image/text）
 * @param {object} ossConfig - OSS 配置
 * @returns {Promise<{ skipped: boolean, ossPath: string, md5: string, size: number }>}
 */
async function processFileUpload({ buffer, ossPath, originalName, type }, ossConfig) {
  const md5 = computeMd5(buffer)
  const size = buffer.length
  const dataBasePath = ossConfig.dataBasePath || '.'

  // 1. MD5 比对，相同则跳过
  if (isFileUnchanged(dataBasePath, ossPath, md5)) {
    return { skipped: true, ossPath, md5, size, ossUrl: getOssPublicUrl(ossConfig, ossPath) }
  }

  // 2. 上传到 OSS
  await uploadToOss(buffer, ossPath, { ...ossConfig })

  // 3. 更新 version.json
  updateVersionRecord(dataBasePath, ossPath, md5, size, type)

  logger.info(`[AssetService] 处理完成: ${ossPath} (${size} bytes, md5: ${md5})`)

  return { skipped: false, ossPath, md5, size, ossUrl: getOssPublicUrl(ossConfig, ossPath) }
}

/**
 * 批量处理文件上传
 * @param {Array<{ buffer: Buffer, ossPath: string, originalName?: string, type?: string }>} files
 * @param {object} ossConfig
 * @returns {Promise<{ uploaded: Array, skipped: Array, errors: Array }>}
 */
async function batchProcessFiles(files, ossConfig) {
  const results = { uploaded: [], skipped: [], errors: [] }

  for (const file of files) {
    try {
      const result = await processFileUpload(file, ossConfig)
      if (result.skipped) {
        results.skipped.push(result)
      } else {
        results.uploaded.push(result)
      }
    } catch (err) {
      results.errors.push({ ossPath: file.ossPath, error: err.message })
      logger.error(`[AssetService] 处理失败: ${file.ossPath}`, err)
    }
  }

  return results
}

/**
 * 获取版本信息（供前端读取）
 * @param {string} dataBasePath
 * @returns {object} 版本数据
 */
function getVersionInfo(dataBasePath) {
  return readVersionFile(dataBasePath)
}

module.exports = {
  computeMd5,
  processFileUpload,
  batchProcessFiles,
  getVersionInfo,
  readVersionFile,
  writeVersionFile,
  VERSION_FILE,
}