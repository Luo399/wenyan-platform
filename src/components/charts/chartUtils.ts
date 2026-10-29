/**
 * 图表几何与刻度工具（手写 SVG 看板共用）
 *
 * 项目零图表依赖（package.json 里没有 echarts/chart.js），所有形状由这些
 * 纯函数算出坐标、再由 components/charts/*.vue 拼成 SVG 元素。
 * 保持纯函数是为了能被 src/components/charts/__tests__ 直接用 vitest 断言，
 * 不依赖 DOM 尺寸。
 *
 * 坐标约定：调用方先算出绘图区宽高（innerWidth/innerHeight，已扣掉轴边距），
 * 这里的函数只负责把「数据值」映射到「绘图区内像素」。
 */

/** 轴标签 + 数值的最小单元，条形图与图例共用 */
export interface ChartDatum {
  label: string
  value: number
}

/** 折线序列：name 进图例，values 与 labels 一一对应 */
export interface ChartSeries {
  name: string
  values: number[]
  /** CSS 颜色；缺省按 CHART_PALETTE 取色 */
  color?: string
}

/** 热力图单元格：value 决定色深，title 是悬浮说明 */
export interface HeatmapCell {
  value: number
  title?: string
}

/** 热力图一行（一般是「一行 = 一篇文言文」） */
export interface HeatmapRow {
  key: string
  label: string
  cells: HeatmapCell[]
}

/**
 * 与 design-tokens 同源的取色顺序（赭红 → 墨绿 → 陶土 → 灰蓝）
 * 看板配色必须来自项目色板，不能引入第三方主题色。
 */
export const CHART_PALETTE = ['#851e0e', '#687857', '#c99471', '#1d4ed8', '#166534', '#9c9999']

/** 热力图底色：与 --color-primary 同色，靠透明度做 5 档阶梯 */
const HEAT_BASE_RGB = '133, 30, 14'

/** 0 值（未开始）用占位灰，避免和「答了但正确率为 0」撞色 */
const HEAT_EMPTY_FILL = '#f2f0ea'

export interface Point {
  x: number
  y: number
}

/**
 * 把任意上限收敛到「好看」的刻度顶（1 / 2 / 2.5 / 5 / 10 的十倍阶梯）
 * 例：37 → 50，143 → 200，0 → 1（避免除零）
 */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const base = Math.pow(10, exponent)
  const unit = value / base
  if (unit <= 1) return tidy(base * 1)
  if (unit <= 2) return tidy(base * 2)
  if (unit <= 2.5) return tidy(base * 2.5)
  if (unit <= 5) return tidy(base * 5)
  return tidy(base * 10)

  /**
   * 2.5 这个阶梯在 base=1 时本身就是小数，不能被 Math.round 抬成 3
   * （否则「3 道题」的图会顶到 3 而不是 2.5，刻度差一档就画不准）；
   * 整数值原样返回，非整数保留两位。
   */
  function tidy(n: number): number {
    return Number.isInteger(n) ? n : Math.round(n * 100) / 100
  }
}

/**
 * 生成含 0 与 max 的等分刻度，供网格线与 y 轴文字使用
 * @param max - 已经过 niceCeil 的上限
 * @param count - 分段数（默认 4 段 → 5 个刻度）
 */
export function buildTicks(max: number, count = 4): number[] {
  const safeMax = max > 0 ? max : 1
  const step = safeMax / count
  const ticks: number[] = []
  for (let i = 0; i <= count; i += 1) {
    ticks.push(Number((step * i).toFixed(Math.abs(step) < 1 ? 2 : 0)))
  }
  return ticks
}

/**
 * 类目轴的等分圆心坐标（条形图、按日折线都用它）
 * @param index - 类目序号
 * @param total - 类目总数
 * @param innerWidth - 绘图区宽度
 */
export function bandCenter(index: number, total: number, innerWidth: number): number {
  if (total <= 0) return 0
  return ((index + 0.5) / total) * innerWidth
}

/** 类目带宽（条形宽度上限 48px，留白随类目数自适应） */
export function bandWidth(total: number, innerWidth: number, maxBarWidth = 48): number {
  if (total <= 0) return 0
  return Math.max(2, Math.min(maxBarWidth, (innerWidth / total) * 0.62))
}

/** 数值轴 → 像素（自绘图区顶部起算，SVG 的 y 向下增长） */
export function valueToY(value: number, max: number, innerHeight: number): number {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return innerHeight - ratio * innerHeight
}

/** 把点串成折线 path（不足 2 点返回空串，交给调用方走空态） */
export function linePath(points: Point[]): string {
  if (points.length === 0) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' ')
}

/** 折线下方填充区域：闭合到底边，用于面积图观感 */
export function areaPath(points: Point[], innerHeight: number): string {
  if (points.length < 2) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${linePath(points)} L${fmt(last.x)},${fmt(innerHeight)} L${fmt(first.x)},${fmt(innerHeight)} Z`
}

/**
 * 圆环进度（ProgressRing）
 * 用 stroke-dasharray 而不是 path 弧：环形只表达单一比例时更短也更稳，
 * 且 percent=100 时不会出现「差 1px 看起来没闭合」的经典问题。
 */
export function ringGeometry(radius: number, percent: number): { circumference: number; dash: number } {
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(100, percent)) / 100
  return { circumference: round2(circumference), dash: round2(circumference * ratio) }
}

/**
 * 热力图色阶
 * @param ratio - 0~1 的完成比例（调用方已按列内最大值归一）
 * @returns 0 值给占位灰，其余给主色的 5 档透明度阶梯
 */
export function heatFill(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return HEAT_EMPTY_FILL
  const steps = [0.12, 0.28, 0.46, 0.66, 0.86]
  const index = Math.min(steps.length - 1, Math.floor(ratio * steps.length))
  return `rgba(${HEAT_BASE_RGB}, ${steps[index]})`
}

/** 深色底（高完成度）上换白字，保证对比度 */
export function heatTextColor(ratio: number): string {
  return Number.isFinite(ratio) && ratio >= 0.6 ? '#ffffff' : 'var(--color-text)'
}

/**
 * x 轴文字抽稀：最多显示 maxLabels 个，首尾必显示
 * 返回需要显示的索引集合，其余返回空串占位，避免刻度错位
 */
export function axisLabelIndices(total: number, maxLabels = 6): number[] {
  if (total <= 0) return []
  if (total <= maxLabels) return Array.from({ length: total }, (_, i) => i)
  const step = (total - 1) / (maxLabels - 1)
  const indices = new Set<number>()
  for (let i = 0; i < maxLabels; i += 1) indices.add(Math.round(i * step))
  indices.add(total - 1)
  return [...indices].sort((a, b) => a - b)
}

/** 日期串（YYYY-MM-DD）取 MM-DD 做轴标签，跨年时保留年份 */
export function shortDate(date: string): string {
  if (typeof date !== 'string' || date.length < 10) return date || ''
  const year = date.slice(0, 4)
  const tail = date.slice(5, 10)
  return year === String(new Date().getFullYear()) ? tail : `${year}-${tail}`
}

/** 数值展示：整数不带小数点，小数保留 1 位 */
export function formatValue(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(digits)
}

/** 百分比展示，统一带 %，空值显示 0% */
export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(digits).replace(/\.0$/, '')}%`
}

/** 坐标保留两位小数，SVG path 文本更短也更好比对 */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
