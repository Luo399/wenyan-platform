/**
 * 媒体资源路径工具函数
 * 用于动态拼接基础路径与相对路径
 *
 * 使用方法：
 *   import { getAssetUrl } from '@/utils/asset'
 *   const videoUrl = getAssetUrl('videos/intro.mp4')
 *
 * 环境变量配置：
 *   - VITE_OSS_BASE_URL: OSS 基础路径（生产环境）
 *   - 本地开发时为空或 '/'
 */

/**
 * 获取资源完整 URL
 * @param {string} relativePath - 相对路径（如 'videos/intro.mp4'）
 * @returns {string} 完整资源 URL
 */
export function getAssetUrl(relativePath: string): string {
  // 获取基础路径（开发环境为空，生产环境为 OSS 域名）
  const baseUrl = import.meta.env.VITE_OSS_BASE_URL || ''

  // 移除相对路径开头的斜杠（如果有）
  const normalizedPath = relativePath.replace(/^\/+/, '')

  // 如果基础路径为空，直接返回相对路径
  if (!baseUrl) {
    return `/${normalizedPath}`
  }

  // 确保基础路径末尾没有斜杠
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  // 拼接完整 URL
  return `${normalizedBaseUrl}/${normalizedPath}`
}

/**
 * 获取视频资源 URL
 * @param {string} filename - 视频文件名（如 'intro.mp4'）
 * @returns {string} 完整视频 URL
 */
export function getVideoUrl(filename: string): string {
  return getAssetUrl(`videos/${filename}`)
}

/**
 * 获取图片资源 URL
 * @param {string} filename - 图片文件名（如 'logo.png'）
 * @returns {string} 完整图片 URL
 */
export function getImageUrl(filename: string): string {
  return getAssetUrl(`img/${filename}`)
}

/**
 * 获取音频资源 URL
 * @param {string} filename - 音频文件名（如 'bgm.mp3'）
 * @returns {string} 完整音频 URL
 */
export function getAudioUrl(filename: string): string {
  return getAssetUrl(`audio/${filename}`)
}

/**
 * 获取基础路径
 * @returns {string} 基础路径
 */
export function getBaseUrl(): string {
  return import.meta.env.VITE_OSS_BASE_URL || ''
}
