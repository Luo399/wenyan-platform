/**
 * 素材可用性清单（poemAssets）
 *
 * 作用：记录「某个编号在 OSS 上到底有没有对应素材」，
 * 供首页选篇置灰、规则页降级提示使用，避免学生点进 404 黑屏。
 *
 * 口径说明（重要）：
 * - 这里一律用 wenId 编号口径（'13' ↔ WEN_13），只描述**文件是否存在**，
 *   不描述编号对应哪一篇课文。篇目编号对照表另见 wenUtils.poemMap，
 *   两者即使后续重排编号，这张表的「存在性」结论依然成立。
 * - 数据来源：2026-10-23 对生产 OSS
 *   `https://www.classicalab.cn/video/{wenId}_rule_{bg|1|2|3}.mp4`
 *   逐文件 HEAD 探测（规则见 scripts/check-video-inventory.sh），
 *   以及 `https://www.classicalab.cn/data/culture_cards/{wenId}.json` 探测。
 * - 前端直连 OSS 取资源（src/utils/asset.ts 的 getAssetUrl），
 *   不经过后端，所以「能不能播」只取决于 OSS 上有没有这个 key。
 *
 * 更新方式：跑 `scripts/check-video-inventory.sh` 重新生成，改动只落在本文件。
 */

/**
 * rule 视频（4 个：_rule_bg / _rule_1 / _rule_2 / _rule_3）全缺的编号。
 * 探测结果：这些编号在 OSS 上连任何扩展名/大小写变体都没有，是真的还没交付。
 */
export const RULE_VIDEO_MISSING_POEM_IDS: readonly string[] = ['13', '16', '17', '33', '34']

/**
 * culture_cards 数据 JSON 已存在的编号。
 * 只有这些编号的第三关会渲染出文化卡片；其余编号即使 OSS 上有卡片视频文件，
 * 也因为没有任何 JSON 引用而永远加载不到（属于「素材已交付但未挂载」）。
 */
export const CULTURE_CARD_DATA_POEM_IDS: readonly string[] = ['1', '2', '3', '4']

/**
 * OSS 上存在、但没有任何 culture_cards JSON 引用的卡片视频编号。
 * 这些是「做了没挂上」的素材，等编号对照表确认后再决定挂到哪一篇。
 */
export const ORPHAN_CARD_VIDEO_POEM_IDS: readonly string[] = [
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '17',
  '18',
  '22',
  '23',
]

/** 素材未就绪时统一展示给学生的文案（不要暴露 404/技术细节） */
export const ASSET_NOT_READY_TEXT = '本篇素材正在制作中，敬请期待'

/**
 * 把任意 ID 口径归一为纯数字 poemId 字符串（'WEN_13' / '13' / '013' → '13'）
 */
function toPoemId(id: string | undefined | null): string {
  if (!id) return ''
  const digits = String(id).replace(/\D/g, '')
  if (!digits) return ''
  return String(parseInt(digits, 10))
}

/**
 * 该编号的 rule 视频是否可用（4 段规则介绍视频齐备才放行）
 * @param id - poemId（'13'）或 wenId（'WEN_13'）
 */
export function hasRuleVideo(id: string | undefined | null): boolean {
  return !RULE_VIDEO_MISSING_POEM_IDS.includes(toPoemId(id))
}

/**
 * 该编号是否有 culture_cards 数据 JSON（第三关文化卡片能否渲染）
 * @param id - poemId 或 wenId
 */
export function hasCultureCardData(id: string | undefined | null): boolean {
  return CULTURE_CARD_DATA_POEM_IDS.includes(toPoemId(id))
}

/**
 * 该编号现在能不能让学生走完整流程。
 * 当前判据只看 rule 视频：缺了会直接黑屏；缺卡片只影响第三关的一个附加环节。
 * @param id - poemId 或 wenId
 */
export function isPoemReady(id: string | undefined | null): boolean {
  return hasRuleVideo(id)
}
