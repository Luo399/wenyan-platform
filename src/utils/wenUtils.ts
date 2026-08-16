/**
 * 文言文平台工具函数
 *
 * 提供课文相关的公共工具函数，供多个组件和页面复用
 */

/**
 * 诗文条目类型
 * 用于统一描述一篇诗文的完整标识信息
 */
export interface PoemEntry {
  /** 完整 wenId 格式，如 WEN_01 */
  wenId: string
  /** 纯数字 poemId 字符串，如 '1' */
  poemId: string
  /** 篇目标题（UI 显示用，长标题做简写处理） */
  title: string
}

/**
 * 篇目数据映射
 * 用于根据 poemId 获取篇目标题
 * key 为纯数字字符串（'1' ~ 'n'），顺序与真实 WEN_XX 数据文件一致
 */
/**
 * 37 篇古文完整映射
 * 按部编版教材顺序排列，与 WEN_01 ~ WEN_37 一一对应
 */
export const poemMap: Record<string, { title: string }> = {
  '1': { title: '论语十二章' },
  '2': { title: '诫子书' },
  '3': { title: '陋室铭' },
  '4': { title: '爱莲说' },
  '5': { title: '孟子三章' },
  '6': { title: '虽有嘉肴' },
  '7': { title: '大道之行' },
  '8': { title: '鱼我所欲也' },
  '9': { title: '马说' },
  '10': { title: '送东阳马生序' },
  '11': { title: '出师表' },
  '12': { title: '三峡' },
  '13': { title: '答谢中书书' },
  '14': { title: '记承天寺夜游' },
  '15': { title: '与朱元思书' },
  '16': { title: '桃花源记' },
  '17': { title: '小石潭记' },
  '18': { title: '核舟记' },
  '19': { title: '岳阳楼记' },
  '20': { title: '醉翁亭记' },
  '21': { title: '湖心亭看雪' },
  '22': { title: '孙权劝学' },
  '23': { title: '卖油翁' },
  '24': { title: '周亚夫军细柳' },
  '25': { title: '唐雎不辱使命' },
  '26': { title: '陈涉世家' },
  '27': { title: '曹刿论战' },
  '28': { title: '邹忌讽齐王纳谏' },
  '29': { title: '穿井得一人' },
  '30': { title: '杞人忧天' },
  '31': { title: '愚公移山' },
  '32': { title: '北冥有鱼' },
  '33': { title: '庄子与惠子' },
  '34': { title: '咏雪' },
  '35': { title: '陈太丘与友期行' },
  '36': { title: '狼' },
  '37': { title: '活板' },
}

/**
 * 获取全部诗文列表（按 poemId 升序）
 * 供组件 v-for 直接使用，避免硬编码重复维护
 * @returns 按 poemId 升序排列的诗文数组
 */
export function getAllPoems(): PoemEntry[] {
  // poemMap key 为数字字符串，按升序排序生成稳定的列表顺序
  const sortedKeys = Object.keys(poemMap).sort((a, b) => Number(a) - Number(b))
  return sortedKeys.map((poemId) => {
    const entry = poemMap[poemId]
    return {
      poemId,
      wenId: `WEN_${poemId.padStart(2, '0')}`,
      // entry 由 Object.keys(poemMap) 枚举，必定存在，使用非空断言
      title: entry!.title,
    }
  })
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
