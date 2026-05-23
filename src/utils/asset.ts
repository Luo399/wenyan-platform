/**
 * 资源路径工具函数
 *
 * 功能说明：
 * - 根据环境变量获取 OSS 基础路径
 * - 拼接完整的资源 URL
 *
 * 使用示例：
 * const audioUrl = getAssetUrl('audio', 'WEN_01_read_full.mp3')
 * // 开发环境返回: http://localhost:5173/audio/WEN_01_read_full.mp3
 * // 生产环境返回: https://your-bucket.oss-cn-hangzhou.aliyuncs.com/audio/WEN_01_read_full.mp3
 */

/** OSS 基础路径，从环境变量读取 */
export const ossBase = import.meta.env.VITE_OSS_BASE_URL

/**
 * 获取资源完整 URL
 *
 * @param type - 资源类型：'audio' | 'images' | 'video'
 * @param fileName - 文件名（包含扩展名）
 * @returns 完整的资源 URL
 *
 * @example
 * // 获取音频文件 URL
 * getAssetUrl('audio', 'WEN_01_read_full.mp3')
 *
 * // 获取图片文件 URL
 * getAssetUrl('images', 'WEN_01_illus_room.jpg')
 *
 * // 获取视频文件 URL
 * getAssetUrl('video', 'WEN_01_intro.mp4')
 */
export function getAssetUrl(type: 'audio' | 'images' | 'video', fileName: string): string {
  return `${ossBase}/${type}/${fileName}`
}
