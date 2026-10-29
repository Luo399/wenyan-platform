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
import {
  FIGMA_SCREEN_CATALOG,
  type FigmaOptionKey,
  type FigmaScreenAssetRef,
  type FigmaScreenRole,
  type FigmaTextBoxRole,
  type WenScreenCatalogEntry,
} from './figmaScreenCatalog'

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

// ============================================================
// 扫描目录（figmaScreenCatalog）读取
//
// 插件按组件切图，OSS 上同一篇课文会有几十份重复的标题图/按钮图，
// 由 scripts/gen-figma-screen-catalog.mjs 按「篇目 × 角色」折叠成静态目录。
// 目录来自 OSS 清单接口，路径本身即事实，读取时不再逐张 HEAD 探测：
// 图片加载失败由组件 @error 回退到文字/纯 CSS。
// ============================================================

/**
 * 归一化篇目 ID：'WEN_2' / '2' / 'WEN_02' → 'WEN_02'
 */
export function normalizeWenId(wenId: string | null | undefined): string {
  const digits = String(wenId ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return `WEN_${String(parseInt(digits, 10)).padStart(2, '0')}`
}

/**
 * 取某篇课文的扫描资产目录；不存在返回 undefined
 */
export function getWenScreenCatalog(
  wenId: string | null | undefined,
): WenScreenCatalogEntry | undefined {
  const id = normalizeWenId(wenId)
  return id ? FIGMA_SCREEN_CATALOG[id] : undefined
}

/** 目录条目 → OSS 完整 URL（路径已含 WEN_xx/<screenType>/） */
function getCatalogAssetUrl(ref: FigmaScreenAssetRef | undefined): string | null {
  if (!ref?.path) return null
  const safe = ref.path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return ossBase ? `${ossBase}/${SCREEN_DIR}/${safe}` : `/${SCREEN_DIR}/${safe}`
}

/** 整篇书法标题图 URL */
export function getWenScreenTitleUrl(wenId: string | null | undefined): string | null {
  return getCatalogAssetUrl(getWenScreenCatalog(wenId)?.title)
}

/** 通用角色图 URL（按钮、文本框、背景等） */
export function getWenScreenRoleUrl(
  wenId: string | null | undefined,
  role: FigmaScreenRole,
): string | null {
  return getCatalogAssetUrl(getWenScreenCatalog(wenId)?.roles[role])
}

/** 选项底图 URL（A/B/C/D） */
export function getWenScreenOptionUrl(
  wenId: string | null | undefined,
  option: FigmaOptionKey,
): string | null {
  return getCatalogAssetUrl(getWenScreenCatalog(wenId)?.options[option])
}

/** 文本框图 URL（summary/homework/proverb/poem/explanation） */
export function getWenScreenTextBoxUrl(
  wenId: string | null | undefined,
  role: FigmaTextBoxRole,
): string | null {
  return getCatalogAssetUrl(getWenScreenCatalog(wenId)?.textBoxes[role])
}

/** 角色立绘 URL（按扫描文件名里的角色键，如 'chen_sheng'） */
export function getWenScreenAvatarUrl(
  wenId: string | null | undefined,
  characterKey: string,
): string | null {
  return getCatalogAssetUrl(getWenScreenCatalog(wenId)?.avatars[`avatar_${characterKey}`])
}

/** 角色名牌/小像 URL（10–18KB，适合直接上屏） */
export function getWenScreenCharacterCardUrl(
  wenId: string | null | undefined,
  characterKey: string,
): string | null {
  return getCatalogAssetUrl(
    getWenScreenCatalog(wenId)?.characterCards[`card_character_${characterKey}`],
  )
}
