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
export const poemMap: Record<string, { title: string }> = {
  '1': { title: '陈涉世家' },
  '2': { title: '马说' },
  '3': { title: '岳阳楼记' },
  '4': { title: '庄子与惠子' },
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
