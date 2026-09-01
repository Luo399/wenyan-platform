/**
 * figmaAssets - Figma 切片资源定位（生产桶路径约定）
 *
 * 约定（与生产桶现网一致）：
 *   OSS/images/screens/{wenId}/{screenType}/{fileName}
 *   例：images/screens/WEN_18/dialogue/avatar_eldest_son_01.png
 *        images/screens/WEN_18/quiz/option_a_03.png
 *
 * 提供：
 * - getScreenAssetUrl()     按约定构造完整 URL（不复用 ossBase 其它目录）
 * - probeAsset()            资源存在性探测（HEAD + 模块级缓存，避免重复 404）
 * - resolveScreenAsset()    探测成功返回 URL，失败返回 null → 组件可"图优先/CSS 兜底"
 */

import { ossBase } from '@/utils/asset'

/** 生产桶 screen 类型（与 inventory 的 screen_type 一致） */
export type FigmaScreenType =
  | 'dialogue'
  | 'video'
  | 'explanation'
  | 'quiz'
  | 'summary'
  | 'cultural_card'

const SCREEN_DIR = 'images/screens'

/**
 * 按约定构造切片完整 URL
 * @param wenId - 课文 ID（WEN_xx）
 * @param screenType - 页面类型
 * @param fileName - 文件名（含扩展名）
 */
export function getScreenAssetUrl(
  wenId: string,
  screenType: FigmaScreenType,
  fileName: string,
): string {
  const safe = [wenId, screenType, fileName].map((seg) => encodeURIComponent(seg)).join('/')
  return ossBase ? `${ossBase}/${SCREEN_DIR}/${safe}` : `/${SCREEN_DIR}/${safe}`
}

/** 资源探测缓存：URL -> 是否存在 */
const probeCache = new Map<string, boolean>()
/** 资源探测在途请求：URL -> Promise，去重并发探测 */
const inflightProbe = new Map<string, Promise<boolean>>()

/**
 * HEAD 探测资源是否存在（带模块级缓存）
 * 生产环境资源与站点同源（VITE_OSS_BASE_URL），可读取响应状态；
 * 失败/异常一律视为不存在，由调用方回退 CSS。
 */
export function probeAsset(url: string): Promise<boolean> {
  const cached = probeCache.get(url)
  if (cached !== undefined) return Promise.resolve(cached)

  const inflight = inflightProbe.get(url)
  if (inflight) return inflight

  const task = fetch(url, { method: 'HEAD', cache: 'no-store' })
    .then((res) => {
      const exists = res.ok
      probeCache.set(url, exists)
      return exists
    })
    .catch(() => {
      probeCache.set(url, false)
      return false
    })
    .finally(() => {
      inflightProbe.delete(url)
    })

  inflightProbe.set(url, task)
  return task
}

/**
 * 探测约定路径下的切片资源。
 * 存在 → 返回完整 URL；不存在 → 返回 null（供组件 CSS 兜底）。
 */
export async function resolveScreenAsset(
  wenId: string,
  screenType: FigmaScreenType,
  fileName: string,
): Promise<string | null> {
  const url = getScreenAssetUrl(wenId, screenType, fileName)
  const exists = await probeAsset(url)
  return exists ? url : null
}
