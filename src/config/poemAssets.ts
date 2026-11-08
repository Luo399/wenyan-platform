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
 * 编号 ↔ 篇目**已确认**的号位（内容组 2026-10-28 分两批给的对照表：01–19、22、24–27；
 * 23 由用户 2026-10-29 确认为《活板》）。
 *
 * 为什么要把「编号是否确认」单独建表：实测发现 OSS 上素材用的编号，
 * 与旧 poemMap 按教材顺序硬排的推测从 05 起整体错位（旧表把《湖心亭看雪》排在 23，
 * 确认表里它是 10）。剩下 12 个号（20、21、28–37）的篇目还没确认，
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
  '23',
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
 * 2026-10-29 再补 23（《活板》，见 `ORPHAN_CARD_VIDEO_POEM_IDS` 的说明），现在 16 个号。
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
  '23',
]

/**
 * 三关学习 + 课文详情需要的文本数据 JSON 已存在的编号。
 *
 * 判据目录：text_basic_info（详情/字词原文）、word_list（字词注释）、
 * multi_role_reading（多角色朗读）、level1_quiz（第一关随堂练习）。
 * 第二、三关的页面数据另有独立清单（LEVEL2_PAGE_DATA_POEM_IDS /
 * LEVEL3_PAGE_DATA_POEM_IDS），不再和这里绑在一起——2026-10-30 补齐了
 * WEN_05–19、22–27 的第二/三关页面 JSON，但原文/字词/朗读/第一关仍然只有
 * 01–04，若继续共用一张表，第二、三关会被第一关的缺失一起挡成「制作中」。
 *
 * 2026-10-30 晚：Figma 上传的原始文字资源（`data/texts/文字资源_<篇名>.json`，
 * 26 份）已经存在，用 `scripts/gen-step1-page-data.cjs` 生成页面层 JSON，
 * text_basic_info / word_list 补到 20 个号位（01–05、07–19、22、23），
 * 于是 05、07–19、22、23 的第一关不再显示「制作中」。
 *
 * 仍然缺的号位及原因：
 * - 06（醉翁亭记）：原始文字资源里没有这篇，无源可转；
 * - 24–27：Figma 资源内嵌编号与内容组确认表冲突（Figma 的 24 是《孟子》三章、
 *   25 是《虽有佳肴》、26 是《大道之行也》、27 是《鱼我所欲也》），生成脚本
 *   按篇名校验后拒绝输出，宁可「制作中」也不能在 24 号位放另一篇课文。
 *   详见 docs/素材对应核查.md。
 *
 * 这张表**不参与首页放行**（用户 2026-10-30 口径：入口只拦截未确认编号的号位），
 * 只供 StepView/DetailView 在进页后按 hasTextData 判断：缺数据时展示「制作中」占位，
 * 不再把请求打出去看 HTTP 404。
 *
 * ⚠ 这是静态快照：内容组补传 JSON 后要同步改这里并重新发版；
 * 只传 OSS 不改表，学生侧仍会看到「制作中」。
 */
export const TEXT_DATA_POEM_IDS: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
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
  '23',
]

/**
 * multi_role_reading 朗读 JSON 已存在的编号（第一关音频区块能否渲染）。
 *
 * 比 TEXT_DATA_POEM_IDS 少 13/14/16/17 四篇，原因都在音频文件本身：
 * - 13、16、17：`WEN_nn_multi_role.mp3` 线上 404，内容组还没交付；
 * - 14：OSS 上的 `WEN_14_multi_role.mp3` 与 WEN_05 的文件逐字节相同（内容错配），
 *   挂上去会放《唐雎不辱使命》的录音给《论语》十二章。
 * 缺音频时第一关仍可读原文/注释，只把朗读区块换成「音频制作中」占位。
 *
 * 另注：这 20 篇里 05–23 的朗读 JSON 只有**一个整篇段落**（角色名「课文朗读」），
 * 因为原始文字资源没有角色和时间轴；01–04 是人工校对的逐句多角色版本。
 */
export const MULTI_ROLE_AUDIO_POEM_IDS: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '15',
  '18',
  '19',
  '22',
  '23',
]

/**
 * 第二关（pages_level2_dialog_quiz）页面 JSON 已存在的编号。
 *
 * 2026-10-30 产出 05–19、22–27，加上原有 01–04，共 25 篇；
 * 其余 12 个未确认号位没有对应篇目，也不产出页面内容。
 */
export const LEVEL2_PAGE_DATA_POEM_IDS: readonly string[] = [
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
  '23',
  '24',
  '25',
  '26',
  '27',
]

/**
 * 第三关（pages_level3_adaptive_quiz）页面 JSON 已存在的编号。
 * 与第二关同步产出 05–19、22–27，加上原有 01–04，共 25 篇。
 */
export const LEVEL3_PAGE_DATA_POEM_IDS: readonly string[] = [
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
  '23',
  '24',
  '25',
  '26',
  '27',
]

/**
 * OSS 上已交付、但还没被 culture_cards JSON 引用的卡片视频**编号**。
 *
 * 2026-10-28 按命名约定（视频平铺在 /video/，文件名 `WEN_nn_card_<标识>.mp4`，nn 即号位）
 * 把 24 个孤儿里号位已确认的都挂上了，只剩 23 号位的 2 个文件——当时卡在「号位↔篇目未确认」，
 * 2026-10-29 用户确认 23 = 《活板》后障碍解除，同日按同一口径补出 `WEN_23.json`
 * （public 与 backend 两份逐字节一致），**这张表因此清空**。
 *
 * ⚠ 清空只说明「OSS 上没有没人引用的卡片视频了」，不代表 23 号位的卡片已经上线：
 * `public/data/culture_cards/WEN_23.json` 要随前端构建发出去才在线上可见，
 * 发版前 `https://www.classicalab.cn/data/culture_cards/WEN_23.json` 仍是 404。
 * `card_paper` / `card_printing` 与《活板》讲雕版/活字印刷对得上，
 * 这条归属结论来自号位命名约定，没抽帧验过画面；两张卡的 `knowledge_text` 都留空串，
 * 导语等内容组给正文再填。逐文件清单见 docs/素材缺失清单.md 第二节。
 *
 * 挂载时 knowledge_text 的两类处理：有抽帧字幕佐证的写成事实性导语（06 林则徐发配伊犁 /
 * 左宗棠在哈密、07 伊犁将军统辖天山南北、08+11 库尔班大叔、04 奶馕），以及文件名即人名的
 * （weizheng→魏征、zhangqian→张骞、zuozongtang→左宗棠）；其余留空字符串——
 * `CultureCards.vue:125` 是 `v-if="card.knowledge_text"`，空值不渲染字幕，不会把占位文字漏给学生，
 * 等内容组给正文再填。
 * ⚠ 全部改动要发出去才在线上生效：`public/data/` 被 .gitignore 忽略（历史上靠 git add -f 入库），
 * 新加的 12 份 JSON 不加 -f 就进不了构建，线上照旧 404。详见 docs/素材缺失清单.md 第二节。
 */
export const ORPHAN_CARD_VIDEO_POEM_IDS: readonly string[] = []

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
 * 该编号的文本数据 JSON 是否存在（三关 + 详情页能否渲染）
 * @param id - poemId 或 wenId
 */
export function hasTextData(id: string | undefined | null): boolean {
  return TEXT_DATA_POEM_IDS.includes(toPoemId(id))
}

/**
 * 该编号的多角色朗读音频 JSON 是否存在（第一关朗读区块能否渲染）
 * @param id - poemId 或 wenId
 */
export function hasMultiRoleAudio(id: string | undefined | null): boolean {
  return MULTI_ROLE_AUDIO_POEM_IDS.includes(toPoemId(id))
}

/**
 * 该编号的第二关页面数据 JSON 是否存在（pages_level2_dialog_quiz）
 * @param id - poemId 或 wenId
 */
export function hasLevel2PageData(id: string | undefined | null): boolean {
  return LEVEL2_PAGE_DATA_POEM_IDS.includes(toPoemId(id))
}

/**
 * 该编号的第三关页面数据 JSON 是否存在（pages_level3_adaptive_quiz）
 * @param id - poemId 或 wenId
 */
export function hasLevel3PageData(id: string | undefined | null): boolean {
  return LEVEL3_PAGE_DATA_POEM_IDS.includes(toPoemId(id))
}

/**
 * 该编号的首页入口是否放行。
 * 判据两条：rule 视频齐备（缺了直接黑屏）+ 编号对应关系已确认（没确认就不知道
 * 这个号上的素材到底是哪一篇）。
 *
 * 文本数据缺失**不挡入口**（用户 2026-10-30 明确：制作中只拦截未确定编号的）。
 * 05–27 这类编号已确认但 JSON 未交付的号位照常可点，进入步骤页/详情页后由
 * hasTextData 换成「制作中」占位，既不发请求也不暴露 404。
 * 缺文化卡片只影响第三关的一个附加环节，同样不放行条件里。
 * @param id - poemId 或 wenId
 */
export function isPoemReady(id: string | undefined | null): boolean {
  return hasRuleVideo(id) && isNumberingConfirmed(id)
}

/**
 * 规则介绍视频现在能不能播：rule 视频齐备 + 编号已确认。
 *
 * 单独留一个语义名，是为了让规则页不必跟着首页入口策略走：
 * 以后入口若再收紧，规则页仍能凭素材本身决定播不播。
 * @param id - poemId 或 wenId
 */
export function canPlayRuleVideo(id: string | undefined | null): boolean {
  return hasRuleVideo(id) && isNumberingConfirmed(id)
}
