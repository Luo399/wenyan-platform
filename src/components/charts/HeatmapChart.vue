<!--
  HeatmapChart.vue - 篇目 × 班级热力图

  单元格色深 = 该班在该篇的人均完成比例（后端 avg_progress，0~100）。
  为什么不用颜色表数值而用「比例」：正确率为 0 的篇目和没人答过的篇目
  在颜色上必须能区分开，未开始的格子走占位灰（见 chartUtils.heatFill）。

  行标签是篇目书名，可能较长；SVG 里截断到 8 字并用 <title> 保留全名，
  表格版（含完成人数/正确率）在页面下方另行给出，两者读同一份数据。
-->
<template>
  <div v-if="hasData" class="heatmap-chart" data-testid="heatmap-chart">
    <svg
      :viewBox="`0 0 ${totalWidth} ${totalHeight}`"
      :width="totalWidth"
      :height="totalHeight"
      class="heatmap-svg"
      role="img"
      :aria-label="ariaLabel"
    >
      <!-- 列头 -->
      <text
        v-for="(column, columnIndex) in columnLabels"
        :key="`col-${column}`"
        :x="cellStartX + columnIndex * cellWidth + cellWidth / 2"
        :y="headerHeight - 6"
        class="axis-text"
        text-anchor="middle"
      >
        {{ column }}
      </text>

      <g v-for="(row, rowIndex) in rows" :key="`row-${row.key}`">
        <text :x="labelWidth - 8" :y="cellY(rowIndex) + cellHeight / 2 + 4" class="row-label" text-anchor="end">
          {{ truncate(row.label) }}
          <title>{{ row.label }}</title>
        </text>

        <g v-for="(cell, columnIndex) in row.cells" :key="`cell-${row.key}-${columnIndex}`">
          <rect
            :x="cellStartX + columnIndex * cellWidth + 1"
            :y="cellY(rowIndex) + 1"
            :width="cellWidth - 2"
            :height="cellHeight - 2"
            :fill="heatFill(ratioOf(cell.value))"
            rx="2"
          >
            <title>{{ cell.title || `${row.label} · ${columnLabels[columnIndex]}：${displayValue(cell.value)}%` }}</title>
          </rect>
          <text
            v-if="cellWidth >= 40"
            :x="cellStartX + columnIndex * cellWidth + cellWidth / 2"
            :y="cellY(rowIndex) + cellHeight / 2 + 4"
            class="cell-text"
            :fill="heatTextColor(ratioOf(cell.value))"
            text-anchor="middle"
          >
            {{ displayValue(cell.value) }}
          </text>
        </g>
      </g>
    </svg>

    <div class="heat-legend">
      <span class="legend-word">未开始</span>
      <span
        v-for="step in legendSteps"
        :key="`legend-${step}`"
        class="legend-cell"
        :style="{ background: heatFill(step) }"
      ></span>
      <span class="legend-word">{{ maxValue }}%</span>
    </div>
  </div>
  <div v-else class="chart-empty" data-testid="heatmap-chart-empty">{{ emptyText }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { heatFill, heatTextColor, type HeatmapRow } from './chartUtils'

export interface HeatmapChartProps {
  columnLabels: string[]
  rows: HeatmapRow[]
  /** 色阶上限，完成率类固定 100 */
  maxValue?: number
  cellWidth?: number
  cellHeight?: number
  labelWidth?: number
  emptyText?: string
  ariaLabel?: string
}

const props = withDefaults(defineProps<HeatmapChartProps>(), {
  maxValue: 100,
  cellWidth: 64,
  cellHeight: 28,
  labelWidth: 150,
  emptyText: '暂无篇目完成数据',
  ariaLabel: '篇目班级热力图',
})

const headerHeight = 22

const hasData = computed(() => props.rows.length > 0 && props.columnLabels.length > 0)

/** 实际单元格宽度：列数少时铺满最小宽度，列数多时靠外层横向滚动 */
const cellWidth = computed(() => Math.max(44, props.cellWidth))
const cellStartX = computed(() => props.labelWidth)

const totalWidth = computed(() => props.labelWidth + cellWidth.value * Math.max(1, props.columnLabels.length) + 8)
const totalHeight = computed(() => headerHeight + props.cellHeight * Math.max(1, props.rows.length) + 4)

const legendSteps = computed(() => [0.1, 0.3, 0.5, 0.7, 0.9])

function cellY(rowIndex: number): number {
  return headerHeight + rowIndex * props.cellHeight
}

function ratioOf(value: number): number {
  const max = props.maxValue > 0 ? props.maxValue : 1
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value / max))
}

function displayValue(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

function truncate(label: string): string {
  const text = String(label ?? '')
  return text.length > 8 ? `${text.slice(0, 8)}…` : text
}
</script>

<style scoped>
.heatmap-chart {
  width: 100%;
  overflow-x: auto;
}

.heatmap-svg {
  display: block;
  font-family: var(--font-family-serif);
}

.axis-text,
.row-label {
  font-size: 10px;
  fill: var(--color-text-secondary);
}

.cell-text {
  font-size: 10px;
}

.heat-legend {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: var(--spacing-xs);
}

.legend-cell {
  display: inline-block;
  width: 18px;
  height: 10px;
  border-radius: 2px;
}

.legend-word {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  margin: 0 4px;
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
