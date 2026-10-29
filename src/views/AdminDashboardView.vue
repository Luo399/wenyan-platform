<!--
  AdminDashboardView.vue - 管理员运营看板

  管理员关心的是「平台有没有真的被用起来」，所以顺序是：
  结构（有多少账号）→ 使用（有多少真的答题）→ 待办（谁卡在默认密码/谁等审批）→
  趋势（这 30 天在涨还是在躺）→ 分布（哪些学校/年级/班级挂了名不用）。

  每个区块独立 loading/error，与教师看板同一套 DashboardPanel；
  数据全部来自 services/adminDashboardService，组件内不 fetch。
-->
<template>
  <div class="admin-dashboard" data-testid="admin-dashboard">
    <header class="page-header">
      <div>
        <h1>平台运营看板</h1>
        <p class="subtitle">
          全平台口径
          <span v-if="updatedAt" class="updated-at">更新于 {{ updatedAt }}</span>
        </p>
      </div>
      <div class="header-actions">
        <button type="button" class="plain-btn" @click="reloadAll">刷新</button>
        <button type="button" class="back-btn" @click="goConsole">→ 管理后台</button>
      </div>
    </header>

    <DashboardPanel
      title="账号与结构"
      hint="教师按状态分组统计；班级数取学生名册里去重后的 class_code 数"
      :loading="overview.loading"
      :error="overview.error"
      @retry="loadOverview"
    >
      <div class="cards-grid">
        <StatCard label="教师账号" :value="accounts.teacher_total" unit="人" :hint="`在岗 ${accounts.teacher_status.active} · 待审批 ${accounts.teacher_status.pending}`" />
        <StatCard label="学生账号" :value="accounts.student_total" unit="人" :hint="`${accounts.class_count} 个班级 · ${accounts.school_count} 所学校`" />
        <StatCard label="待审批教师" :value="todos.pending_teacher_count" unit="人" :tone="todos.pending_teacher_count > 0 ? 'warn' : 'default'" hint="点击进入审批列表" />
        <StatCard
          label="默认密码未改"
          :value="todos.students_on_default_password"
          unit="人"
          :tone="todos.students_on_default_password > 0 ? 'danger' : 'success'"
          hint="仍是初始 99999999，存在泄露风险"
        />
      </div>
    </DashboardPanel>

    <DashboardPanel
      title="使用情况"
      :hint="`激活率 = 至少答过一道题的学生占比；整体正确率按题次汇总（不是学生均值）；完成率分母 = 每人 ${usage.total_questions_per_student} 道题`"
      :loading="overview.loading"
      :error="overview.error"
      @retry="loadOverview"
    >
      <div class="usage-row">
        <div class="usage-ring">
          <ProgressRing :percent="usage.activation_rate" :size="104" :stroke-width="10" label="学生激活率" />
        </div>
        <div class="cards-grid cards-grid--tight">
          <StatCard label="已答题学生" :value="usage.answered_student_count" unit="人" :hint="`未开始 ${usage.untouched_student_count} 人`" />
          <StatCard label="整体正确率" :value="usage.overall_accuracy" unit="%" hint="答对题次 / 已答题次" />
          <StatCard label="人均完成率" :value="usage.avg_completion_rate" unit="%" hint="含未开始学生" />
          <StatCard label="题库规模" :value="usage.text_count" unit="篇" :hint="`共 ${usage.total_questions_per_student} 道题/人`" />
        </div>
      </div>
      <div class="cards-grid cards-grid--tight">
        <StatCard label="累计提交" :value="submissions.total" unit="次" />
        <StatCard label="近 7 天提交" :value="submissions.last_7_days" unit="次" />
        <StatCard label="近 30 天提交" :value="submissions.last_30_days" unit="次" />
        <StatCard label="日活 DAU" :value="activity.dau" unit="人" hint="当天有提交" />
        <StatCard label="周活 WAU" :value="activity.wau" unit="人" />
        <StatCard label="月活 MAU" :value="activity.mau" unit="人" />
      </div>
    </DashboardPanel>

    <DashboardPanel
      title="增长与使用趋势"
      hint="空日补 0，曲线长度恒等于窗口天数；新增按账号创建日、提交按答题提交日"
      :loading="trends.loading"
      :error="trends.error"
      @retry="loadTrends"
    >
      <template #actions>
        <label class="inline-field">
          <span>指标</span>
          <select v-model="trendMetric">
            <option value="submissions">提交量</option>
            <option value="active_students">活跃学生</option>
            <option value="new_students">新增学生</option>
            <option value="new_teachers">新增教师</option>
          </select>
        </label>
        <label class="inline-field">
          <span>窗口</span>
          <select v-model.number="trendDays" @change="loadTrends">
            <option :value="7">7 天</option>
            <option :value="14">14 天</option>
            <option :value="30">30 天</option>
            <option :value="90">90 天</option>
          </select>
        </label>
      </template>

      <LineChart
        :labels="trendLabels"
        :series="trendSeries"
        :height="250"
        :empty-text="trendsEmptyText"
        :aria-label="`${trendMetricLabel}趋势`"
      />
      <p class="trend-footnote">
        窗口内合计：新增学生 {{ trendsData.totals.new_students }} 人 · 新增教师 {{ trendsData.totals.new_teachers }} 人 ·
        提交 {{ trendsData.totals.submissions }} 次
      </p>
    </DashboardPanel>

    <DashboardPanel
      title="覆盖率分布"
      :hint="`使用率 = 近 ${distributionWindow} 天有提交的学生占比；未覆盖列出该窗口内没人答题的分组`"
      :loading="distribution.loading"
      :error="distribution.error"
      @retry="loadDistribution"
    >
      <template #actions>
        <label class="inline-field">
          <span>维度</span>
          <select v-model="dimension" @change="loadDistribution">
            <option value="class">班级</option>
            <option value="grade">年级</option>
            <option value="school">学校</option>
          </select>
        </label>
        <label class="inline-field">
          <span>活跃窗口</span>
          <select v-model.number="distributionWindow" @change="loadDistribution">
            <option :value="7">7 天</option>
            <option :value="30">30 天</option>
            <option :value="90">90 天</option>
          </select>
        </label>
      </template>

      <BarChart
        :items="distributionBars"
        :max-value="100"
        orientation="horizontal"
        :height="distributionBarHeight"
        unit="%"
        empty-text="暂无分组数据"
        :aria-label="`${dimensionLabel}使用率`"
      />

      <div v-if="uncovered.length" class="uncovered" data-testid="uncovered">
        <span class="uncovered-title">未覆盖（{{ dimensionLabel }} {{ uncovered.length }} 个）：</span>
        <span v-for="key in uncovered" :key="key" class="uncovered-chip">{{ groupLabel(key) }}</span>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ dimensionLabel }}</th>
              <th>学生数</th>
              <th>已答题</th>
              <th>窗口内活跃</th>
              <th>使用率</th>
              <th>激活率</th>
              <th>整体正确率</th>
              <th>人均完成率</th>
              <th>提交量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in groups" :key="group.key" :class="{ 'row-uncovered': group.answered_student_count === 0 }">
              <td>{{ group.label }}</td>
              <td class="mono">{{ group.student_count }}</td>
              <td class="mono">{{ group.answered_student_count }}</td>
              <td class="mono">{{ group.active_student_count }}</td>
              <td class="mono">{{ formatPercent(group.usage_rate) }}</td>
              <td class="mono">{{ formatPercent(group.activation_rate) }}</td>
              <td class="mono">{{ group.submissions === 0 ? '-' : formatPercent(group.overall_accuracy) }}</td>
              <td class="mono">{{ formatPercent(group.avg_completion_rate) }}</td>
              <td class="mono">{{ group.submissions }}</td>
            </tr>
            <tr v-if="groups.length === 0">
              <td colspan="9" class="empty-cell">暂无分组数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DashboardPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BarChart, LineChart, ProgressRing, StatCard, formatPercent, type ChartDatum, type ChartSeries } from '@/components/charts'
import DashboardPanel from '@/components/dashboard/DashboardPanel.vue'
import { ApiError } from '@/utils/api'
import { debugError } from '@/utils/debug'
import {
  getAdminDistribution,
  getAdminOverview,
  getAdminTrends,
  type AdminActivity,
  type AdminAccounts,
  type AdminDistributionGroup,
  type AdminDistributionResult,
  type AdminOverviewResult,
  type AdminSubmissions,
  type AdminTodos,
  type AdminTrendsResult,
  type AdminUsage,
  type DistributionDimension,
} from '@/services/adminDashboardService'

interface PanelState {
  loading: boolean
  error: string
}

const router = useRouter()

const overview = reactive<PanelState>({ loading: false, error: '' })
const trends = reactive<PanelState>({ loading: false, error: '' })
const distribution = reactive<PanelState>({ loading: false, error: '' })

const overviewData = ref<AdminOverviewResult | null>(null)
const trendsDataRaw = ref<AdminTrendsResult | null>(null)
const distributionData = ref<AdminDistributionResult | null>(null)

const trendMetric = ref<'submissions' | 'active_students' | 'new_students' | 'new_teachers'>('submissions')
const trendDays = ref(30)
const dimension = ref<DistributionDimension>('class')
const distributionWindow = ref(30)
const updatedAt = ref('')

const emptyOverviewData: AdminOverviewResult = {
  accounts: {
    teacher_total: 0,
    teacher_status: { active: 0, pending: 0, disabled: 0, rejected: 0 },
    pending_teacher_count: 0,
    student_total: 0,
    school_count: 0,
    class_count: 0,
    admin_count: 0,
  },
  usage: {
    student_total: 0,
    answered_student_count: 0,
    untouched_student_count: 0,
    activation_rate: 0,
    overall_accuracy: 0,
    avg_completion_rate: 0,
    total_questions_per_student: 0,
    text_count: 0,
  },
  submissions: { total: 0, last_7_days: 0, last_30_days: 0 },
  activity: { dau: 0, wau: 0, mau: 0 },
  todos: { pending_teacher_count: 0, students_on_default_password: 0 },
}

const accounts = computed<AdminAccounts>(() => overviewData.value?.accounts || emptyOverviewData.accounts)
const usage = computed<AdminUsage>(() => overviewData.value?.usage || emptyOverviewData.usage)
const submissions = computed<AdminSubmissions>(() => overviewData.value?.submissions || emptyOverviewData.submissions)
const activity = computed<AdminActivity>(() => overviewData.value?.activity || emptyOverviewData.activity)
const todos = computed<AdminTodos>(() => overviewData.value?.todos || emptyOverviewData.todos)

const trendsData = computed<AdminTrendsResult>(
  () => trendsDataRaw.value || { days: trendDays.value, series: [], totals: { new_students: 0, new_teachers: 0, submissions: 0 } },
)

const groups = computed<AdminDistributionGroup[]>(() => distributionData.value?.groups || [])
const uncovered = computed(() => distributionData.value?.uncovered || [])

const trendMetricLabel = computed(() => {
  if (trendMetric.value === 'submissions') return '提交量'
  if (trendMetric.value === 'active_students') return '活跃学生'
  if (trendMetric.value === 'new_students') return '新增学生'
  return '新增教师'
})

const trendLabels = computed(() => trendsData.value.series.map((point) => point.date))
const trendSeries = computed<ChartSeries[]>(() => [
  { name: trendMetricLabel.value, values: trendsData.value.series.map((point) => point[trendMetric.value]) },
])

const trendsEmptyText = computed(() => `近 ${trendDays.value} 天没有${trendMetricLabel.value}记录`)

const dimensionLabel = computed(() => {
  if (dimension.value === 'grade') return '年级'
  if (dimension.value === 'school') return '学校'
  return '班级'
})

/** 使用率上限固定 100%，这样不同维度之间柱子长度可以直接比 */
const distributionBars = computed<ChartDatum[]>(() =>
  groups.value.map((group) => ({ label: group.label, value: group.usage_rate })),
)
const distributionBarHeight = computed(() => Math.max(120, groups.value.length * 26 + 40))

/** uncovered 给的是 key，表格里同 key 的中文名要能对上；对不上时退回 key（如「未分班」） */
function groupLabel(key: string): string {
  return groups.value.find((group) => group.key === key)?.label || key
}

function panelMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message || fallback
  return fallback
}

async function loadOverview(): Promise<void> {
  overview.loading = true
  overview.error = ''
  try {
    overviewData.value = await getAdminOverview()
    touchUpdated()
  } catch (err) {
    debugError('[AdminDashboard] 概览加载失败:', err)
    overview.error = panelMessage(err, '运营概览加载失败')
    overviewData.value = null
  } finally {
    overview.loading = false
  }
}

async function loadTrends(): Promise<void> {
  trends.loading = true
  trends.error = ''
  try {
    trendsDataRaw.value = await getAdminTrends(trendDays.value)
  } catch (err) {
    debugError('[AdminDashboard] 趋势加载失败:', err)
    trends.error = panelMessage(err, '趋势数据加载失败')
    trendsDataRaw.value = null
  } finally {
    trends.loading = false
  }
}

async function loadDistribution(): Promise<void> {
  distribution.loading = true
  distribution.error = ''
  try {
    distributionData.value = await getAdminDistribution(dimension.value, distributionWindow.value)
  } catch (err) {
    debugError('[AdminDashboard] 分布加载失败:', err)
    distribution.error = panelMessage(err, '覆盖率分布加载失败')
    distributionData.value = null
  } finally {
    distribution.loading = false
  }
}

function reloadAll(): void {
  void Promise.all([loadOverview(), loadTrends(), loadDistribution()])
}

function touchUpdated(): void {
  const now = new Date()
  updatedAt.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function goConsole(): void {
  router.push('/admin-console')
}

onMounted(reloadAll)
</script>

<style scoped>
.admin-dashboard {
  max-width: 1180px;
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
  margin-bottom: var(--spacing-md);
}

.page-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.updated-at {
  margin-left: var(--spacing-sm);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.back-btn,
.plain-btn {
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: var(--radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-primary);
}

.plain-btn {
  background: none;
  border: var(--border-width-hairline) solid var(--color-border);
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.cards-grid--tight {
  margin-top: var(--spacing-sm);
}

.usage-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.usage-ring {
  flex-shrink: 0;
}

.inline-field {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.inline-field select {
  padding: 2px var(--spacing-xs);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-size: 0.8rem;
  font-family: inherit;
}

.trend-footnote {
  margin: var(--spacing-sm) 0 0;
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}

.uncovered {
  margin: var(--spacing-sm) 0;
  font-size: 0.78rem;
}

.uncovered-title {
  color: var(--color-danger);
  margin-right: 4px;
}

.uncovered-chip {
  display: inline-block;
  margin: 2px 4px 0 0;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-danger-bg-soft, rgba(153, 27, 27, 0.08));
  color: var(--color-danger);
}

.table-scroll {
  overflow-x: auto;
  margin-top: var(--spacing-sm);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
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
  white-space: nowrap;
}

.mono {
  font-variant-numeric: tabular-nums;
}

.row-uncovered td {
  color: var(--color-text-secondary);
}

.empty-cell {
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
