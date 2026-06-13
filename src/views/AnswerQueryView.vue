<!--
  AnswerQueryView.vue - 学生信息查询与管理页面

  功能说明：
  - 学生信息CRUD管理（新增、删除、修改、查询）
  - 按文言文ID和学生ID查询答题情况
  - 展示学生列表和答题记录
  - 提供数据筛选、排序和分页功能
  - 支持数据导出
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
      <table v-else-if="activeTab === 'students'" class="data-table">
        <thead>
          <tr>
            <th>学号</th>
            <th>姓名</th>
            <th>班级</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in displayData" :key="student.student_id">
            <td>{{ student.student_id }}</td>
            <td>{{ student.name }}</td>
            <td>{{ student.class || '-' }}</td>
            <td>{{ formatDate(student.created_at) }}</td>
            <td class="actions-cell">
              <button class="action-btn view-btn" @click="viewStudentDetail(student)">查看</button>
              <button class="action-btn edit-btn" @click="openEditModal(student)">编辑</button>
              <button class="action-btn answer-btn" @click="viewStudentAnswers(student.student_id)">
                答题
              </button>
              <button class="action-btn delete-btn" @click="confirmDelete(student)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 按文言文查询结果 -->
      <table v-else-if="activeTab === 'wenId'" class="data-table">
        <thead>
          <tr>
            <th>学号</th>
            <th>姓名</th>
            <th>答题数</th>
            <th>正确数</th>
            <th>错误数</th>
            <th>平均分</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in displayData" :key="student.studentId">
            <td>{{ student.studentId }}</td>
            <td>{{ student.studentName || '未知' }}</td>
            <td>{{ student.totalQuestions }}</td>
            <td class="correct">{{ student.correctCount }}</td>
            <td class="wrong">{{ student.wrongCount }}</td>
            <td>{{ student.avgScore }}%</td>
            <td>
              <button class="action-btn detail-btn" @click="viewWenStudentDetail(student)">
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 按学生查询结果 -->
      <table v-else-if="activeTab === 'studentId'" class="data-table">
        <thead>
          <tr>
            <th>文言文ID</th>
            <th>答题时间</th>
            <th>答题数</th>
            <th>正确数</th>
            <th>平均分</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in displayData" :key="record.wenId">
            <td>{{ record.wenId }}</td>
            <td>{{ formatDate(record.submittedAt) }}</td>
            <td>{{ record.totalQuestions }}</td>
            <td class="correct">{{ record.correctCount }}</td>
            <td>{{ record.avgScore }}%</td>
            <td>
              <button class="action-btn detail-btn" @click="viewStudentWenDetail(record)">
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>
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

    <!-- 学生详情弹窗 -->
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
    <div v-if="showAnswerModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal-content answer-detail-modal">
        <div class="modal-header">
          <h3>答题详情</h3>
          <button class="close-btn" @click="closeModals">×</button>
        </div>
        <div v-if="selectedAnswers.length > 0" class="modal-body">
          <div class="answer-detail-header">
            <span>{{ selectedStudentInfo }}</span>
          </div>
          <div v-for="(answer, index) in selectedAnswers" :key="index" class="answer-item">
            <div class="answer-header">
              <span class="question-num">第 {{ index + 1 }} 题</span>
              <span class="score-badge" :class="{ correct: answer.isCorrect }">
                {{ answer.isCorrect ? '正确' : '错误' }}
              </span>
            </div>
            <div class="answer-content">
              <div class="answer-row">
                <span class="label">你的答案：</span>
                <span class="value">{{ formatAnswer(answer.userAnswer) }}</span>
              </div>
              <div class="answer-row" v-if="answer.correctAnswer">
                <span class="label">正确答案：</span>
                <span class="value correct">{{ formatAnswer(answer.correctAnswer) }}</span>
              </div>
              <div class="answer-row">
                <span class="label">得分：</span>
                <span class="value">{{ answer.score }}分</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/编辑学生弹窗 -->
    <div v-if="showStudentFormModal" class="modal-overlay" @click.self="closeFormModal">
      <div class="modal-content student-form-modal">
        <div class="modal-header">
          <h3>{{ isEditMode ? '编辑学生信息' : '新增学生' }}</h3>
          <button class="close-btn" @click="closeFormModal">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleSubmitForm" class="student-form">
            <div class="form-group">
              <label for="studentIdInput">学号 <span class="required">*</span></label>
              <input
                id="studentIdInput"
                v-model="studentForm.studentId"
                type="text"
                placeholder="请输入学号（纯数字）"
                class="form-input"
                :disabled="isEditMode || isSubmitting"
                :class="{ error: formErrors.studentId }"
              />
              <span v-if="formErrors.studentId" class="error-text">{{ formErrors.studentId }}</span>
            </div>

            <div class="form-group">
              <label for="studentNameInput">姓名 <span class="required">*</span></label>
              <input
                id="studentNameInput"
                v-model="studentForm.name"
                type="text"
                placeholder="请输入姓名"
                class="form-input"
                :disabled="isSubmitting"
                :class="{ error: formErrors.name }"
              />
              <span v-if="formErrors.name" class="error-text">{{ formErrors.name }}</span>
            </div>

            <div class="form-group">
              <label for="studentClassInput">班级 <span class="required">*</span></label>
              <input
                id="studentClassInput"
                v-model.number="studentForm.class"
                type="number"
                placeholder="请输入班级（如：9）"
                class="form-input"
                :disabled="isSubmitting"
                :class="{ error: formErrors.class }"
              />
              <span v-if="formErrors.class" class="error-text">{{ formErrors.class }}</span>
            </div>

            <div class="form-actions">
              <button
                type="button"
                class="cancel-btn"
                @click="closeFormModal"
                :disabled="isSubmitting"
              >
                取消
              </button>
              <button type="submit" class="submit-btn" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-small"></span>
                <span v-else>{{ isEditMode ? '保存' : '添加' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content delete-confirm-modal">
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="close-btn" @click="closeDeleteModal">×</button>
        </div>
        <div class="modal-body">
          <div class="confirm-content">
            <div class="warning-icon">⚠</div>
            <p>
              确定要删除学生 <strong>{{ studentToDelete?.name }}</strong> 吗？
            </p>
            <p class="sub-text">学号：{{ studentToDelete?.student_id }}</p>
            <p class="sub-text danger">此操作将同时删除该学生的所有答题记录，且无法恢复！</p>
          </div>
          <div class="form-actions">
            <button
              type="button"
              class="cancel-btn"
              @click="closeDeleteModal"
              :disabled="isDeleting"
            >
              取消
            </button>
            <button type="button" class="danger-btn" @click="handleDelete" :disabled="isDeleting">
              <span v-if="isDeleting" class="spinner-small"></span>
              <span v-else>确认删除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { get } from '@/utils/api'
import {
  createStudent,
  updateStudent,
  deleteStudent,
  validateStudentId,
  validateStudentName,
  type StudentInfo,
} from '@/utils/studentApi'

interface StudentRecord {
  student_id: string
  name: string
  class?: number
  created_at?: string
}

interface Toast {
  show: boolean
  message: string
  type: 'success' | 'error'
}

interface FormErrors {
  studentId: string
  name: string
  class?: string
}

const tabs = [
  { id: 'wenId', name: '按文言文ID查询' },
  { id: 'studentId', name: '按学生ID查询' },
  { id: 'students', name: '学生管理' },
]

const activeTab = ref('students')
const loading = ref(false)
const error = ref('')
const queryForm = reactive({
  wenId: '',
  studentId: '',
})
const allData = ref<any[]>([])
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
const selectedStudent = ref<StudentRecord | null>(null)
const selectedAnswers = ref<any[]>([])
const selectedStudentInfo = ref('')

const sortBy = ref('time')

const searchKeyword = ref('')

const selectedClass = ref('')
const availableClasses = ref<number[]>([9])

const showStudentFormModal = ref(false)
const showDeleteModal = ref(false)
const isEditMode = ref(false)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const studentToDelete = ref<StudentRecord | null>(null)

const studentForm = reactive({
  studentId: '',
  name: '',
  class: 9,
})

const formErrors = reactive<FormErrors>({
  studentId: '',
  name: '',
  class: '',
})

const toast = reactive<Toast>({
  show: false,
  message: '',
  type: 'success',
})

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

const tableTitle = computed(() => {
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

const displayData = computed(() => {
  if (!pagination.value) return allData.value
  const start = (pagination.value.currentPage - 1) * pagination.value.pageSize
  const end = start + pagination.value.pageSize
  return allData.value.slice(start, end)
})

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function formatAnswer(answer: any): string {
  if (answer === null || answer === undefined) return '-'
  if (Array.isArray(answer)) return answer.join(', ')
  return String(answer)
}

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
  if (!classNum) {
    await loadAllStudents()
  } else {
    await loadAllStudents(parseInt(classNum))
  }
}

async function fetchData(url: string, type: string) {
  loading.value = true
  error.value = ''
  allData.value = []
  statistics.value = null

  try {
    const response = await get(url)

    if (response.success && response.data) {
      if (type === 'wenId') {
        allData.value = response.data.students || []
        const students = response.data.students || []
        let totalCorrect = 0
        let totalWrong = 0
        let totalQuestions = 0
        students.forEach((student: any) => {
          totalCorrect += student.correctCount || 0
          totalWrong += student.wrongCount || 0
          totalQuestions += student.totalQuestions || 0
        })
        statistics.value = {
          totalStudents: response.data.studentCount || 0,
          totalCorrect,
          totalWrong,
          avgScore: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        }
      } else if (type === 'studentId') {
        allData.value = response.data.wenRecords || []
        statistics.value = {
          totalStudents: 1,
          totalCorrect: response.data.totalAllCorrect || 0,
          totalWrong: response.data.totalAllWrong || 0,
          avgScore: response.data.overallAvgScore || 0,
        }
      } else if (type === 'students') {
        allData.value = response.data || []
        statistics.value = {
          totalStudents: allData.value.length,
          totalCorrect: 0,
          totalWrong: 0,
          avgScore: 0,
        }
      }

      const total = allData.value.length
      pagination.value = {
        currentPage: 1,
        totalPages: Math.ceil(total / 10),
        pageSize: 10,
        total,
      }
    } else {
      error.value = response.message || '获取数据失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '网络请求失败'
    console.error('获取数据失败:', err)
  } finally {
    loading.value = false
  }
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

function handleSort() {
  if (!hasData.value) return

  if (sortBy.value === 'score') {
    allData.value.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
  } else {
    allData.value.sort((a, b) => {
      const dateA = new Date(a.submittedAt || a.created_at || 0)
      const dateB = new Date(b.submittedAt || b.created_at || 0)
      return dateB.getTime() - dateA.getTime()
    })
  }
}

function handleSearch() {
  if (!allData.value.length) return

  const keyword = searchKeyword.value.toLowerCase().trim()
  if (!keyword) {
    loadAllStudents()
    return
  }

  const filtered = allData.value.filter((student: any) => {
    const s = student as StudentRecord
    return s.student_id.toLowerCase().includes(keyword) || s.name.toLowerCase().includes(keyword)
  })

  allData.value = filtered
  if (pagination.value) {
    pagination.value.total = filtered.length
    pagination.value.totalPages = Math.ceil(filtered.length / pagination.value.pageSize)
    pagination.value.currentPage = 1
  }
}

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

function viewStudentDetail(student: any) {
  selectedStudent.value = student
  showStudentModal.value = true
}

function viewStudentAnswers(studentId: string) {
  queryForm.studentId = studentId
  activeTab.value = 'studentId'
  queryByStudentId()
}

function viewWenStudentDetail(student: any) {
  selectedStudentInfo.value = `${student.studentId} - ${student.studentName || '未知'}`
  selectedAnswers.value = student.answers || []
  showAnswerModal.value = true
}

function viewStudentWenDetail(record: any) {
  selectedStudentInfo.value = `${record.studentId} - ${record.studentName || '未知'}`
  selectedAnswers.value = record.answers || []
  showAnswerModal.value = true
}

function closeModals() {
  showStudentModal.value = false
  showAnswerModal.value = false
  selectedStudent.value = null
  selectedAnswers.value = []
}

function openAddModal() {
  isEditMode.value = false
  studentForm.studentId = ''
  studentForm.name = ''
  studentForm.class = 9
  formErrors.studentId = ''
  formErrors.name = ''
  formErrors.class = ''
  showStudentFormModal.value = true
}

function openEditModal(student: StudentRecord) {
  isEditMode.value = true
  studentForm.studentId = student.student_id
  studentForm.name = student.name
  studentForm.class = student.class || 9
  formErrors.studentId = ''
  formErrors.name = ''
  formErrors.class = ''
  selectedStudent.value = student
  showStudentFormModal.value = true
}

function closeFormModal() {
  showStudentFormModal.value = false
  selectedStudent.value = null
}

function validateForm(): boolean {
  let valid = true
  formErrors.studentId = ''
  formErrors.name = ''
  formErrors.class = ''

  if (!isEditMode.value) {
    const idValidation = validateStudentId(studentForm.studentId)
    if (!idValidation.valid) {
      formErrors.studentId = idValidation.error!
      valid = false
    }
  }

  const nameValidation = validateStudentName(studentForm.name)
  if (!nameValidation.valid) {
    formErrors.name = nameValidation.error!
    valid = false
  }

  if (!studentForm.class || studentForm.class <= 0) {
    formErrors.class = '请输入有效的班级号'
    valid = false
  }

  return valid
}

async function handleSubmitForm() {
  if (!validateForm()) return

  isSubmitting.value = true

  try {
    let result
    if (isEditMode.value && selectedStudent.value) {
      result = await updateStudent(selectedStudent.value.student_id, {
        name: studentForm.name.trim(),
        class: studentForm.class,
      })
    } else {
      result = await createStudent({
        studentId: studentForm.studentId.trim(),
        name: studentForm.name.trim(),
        class: studentForm.class,
      })
    }

    if (result.success) {
      showToast(isEditMode.value ? '学生信息修改成功' : '学生添加成功', 'success')
      closeFormModal()
      await loadAllStudents()
    } else {
      showToast(result.message, 'error')
    }
  } catch (err) {
    showToast('操作失败，请重试', 'error')
  } finally {
    isSubmitting.value = false
  }
}

function confirmDelete(student: StudentRecord) {
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
      await loadAllStudents()
    } else {
      showToast(result.message, 'error')
    }
  } catch (err) {
    showToast('删除失败，请重试', 'error')
  } finally {
    isDeleting.value = false
  }
}

function exportData() {
  if (!hasData.value) return

  let csvContent = ''
  let headers: string[] = []

  if (activeTab.value === 'students') {
    headers = ['学号', '姓名', '创建时间']
    csvContent = headers.join(',') + '\n'
    allData.value.forEach((row: any) => {
      csvContent += `${row.student_id},${row.name || ''},${row.created_at || ''}\n`
    })
  } else if (activeTab.value === 'wenId') {
    headers = ['学号', '姓名', '答题数', '正确数', '错误数', '平均分']
    csvContent = headers.join(',') + '\n'
    allData.value.forEach((row: any) => {
      csvContent += `${row.studentId},${row.studentName || ''},${row.totalQuestions || 0},${row.correctCount || 0},${row.wrongCount || 0},${row.avgScore || 0}\n`
    })
  } else if (activeTab.value === 'studentId') {
    headers = ['文言文ID', '答题时间', '答题数', '正确数', '平均分']
    csvContent = headers.join(',') + '\n'
    allData.value.forEach((row: any) => {
      csvContent += `${row.wenId},${row.submittedAt || ''},${row.totalQuestions || 0},${row.correctCount || 0},${row.avgScore || 0}\n`
    })
  }

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `答题数据_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
}

loadAllStudents()
</script>

<style scoped>
.answer-query-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.page-header .subtitle {
  color: #6b7280;
}

.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 2000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast.success {
  background: #10b981;
  color: white;
}

.toast.error {
  background: #ef4444;
  color: white;
}

.toast-icon {
  font-size: 1.2rem;
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

.query-form {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.form-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.tabs-left {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-start;
}

.tabs-right {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.tab-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #e5e7eb;
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
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
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
}

.left-buttons {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: flex-start;
}

.search-group {
  display: flex;
  gap: 0;
}

.search-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem 0 0 0.375rem;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.search-btn {
  padding: 0.75rem 1rem;
  background: #3b82f6;
  border: none;
  border-radius: 0 0.375rem 0.375rem 0;
  color: white;
  cursor: pointer;
}

.class-filter {
  display: flex;
  align-items: center;
}

.class-select {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  min-width: 120px;
}

.class-select:focus {
  outline: none;
  border-color: #3b82f6;
}

.add-btn {
  padding: 0.75rem 1.5rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  transition: all 0.2s;
}

.add-btn:hover {
  background: #059669;
}

.form-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.form-group {
  flex: 1;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.error {
  border-color: #ef4444;
}

.form-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.error-text {
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  display: block;
}

.required {
  color: #ef4444;
}

.query-btn {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.query-btn:hover {
  background: #2563eb;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1.25rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #3b82f6;
}

.stat-card.success {
  border-left-color: #10b981;
}

.stat-card.warning {
  border-left-color: #f59e0b;
}

.stat-card.info {
  border-left-color: #06b6d4;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.table-container {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 1rem;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.table-header h3 {
  margin: 0;
  color: #1f2937;
}

.table-actions {
  display: flex;
  gap: 0.75rem;
}

.sort-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.export-btn {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover:not(:disabled) {
  background: #059669;
}

.export-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.data-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.data-table tr:hover {
  background: #f9fafb;
}

.data-table .correct {
  color: #10b981;
  font-weight: 500;
}

.data-table .wrong {
  color: #ef4444;
  font-weight: 500;
}

.actions-cell {
  white-space: nowrap;
}

.action-btn {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  margin-right: 0.375rem;
  transition: all 0.2s;
}

.view-btn {
  background: #f3f4f6;
  color: #374151;
}

.view-btn:hover {
  background: #e5e7eb;
}

.edit-btn {
  background: #fef3c7;
  color: #d97706;
}

.edit-btn:hover {
  background: #fde68a;
}

.answer-btn {
  background: #dbeafe;
  color: #2563eb;
}

.answer-btn:hover {
  background: #bfdbfe;
}

.detail-btn {
  background: #3b82f6;
  color: white;
}

.detail-btn:hover {
  background: #2563eb;
}

.delete-btn {
  background: #fee2e2;
  color: #dc2626;
}

.delete-btn:hover {
  background: #fecaca;
}

.loading-state,
.error-state,
.empty-state {
  padding: 3rem;
  text-align: center;
}

.loading-state .spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  color: #ef4444;
}

.error-state .error-icon {
  font-size: 2rem;
  margin-right: 0.5rem;
}

.empty-state {
  color: #6b7280;
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #6b7280;
  font-size: 0.875rem;
}

.modal-overlay {
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
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 0.5rem;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #f3f4f6;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: calc(80vh - 6rem);
}

.detail-row {
  margin-bottom: 0.75rem;
}

.detail-label {
  font-weight: 500;
  color: #6b7280;
  margin-right: 0.5rem;
}

.detail-value {
  color: #1f2937;
}

.student-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.cancel-btn {
  padding: 0.625rem 1.25rem;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.submit-btn {
  padding: 0.625rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
}

.submit-btn:hover:not(:disabled) {
  background: #2563eb;
}

.submit-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.danger-btn {
  padding: 0.625rem 1.5rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
}

.danger-btn:hover:not(:disabled) {
  background: #dc2626;
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-small {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.answer-detail-header {
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-weight: 500;
  color: #374151;
}

.answer-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  overflow: hidden;
}

.answer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
}

.question-num {
  font-weight: 600;
  color: #374151;
}

.score-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #fee2e2;
  color: #dc2626;
}

.score-badge.correct {
  background: #d1fae5;
  color: #059669;
}

.answer-content {
  padding: 0.75rem;
}

.answer-row {
  margin-bottom: 0.5rem;
}

.answer-row:last-child {
  margin-bottom: 0;
}

.answer-row .label {
  color: #6b7280;
  font-size: 0.875rem;
  margin-right: 0.5rem;
}

.answer-row .value {
  color: #1f2937;
  font-size: 0.875rem;
}

.answer-row .value.correct {
  color: #10b981;
  font-weight: 500;
}

.confirm-content {
  text-align: center;
  margin-bottom: 1.5rem;
}

.warning-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.confirm-content p {
  margin: 0.5rem 0;
  color: #374151;
}

.sub-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.sub-text.danger {
  color: #ef4444;
  font-weight: 500;
}

@media (max-width: 768px) {
  .answer-query-container {
    padding: 1rem;
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
    gap: 0.75rem;
    align-items: flex-start;
  }

  .table-actions {
    width: 100%;
    justify-content: space-between;
  }

  .data-table {
    display: block;
    overflow-x: auto;
  }

  .action-btn {
    margin-bottom: 0.25rem;
    margin-right: 0.25rem;
  }

  .modal-content {
    width: 100%;
    margin: 0.5rem;
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
