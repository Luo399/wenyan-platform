<!--
  LineChart.vue - 手写折线/面积趋势图

  用途：按日提交趋势、活跃学生数、新增学生数。
  多序列共用同一套坐标（values 与 labels 等长），缺省色取 CHART_PALETTE。

  与 BarChart 一样走 viewBox 缩放：不依赖 ResizeObserver，也不会在
  低配机上因为图表库的重排而卡顿；文字随图缩放是可接受的取舍。
-->
<template>
  <div v-if="hasData" class="line-chart" data-testid="line-chart">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      class="line-svg"
      role="img"
      :aria-label="ariaLabel"
    >
      <g class="grid-layer">
        <line
          v-for="tick in ticks"
          :key="`grid-${tick}`"
          :x1="axisOffset"
          :x2="width - axisOffset"
          :y1="plotTop + valueToY(tick, axisMax, innerHeight)"
          :y2="plotTop + valueToY(tick, axisMax, innerHeight)"
          class="grid-line"
        />
        <text
          v-for="tick in ticks"
          :key="`tick-${tick}`"
          :x="axisOffset - 6"
          :y="plotTop + valueToY(tick, axisMax, innerHeight) + 3"
          class="tick-text"
          text-anchor="end"
        >
          {{ formatValue(tick) }}
        </text>
      </g>

      <!-- 面积（只给第一条序列画，避免多色糊成一片） -->
      <path
        v-if="showArea && series[0]"
        :d="areaOf(series[0])"
        :fill="colorOf(0)"
        fill-opacity="0.12"
        stroke="none"
      />

      <g v-for="(line, lineIndex) in series" :key="`line-${line.name}`">
        <path
          :d="pathOf(line)"
          :stroke="colorOf(lineIndex)"
          stroke-width="2"
          fill="none"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          v-for="(point, index) in pointsOf(line)"
          :key="`dot-${line.name}-${index}`"
          :cx="point.x"
          :cy="point.y"
          :r="dotRadius(index, line)"
          :fill="colorOf(lineIndex)"
        >
          <title>{{ labels[index] }} · {{ line.name }}：{{ displayValue(line.values[index]) }}{{ unit }}</title>
        </circle>
      </g>

      <line :x1="axisOffset" :x2="width - axisOffset" :y1="plotTop + innerHeight" :y2="plotTop + innerHeight" class="axis-line" />

      <g class="x-labels">
        <text
          v-for="index in labelIndices"
          :key="`x-${index}`"
          :x="axisOffset + bandCenter(index, labels.length, innerWidth)"
          :y="height - 6"
          class="axis-text"
          text-anchor="middle"
        >
          {{ xLabel(labels[index]) }}
        </text>
      </g>
    </svg>

    <ul v-if="series.length > 1" class="chart-legend">
      <li v-for="(line, index) in series" :key="`legend-${line.name}`">
        <span class="legend-dot" :style="{ background: colorOf(index) }"></span>{{ line.name }}
      </li>
    </ul>
  </div>
  <div v-else class="chart-empty" data-testid="line-chart-empty">{{ emptyText }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  axisLabelIndices,
  bandCenter,
  buildTicks,
  CHART_PALETTE,
  formatValue,
  niceCeil,
  shortDate,
  valueToY,
  areaPath,
  linePath,
  type ChartSeries,
  type Point,
} from './chartUtils'

export interface LineChartProps {
  /** x 轴类目（一般是 YYYY-MM-DD） */
  labels: string[]
  series: ChartSeries[]
  unit?: string
  maxValue?: number
  width?: number
  height?: number
  showArea?: boolean
  emptyText?: string
  ariaLabel?: string
}

const props = withDefaults(defineProps<LineChartProps>(), {
  unit: '',
  maxValue: 0,
  width: 680,
  height: 240,
  showArea: true,
  emptyText: '暂无趋势数据',
  ariaLabel: '趋势折线图',
})

const axisOffset = 34
const plotTop = 16

const hasData = computed(
  () => props.labels.length > 0 && props.series.some((line) => line.values.some((v) => Number.isFinite(v) && v > 0)),
)
const innerWidth = computed(() => Math.max(10, props.width - axisOffset * 2))
const innerHeight = computed(() => props.height - plotTop - 26)

const axisMax = computed(() => {
  if (props.maxValue > 0) return props.maxValue
  const dataMax = props.series.reduce(
    (max, line) => Math.max(max, ...line.values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0)), 0),
    0,
  )
  return niceCeil(dataMax)
})

const ticks = computed(() => buildTicks(axisMax.value, 4))
const labelIndices = computed(() => axisLabelIndices(props.labels.length, 6))

function colorOf(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]
}

function pointsOf(line: ChartSeries): Point[] {
  return line.values.map((value, index) => ({
    x: bandCenter(index, props.labels.length, innerWidth.value),
    y: valueToY(Number.isFinite(value) && value > 0 ? value : 0, axisMax.value, innerHeight.value),
  }))
}

/** 平移进绘图区：points 是「绘图区内」相对坐标，模板里 path 需要加上边距 */
function pathOf(line: ChartSeries): string {
  return linePath(offset(pointsOf(line)))
}

function areaOf(line: ChartSeries): string {
  return areaPath(offset(pointsOf(line)), plotTop + innerHeight.value)
}

function offset(points: Point[]): Point[] {
  return points.map((p) => ({ x: p.x + axisOffset, y: p.y + plotTop }))
}

/** 点多时把非关键点的圆缩小，30 天曲线才不会「点比线还抢眼」 */
function dotRadius(index: number, line: ChartSeries): number {
  const isEdge = index === 0 || index === line.values.length - 1
  const isPeak = line.values[index] === Math.max(...line.values)
  if (line.values.length <= 10 || isEdge || isPeak) return 3
  return 1.5
}

function xLabel(raw: string): string {
  return shortDate(String(raw ?? ''))
}

function displayValue(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}
</script>

<style scoped>
.line-chart {
  width: 100%;
  overflow-x: auto;
}

.line-svg {
  display: block;
  max-width: 100%;
  height: auto;
  font-family: var(--font-family-serif);
}

.grid-line {
  stroke: var(--color-placeholder);
  stroke-width: 1;
}

.axis-line {
  stroke: var(--color-border);
  stroke-width: 1;
}

.tick-text,
.axis-text {
  font-size: 10px;
  fill: var(--color-text-secondary);
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-md);
  list-style: none;
  margin: var(--spacing-xs) 0 0;
  padding: 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.chart-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  border: var(--border-width-hairline) dashed var(--color-placeholder);
  border-radius: var(--radius-small);
}
</style>
