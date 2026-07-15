/**
 * 文言文平台工具函数
 *
 * 提供课文相关的公共工具函数，供多个组件和页面复用
 */

/**
 * 篇目数据映射
 * 用于根据 poemId 获取篇目标题
 */
export const poemMap: Record<string, { title: string }> = {
  '1': { title: '马说' },
  '2': { title: '陈涉世家' },
  '3': { title: '岳阳楼记' },
  '4': { title: '庄子与惠子' },
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
export function getPoemTitle(poemId: string): string {
  return poemMap[poemId]?.title || '未知篇目'
}
