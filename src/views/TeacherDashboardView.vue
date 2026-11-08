<!--
  TeacherDashboardView.vue - 教师数据看板

  页面顺序按老师真正的使用动线排：
  1) 我的班整体铺开了吗（概览卡）→ 2) 哪个班拖后（班级汇总）→
  3) 最近有没有人在做（活跃趋势）→ 4) 哪篇还没读过去（篇目矩阵）→
  5) 讲评该讲哪几题（薄弱题）→ 6) 具体到每个人（学生明细）。

  六个区块各自持有 loading/error，一个接口挂了其余照常显示：
  看板是「来了就得看到数」的页面，整页白屏比某个模块报错对老师伤害更大。
  数据全部经 services/teacherDashboardService 取，组件内不出现 fetch。
-->
<template>
  <div class="dashboard-view" data-testid="teacher-dashboard">
    <header class="page-header">
      <div>
        <h1>教学数据看板</h1>
        <p class="subtitle">
          {{ scopeLabel }}
          <span v-if="updatedAt" class="updated-at">更新于 {{ updatedAt }}</span>
        </p>
      </div>
      <button type="button" class="back-btn" @click="goBack">← 返回学生管理</button>
    </header>

    <div class="toolbar">
      <label class="filter-field">
        <span>班级</span>
        <select v-model="classCode" @change="reloadAll">
          <option value="">全部班级（{{ ownClassCodes.length || '—' }} 个）</option>
          <option v-for="code in ownClassCodes" :key="code" :value="code">{{ code }}</option>
        </select>
      </label>
      <label class="filter-field">
        <span>趋势窗口</span>
        <select v-model.number="activityDays" @change="loadActivity">
          <option :value="7">近 7 天</option>
          <option :value="14">近 14 天</option>
          <option :value="30">近 30 天</option>
        </select>
      </label>
      <label class="filter-field">
        <span>薄弱题最少作答人数</span>
        <input v-model.number="minStudents" type="number" min="1" max="50" @change="loadWeak" />
      </label>
      <button type="button" class="primary-btn" :disabled="anyLoading" @click="reloadAll">
        {{ anyLoading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <DashboardPanel
      title="整体进度"
      :hint="`完成率分母：平台共 ${summary.total_questions} 道题（第一关 ${summary.level_totals.A} / 第二关 ${summary.level_totals.B} / 第三关 ${summary.level_totals.C}），每篇题量见下方矩阵`"
      :loading="overview.loading"
      :error="overview.error"
      @retry="loadOverview"
    >
      <div class="cards-grid">
        <StatCard label="学生人数" :value="summary.student_count" unit="人" :hint="`${summary.class_count} 个班级`" />
        <StatCard
          label="已开始答题"
          :value="summary.answered_student_count"
          unit="人"
          :tone="summary.answered_student_count === 0 ? 'danger' : 'success'"
          :hint="`占 ${percentText(summary.answered_student_count, summary.student_count)}`"
        />
        <StatCard
          label="从未提交"
          :value="summary.untouched_student_count"
          unit="人"
          :tone="summary.untouched_student_count > 0 ? 'danger' : 'default'"
          hint="需优先跟进"
        />
        <StatCard label="近 7 日活跃" :value="summary.active_students_7d" unit="人" :hint="`${summary.submissions_7d} 次提交`" />
        <StatCard label="平均正确率" :value="summary.avg_accuracy" unit="%" tone="warn" hint="仅统计答过题的学生" />
        <StatCard label="平均完成率" :value="summary.avg_completion_rate" unit="%" hint="全员平均（未开始记 0）" />
        <StatCard label="累计提交" :value="summary.submissions_total" unit="次" :hint="`${summary.text_count} 篇文言文`" />
      </div>
    </DashboardPanel>

    <DashboardPanel
      title="班级对比"
      hint="同一口径下逐班列出，正确率只取该班已作答学生的均值，与顶部卡片可直接相加核对"
      :loading="overview.loading"
      :error="overview.error"
      @retry="loadOverview"
    >
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>班级</th>
              <th>人数</th>
              <th>已开始</th>
              <th>未开始</th>
              <th>近 7 日活跃</th>
              <th>平均正确率</th>
              <th>平均完成率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in classes" :key="row.class_code">
              <td class="mono">{{ row.class_code }}</td>
              <td class="mono">{{ row.student_count }}</td>
              <td class="mono">{{ row.answered_student_count }}</td>
              <td class="mono" :class="{ 'cell-danger': row.untouched_student_count > 0 }">
                {{ row.untouched_student_count }}
              </td>
              <td class="mono">{{ row.active_students_7d }}</td>
              <td class="mono">{{ formatPercent(row.avg_accuracy) }}</td>
              <td class="mono">{{ formatPercent(row.avg_completion_rate) }}</td>
            </tr>
            <tr v-if="classes.length === 0">
              <td colspan="7" class="empty-cell">当前范围内还没有班级数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DashboardPanel>

    <DashboardPanel
      title="活跃趋势"
      :hint="`近 ${activityDays} 天：按日提交量与当日去重活跃人数；小时分布按 UTC 存储口径显示`"
      :loading="activity.loading"
      :error="activity.error"
      @retry="loadActivity"
    >
      <div class="chart-pair">
        <div class="chart-col">
          <h3 class="chart-subtitle">按日提交</h3>
          <LineChart
            :labels="dailyLabels"
            :series="dailySeries"
            :show-area="true"
            :height="230"
            empty-text="窗口内还没有提交记录"
            aria-label="按日提交趋势"
          />
          <p v-if="activityData.totals.peak_date" class="chart-footnote">
            峰值 {{ activityData.totals.peak_date }}，共 {{ activityData.totals.submissions }} 次提交
          </p>
        </div>
        <div class="chart-col">
          <h3 class="chart-subtitle">提交时段（UTC 小时）</h3>
          <BarChart
            :items="hourlyItems"

            :height="230"
            unit=" 次"
            empty-text="窗口内还没有提交记录"
            aria-label="24 小时提交分布"
          />
          <p v-if="peakHourText" class="chart-footnote">{{ peakHourText }}</p>
        </div>
      </div>
    </DashboardPanel>

    <DashboardPanel
      title="篇目完成情况"
      hint="格子颜色 = 该班在该篇的人均完成比例；一整行都浅＝这篇全班没开始"
      :loading="texts.loading"
      :error="texts.error"
      @retry="loadTexts"
    >
      <TextProgressMatrix :classes="matrixClasses" :rows="matrixRows" />
    </DashboardPanel>

    <DashboardPanel
      title="薄弱题 Top 10"
      hint="按每题最后一次作答统计，同一人重做不会重复计票；错误分布给出多数人错选的选项"
      :loading="weak.loading"
      :error="weak.error"
      @retry="loadWeak"
    >
      <WeakQuestionBoard :questions="weakQuestions" />
    </DashboardPanel>

    <DashboardPanel
      title="学生明细"
      hint="停滞天数从最后一次提交起算，超过 3 天标黄、7 天标红"
      :loading="students.loading"
      :error="students.error"
      @retry="loadStudents"
    >
      <StudentDetailTable
        :students="studentRows"
        :pagination="studentPagination"
        :sort="studentSort"
        :order="studentOrder"
        :pending="students.loading"
        @sort="onSortChange"
        @page="onPageChange"
        @search="onSearchChange"
      />
    </DashboardPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BarChart, LineChart, StatCard, formatPercent, type ChartDatum, type ChartSeries } from '@/components/charts'
import DashboardPanel from '@/components/dashboard/DashboardPanel.vue'
import StudentDetailTable from '@/components/dashboard/StudentDetailTable.vue'
import TextProgressMatrix from '@/components/dashboard/TextProgressMatrix.vue'
import WeakQuestionBoard from '@/components/dashboard/WeakQuestionBoard.vue'
import { debugError } from '@/utils/debug'
import { ApiError } from '@/utils/api'
import {
  getTeacherActivity,
  getTeacherOverview,
  getTeacherStudents,
  getTeacherTextMatrix,
  getTeacherWeakQuestions,
  type DailyActivityPoint,
  type HourlyActivityBucket,
  type Pagination,
  type StudentQuery,
  type TeacherActivityResult,
  type TeacherClassRow,
  type TeacherOverviewResult,
  type TeacherOverviewSummary,
  type TeacherStudentsResult,
  type TeacherTextMatrixResult,
  type WeakQuestionRow,
} from '@/services/teacherDashboardService'

/** 每个区块的局部状态：loading 与 error 都只作用于自己 */
interface PanelState {
  loading: boolean
  error: string
}

const router = useRouter()

const classCode = ref('')
const activityDays = ref(30)
const minStudents = ref(2)
const updatedAt = ref('')

const overview = reactive<PanelState>({ loading: false, error: '' })
const texts = reactive<PanelState>({ loading: false, error: '' })
const activity = reactive<PanelState>({ loading: false, error: '' })
const weak = reactive<PanelState>({ loading: false, error: '' })
const students = reactive<PanelState>({ loading: false, error: '' })

const summaryData = ref<TeacherOverviewResult | null>(null)
const matrixData = ref<TeacherTextMatrixResult | null>(null)
const activityDataRaw = ref<TeacherActivityResult | null>(null)
const studentsData = ref<TeacherStudentsResult | null>(null)
const weakQuestions = ref<WeakQuestionRow[]>([])

const studentSort = ref('student_id')
const studentOrder = ref<'asc' | 'desc'>('asc')
const studentKeyword = ref('')
const studentPage = ref(1)

const emptySummary: TeacherOverviewSummary = {
  class_count: 0,
  student_count: 0,
  answered_student_count: 0,
  untouched_student_count: 0,
  active_students_7d: 0,
  submissions_total: 0,
  submissions_7d: 0,
  avg_accuracy: 0,
  avg_completion_rate: 0,
  total_questions: 0,
  text_count: 0,
  level_totals: { A: 0, B: 0, C: 0 },
}

const summary = computed(() => summaryData.value?.summary || emptySummary)
const classes = computed<TeacherClassRow[]>(() => summaryData.value?.classes || [])
const matrixClasses = computed(() => matrixData.value?.classes || [])
const matrixRows = computed(() => matrixData.value?.rows || [])
const studentRows = computed(() => studentsData.value?.students || [])
const studentPagination = computed<Pagination>(
  () => studentsData.value?.pagination || { page: 1, page_size: 20, total: 0, total_pages: 1 },
)
const activityData = computed<TeacherActivityResult>(
  () => activityDataRaw.value || { scope: { all_access: false, class_codes: [], requested_class_code: null }, days: activityDays.value, daily: [], hourly: [], totals: { submissions: 0, peak_date: null, peak_hour: null } },
)

/** 班级下拉：优先用概览返回的班级（真实名册），全权限教师未加载时用 scope 兜底 */
const ownClassCodes = computed(() => {
  const fromClasses = classes.value.map((row) => row.class_code)
  if (fromClasses.length) return fromClasses
  return summaryData.value?.scope.class_codes || []
})

const scopeLabel = computed(() => {
  const scope = summaryData.value?.scope
  if (!scope) return '加载中...'
  if (scope.requested_class_code) return `当前范围：班级 ${scope.requested_class_code}`
  if (scope.all_access) return '当前范围：全部班级（全权限教师）'
  return `当前范围：所教 ${ownClassCodes.value.length} 个班级`
})

const anyLoading = computed(
  () => overview.loading || texts.loading || activity.loading || weak.loading || students.loading,
)

const dailyLabels = computed(() => activityData.value.daily.map((d: DailyActivityPoint) => d.date))
const dailySeries = computed<ChartSeries[]>(() => [
  { name: '提交量', values: activityData.value.daily.map((d) => d.submissions) },
  { name: '活跃人数', values: activityData.value.daily.map((d) => d.active_students) },
])

/** 小时桶要补 0 才能保持 24 根柱等宽，标签写成 00 / 01 … */
const hourlyItems = computed<ChartDatum[]>(() =>
  activityData.value.hourly.map((h: HourlyActivityBucket) => ({
    label: String(h.hour).padStart(2, '0'),
    value: h.submissions,
  })),
)
const peakHourText = computed(() => {
  const hour = activityData.value.totals.peak_hour
  if (hour === null || hour === undefined) return ''
  const label = String(hour).padStart(2, '0')
  return `最集中的时段是 ${label}:00–${label}:59（UTC，比北京时间晚 8 小时）`
})

function percentText(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

/** 统一把接口异常转成一行可读文案，403/401 直接把后端消息透出来 */
function panelMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message || fallback
  return fallback
}

async function loadOverview(): Promise<void> {
  overview.loading = true
  overview.error = ''
  try {
    summaryData.value = await getTeacherOverview(classCode.value || undefined)
    touchUpdated()
  } catch (err) {
    debugError('[TeacherDashboard] 概览加载失败:', err)
    overview.error = panelMessage(err, '概览数据加载失败')
    summaryData.value = null
  } finally {
    overview.loading = false
  }
}

async function loadTexts(): Promise<void> {
  texts.loading = true
  texts.error = ''
  try {
    matrixData.value = await getTeacherTextMatrix(classCode.value || undefined)
  } catch (err) {
    debugError('[TeacherDashboard] 篇目矩阵加载失败:', err)
    texts.error = panelMessage(err, '篇目完成情况加载失败')
    matrixData.value = null
  } finally {
    texts.loading = false
  }
}

async function loadActivity(): Promise<void> {
  activity.loading = true
  activity.error = ''
  try {
    activityDataRaw.value = await getTeacherActivity(classCode.value || undefined, activityDays.value)
  } catch (err) {
    debugError('[TeacherDashboard] 活跃趋势加载失败:', err)
    activity.error = panelMessage(err, '活跃趋势加载失败')
    activityDataRaw.value = null
  } finally {
    activity.loading = false
  }
}

async function loadWeak(): Promise<void> {
  weak.loading = true
  weak.error = ''
  try {
    const result = await getTeacherWeakQuestions(classCode.value || undefined, minStudents.value || 2, 10)
    weakQuestions.value = result.questions
  } catch (err) {
    debugError('[TeacherDashboard] 薄弱题加载失败:', err)
    weak.error = panelMessage(err, '薄弱题加载失败')
    weakQuestions.value = []
  } finally {
    weak.loading = false
  }
}

async function loadStudents(): Promise<void> {
  students.loading = true
  students.error = ''
  try {
    studentsData.value = await getTeacherStudents({
      class_code: classCode.value || undefined,
      keyword: studentKeyword.value || undefined,
      sort: studentSort.value as StudentQuery['sort'],
      order: studentOrder.value,
      page: studentPage.value,
      page_size: 20,
    })
  } catch (err) {
    debugError('[TeacherDashboard] 学生明细加载失败:', err)
    students.error = panelMessage(err, '学生明细加载失败')
    studentsData.value = null
  } finally {
    students.loading = false
  }
}

/** 切换班级 = 全量重载，并回到明细首页（不同班级的分页没有可比性） */
function reloadAll(): void {
  studentPage.value = 1
  void Promise.all([loadOverview(), loadTexts(), loadActivity(), loadWeak(), loadStudents()])
}

function onSortChange(sort: string, order: 'asc' | 'desc'): void {
  studentSort.value = sort
  studentOrder.value = order
  studentPage.value = 1
  void loadStudents()
}

function onPageChange(page: number): void {
  studentPage.value = page
  void loadStudents()
}

function onSearchChange(keyword: string): void {
  studentKeyword.value = keyword
  studentPage.value = 1
  void loadStudents()
}

function touchUpdated(): void {
  const now = new Date()
  updatedAt.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function goBack(): void {
  // 看板属于教师后台，返回走路由（auth 流程例外，这里可用 router.push）
  router.push('/answer-query')
}

onMounted(reloadAll)
</script>

<style scoped>
.dashboard-view {
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

.back-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}

.toolbar {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-md);
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.filter-field select,
.filter-field input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-size: 0.85rem;
  font-family: inherit;
  min-width: 120px;
}

.filter-field input {
  min-width: 72px;
}

.primary-btn {
  background: var(--color-primary);
  color: var(--color-white);
  border: none;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-small);
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}

.primary-btn:disabled {
  background: var(--color-placeholder);
  cursor: not-allowed;
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
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
}

.data-table th {
  background: var(--color-bg-highlight);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.mono {
  font-variant-numeric: tabular-nums;
}

.cell-danger {
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
}

.empty-cell {
  text-align: center;
  color: var(--color-text-secondary);
}

.chart-pair {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.chart-col {
  flex: 1 1 380px;
  min-width: 0;
}

.chart-subtitle {
  margin: 0 0 var(--spacing-xs);
  font-size: 0.85rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.chart-footnote {
  margin: var(--spacing-xs) 0 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
