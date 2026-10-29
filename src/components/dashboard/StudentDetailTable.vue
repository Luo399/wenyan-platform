<!--
  StudentDetailTable.vue - 学生明细表（纯展示 + 交互事件上抛）

  只做三件事：画行、点表头排序、翻页。所有数据来自服务层，组件内不 fetch，
  也不重算完成率——分母是后端题量清单给的，前端再算一次就会出现两个口径。

  「停滞天数」是这张表最该被看见的列：金种子的场景是学生预习，
  老师要的是「谁三天没碰了」，所以它单独成列并高亮，而不是藏在悬浮里。
-->
<template>
  <div class="student-table-wrap" data-testid="student-table">
    <div class="table-tools">
      <form class="keyword-form" @submit.prevent="emitSearch">
        <input v-model.trim="keywordDraft" type="text" placeholder="按学号或姓名搜索" aria-label="按学号或姓名搜索" />
        <button type="submit" class="plain-btn" :disabled="pending">搜索</button>
        <button v-if="keywordDraft" type="button" class="link-btn" @click="clearKeyword">清除</button>
      </form>
      <span class="table-count">共 {{ pagination.total }} 人</span>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              <button type="button" class="th-btn" @click="toggleSort('student_id')">
                学号<sort-mark :active="sort === 'student_id'" :order="order" />
              </button>
            </th>
            <th>姓名</th>
            <th>班级</th>
            <th>
              <button type="button" class="th-btn" @click="toggleSort('answered_questions')">
                已答<sort-mark :active="sort === 'answered_questions'" :order="order" />
              </button>
            </th>
            <th>三关进度</th>
            <th>
              <button type="button" class="th-btn" @click="toggleSort('accuracy')">
                正确率<sort-mark :active="sort === 'accuracy'" :order="order" />
              </button>
            </th>
            <th>
              <button type="button" class="th-btn" @click="toggleSort('completion_rate')">
                完成率<sort-mark :active="sort === 'completion_rate'" :order="order" />
              </button>
            </th>
            <th>
              <button type="button" class="th-btn" @click="toggleSort('stalled_days')">
                停滞<sort-mark :active="sort === 'stalled_days'" :order="order" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in students" :key="student.student_id" :class="{ 'row-untouched': student.never_started }">
            <td class="mono">{{ student.student_id }}</td>
            <td>
              {{ student.student_name || '-' }}
              <span v-if="student.is_active_7d" class="badge badge-active">近 7 日活跃</span>
            </td>
            <td class="mono">{{ student.class_code }}</td>
            <td>{{ student.answered_questions }} / {{ student.total_questions }}</td>
            <td>
              <div class="level-bars">
                <span v-for="key in levelKeys" :key="key" class="level-bar" :title="levelTitle(key, student)">
                  <span class="level-word">{{ key }}</span>
                  <span class="level-track"><span class="level-fill" :style="{ width: levelPercent(key, student) + '%' }"></span></span>
                  <span class="level-num">{{ student.levels[key].answered }}/{{ student.levels[key].total }}</span>
                </span>
              </div>
            </td>
            <td :class="accuracyClass(student)">{{ student.never_started ? '-' : formatPercent(student.accuracy) }}</td>
            <td>{{ formatPercent(student.completion_rate) }}</td>
            <td>
              <span v-if="student.never_started" class="stalled stalled-none">未开始</span>
              <span v-else :class="stalledClass(student)">{{ student.stalled_days }} 天</span>
            </td>
          </tr>
          <tr v-if="students.length === 0">
            <td colspan="8" class="empty-cell">{{ pending ? '加载中...' : '没有符合条件的学生' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="pagination.total_pages > 1" class="pager" aria-label="分页">
      <button type="button" class="plain-btn" :disabled="pending || pagination.page <= 1" @click="goPage(pagination.page - 1)">
        上一页
      </button>
      <span class="pager-info">{{ pagination.page }} / {{ pagination.total_pages }}</span>
      <button
        type="button"
        class="plain-btn"
        :disabled="pending || pagination.page >= pagination.total_pages"
        @click="goPage(pagination.page + 1)"
      >
        下一页
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatPercent } from '@/components/charts'
import type { DashboardStudent, Pagination } from '@/services/teacherDashboardService'
import SortMark from './SortMark.vue'

export interface StudentDetailTableProps {
  students: DashboardStudent[]
  pagination: Pagination
  sort: string
  order: 'asc' | 'desc'
  /** 拉数中：禁用交互，避免连点翻页 */
  pending?: boolean
}

const props = withDefaults(defineProps<StudentDetailTableProps>(), { pending: false })

const emit = defineEmits<{
  (e: 'sort', sort: string, order: 'asc' | 'desc'): void
  (e: 'page', page: number): void
  (e: 'search', keyword: string): void
}>()

/** 关卡顺序固定 A→B→C，与后端 level_totals 同序 */
const levelKeys: ('A' | 'B' | 'C')[] = ['A', 'B', 'C']

const keywordDraft = ref('')

function emitSearch(): void {
  emit('search', keywordDraft.value)
}

function clearKeyword(): void {
  keywordDraft.value = ''
  emit('search', '')
}

/** 点已排序列翻转方向，点新列从 asc 起 */
function toggleSort(column: string): void {
  const nextOrder = props.sort === column && props.order === 'asc' ? 'desc' : 'asc'
  emit('sort', column, nextOrder)
}

function goPage(page: number): void {
  emit('page', page)
}

function levelPercent(key: 'A' | 'B' | 'C', student: DashboardStudent): number {
  const stat = student.levels[key]
  if (!stat.total) return 0
  return Math.max(0, Math.min(100, stat.completion_rate))
}

function levelTitle(key: 'A' | 'B' | 'C', student: DashboardStudent): string {
  const stat = student.levels[key]
  return `${key} 关：答 ${stat.answered}/${stat.total}，正确率 ${formatPercent(stat.accuracy)}`
}

function accuracyClass(student: DashboardStudent): string {
  if (student.never_started) return 'accuracy-none'
  if (student.accuracy < 60) return 'accuracy-low'
  if (student.accuracy >= 85) return 'accuracy-high'
  return ''
}

/** 停滞超过 3 天标黄、7 天标红：预习场景里这就是「要打电话」的信号 */
function stalledClass(student: DashboardStudent): string {
  const days = student.stalled_days ?? 0
  if (days >= 7) return 'stalled stalled-danger'
  if (days >= 3) return 'stalled stalled-warn'
  return 'stalled'
}
</script>

<style scoped>
.student-table-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.table-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.keyword-form {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.keyword-form input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-size: 0.85rem;
  font-family: inherit;
  min-width: 180px;
}

.table-count {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.data-table th,
.data-table td {
  border: var(--border-width-hairline) solid var(--color-border);
  padding: var(--spacing-xs) var(--spacing-sm);
  text-align: left;
  vertical-align: middle;
}

.data-table th {
  background: var(--color-bg-highlight);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.th-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
}

.mono {
  font-variant-numeric: tabular-nums;
}

.row-untouched td {
  color: var(--color-text-secondary);
}

.level-bars {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.level-bar {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}

.level-word {
  font-weight: var(--font-weight-semibold);
}

.level-track {
  display: inline-block;
  width: 34px;
  height: 6px;
  border-radius: 3px;
  background: var(--color-placeholder);
  overflow: hidden;
}

.level-fill {
  display: block;
  height: 100%;
  background: var(--color-primary);
}

.level-num {
  font-variant-numeric: tabular-nums;
}

.badge {
  display: inline-block;
  margin-left: 4px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  font-size: 0.68rem;
}

.badge-active {
  background: var(--color-success-bg-soft, rgba(22, 101, 52, 0.12));
  color: var(--color-success);
}

.accuracy-low {
  color: var(--color-danger);
}

.accuracy-high {
  color: var(--color-success);
}

.accuracy-none {
  color: var(--color-text-secondary);
}

.stalled-warn {
  color: var(--color-accent);
}

.stalled-danger {
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
}

.stalled-none {
  color: var(--color-text-secondary);
}

.empty-cell {
  text-align: center;
  color: var(--color-text-secondary);
}

.pager {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.pager-info {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.plain-btn {
  font-family: inherit;
  cursor: pointer;
  background: none;
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 0.8rem;
}

.plain-btn:disabled {
  cursor: not-allowed;
  color: var(--color-text-secondary);
}

.link-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.78rem;
  cursor: pointer;
  font-family: inherit;
}
</style>
