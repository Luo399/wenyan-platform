// ============================================================
// 共享格式化工具：供 AnswerQueryView 及其子组件复用
// ============================================================

/**
 * 格式化日期字符串为本地化展示
 * @param dateStr 日期字符串，可能为 undefined
 * @returns 格式化后的日期字符串，空值返回 '-'
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  // R100: 校验无效日期，避免 UI 显示 "Invalid Date"
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

/**
 * 格式化答题答案：数组拼接为字符串，其他类型转字符串，空值返回 '-'
 * @param answer 原始答案
 * @returns 格式化后的字符串
 */
export function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return '-'
  if (Array.isArray(answer)) return answer.join(', ')
  return String(answer)
}
