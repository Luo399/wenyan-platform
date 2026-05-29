<!--
  AnswerQueryView.vue - 学生答题情况查询页面
  
  功能说明：
  - 支持按文言文ID和学生ID查询答题情况
  - 展示学生列表和答题记录
  - 提供数据筛选、排序和分页功能
  - 支持数据导出和可视化展示
-->
<template>
  <div class="answer-query-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>学生答题情况查询</h1>
      <p class="subtitle">查看学生的答题记录和统计信息</p>
    </div>

    <!-- 查询表单 -->
    <div class="query-form">
      <div class="form-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
        </button>
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
              placeholder="如：1234"
              class="form-input"
            />
          </div>
          <button class="query-btn" @click="queryByStudentId">查询</button>
        </div>
      </div>

      <!-- 查询所有学生 -->
      <div v-show="activeTab === 'students'" class="tab-content">
        <button class="query-btn" @click="loadAllStudents">加载所有学生</button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div v-if="statistics" class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ statistics.totalStudents }}</div>
        <div class="stat-label">学生总数</div>
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
            <span>导出Excel</span>
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
        <p>请选择查询方式并点击查询</p>
      </div>

      <!-- 学生列表 -->
      <table v-else-if="activeTab === 'students'" class="data-table">
        <thead>
          <tr>
            <th>学号</th>
            <th>姓名</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in displayData" :key="student.student_id">
            <td>{{ student.student_id }}</td>
            <td>{{ student.name }}</td>
            <td>{{ formatDate(student.created_at) }}</td>
            <td>
              <button class="action-btn view-btn" @click="viewStudentDetail(student)">查看详情</button>
              <button class="action-btn answer-btn" @click="viewStudentAnswers(student.student_id)">答题记录</button>
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
              <button class="action-btn detail-btn" @click="viewWenStudentDetail(student)">查看详情</button>
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
              <button class="action-btn detail-btn" @click="viewStudentWenDetail(record)">查看详情</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="hasData && pagination" class="pagination">
      <button 
        class="page-btn" 
        :disabled="pagination.currentPage <= 1"
        @click="prevPage"
      >上一页</button>
      <span class="page-info">
        第 {{ pagination.currentPage }} / {{ pagination.totalPages }} 页
      </span>
      <button 
        class="page-btn" 
        :disabled="pagination.currentPage >= pagination.totalPages"
        @click="nextPage"
      >下一页</button>
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
            <span>学生：{{ selectedStudentInfo }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { get } from '@/utils/api'

// 查询标签页
const tabs = [
  { id: 'wenId', name: '按文言文ID查询' },
  { id: 'studentId', name: '按学生ID查询' },
  { id: 'students', name: '学生列表' },
]

// 状态
const activeTab = ref('students')
const loading = ref(false)
const error = ref('')
const queryForm = reactive({
  wenId: '',
  studentId: ''
})
const allData = ref<any[]>([])
const statistics = ref<{
  totalStudents: number
  totalCorrect: number
  totalWrong: number
  avgScore: number
} | null>(null)

// 分页
const pagination = ref<{
  currentPage: number
  totalPages: number
  pageSize: number
} | null>(null)

// 弹窗状态
const showStudentModal = ref(false)
const showAnswerModal = ref(false)
const selectedStudent = ref<any>(null)
const selectedAnswers = ref<any[]>([])
const selectedStudentInfo = ref('')

// 排序
const sortBy = ref('time')

// 表格标题
const tableTitle = computed(() => {
  switch (activeTab.value) {
    case 'wenId': return '文言文答题情况'
    case 'studentId': return '学生答题记录'
    case 'students': return '学生列表'
    default: return '数据列表'
  }
})

// 是否有数据
const hasData = computed(() => allData.value.length > 0)

// 显示数据（分页后）
const displayData = computed(() => {
  if (!pagination.value) return allData.value
  const start = (pagination.value.currentPage - 1) * pagination.value.pageSize
  const end = start + pagination.value.pageSize
  return allData.value.slice(start, end)
})

// 格式化日期
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

// 格式化答案
function formatAnswer(answer: any): string {
  if (answer === null || answer === undefined) return '-'
  if (Array.isArray(answer)) return answer.join(', ')
  return String(answer)
}

// 按文言文ID查询
async function queryByWenId() {
  const wenId = queryForm.wenId.trim()
  if (!wenId) {
    error.value = '请输入文言文ID'
    return
  }

  await fetchData(`/api/answers/wen/${wenId}`, 'wenId')
}

// 按学生ID查询
async function queryByStudentId() {
  const studentId = queryForm.studentId.trim()
  if (!studentId) {
    error.value = '请输入学生学号'
    return
  }

  await fetchData(`/api/answers/student/${studentId}`, 'studentId')
}

// 加载所有学生
async function loadAllStudents() {
  await fetchData('/api/students', 'students')
}

// 获取数据
async function fetchData(url: string, type: string) {
  loading.value = true
  error.value = ''
  allData.value = []
  statistics.value = null

  try {
    const response = await get(url)
    
    if (response.success && response.data) {
      if (type === 'wenId') {
        // 按文言文查询结果
        allData.value = response.data.students || []
        statistics.value = {
          totalStudents: response.data.studentCount || 0,
          totalCorrect: 0,
          totalWrong: 0,
          avgScore: 0
        }
      } else if (type === 'studentId') {
        // 按学生查询结果
        allData.value = response.data.wenRecords || []
        statistics.value = {
          totalStudents: 1,
          totalCorrect: response.data.totalAllCorrect || 0,
          totalWrong: response.data.totalAllWrong || 0,
          avgScore: response.data.overallAvgScore || 0
        }
      } else if (type === 'students') {
        // 学生列表
        allData.value = response.data || []
        statistics.value = {
          totalStudents: allData.value.length,
          totalCorrect: 0,
          totalWrong: 0,
          avgScore: 0
        }
      }

      // 设置分页
      const total = allData.value.length
      pagination.value = {
        currentPage: 1,
        totalPages: Math.ceil(total / 10),
        pageSize: 10
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

// 重试查询
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

// 排序处理
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

// 分页
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

// 查看学生详情
function viewStudentDetail(student: any) {
  selectedStudent.value = student
  showStudentModal.value = true
}

// 查看学生答题记录
function viewStudentAnswers(studentId: string) {
  queryForm.studentId = studentId
  activeTab.value = 'studentId'
  queryByStudentId()
}

// 查看文言文学生详情
function viewWenStudentDetail(student: any) {
  selectedStudentInfo.value = `${student.studentId} - ${student.studentName || '未知'}`
  selectedAnswers.value = student.answers || []
  showAnswerModal.value = true
}

// 查看学生文言文详情
function viewStudentWenDetail(record: any) {
  selectedStudentInfo.value = record.wenId
  selectedAnswers.value = record.answers || []
  showAnswerModal.value = true
}

// 关闭弹窗
function closeModals() {
  showStudentModal.value = false
  showAnswerModal.value = false
  selectedStudent.value = null
  selectedAnswers.value = []
}

// 导出数据
function exportData() {
  if (!hasData.value) return

  let csvContent = ''
  let headers: string[] = []

  if (activeTab.value === 'students') {
    headers = ['学号', '姓名', '创建时间']
    csvContent = headers.join(',') + '\n'
    allData.value.forEach(row => {
      csvContent += `${row.student_id},${row.name || ''},${row.created_at || ''}\n`
    })
  } else if (activeTab.value === 'wenId') {
    headers = ['学号', '姓名', '答题数', '正确数', '错误数', '平均分']
    csvContent = headers.join(',') + '\n'
    allData.value.forEach(row => {
      csvContent += `${row.studentId},${row.studentName || ''},${row.totalQuestions || 0},${row.correctCount || 0},${row.wrongCount || 0},${row.avgScore || 0}\n`
    })
  } else if (activeTab.value === 'studentId') {
    headers = ['文言文ID', '答题时间', '答题数', '正确数', '平均分']
    csvContent = headers.join(',') + '\n'
    allData.value.forEach(row => {
      csvContent += `${row.wenId},${row.submittedAt || ''},${row.totalQuestions || 0},${row.correctCount || 0},${row.avgScore || 0}\n`
    })
  }

  // 下载CSV文件
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `答题数据_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
}

// 页面加载时自动加载学生列表
loadAllStudents()
</script>

<style scoped>
.answer-query-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* 页面标题 */
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

/* 查询表单 */
.query-form {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.form-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
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
  from { opacity: 0; }
  to { opacity: 1; }
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

/* 统计卡片 */
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

/* 表格容器 */
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
  display: flex;
  align-items: center;
  gap: 0.375rem;
  transition: all 0.2s;
}

.export-btn:hover:not(:disabled) {
  background: #059669;
}

.export-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

/* 数据表格 */
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

/* 操作按钮 */
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

/* 状态显示 */
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
  to { transform: rotate(360deg); }
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

/* 分页 */
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

/* 弹窗 */
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
  max-width: 600px;
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

/* 学生详情 */
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

/* 答题详情 */
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

/* 响应式设计 */
@media (max-width: 768px) {
  .answer-query-container {
    padding: 1rem;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
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
    margin-right: 0;
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