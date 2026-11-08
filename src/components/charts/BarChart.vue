<!--
  BarChart.vue - 手写柱状/条形图

  用途：班级使用率、每小时提交分布、题型正确率等「类目 × 单值」比较。
  没有引入图表库：所有形状由 chartUtils 的纯函数算坐标后拼 SVG，
  因此可以随页面缩放（viewBox + width:100%），也不需要在生产包里塞 200KB echarts。

  orientation="horizontal" 时给长标签（学校名、年级）用；
  vertical 时标签截断到 6 个字符，靠 <title> 悬浮显示全文。
-->
<template>
  <div v-if="hasData" class="bar-chart" data-testid="bar-chart">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      class="bar-svg"
      role="img"
      :aria-label="ariaLabel"
    >
      <!-- 网格与刻度（仅纵向图需要横向网格线） -->
      <g v-if="orientation === 'vertical'" class="grid-layer">
        <line
          v-for="tick in ticks"
          :key="`grid-${tick}`"
          :x1="axisOffset"
          :x2="width - axisOffset"
          :y1="valueToY(tick, axisMax, innerHeight) + plotTop"
          :y2="valueToY(tick, axisMax, innerHeight) + plotTop"
          class="grid-line"
        />
        <text
          v-for="tick in ticks"
          :key="`tick-${tick}`"
          :x="axisOffset - 6"
          :y="valueToY(tick, axisMax, innerHeight) + plotTop + 3"
          class="tick-text"
          text-anchor="end"
        >
          {{ formatValue(tick) }}
        </text>
      </g>

      <!-- 条形 -->
      <g
        v-for="(item, index) in items"
        :key="`${item.label}-${index}`"
        class="bar-group"
      >
        <template v-if="orientation === 'vertical'">
          <rect
            :x="axisOffset + bandCenter(index, items.length, innerWidth) - barPixelWidth / 2"
            :y="plotTop + valueToY(positive(item.value), axisMax, innerHeight)"
            :width="barPixelWidth"
            :height="barHeight(item.value)"
            :fill="color"
            rx="2"
          >
            <title>{{ item.label }}：{{ displayValue(item.value) }}{{ unit }}</title>
          </rect>
          <text
            :x="axisOffset + bandCenter(index, items.length, innerWidth)"
            :y="plotTop + valueToY(positive(item.value), axisMax, innerHeight) - 4"
            class="bar-value"
            text-anchor="middle"
          >
            {{ displayValue(item.value) }}
          </text>
          <text
            :x="axisOffset + bandCenter(index, items.length, innerWidth)"
            :y="height - 6"
            class="axis-text"
            text-anchor="middle"
          >
            {{ truncate(item.label) }}
            <title>{{ item.label }}</title>
          </text>
        </template>

        <template v-else>
          <rect
            :x="labelWidth"
            :y="rowTop(index) + rowGap / 2"
            :width="rowLength(item.value)"
            :height="rowHeight"
            :fill="color"
            rx="2"
          >
            <title>{{ item.label }}：{{ displayValue(item.value) }}{{ unit }}</title>
          </rect>
          <text :x="labelWidth - 8" :y="rowTop(index) + rowHeight / 2 + 4" class="axis-text" text-anchor="end">
            {{ truncate(item.label, 10) }}
            <title>{{ item.label }}</title>
          </text>
          <text
            :x="labelWidth + rowLength(item.value) + 6"
            :y="rowTop(index) + rowHeight / 2 + 4"
            class="bar-value"
          >
            {{ displayValue(item.value) }}{{ unit }}
          </text>
        </template>
      </g>

      <!-- 基线 -->
      <line
        v-if="orientation === 'vertical'"
        :x1="axisOffset"
        :x2="width - axisOffset"
        :y1="plotTop + innerHeight"
        :y2="plotTop + innerHeight"
        class="axis-line"
      />
      <line
        v-else
        :x1="labelWidth"
        :x2="labelWidth"
        :y1="plotTop"
        :y2="plotTop + innerHeight"
        class="axis-line"
      />
    </svg>
  </div>
  <div v-else class="chart-empty" data-testid="bar-chart-empty">{{ emptyText }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  bandCenter,
  bandWidth,
  buildTicks,
  formatValue,
  niceCeil,
  valueToY,
  type ChartDatum,
} from './chartUtils'

export interface BarChartProps {
  items: ChartDatum[]
  /** 数值单位后缀，如 % 或 次 */
  unit?: string
  /** 手工上限（百分比图固定 100 用），缺省按数据 niceCeil */
  maxValue?: number
  /** vertical 适合短标签类目，horizontal 适合学校/年级这类长标签 */
  orientation?: 'vertical' | 'horizontal'
  width?: number
  height?: number
  color?: string
  emptyText?: string
  /** 小数位；整数不受影响 */
  digits?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<BarChartProps>(), {
  unit: '',
  maxValue: 0,
  orientation: 'vertical',
  width: 640,
  height: 240,
  color: 'var(--color-primary)',
  emptyText: '暂无数据',
  digits: 1,
  ariaLabel: '柱状图',
})

/** 轴文字与图的间距 */
const axisOffset = 34
/** 顶部留给数值文字 */
const plotTop = 18
/** horizontal 时左侧标签列宽 */
const labelWidth = 130

const hasData = computed(() => props.items.some((item) => Number.isFinite(item.value)))
/**
 * 绘图区宽度要留给「轴文字」：
 * - 纵向：两侧各 axisOffset 给 y 轴刻度
 * - 横向：左边 labelWidth 给类目标签，右边 56px 给条末数值
 */
const innerWidth = computed(() =>
  props.orientation === 'horizontal'
    ? Math.max(10, props.width - labelWidth - 56)
    : Math.max(10, props.width - axisOffset * 2),
)
const innerHeight = computed(() => props.height - plotTop - 26)

const axisMax = computed(() => {
  if (props.maxValue > 0) return props.maxValue
  const dataMax = props.items.reduce((max, item) => Math.max(max, positive(item.value)), 0)
  return niceCeil(dataMax)
})

const ticks = computed(() => buildTicks(axisMax.value, 4))

/** 柱宽按类目数自适应，上限 48px */
const barPixelWidth = computed(() => bandWidth(props.items.length, innerWidth.value))

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function barHeight(value: number): number {
  const y = valueToY(positive(value), axisMax.value, innerHeight.value)
  return Math.max(0, innerHeight.value - y)
}

/** horizontal 模式的行几何 */
const rowCount = computed(() => Math.max(1, props.items.length))
const rowSlot = computed(() => innerHeight.value / rowCount.value)
const rowHeight = computed(() => Math.max(6, Math.min(26, rowSlot.value * 0.66)))
const rowGap = computed(() => rowSlot.value - rowHeight.value)

function rowTop(index: number): number {
  return plotTop + index * rowSlot.value
}

function rowLength(value: number): number {
  const ratio = axisMax.value > 0 ? positive(value) / axisMax.value : 0
  return Math.max(0, ratio * innerWidth.value)
}

function truncate(label: string, limit = 6): string {
  const text = String(label ?? '')
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function displayValue(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(props.digits).replace(/\.0$/, '')
}
</script>

<style scoped>
.bar-chart {
  width: 100%;
  overflow-x: auto;
}

.bar-svg {
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

.bar-value {
  font-size: 10px;
  fill: var(--color-text);
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
