<!--
  AnswerQueryView.vue - 学生信息查询与管理页面

  功能说明：
  - 学生信息CRUD管理（新增、删除、修改、查询）
  - 按文言文ID和学生ID查询答题情况
  - 展示学生列表和答题记录
  - 提供数据筛选、排序和分页功能
  - 支持数据导出

  子组件拆分（C02）：
  - StudentTable        学生列表表格
  - AnswerTable         答题记录表格（wenId / studentId 两种模式）
  - StudentFormModal    新增/编辑学生弹窗
  - DeleteConfirmModal  删除确认弹窗
  - AnswerDetailModal   答题详情弹窗
-->
<template>
  <div class="answer-query-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>学生信息查询与管理</h1>
      <p class="subtitle">管理系统中的学生信息，支持增删查改操作</p>
    </div>

    <!-- 操作反馈提示 -->
    <Transition name="fade">
      <div v-if="toast.show" :class="['toast', toast.type]">
        <span class="toast-icon">{{ toast.type === 'success' ? '✓' : '✕' }}</span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </Transition>

    <!-- 查询表单 -->
    <div class="query-form">
      <div class="form-tabs">
        <div class="tabs-left">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'students' }"
            @click="activeTab = 'students'"
          >
            学生管理
          </button>
        </div>
        <div class="tabs-right">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'wenId' }"
            @click="activeTab = 'wenId'"
          >
            按文言文ID查询
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'studentId' }"
            @click="activeTab = 'studentId'"
          >
            按学生ID查询
          </button>
        </div>
      </div>

      <!-- 按文言文ID查询 -->
      <div v-show="activeTab === 'wenId'" class="tab-content">
        <div class="form-row">
          <div class="form-group">
            <label>文言文ID</label>
            <input
              v-model="queryForm.wenId"
              type="text"
              placeholder="如：WEN_01"
              class="form-input"
            />
          </div>
          <button class="query-btn" @click="queryByWenId">查询</button>
        </div>
      </div>

      <!-- 按学生ID查询 -->
      <div v-show="activeTab === 'studentId'" class="tab-content">
        <div class="form-row">
          <div class="form-group">
            <label>学生学号</label>
            <input
              v-model="queryForm.studentId"
              type="text"
              placeholder="如：2024001"
              class="form-input"
            />
          </div>
          <button class="query-btn" @click="queryByStudentId">查询</button>
        </div>
      </div>

      <!-- 学生列表管理 -->
      <div v-show="activeTab === 'students'" class="tab-content">
        <div class="students-toolbar">
          <div class="left-buttons">
            <div class="search-group">
              <input
                v-model="searchKeyword"
                type="text"
                placeholder="搜索学号或姓名..."
                class="search-input"
                @input="handleSearch"
              />
              <button class="search-btn" @click="handleSearch">
                <span>🔍</span>
              </button>
            </div>
            <div class="class-filter">
              <select v-model="selectedClass" class="class-select" @change="queryByClass">
                <option value="">全部班级</option>
                <option v-for="cls in availableClasses" :key="cls" :value="cls">
                  班级{{ cls }}
                </option>
              </select>
            </div>
          </div>
          <button class="add-btn" @click="openAddModal"><span>+</span> 新增学生</button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div v-if="statistics" class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ statistics.totalStudents }}</div>
        <div class="stat-label">{{ activeTab === 'students' ? '学生总数' : '学生人数' }}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ statistics.totalCorrect }}</div>
        <div class="stat-label">正确题数</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ statistics.totalWrong }}</div>
        <div class="stat-label">错误题数</div>
      </div>
      <div class="stat-card info">
        <div class="stat-value">{{ statistics.avgScore }}%</div>
        <div class="stat-label">平均正确率</div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-container">
      <div class="table-header">
        <h3>{{ tableTitle }}</h3>
        <div class="table-actions">
          <select v-model="sortBy" class="sort-select" @change="handleSort">
            <option value="time">按时间排序</option>
            <option value="score">按得分排序</option>
          </select>
          <button class="export-btn" @click="exportData" :disabled="!hasData">
            <span>导出</span>
          </button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <span class="error-icon">⚠</span>
        <span>{{ error }}</span>
        <button class="retry-btn" @click="retryQuery">重试</button>
      </div>

      <!-- 空数据状态 -->
      <div v-else-if="!hasData" class="empty-state">
        <span>暂无数据</span>
        <p v-if="activeTab === 'students'">点击"新增学生"添加第一条记录</p>
        <p v-else>请选择查询方式并点击查询</p>
      </div>

      <!-- 学生列表（带CRUD操作） -->
      <StudentTable
        v-else-if="activeTab === 'students'"
        :students="displayStudents"
        @view="viewStudentDetail"
        @edit="openEditModal"
        @view-answers="viewStudentAnswers"
        @confirm-delete="confirmDelete"
      />

      <!-- 按文言文/学生ID查询结果 -->
      <AnswerTable
        v-else
        :records="displayAnswerRecords"
        :mode="activeTab as 'wenId' | 'studentId'"
        @view-detail="handleViewDetail"
      />
    </div>

    <!-- 分页 -->
    <div v-if="hasData && pagination" class="pagination">
      <button class="page-btn" :disabled="pagination.currentPage <= 1" @click="prevPage">
        上一页
      </button>
      <span class="page-info">
        第 {{ pagination.currentPage }} / {{ pagination.totalPages }} 页，共
        {{ pagination.total }} 条
      </span>
      <button
        class="page-btn"
        :disabled="pagination.currentPage >= pagination.totalPages"
        @click="nextPage"
      >
        下一页
      </button>
    </div>

    <!-- 学生详情弹窗（轻量，保留在主容器） -->
    <div v-if="showStudentModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal-content student-detail-modal">
        <div class="modal-header">
          <h3>学生详情</h3>
          <button class="close-btn" @click="closeModals">×</button>
        </div>
        <div v-if="selectedStudent" class="modal-body">
          <div class="detail-row">
            <span class="detail-label">学号：</span>
            <span class="detail-value">{{ selectedStudent.student_id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">姓名：</span>
            <span class="detail-value">{{ selectedStudent.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">班级：</span>
            <span class="detail-value">{{ selectedStudent.class || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">创建时间：</span>
            <span class="detail-value">{{ formatDate(selectedStudent.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 答题详情弹窗 -->
    <AnswerDetailModal
      v-if="showAnswerModal"
      :student-info="selectedStudentInfo"
      :answers="selectedAnswers"
      @close="closeModals"
    />

    <!-- 新增/编辑学生弹窗 -->
    <StudentFormModal
      v-if="showStudentFormModal"
      :is-edit-mode="isEditMode"
      :is-submitting="isSubmitting"
      :initial-student="selectedStudent"
      @close="closeFormModal"
      @submit="handleSubmitForm"
    />

    <!-- 删除确认弹窗 -->
    <DeleteConfirmModal
      v-if="showDeleteModal"
      :student="studentToDelete"
      :is-deleting="isDeleting"
      @close="closeDeleteModal"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { get } from '@/utils/api'
import { formatDate } from '@/utils/format'
import { createStudent, updateStudent, deleteStudent, type StudentInfo } from '@/utils/studentApi'
import { debugError } from '@/utils/debug'
import StudentTable from '@/components/StudentTable.vue'
import AnswerTable from '@/components/AnswerTable.vue'
import StudentFormModal from '@/components/StudentFormModal.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import AnswerDetailModal from '@/components/AnswerDetailModal.vue'

// ============================================================
// 类型定义（R04：移除 any）
// ============================================================

/** Toast 状态接口 */
interface Toast {
  show: boolean
  message: string
  type: 'success' | 'error'
}

/** 答题明细：单个 question 的作答记录（来自后端 answers[]） */
interface AnswerDetail {
  questionId?: string
  questionNumber?: number
  userAnswer?: string
  correctAnswer?: string | number
  isCorrect?: boolean
  score?: number
  submittedAt?: string
  [key: string]: unknown
}

/** 文言文维度下，单个学生的聚合答题记录
 *  后端：/api/answers/wen/:wenId 响应 data.students[i]
 */
interface WenIdAnswerRecord {
  studentId: string
  studentName?: string
  totalQuestions?: number
  correctCount?: number
  wrongCount?: number
  avgScore?: number
  submittedAt?: string
  answers?: AnswerDetail[]
  [key: string]: unknown
}

/** 学生维度下，单篇文言文的聚合答题记录
 *  后端：/api/answers/student/:studentId 响应 data.wenRecords[i]
 */
interface StudentIdAnswerRecord {
  wenId: string
  wenTitle?: string
  totalQuestions?: number
  correctCount?: number
  wrongCount?: number
  avgScore?: number
  submittedAt?: string
  answers?: AnswerDetail[]
  studentId?: string
  studentName?: string
  [key: string]: unknown
}

/** 三种 tab 下 allData 的元素类型联合 */
type QueryRow = StudentInfo | WenIdAnswerRecord | StudentIdAnswerRecord

type QueryTab = 'students' | 'wenId' | 'studentId'

/** 分页常量（R47：移除硬编码 10） */
const DEFAULT_PAGE_SIZE = 10 as const
const TOAST_DURATION_MS = 3000 as const

// ============================================================
// 基础状态
// ============================================================
const activeTab = ref<QueryTab>('students')
const loading = ref(false)
const error = ref('')
const queryForm = reactive({
  wenId: '',
  studentId: '',
})

// R05：originalData 保存原始后端返回，allData 只用于前端过滤/排序后的展示
const originalData = ref<QueryRow[]>([])
const allData = ref<QueryRow[]>([])
const statistics = ref<{
  totalStudents: number
  totalCorrect: number
  totalWrong: number
  avgScore: number
} | null>(null)

const pagination = ref<{
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
} | null>(null)

const showStudentModal = ref(false)
const showAnswerModal = ref(false)
const selectedStudent = ref<StudentInfo | null>(null)
const selectedAnswers = ref<AnswerDetail[]>([])
const selectedStudentInfo = ref('')

const sortBy = ref('time')
const searchKeyword = ref('')

// R10：availableClasses 从学生数据动态提取，初始值为空数组（load 后填充）
const selectedClass = ref<number | ''>('')
const availableClasses = ref<number[]>([])

const showStudentFormModal = ref(false)
const showDeleteModal = ref(false)
const isEditMode = ref(false)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const studentToDelete = ref<StudentInfo | null>(null)

// ============================================================
// Toast 展示（R09：保存 timer 并在 onUnmounted 清理）
// ============================================================
const toast = reactive<Toast>({
  show: false,
  message: '',
  type: 'success',
})

let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(message: string, type: 'success' | 'error' = 'success') {
  // 连续触发时先清掉旧 timer，避免多个定时器叠加
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  toast.message = message
  toast.type = type
  toast.show = true
  toastTimer = setTimeout(() => {
    toast.show = false
    toastTimer = null
  }, TOAST_DURATION_MS)
}

onUnmounted(() => {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
})

// ============================================================
// 计算属性
// ============================================================
const tableTitle = computed<string>(() => {
  switch (activeTab.value) {
    case 'wenId':
      return '文言文答题情况'
    case 'studentId':
      return '学生答题记录'
    case 'students':
      return '学生列表'
    default:
      return '数据列表'
  }
})

const hasData = computed(() => allData.value.length > 0)

const displayData = computed<QueryRow[]>(() => {
  if (!pagination.value) return allData.value
  const start = (pagination.value.currentPage - 1) * pagination.value.pageSize
  const end = start + pagination.value.pageSize
  return allData.value.slice(start, end)
})

/**
 * StudentTable 要求的入参是 StudentInfo[]。
 * 虽然 activeTab==='students' 时 allData 的运行时元素就是 StudentInfo，
 * 但 TS 联合类型不能自动"按 tab 收窄"，所以这里显式用类型断言 + 运行时守卫做兜底。
 */
const displayStudents = computed<StudentInfo[]>(() => {
  if (activeTab.value !== 'students') return []
  return displayData.value.filter(isStudentInfo) as StudentInfo[]
})

/**
 * AnswerTable records 接受 Record<string, any>[]。
 * 把 QueryRow[] 直接转成宽类型，避免模板里三元函数类型交集的报错。
 */
const displayAnswerRecords = computed<Array<Record<string, unknown>>>(() => {
  if (activeTab.value === 'students') return []
  return displayData.value as Array<Record<string, unknown>>
})

/**
 * 记录详情点击：把模板里的"三元+两个函数"收敛成一个，避免 TS 做交集类型推断导致参数不兼容。
 * 运行时根据 activeTab 分发到具体处理函数。
 */
function handleViewDetail(record: Record<string, unknown>) {
  if (activeTab.value === 'wenId') {
    viewWenStudentDetail(record as WenIdAnswerRecord)
  } else if (activeTab.value === 'studentId') {
    viewStudentWenDetail(record as StudentIdAnswerRecord)
  }
}

// ============================================================
// 类型守卫：帮助在分支内收窄 QueryRow 联合类型
// ============================================================
function isStudentInfo(row: QueryRow): row is StudentInfo {
  return activeTab.value === 'students' && 'student_id' in row
}
function isWenIdRecord(row: QueryRow): row is WenIdAnswerRecord {
  return activeTab.value === 'wenId' && 'studentId' in row
}
function isStudentIdRecord(row: QueryRow): row is StudentIdAnswerRecord {
  return activeTab.value === 'studentId' && 'wenId' in row
}

// ============================================================
// 查询入口函数
// ============================================================
async function queryByWenId() {
  const wenId = queryForm.wenId.trim()
  if (!wenId) {
    error.value = '请输入文言文ID'
    return
  }
  await fetchData(`/api/answers/wen/${wenId}`, 'wenId')
}

async function queryByStudentId() {
  const studentId = queryForm.studentId.trim()
  if (!studentId) {
    error.value = '请输入学生学号'
    return
  }
  await fetchData(`/api/answers/student/${studentId}`, 'studentId')
}

async function loadAllStudents(classNum?: number) {
  let url = '/api/students'
  if (classNum !== undefined) {
    url += `?class=${classNum}`
  }
  await fetchData(url, 'students')
}

async function queryByClass() {
  const classNum = selectedClass.value
  if (classNum === '' || classNum === undefined) {
    await loadAllStudents()
  } else {
    await loadAllStudents(Number(classNum))
  }
}

/**
 * R05：加载成功后同时写入 originalData + allData
 * R10：students tab 下根据 class 字段动态刷新 availableClasses
 */
async function fetchData(url: string, type: QueryTab) {
  loading.value = true
  error.value = ''
  originalData.value = []
  allData.value = []
  statistics.value = null

  try {
    const response = await get<unknown>(url)

    if (response.success && response.data !== undefined && response.data !== null) {
      const data = response.data as Record<string, unknown>

      if (type === 'wenId') {
        const students = (data.students as WenIdAnswerRecord[]) || []
        originalData.value = students
        allData.value = students

        let totalCorrect = 0
        let totalWrong = 0
        let totalQuestions = 0
        students.forEach((student: WenIdAnswerRecord) => {
          totalCorrect += student.correctCount || 0
          totalWrong += student.wrongCount || 0
          totalQuestions += student.totalQuestions || 0
        })
        statistics.value = {
          totalStudents: (data.studentCount as number) || 0,
          totalCorrect,
          totalWrong,
          avgScore: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        }
      } else if (type === 'studentId') {
        const wenRecords = (data.wenRecords as StudentIdAnswerRecord[]) || []
        originalData.value = wenRecords
        allData.value = wenRecords
        statistics.value = {
          totalStudents: 1,
          totalCorrect: (data.totalAllCorrect as number) || 0,
          totalWrong: (data.totalAllWrong as number) || 0,
          avgScore: (data.overallAvgScore as number) || 0,
        }
      } else {
        // students tab
        const students = (Array.isArray(data) ? data : []) as StudentInfo[]
        originalData.value = students
        allData.value = students
        // R10：根据全部学生动态提取班级列表（按数值升序）
        refreshAvailableClasses(students)
        statistics.value = {
          totalStudents: students.length,
          totalCorrect: 0,
          totalWrong: 0,
          avgScore: 0,
        }
      }

      const total = allData.value.length
      pagination.value = {
        currentPage: 1,
        totalPages: Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE)),
        pageSize: DEFAULT_PAGE_SIZE,
        total,
      }
    } else {
      error.value = response.message || '获取数据失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '网络请求失败'
    debugError('获取数据失败:', err)
  } finally {
    loading.value = false
  }
}

/**
 * R10：根据学生列表的 class 字段动态刷新 availableClasses
 */
function refreshAvailableClasses(students: StudentInfo[]) {
  const classSet = new Set<number>()
  students.forEach((s: StudentInfo) => {
    if (typeof s.class === 'number') {
      classSet.add(s.class)
    }
  })
  availableClasses.value = Array.from(classSet).sort((a, b) => a - b)
}

function retryQuery() {
  switch (activeTab.value) {
    case 'wenId':
      queryByWenId()
      break
    case 'studentId':
      queryByStudentId()
      break
    case 'students':
      loadAllStudents()
      break
  }
}

// ============================================================
// 排序
// ============================================================
function handleSort() {
  if (!hasData.value) return

  if (sortBy.value === 'score') {
    allData.value.sort((a: QueryRow, b: QueryRow) => {
      const scoreA = (a as WenIdAnswerRecord | StudentIdAnswerRecord).avgScore || 0
      const scoreB = (b as WenIdAnswerRecord | StudentIdAnswerRecord).avgScore || 0
      return scoreB - scoreA
    })
  } else {
    allData.value.sort((a: QueryRow, b: QueryRow) => {
      const getDate = (row: QueryRow): number => {
        if (isStudentInfo(row)) return new Date(row.created_at || 0).getTime()
        if (isWenIdRecord(row)) return new Date(row.submittedAt || 0).getTime()
        if (isStudentIdRecord(row)) return new Date(row.submittedAt || 0).getTime()
        return 0
      }
      return getDate(b) - getDate(a)
    })
  }
}

// ============================================================
// 搜索（R05：只读 originalData，不破坏原始数据）
// ============================================================
function handleSearch() {
  // 搜索仅对 students tab 生效；其余 tab 下无本地搜索语义
  if (activeTab.value !== 'students') return
  if (originalData.value.length === 0) return

  const keyword = searchKeyword.value.toLowerCase().trim()

  let filtered: StudentInfo[]
  if (!keyword) {
    // 清空关键词：直接恢复 originalData，不发网络请求
    filtered = originalData.value as StudentInfo[]
  } else {
    filtered = (originalData.value as StudentInfo[]).filter((s: StudentInfo) => {
      return s.student_id.toLowerCase().includes(keyword) || s.name.toLowerCase().includes(keyword)
    })
  }

  allData.value = filtered
  if (pagination.value) {
    pagination.value.total = filtered.length
    pagination.value.totalPages = Math.max(
      1,
      Math.ceil(filtered.length / pagination.value.pageSize),
    )
    pagination.value.currentPage = 1
  }
}

// ============================================================
// 分页
// ============================================================
function prevPage() {
  if (pagination.value && pagination.value.currentPage > 1) {
    pagination.value.currentPage--
  }
}

function nextPage() {
  if (pagination.value && pagination.value.currentPage < pagination.value.totalPages) {
    pagination.value.currentPage++
  }
}

// ============================================================
// 弹窗：详情/答题记录
// ============================================================
function viewStudentDetail(student: StudentInfo) {
  selectedStudent.value = student
  showStudentModal.value = true
}

function viewStudentAnswers(studentId: string) {
  queryForm.studentId = studentId
  activeTab.value = 'studentId'
  queryByStudentId()
}

function viewWenStudentDetail(student: WenIdAnswerRecord) {
  selectedStudentInfo.value = `${student.studentId} - ${student.studentName || '未知'}`
  selectedAnswers.value = student.answers || []
  showAnswerModal.value = true
}

function viewStudentWenDetail(record: StudentIdAnswerRecord) {
  selectedStudentInfo.value = `${record.studentId || queryForm.studentId} - ${record.wenId}`
  selectedAnswers.value = record.answers || []
  showAnswerModal.value = true
}

function closeModals() {
  showStudentModal.value = false
  showAnswerModal.value = false
  selectedStudent.value = null
  selectedAnswers.value = []
  selectedStudentInfo.value = ''
}

// ============================================================
// 学生表单弹窗（新增/编辑）
// ============================================================
function openAddModal() {
  isEditMode.value = false
  selectedStudent.value = null
  showStudentFormModal.value = true
}

function openEditModal(student: StudentInfo) {
  isEditMode.value = true
  selectedStudent.value = student
  showStudentFormModal.value = true
}

function closeFormModal() {
  showStudentFormModal.value = false
  selectedStudent.value = null
}

async function handleSubmitForm(payload: { studentId: string; name: string; class: number }) {
  isSubmitting.value = true

  try {
    let result: { success: boolean; message: string }
    if (isEditMode.value && selectedStudent.value) {
      result = await updateStudent(selectedStudent.value.student_id, {
        name: payload.name,
        class: payload.class,
      })
    } else {
      result = await createStudent({
        studentId: payload.studentId,
        name: payload.name,
        class: payload.class,
      })
    }

    if (result.success) {
      showToast(isEditMode.value ? '学生信息修改成功' : '学生添加成功', 'success')
      closeFormModal()
      // 清空搜索关键词后重新加载，避免新增的学生被当前搜索过滤掉
      searchKeyword.value = ''
      await loadAllStudents()
    } else {
      showToast(result.message, 'error')
    }
  } catch {
    showToast('操作失败，请重试', 'error')
  } finally {
    isSubmitting.value = false
  }
}

// ============================================================
// 删除确认弹窗
// ============================================================
function confirmDelete(student: StudentInfo) {
  studentToDelete.value = student
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  studentToDelete.value = null
}

async function handleDelete() {
  if (!studentToDelete.value) return

  isDeleting.value = true

  try {
    const result = await deleteStudent(studentToDelete.value.student_id)

    if (result.success) {
      showToast('学生删除成功', 'success')
      closeDeleteModal()
      // 搜索关键词保留在前端，但刷新源数据后重新过滤即可
      const currentKeyword = searchKeyword.value
      await loadAllStudents()
      if (currentKeyword) {
        searchKeyword.value = currentKeyword
        handleSearch()
      }
    } else {
      showToast(result.message, 'error')
    }
  } catch {
    showToast('删除失败，请重试', 'error')
  } finally {
    isDeleting.value = false
  }
}

// ============================================================
// 导出 CSV（R08：加 escapeCsvField 防公式注入 + 字段引号转义）
// ============================================================

/**
 * CSV 字段转义
 * - 含逗号 / 双引号 / 换行符：用双引号包裹，内部双引号翻倍
 * - 以 = + - @ 开头（Excel 公式字符）：前缀单引号，防止 CSV 注入
 */
function escapeCsvField(value: unknown): string {
  const str = String(value ?? '')
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`
  }
  return str
}

/** 根据 activeTab 导出不同 CSV 内容 */
function exportData() {
  if (!hasData.value) return

  let csvContent = ''
  const rows = allData.value

  if (activeTab.value === 'students') {
    const headers = ['学号', '姓名', '班级', '创建时间']
    csvContent = headers.map(escapeCsvField).join(',') + '\n'
    rows.forEach((row: QueryRow) => {
      if (!isStudentInfo(row)) return
      csvContent +=
        [
          escapeCsvField(row.student_id),
          escapeCsvField(row.name),
          escapeCsvField(row.class ?? ''),
          escapeCsvField(row.created_at ?? ''),
        ].join(',') + '\n'
    })
  } else if (activeTab.value === 'wenId') {
    const headers = ['学号', '姓名', '答题数', '正确数', '错误数', '平均分']
    csvContent = headers.map(escapeCsvField).join(',') + '\n'
    rows.forEach((row: QueryRow) => {
      if (!isWenIdRecord(row)) return
      csvContent +=
        [
          escapeCsvField(row.studentId),
          escapeCsvField(row.studentName ?? ''),
          escapeCsvField(row.totalQuestions ?? 0),
          escapeCsvField(row.correctCount ?? 0),
          escapeCsvField(row.wrongCount ?? 0),
          escapeCsvField(row.avgScore ?? 0),
        ].join(',') + '\n'
    })
  } else if (activeTab.value === 'studentId') {
    const headers = ['文言文ID', '答题时间', '答题数', '正确数', '平均分']
    csvContent = headers.map(escapeCsvField).join(',') + '\n'
    rows.forEach((row: QueryRow) => {
      if (!isStudentIdRecord(row)) return
      csvContent +=
        [
          escapeCsvField(row.wenId),
          escapeCsvField(row.submittedAt ?? ''),
          escapeCsvField(row.totalQuestions ?? 0),
          escapeCsvField(row.correctCount ?? 0),
          escapeCsvField(row.avgScore ?? 0),
        ].join(',') + '\n'
    })
  }

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `答题数据_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  // 释放 object URL 避免内存泄漏（现代浏览器 GC 会处理，但显式释放更安全）
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

// ============================================================
// R06：副作用放在 onMounted 中，而非 setup 末尾
// ============================================================
onMounted(() => {
  loadAllStudents()
})
</script>

<style scoped>
.answer-query-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-xl);
  position: relative;
}

.page-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.page-header h1 {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}

.page-header .subtitle {
  font-family: var(--font-family-serif);
  color: var(--color-text-secondary);
}

/* 反馈提示条 */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-small);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  z-index: 2000;
  box-shadow: var(--shadow-small);
}

.toast.success {
  background: var(--color-border);
  color: var(--color-white);
}

.toast.error {
  background: var(--color-primary);
  color: var(--color-white);
}

.toast-icon {
  font-size: var(--font-size-body-lg);
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

/* 查询表单卡片：30px 圆角 + token 阴影 */
.query-form {
  background: var(--color-white);
  border-radius: var(--radius-card);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-small);
  margin-bottom: var(--spacing-lg);
}

.form-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.tabs-left {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: flex-start;
}

.tabs-right {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: flex-end;
}

.tab-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: none;
  border-radius: var(--radius-small);
  background: var(--color-placeholder);
  color: var(--color-text-secondary);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background: var(--color-bg-highlight);
}

.tab-btn.active {
  background: var(--color-primary);
  color: var(--color-white);
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.students-toolbar {
  display: flex;
  gap: var(--spacing-md);
  justify-content: space-between;
  align-items: center;
}

.left-buttons {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  justify-content: flex-start;
}

.search-group {
  display: flex;
  gap: 0;
}

.search-input {
  flex: 1;
  padding: var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small) 0 0 var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  color: var(--color-text);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* 搜索按钮（朱红底 + 橄榄绿边框 + 50px 圆角） */
.search-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  border: var(--border-width) solid var(--color-border);
  border-radius: 0 var(--radius-button) var(--radius-button) 0;
  color: var(--color-white);
  cursor: pointer;
}

.class-filter {
  display: flex;
  align-items: center;
}

.class-select {
  padding: var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-text);
  min-width: 120px;
}

.class-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* 新增按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
.add-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  transition: all 0.2s ease;
}

.add-btn:hover {
  background: var(--color-primary-hover);
}

.form-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-end;
}

/* 查询表单与 StudentFormModal 共用的表单字段样式（:deep 穿透到子组件） */
.form-group,
:deep(.form-group) {
  flex: 1;
}

.form-group label,
:deep(.form-group label) {
  display: block;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}

.form-input,
:deep(.form-input) {
  width: 100%;
  padding: var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  color: var(--color-text);
  transition: all 0.2s ease;
}

.form-input:focus,
:deep(.form-input:focus) {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(133, 30, 14, 0.1);
}

:deep(.form-input.error) {
  border-color: var(--color-primary);
}

:deep(.form-input:disabled) {
  background: var(--color-placeholder);
  cursor: not-allowed;
}

:deep(.error-text) {
  color: var(--color-primary);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  margin-top: var(--spacing-xs);
  display: block;
}

:deep(.required) {
  color: var(--color-primary);
}

/* 查询按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
.query-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
}

.query-btn:hover {
  background: var(--color-primary-hover);
}

/* 统计卡片网格 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-card {
  background: var(--color-white);
  border-radius: var(--radius-small);
  padding: 1.25rem;
  text-align: center;
  box-shadow: var(--shadow-small);
  border-left: var(--border-width-thin) solid var(--color-primary);
}

.stat-card.success {
  border-left-color: var(--color-border);
}

.stat-card.warning {
  border-left-color: var(--color-accent);
}

.stat-card.info {
  border-left-color: var(--color-text-secondary);
}

.stat-value {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
  display: block;
}

.stat-label {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

/* 数据表格容器卡片 */
.table-container {
  background: var(--color-white);
  border-radius: var(--radius-small);
  box-shadow: var(--shadow-small);
  overflow: hidden;
  margin-bottom: var(--spacing-md);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
}

.table-header h3 {
  margin: 0;
  font-family: var(--font-family-serif);
  color: var(--color-text);
}

.table-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.sort-select {
  padding: var(--spacing-xs);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-text);
}

/* 导出按钮 */
.export-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.export-btn:disabled {
  background: var(--color-text-secondary);
  cursor: not-allowed;
}

/* 表格相关样式穿透到 StudentTable / AnswerTable */
:deep(.data-table) {
  width: 100%;
  border-collapse: collapse;
}

:deep(.data-table th),
:deep(.data-table td) {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
}

:deep(.data-table th) {
  background: var(--color-bg-highlight);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  font-size: var(--font-size-small);
}

:deep(.data-table tr:hover) {
  background: var(--color-bg-highlight);
}

/* 正确/错误用橄榄绿/朱红区分 */
:deep(.data-table .correct) {
  color: var(--color-border);
  font-weight: var(--font-weight-semibold);
}

:deep(.data-table .wrong) {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

:deep(.actions-cell) {
  white-space: nowrap;
}

:deep(.action-btn) {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  margin-right: var(--spacing-xs);
  transition: all 0.2s ease;
}

:deep(.view-btn) {
  background: var(--color-placeholder);
  color: var(--color-text);
}

:deep(.view-btn:hover) {
  background: var(--color-bg-highlight);
}

:deep(.edit-btn) {
  background: var(--color-bg-highlight);
  color: var(--color-accent);
}

:deep(.edit-btn:hover) {
  background: var(--color-placeholder);
}

:deep(.answer-btn) {
  background: var(--color-bg-highlight);
  color: var(--color-primary);
}

:deep(.answer-btn:hover) {
  background: var(--color-placeholder);
}

:deep(.detail-btn) {
  background: var(--color-primary);
  color: var(--color-white);
}

:deep(.detail-btn:hover) {
  background: var(--color-primary-hover);
}

:deep(.delete-btn) {
  background: var(--color-bg-highlight);
  color: var(--color-primary);
}

:deep(.delete-btn:hover) {
  background: var(--color-placeholder);
}

.loading-state,
.error-state,
.empty-state {
  padding: var(--spacing-2xl);
  text-align: center;
}

.loading-state .spinner {
  width: var(--spacing-xl);
  height: var(--spacing-xl);
  border: 2px solid var(--color-placeholder);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--spacing-md);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  color: var(--color-primary);
}

.error-state .error-icon {
  font-size: var(--font-size-heading);
  margin-right: var(--spacing-xs);
}

.empty-state {
  color: var(--color-text-secondary);
}

/* 重试按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
.retry-btn {
  margin-top: var(--spacing-md);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.page-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-white);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: var(--color-bg-highlight);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: var(--color-text-secondary);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
}

/* 弹窗共享样式：穿透到 StudentFormModal / DeleteConfirmModal / AnswerDetailModal */
:deep(.modal-overlay) {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-md);
}

/* 弹窗内容卡片：30px 圆角 */
:deep(.modal-content) {
  background: var(--color-white);
  border-radius: var(--radius-card);
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
}

:deep(.modal-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
}

:deep(.modal-header h3) {
  margin: 0;
  font-family: var(--font-family-serif);
  color: var(--color-text);
}

:deep(.close-btn) {
  width: var(--spacing-xl);
  height: var(--spacing-xl);
  border: none;
  background: transparent;
  font-size: var(--font-size-heading);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.close-btn:hover) {
  background: var(--color-placeholder);
}

:deep(.modal-body) {
  padding: var(--spacing-lg);
  overflow-y: auto;
  max-height: calc(80vh - 6rem);
}

/* 学生详情弹窗（保留在主容器，仍用 scoped 命中） */
.detail-row {
  margin-bottom: var(--spacing-sm);
}

.detail-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-right: var(--spacing-xs);
}

.detail-value {
  color: var(--color-text);
}

/* StudentFormModal 表单 */
:deep(.student-form) {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

:deep(.form-actions) {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  justify-content: flex-end;
}

/* 次要按钮：白底 + 朱红边框 + 50px 圆角 */
:deep(.cancel-btn) {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-white);
  color: var(--color-primary);
  border: var(--border-width) solid var(--color-primary);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
}

:deep(.cancel-btn:hover:not(:disabled)) {
  background: var(--color-bg-highlight);
}

/* 主按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
:deep(.submit-btn) {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
}

:deep(.submit-btn:hover:not(:disabled)) {
  background: var(--color-primary-hover);
}

:deep(.submit-btn:disabled),
:deep(.cancel-btn:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 危险按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
:deep(.danger-btn) {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
}

:deep(.danger-btn:hover:not(:disabled)) {
  background: var(--color-primary-hover);
}

:deep(.danger-btn:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

:deep(.spinner-small) {
  width: var(--spacing-md);
  height: var(--spacing-md);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--color-white);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* AnswerDetailModal 内容样式 */
:deep(.answer-detail-header) {
  padding: var(--spacing-sm);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  margin-bottom: var(--spacing-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

:deep(.answer-item) {
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  margin-bottom: var(--spacing-md);
  overflow: hidden;
}

:deep(.answer-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  background: var(--color-bg-highlight);
}

:deep(.question-num) {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

/* 得分徽章：错误朱红 / 正确橄榄绿 */
:deep(.score-badge) {
  padding: var(--spacing-xs);
  border-radius: 9999px;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  background: var(--color-bg-highlight);
  color: var(--color-primary);
}

:deep(.score-badge.correct) {
  background: var(--color-bg-highlight);
  color: var(--color-border);
}

:deep(.answer-content) {
  padding: var(--spacing-sm);
}

:deep(.answer-row) {
  margin-bottom: var(--spacing-xs);
}

:deep(.answer-row:last-child) {
  margin-bottom: 0;
}

:deep(.answer-row .label) {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  margin-right: var(--spacing-xs);
}

:deep(.answer-row .value) {
  color: var(--color-text);
  font-size: var(--font-size-small);
}

:deep(.answer-row .value.correct) {
  color: var(--color-border);
  font-weight: var(--font-weight-semibold);
}

/* DeleteConfirmModal 内容样式 */
:deep(.confirm-content) {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

:deep(.warning-icon) {
  font-size: var(--font-size-display);
  margin-bottom: var(--spacing-md);
}

:deep(.confirm-content p) {
  margin: var(--spacing-xs) 0;
  color: var(--color-text);
}

:deep(.sub-text) {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}

:deep(.sub-text.danger) {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 768px) {
  .answer-query-container {
    padding: var(--spacing-md);
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .students-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-group {
    max-width: none;
  }

  .add-btn {
    width: 100%;
    justify-content: center;
  }

  .form-row {
    flex-direction: column;
  }

  .query-btn {
    width: 100%;
  }

  .table-header {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: flex-start;
  }

  .table-actions {
    width: 100%;
    justify-content: space-between;
  }

  :deep(.data-table) {
    display: block;
    overflow-x: auto;
  }

  :deep(.action-btn) {
    margin-bottom: var(--spacing-xs);
    margin-right: var(--spacing-xs);
  }

  :deep(.modal-content) {
    width: 100%;
    margin: var(--spacing-xs);
  }
}

@media (max-width: 480px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }

  .form-tabs {
    flex-wrap: wrap;
  }

  .tab-btn {
    flex: 1;
    min-width: calc(50% - 0.25rem);
  }
}
</style>
