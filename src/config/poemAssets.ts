/**
 * 素材可用性清单（poemAssets）
 *
 * 作用：记录「某个编号在 OSS 上到底有没有对应素材」，
 * 供首页选篇置灰、规则页降级提示使用，避免学生点进 404 黑屏。
 *
 * 口径说明（重要）：
 * - 这里一律用 wenId 编号口径（'13' ↔ WEN_13）。RULE_VIDEO_MISSING_POEM_IDS
 *   只描述**文件是否存在**，与编号对应哪篇课文无关，重排编号后依然成立。
 * - NUMBERING_CONFIRMED_POEM_IDS 是另一回事：它描述「这个号对应哪篇课文确认了没有」，
 *   是放行判据的第二条。篇目名本身在 wenUtils.poemMap。
 * - 数据来源：2026-10-23 对生产 OSS
 *   `https://www.classicalab.cn/video/{wenId}_rule_{bg|1|2|3}.mp4`
 *   逐文件 HEAD 探测（规则见 scripts/check-video-inventory.sh），
 *   以及 `https://www.classicalab.cn/data/culture_cards/{wenId}.json` 探测。
 * - 前端直连 OSS 取资源（src/utils/asset.ts 的 getAssetUrl），
 *   不经过后端，所以「能不能播」只取决于 OSS 上有没有这个 key。
 *
 * 更新方式：存在性列表跑 `scripts/check-video-inventory.sh` 重新生成；
 * 确认列表由内容组给的编号对照表直接增删。改动只落在本文件与 wenUtils.poemMap。
 */

/**
 * rule 视频（4 个：_rule_bg / _rule_1 / _rule_2 / _rule_3）全缺的编号。
 * 探测结果：这些编号在 OSS 上连任何扩展名/大小写变体都没有，是真的还没交付。
 */
export const RULE_VIDEO_MISSING_POEM_IDS: readonly string[] = ['13', '16', '17', '33', '34']

/**
 * 编号 ↔ 篇目**已确认**的号位（内容组 2026-10-28 分两批给的对照表：01–19、22、24–27）。
 *
 * 为什么要把「编号是否确认」单独建表：实测发现 OSS 上素材用的编号，
 * 与旧 poemMap 按教材顺序硬排的推测从 05 起整体错位（旧表把《湖心亭看雪》排在 23，
 * 确认表里它是 10）。剩下 13 个号（20、21、23、28–37）的篇目还没确认，
 * 在确认之前**不能**把它们配到任何篇名上放给学生进——那等于张冠李戴。
 *
 * 判据来源：内容组确认的对照表（2026-10-28）。
 * scripts/check-asset-correspondence.sh 能查覆盖与归属、并把每篇的页面标题图
 * images/screens/WEN_nn/video/article_title_*.png 拉下来供人工比对，但**别拿它当篇名结论**：
 * 书法体标题图识别错过 6 处（08 读成「醉翁」实为《咏雪》、22 读成「秋」实为《狼》、
 * 24–27 读成 孟子三章/虽有佳肴/大道之行/鱼我所欲也，实为 送东阳马生序/出师表/三峡/答谢中书书），
 * 所以这张表只认内容组确认的结果，不认图识别结果。
 */
export const NUMBERING_CONFIRMED_POEM_IDS: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '22',
  '24',
  '25',
  '26',
  '27',
]

/** 全部号位 1–37（素材上传工具要能选到未确认的号，美术是按号交付的） */
export const ALL_POEM_IDS: readonly string[] = Array.from({ length: 37 }, (_, i) => String(i + 1))

/**
 * culture_cards 数据 JSON 已存在的编号（**仓库口径**：`public/data/culture_cards/` 里有这个文件）。
 * 只有这些编号的第三关会渲染出文化卡片；其余编号即使 OSS 上有卡片视频文件，
 * 也因为没有任何 JSON 引用而永远加载不到（属于「素材已交付但未挂载」）。
 *
 * 2026-10-28 按「视频平铺在 /video/、文件名即 WEN_nn_card_<标识>.mp4」的约定，
 * 把已交付的卡片视频按号位挂成 JSON，一次补了 06–13、17、18、22 共 11 篇。
 * ⚠ 这份是仓库状态，不等于线上：`scripts/check-video-inventory.sh` 探的是线上 OSS，
 * 发版之前去跑它会给出「只有 01–04」，别照抄回来覆盖这一行。
 */
export const CULTURE_CARD_DATA_POEM_IDS: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
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
]

/**
 * OSS 上已交付、但还没被 culture_cards JSON 引用的卡片视频**编号**。
 *
 * 2026-10-28 按命名约定（视频平铺在 /video/，文件名 `WEN_nn_card_<标识>.mp4`，nn 即号位）
 * 把 24 个孤儿里号位已确认的都挂上了，现在只剩 23 号位的 2 个文件——它们不是漏挂，
 * 是**号位↔篇目还没确认**，挂了等于把素材按错的篇目播给学生。逐文件清单见 docs/素材缺失清单.md 第二节。
 *
 * 挂载时 knowledge_text 的两类处理：有抽帧字幕佐证的写成事实性导语（06 林则徐发配伊犁 /
 * 左宗棠在哈密、07 伊犁将军统辖天山南北、08+11 库尔班大叔、04 奶馕），以及文件名即人名的
 * （weizheng→魏征、zhangqian→张骞、zuozongtang→左宗棠）；其余留空字符串——
 * `CultureCards.vue:125` 是 `v-if="card.knowledge_text"`，空值不渲染字幕，不会把占位文字漏给学生，
 * 等内容组给正文再填。
 * ⚠ 全部改动要发出去才在线上生效：`public/data/` 被 .gitignore 忽略（历史上靠 git add -f 入库），
 * 新加的 11 份 JSON 不加 -f 就进不了构建，线上照旧 404。详见 docs/素材缺失清单.md 第二节。
 */
export const ORPHAN_CARD_VIDEO_POEM_IDS: readonly string[] = ['23']

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
 * 该编号的「编号 ↔ 篇目」对照是否已由内容组确认。
 *
 * 未确认的号位上素材可能是**另一篇**课文的（编号错位），
 * 所以即使文件都在 OSS 上，也不能放学生进去——那等于张冠李戴。
 * @param id - poemId 或 wenId
 */
export function isNumberingConfirmed(id: string | undefined | null): boolean {
  return NUMBERING_CONFIRMED_POEM_IDS.includes(toPoemId(id))
}

/**
 * 该编号现在能不能让学生走完整流程。
 * 判据两条：rule 视频齐备（缺了直接黑屏）+ 编号对应关系已确认（没确认就不知道
 * 这个号上的素材到底是哪一篇）。缺文化卡片只影响第三关的一个附加环节，不放行条件里。
 * @param id - poemId 或 wenId
 */
export function isPoemReady(id: string | undefined | null): boolean {
  return hasRuleVideo(id) && isNumberingConfirmed(id)
}
