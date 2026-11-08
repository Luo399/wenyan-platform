/**
 * 图表组件桶（对外唯一入口）
 *
 * 项目约定「对外桶、对内直、禁自引」：页面从 '@/components/charts' 引，
 * charts 内部组件之间用相对路径（./chartUtils），不回头引本桶。
 *
 * 全部手写 SVG，零图表依赖——后端返回的是聚合好的小数据（几十到几百个点），
 * 引第三方图表库的收益远小于它的包体积。
 */

export { default as StatCard } from './StatCard.vue'
export { default as ProgressRing } from './ProgressRing.vue'
export { default as BarChart } from './BarChart.vue'
export { default as LineChart } from './LineChart.vue'
export { default as HeatmapChart } from './HeatmapChart.vue'

export type { ChartDatum, ChartSeries, HeatmapCell, HeatmapRow } from './chartUtils'

export {
  axisLabelIndices,
  bandCenter,
  bandWidth,
  buildTicks,
  CHART_PALETTE,
  formatPercent,
  formatValue,
  heatFill,
  heatTextColor,
  linePath,
  niceCeil,
  ringGeometry,
  shortDate,
  valueToY,
} from './chartUtils'
