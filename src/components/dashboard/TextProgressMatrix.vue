<!--
  TextProgressMatrix.vue - 篇目 × 班级完成情况

  上半部热力图看「哪篇哪个班还没铺开」，下半部明细表给具体人数。
  色深取后端的 avg_progress（班内人均该篇完成比例），不是正确率：
  预习阶段老师关心的是「做没做」，正确率列单独给出，两者不混在一个颜色里。

  篇目行来自题量清单全量返回（没有作答的篇目也在里面），
  所以「一整行都是灰」是有意义的成绩——说明这篇全班没开始，而不是接口漏了数据。
-->
<template>
  <div class="text-matrix" data-testid="text-matrix">
    <HeatmapChart
      :column-labels="classes"
      :rows="heatmapRows"
      :max-value="100"
      :cell-width="cellWidth"
      :label-width="labelWidth"
      aria-label="篇目班级完成热力图"
    />

    <div v-if="rows.length > 0" class="matrix-detail">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th rowspan="2">篇目</th>
              <th rowspan="2">题量</th>
              <th v-for="code in classes" :key="`head-${code}`" :colspan="3">{{ code }}</th>
            </tr>
            <tr>
              <template v-for="code in classes" :key="`sub-${code}`">
                <th>开始</th>
                <th>完成</th>
                <th>正确率</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.wen_id">
              <td class="text-name">
                {{ row.title }}
                <span v-if="row.author" class="text-meta">{{ row.author }}·{{ row.dynasty }}</span>
              </td>
              <td class="mono">{{ row.total_questions }}</td>
              <template v-for="(cell, index) in row.cells" :key="`${row.wen_id}-${index}`">
                <td class="mono">{{ cell.answered_students }}/{{ cell.student_count }}</td>
                <td class="mono">{{ cell.completed_students }}/{{ cell.student_count }}</td>
                <td class="mono">{{ cell.answered_students === 0 ? '-' : formatPercent(cell.accuracy) }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="matrix-footnote">
        完成率分母来自后端题量清单（每篇各关实际题数），与前端答题页显示的题数一致。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { HeatmapChart, formatPercent, type HeatmapRow } from '@/components/charts'
import type { TextMatrixRow } from '@/services/teacherDashboardService'

export interface TextMatrixProps {
  classes: string[]
  rows: TextMatrixRow[]
}

const props = defineProps<TextMatrixProps>()

/** 班级多时收窄单元格，避免横向溢出 */
const cellWidth = computed(() => (props.classes.length > 4 ? 52 : 72))
const labelWidth = computed(() => 140)

const heatmapRows = computed<HeatmapRow[]>(() =>
  props.rows.map((row) => ({
    key: row.wen_id,
    label: row.title,
    cells: row.cells.map((cell) => ({
      value: cell.avg_progress,
      title: `${row.title} · ${cell.class_code}：${cell.answered_students}/${cell.student_count} 人已开始，` +
        `${cell.completed_students} 人做完本篇，正确率 ${formatPercent(cell.accuracy)}`,
    })),
  })),
)
</script>

<style scoped>
.text-matrix {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.matrix-detail {
  margin-top: var(--spacing-sm);
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.data-table th,
.data-table td {
  border: var(--border-width-hairline) solid var(--color-border);
  padding: 3px var(--spacing-xs);
  text-align: center;
}

.data-table th {
  background: var(--color-bg-highlight);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.text-name {
  text-align: left;
  white-space: nowrap;
}

.text-meta {
  display: block;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}

.mono {
  font-variant-numeric: tabular-nums;
}

.matrix-footnote {
  margin: var(--spacing-xs) 0 0;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}
</style>
