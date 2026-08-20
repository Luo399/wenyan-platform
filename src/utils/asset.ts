/**
 * 资源路径工具函数
 *
 * 功能说明：
 * - 根据环境变量获取 OSS 基础路径
 * - 拼接完整的资源 URL
 * - 支持版本戳缓存刷新（通过 version.json 的 lastSyncAt 时间戳）
 *
 * 使用示例：
 * const audioUrl = getAssetUrl('audio', 'WEN_01_read_full.mp3')
 * // 开发环境返回: http://localhost:5173/audio/WEN_01_read_full.mp3
 * // 生产环境返回: https://oss-bucket/audio/WEN_01_read_full.mp3
 *
 * const audioUrlCached = await getAssetUrlWithVersion('audio', 'WEN_01_read_full.mp3')
 * // 返回: https://oss-bucket/audio/WEN_01_read_full.mp3?t=2026-08-05T12:00:00.000Z
 */

import { debugWarn, debugLog } from '@/utils/debug'

/**
 * OSS 基础路径，从环境变量读取
 * R96: 移除 as string 断言，改用 ?? 兜底，避免 VITE_OSS_BASE_URL 未配置时拼出 undefined/... URL
 */
export const ossBase: string = import.meta.env.VITE_OSS_BASE_URL ?? ''

// R96: 开发环境未配置时给出告警，便于及早发现
if (import.meta.env.DEV && !ossBase) {
  debugWarn('[asset] VITE_OSS_BASE_URL 未配置，资源 URL 将使用相对路径')
}

// ============================================================
// 版本戳缓存机制
// ============================================================

/** 版本信息缓存 */
let versionCache: { lastSyncAt: string | null; fetchedAt: number } | null = null
/** 缓存有效期（10 分钟） */
const VERSION_CACHE_TTL = 10 * 60 * 1000
/** 当前正在执行的版本请求（去重并发） */
let pendingVersionFetch: Promise<string | null> | null = null

/**
 * 获取 API 基础 URL（复用环境变量）
 */
function getApiBase(): string {
  return import.meta.env.VITE_API_BASE_URL || ''
}

/**
 * 从后端获取版本时间戳
 * 内部自带缓存和去重，多次调用不会重复请求
 * @returns lastSyncAt 时间戳字符串，失败返回 null
 */
async function fetchVersionTimestamp(): Promise<string | null> {
  // 缓存有效期内直接返回
  if (versionCache && Date.now() - versionCache.fetchedAt < VERSION_CACHE_TTL) {
    return versionCache.lastSyncAt
  }

  // 去重：已有在途请求则等待
  if (pendingVersionFetch) {
    return pendingVersionFetch
  }

  const apiBase = getApiBase()
  if (!apiBase) {
    return null
  }

  // 发起请求
  pendingVersionFetch = (async () => {
    try {
      const response = await fetch(`${apiBase}/api/assets/version`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json()
      const timestamp = result?.data?.lastSyncAt || null

      versionCache = { lastSyncAt: timestamp, fetchedAt: Date.now() }
      if (timestamp) {
        debugLog('[asset] 版本时间戳:', timestamp)
      }
      return timestamp
    } catch (err) {
      debugWarn('[asset] 获取版本信息失败，使用无版本戳 URL:', err)
      versionCache = { lastSyncAt: null, fetchedAt: Date.now() }
      return null
    } finally {
      pendingVersionFetch = null
    }
  })()

  return pendingVersionFetch
}

/**
 * 获取资源完整 URL（基础版本）
 *
 * @param type - 资源类型：'audio' | 'images' | 'video'
 * @param fileName - 文件名（包含扩展名）
 * @returns 完整的资源 URL
 *
 * @example
 * getAssetUrl('audio', 'WEN_01_read_full.mp3')
 * // => https://oss-bucket/audio/WEN_01_read_full.mp3
 */
export function getAssetUrl(type: 'audio' | 'images' | 'video', fileName: string): string {
  return `${ossBase}/${type}/${encodeURIComponent(fileName)}`
}

/**
 * 获取带版本戳的资源 URL（用于 CDN 缓存刷新）
 *
 * 自动从后端 version.json 获取 lastSyncAt 时间戳，拼接到 URL 末尾。
 * 版本戳有 10 分钟内存缓存，不会每次调用都发起网络请求。
 *
 * @param type - 资源类型：'audio' | 'images' | 'video'
 * @param fileName - 文件名（包含扩展名）
 * @returns Promise，解析为带版本戳的 URL
 *
 * @example
 * await getAssetUrlWithVersion('images', 'home_bg.png')
 * // => https://oss-bucket/images/home_bg.png?t=2026-08-05T12:00:00.000Z
 */
export async function getAssetUrlWithVersion(
  type: 'audio' | 'images' | 'video',
  fileName: string,
): Promise<string> {
  const baseUrl = getAssetUrl(type, fileName)

  // 开发环境或 OSS 未配置时不加版本戳
  if (import.meta.env.DEV || !ossBase) {
    return baseUrl
  }

  const timestamp = await fetchVersionTimestamp()
  if (!timestamp) {
    return baseUrl
  }

  // 用 encodeURIComponent 保证时间戳中的特殊字符不被破坏
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}t=${encodeURIComponent(timestamp)}`
}

/**
 * 获取 JSON 数据完整 URL
 *
 * @param dir - 数据目录，如 'culture_cards' | 'text_basic_info' | 'level1_quiz' | 'texts'
 * @param fileName - 文件名（包含扩展名，如 'WEN_01.json'）
 * @returns 完整数据 URL
 *
 * @example
 * getDataUrl('culture_cards', 'WEN_01.json')
 * // 开发环境 => /data/culture_cards/WEN_01.json
 * // 生产环境 => https://oss-bucket/data/culture_cards/WEN_01.json
 */
export function getDataUrl(dir: string, fileName: string): string {
  const base = ossBase ? `${ossBase}/data/${dir}` : `/data/${dir}`
  return `${base}/${encodeURIComponent(fileName)}`
}

/**
 * 获取组件样式 JSON 完整 URL
 *
 * @param componentName - 组件名（如 'Navigation'），对应 OSS styles/{组件名}.json
 * @returns 完整样式 JSON URL
 *
 * @example
 * getStyleUrl('Navigation')
 * // 开发环境 => /styles/Navigation.json
 * // 生产环境 => https://oss-bucket/styles/Navigation.json
 */
export function getStyleUrl(componentName: string): string {
  const safe = encodeURIComponent(componentName)
  return ossBase ? `${ossBase}/styles/${safe}.json` : `/styles/${safe}.json`
}

/**
 * 获取带版本戳的 JSON 数据 URL（用于 CDN/浏览器缓存刷新）
 *
 * 自动从后端 version.json 获取 lastSyncAt 时间戳拼接到 URL 末尾，
 * 版本戳有 10 分钟内存缓存，不会每次调用都发起网络请求。
 *
 * @param dir - 数据目录（同 getDataUrl）
 * @param fileName - 文件名（包含扩展名）
 * @returns Promise，解析为带版本戳的 URL
 *
 * @example
 * await getDataUrlWithVersion('culture_cards', 'WEN_01.json')
 * // => https://oss-bucket/data/culture_cards/WEN_01.json?t=2026-08-05T12:00:00.000Z
 */
export async function getDataUrlWithVersion(dir: string, fileName: string): Promise<string> {
  const baseUrl = getDataUrl(dir, fileName)

  // 开发环境或 OSS 未配置时不加版本戳（开发环境直接读 public/data 静态文件）
  if (import.meta.env.DEV || !ossBase) {
    return baseUrl
  }

  const timestamp = await fetchVersionTimestamp()
  if (!timestamp) {
    return baseUrl
  }

  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}t=${encodeURIComponent(timestamp)}`
}

/**
 * 强制刷新版本缓存（资源同步后调用）
 */
export function refreshVersionCache(): void {
  versionCache = null
  debugLog('[asset] 版本缓存已刷新')
}
