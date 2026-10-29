/**
 * 文言文平台工具函数
 *
 * 提供课文相关的公共工具函数，供多个组件和页面复用
 */

import { ALL_POEM_IDS, isPoemReady } from '@/config/poemAssets'

/**
 * 诗文条目类型
 * 用于统一描述一篇诗文的完整标识信息
 */
export interface PoemEntry {
  /** 完整 wenId 格式，如 WEN_01 */
  wenId: string
  /** 纯数字 poemId 字符串，如 '1' */
  poemId: string
  /** 篇目标题（UI 显示用，长标题做简写处理；编号未确认时为「编号待确认」） */
  title: string
  /**
   * 素材是否已就绪（rule 视频齐备 **且** 编号对应关系已确认）。
   * false 时选篇要置灰标「制作中」，不要让学生点进 404 黑屏或播到别的课文，
   * 判据来自 src/config/poemAssets.ts（按 OSS 实测结果 + 内容组对照表维护）。
   */
  ready: boolean
}

/**
 * 编号 ↔ 篇目映射（**只收录内容组已确认的号位**，2026-10-28 对照表）
 * key 为纯数字字符串（'1' ~ 'n'），与 OSS 上素材用的编号一致。
 *
 * 历史背景：这张表原先是 37 条，05 往后是按部编版教材顺序**推测**出来的，
 * 实测与 OSS 上美术/内容侧的编号从 05 起整体错位（旧表把《湖心亭看雪》排在 23，
 * 确认表里它是 10）。推测值留着等于把素材配错课文，所以整段删掉，
 * 只保留已确认的 24 个号（01–19、22、24–27）；其余 13 个号（20、21、23、28–37）待确认后加进来。
 *
 * 未确认的号位不要凭教材顺序或标题图识别结果补写——书法标题图实测识别错过 6 处
 * （08 读成「醉翁」实为《咏雪》、22 读成「秋」实为《狼》、24–27 读成
 * 孟子三章/虽有佳肴/大道之行/鱼我所欲也，实为 送东阳马生序/出师表/三峡/答谢中书书）。
 *
 * 标题按 UI 惯例做简写（全称「庄子与惠子游于濠梁之上」存为「庄子与惠子」）。
 */
export const poemMap: Record<string, { title: string }> = {
  '1': { title: '陈涉世家' },
  '2': { title: '马说' },
  '3': { title: '岳阳楼记' },
  '4': { title: '庄子与惠子' },
  '5': { title: '唐雎不辱使命' },
  '6': { title: '醉翁亭记' },
  '7': { title: '周亚夫军细柳' },
  '8': { title: '咏雪' },
  '9': { title: '卖油翁' },
  '10': { title: '湖心亭看雪' },
  '11': { title: '孙权劝学' },
  '12': { title: '邹忌讽齐王纳谏' },
  '13': { title: '曹刿论战' },
  '14': { title: '《论语》十二章' },
  '15': { title: '诫子书' },
  '16': { title: '穿井得一人' },
  '17': { title: '杞人忧天' },
  '18': { title: '愚公移山' },
  '19': { title: '陈太丘与友期行' },
  '22': { title: '狼' },
  '24': { title: '送东阳马生序' },
  '25': { title: '出师表' },
  '26': { title: '三峡' },
  '27': { title: '答谢中书书' },
}

/** 编号未确认的号位在素材上传工具里展示的占位标题 */
export const UNCONFIRMED_POEM_TITLE = '编号待确认'

function toEntry(poemId: string): PoemEntry {
  return {
    poemId,
    wenId: `WEN_${poemId.padStart(2, '0')}`,
    title: poemMap[poemId]?.title ?? UNCONFIRMED_POEM_TITLE,
    ready: isPoemReady(poemId),
  }
}

/**
 * 获取全部**已确认篇目**的诗文列表（按 poemId 升序）
 *
 * 学生侧选篇用这个：编号没确认的号位不进去，避免点进去播的是别的课文。
 * @returns 按 poemId 升序排列的诗文数组
 */
export function getAllPoems(): PoemEntry[] {
  // poemMap key 为数字字符串，按升序排序生成稳定的列表顺序
  const sortedKeys = Object.keys(poemMap).sort((a, b) => Number(a) - Number(b))
  return sortedKeys.map((poemId) => toEntry(poemId))
}

/**
 * 获取全部号位（1–37，含编号未确认的号）
 *
 * 素材上传/清单类工具用这个：美术是按号交付的，号位本身要能选到，
 * 只是没确认的号显示「编号待确认」且 ready 为 false。
 */
export function getAllPoemSlots(): PoemEntry[] {
  return ALL_POEM_IDS.map((poemId) => toEntry(poemId))
}

/**
 * 生成规范的 wenId（WEN_xx 格式）
 * @param id - 输入的 ID，可以是数字 "1" 或已格式化的 "WEN_01"
 * @returns 规范化的 wenId 格式
 */
export function getWenId(id: string): string {
  if (!id) return 'WEN_01'
  if (id.startsWith('WEN_')) return id
  const num = parseInt(id, 10)
  if (isNaN(num)) return 'WEN_01'
  return `WEN_${num.toString().padStart(2, '0')}`
}

/**
 * 根据 poemId 获取篇目标题
 * @param poemId - 篇目 ID
 * @returns 篇目标题，如果不存在则返回 '未知篇目'
 */
export function getPoemTitle(poemId?: string): string {
  if (!poemId) return '未知篇目'

  const id = poemId.startsWith('WEN_') ? poemId.replace('WEN_', '') : poemId

  const normalizedId = parseInt(id, 10).toString()

  return poemMap[normalizedId]?.title || '未知篇目'
}
