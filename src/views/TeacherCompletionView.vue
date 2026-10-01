<!--
  TeacherCompletionView.vue - 教师查看学生完成情况（框架页）

  功能说明：
  - 按班级筛选，展示所教班级学生的完成情况汇总与明细表
  - 后端当前返回框架数据（metrics_ready=false），页面据此提示统计逻辑待接入
  数据统一走 services/teacherCompletionService.ts 封装，组件内不做裸 fetch。
-->
<template>
  <div class="completion-view">
    <header class="page-header">
      <div>
        <h1>学生完成情况</h1>
        <p class="subtitle">查看所教班级学生的答题完成情况</p>
      </div>
      <button type="button" class="back-btn" @click="goBack">← 返回学生管理</button>
    </header>

    <div class="toolbar">
      <label class="filter-field">
        <span>班级编码</span>
        <input v-model.trim="classCode" type="text" placeholder="留空表示全部班级" />
      </label>
      <button type="button" class="primary-btn" :disabled="loading" @click="loadData">
        {{ loading ? '查询中...' : '查询' }}
      </button>
      <span v-if="!metricsReady" class="pending-tip">统计口径尚未接入，当前仅展示学生名单框架</span>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ summary.student_count }}</div>
        <div class="stat-label">学生人数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.avg_accuracy }}%</div>
        <div class="stat-label">平均正确率</div>
      </div>
    </div>

    <div v-if="error" class="error-tip">
      <span>{{ error }}</span>
      <button type="button" class="plain-btn" @click="loadData">重试</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>学号</th>
            <th>姓名</th>
            <th>班级</th>
            <th>已答题数</th>
            <th>正确数</th>
            <th>正确率</th>
            <th>最近提交</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in students" :key="row.student_id">
            <td>{{ row.student_id }}</td>
            <td>{{ row.student_name }}</td>
            <td>{{ row.class_code }}</td>
            <td>{{ row.answered_questions }} / {{ row.total_questions }}</td>
            <td>{{ row.correct_count }}</td>
            <td>{{ row.accuracy }}%</td>
            <td>{{ row.last_submitted_at || '-' }}</td>
          </tr>
          <tr v-if="students.length === 0">
            <td colspan="7" class="empty-cell">
              {{ loading ? '加载中...' : '暂无可展示的学生数据' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { debugError } from '@/utils/debug'
import {
  getStudentsCompletion,
  type StudentCompletionRow,
  type CompletionSummary,
} from '@/services/teacherCompletionService'

const router = useRouter()

const classCode = ref('')
const loading = ref(false)
const error = ref('')
const metricsReady = ref(false)
const students = ref<StudentCompletionRow[]>([])
const summary = reactive<CompletionSummary>({ student_count: 0, avg_accuracy: 0 })

/** 根据筛选条件加载完成情况数据 */
async function loadData(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await getStudentsCompletion(classCode.value || undefined)
    metricsReady.value = result.metrics_ready
    students.value = result.students || []
    summary.student_count = result.summary?.student_count ?? 0
    summary.avg_accuracy = result.summary?.avg_accuracy ?? 0
  } catch (err) {
    debugError('[TeacherCompletion] 加载学生完成情况失败:', err)
    error.value = err instanceof Error ? err.message : '加载失败，请稍后重试'
    students.value = []
    summary.student_count = 0
    summary.avg_accuracy = 0
  } finally {
    loading.value = false
  }
}

function goBack(): void {
  router.push('/answer-query')
}

onMounted(loadData)
</script>

<style scoped>
.completion-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--spacing-lg) var(--spacing-md) var(--spacing-xl);
  font-family: var(--font-family-serif);
  color: var(--color-text);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.page-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.875rem;
  cursor: pointer;
  font-family: inherit;
}

.toolbar {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.filter-field input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-size: 0.9rem;
  font-family: inherit;
}

.primary-btn,
.plain-btn {
  font-family: inherit;
  cursor: pointer;
  border-radius: var(--radius-small);
  font-size: 0.85rem;
}

.primary-btn {
  background: var(--color-primary);
  color: var(--color-white);
  border: none;
  padding: var(--spacing-xs) var(--spacing-md);
}

.primary-btn:disabled {
  background: var(--color-placeholder);
  cursor: not-allowed;
}

.plain-btn {
  background: none;
  border: var(--border-width-hairline) solid var(--color-border);
  padding: var(--spacing-xs) var(--spacing-sm);
  color: var(--color-text);
}

.pending-tip {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.stats-row {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.stat-card {
  flex: 1;
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-white);
}

.stat-value {
  font-size: 1.4rem;
  font-weight: var(--font-weight-semibold);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.error-tip {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: #b23b3b;
  font-size: 0.85rem;
  margin-bottom: var(--spacing-sm);
}

.table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.data-table th,
.data-table td {
  border: var(--border-width-hairline) solid var(--color-border);
  padding: var(--spacing-xs) var(--spacing-sm);
  text-align: left;
}

.data-table th {
  background: var(--color-bg-highlight);
  font-weight: var(--font-weight-semibold);
}

.empty-cell {
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
