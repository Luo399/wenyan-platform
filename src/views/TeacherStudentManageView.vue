<template>
  <div class="manage-page">
    <div class="header">
      <h2>学生管理</h2>
      <div class="actions">
        <button class="btn-primary" @click="showAddModal = true">+ 新增学生</button>
        <button class="btn-secondary" @click="goBack">返回首页</button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <label>按班级筛选：</label>
      <select v-model="filterClass" @change="loadStudents">
        <option value="">全部</option>
        <option v-for="cls in myClasses" :key="cls" :value="cls">{{ cls }}</option>
      </select>
    </div>

    <!-- 学生列表 -->
    <div class="student-table-wrap">
      <table class="student-table">
        <thead>
          <tr>
            <th>学号</th>
            <th>姓名</th>
            <th>年级</th>
            <th>班级</th>
            <th>序号</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filteredStudents" :key="s.student_id">
            <td>{{ s.student_id }}</td>
            <td>{{ s.student_name || '-' }}</td>
            <td>{{ s.student_id.substring(0, 4) }}</td>
            <td>{{ s.student_id.substring(4, 6) }}</td>
            <td>{{ s.student_id.substring(6, 8) }}</td>
            <td class="actions">
              <button class="btn-small" @click="openEdit(s)">编辑</button>
              <button class="btn-small btn-warning" @click="resetPassword(s)">重置密码</button>
              <button class="btn-small btn-danger" @click="confirmDelete(s)">删除</button>
            </td>
          </tr>
          <tr v-if="students.length === 0">
            <td colspan="6" class="empty">暂无学生数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h3>{{ showEditModal ? '编辑学生' : '新增学生' }}</h3>

        <div v-if="modalError" class="modal-error">{{ modalError }}</div>

        <div class="form-group">
          <label>学号 <span class="required">*</span></label>
          <input
            v-model="modalForm.student_id"
            type="text"
            maxlength="8"
            placeholder="8位数字（如 20240001）"
            :disabled="showEditModal"
          />
          <span class="hint">前4位年级 + 中2位班级 + 后2位序号</span>
        </div>

        <div class="form-group">
          <label>姓名 <span class="required">*</span></label>
          <input v-model="modalForm.student_name" type="text" placeholder="请输入姓名" />
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeModal">取消</button>
          <button class="btn-primary" @click="saveStudent" :disabled="!canSave">
            {{ isSaving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content confirm">
        <h3>确认删除</h3>
        <p>确定要删除学生 <strong>{{ deleteTarget?.student_name || deleteTarget?.student_id }}</strong> 吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="btn-danger" @click="doDelete" :disabled="isDeleting">
            {{ isDeleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { get, post, put, del } from '@/utils/api'

const router = useRouter()
const authStore = useAuthStore()

interface Student {
  id: number
  student_id: string
  student_name: string | null
}

const students = ref<Student[]>([])
const filterClass = ref('')
const loading = ref(false)

const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const modalError = ref('')

const modalForm = ref({ student_id: '', student_name: '' })
const editOriginalId = ref('')
const deleteTarget = ref<Student | null>(null)

const myClasses = computed(() => {
  if (authStore.isAdmin) return []
  const u = authStore.user as { classes?: string[] } | null
  return u?.classes || []
})

const filteredStudents = computed(() => {
  if (!filterClass.value) return students.value
  return students.value.filter(s => s.student_id.startsWith(filterClass.value))
})

const canSave = computed(() => {
  return /^\d{8}$/.test(modalForm.value.student_id) && modalForm.value.student_name.trim().length > 0
})

function goBack() {
  router.push('/')
}

async function loadStudents() {
  loading.value = true
  try {
    const res = await get<Student[]>('/api/teacher/students')
    if (res.success && res.data) {
      students.value = res.data
    }
  } catch (err) {
    console.error('加载学生列表失败:', err)
  } finally {
    loading.value = false
  }
}

function closeModal() {
  showAddModal.value = false
  showEditModal.value = false
  modalForm.value = { student_id: '', student_name: '' }
  editOriginalId.value = ''
  modalError.value = ''
}

function openEdit(s: Student) {
  showEditModal.value = true
  modalForm.value = { student_id: s.student_id, student_name: s.student_name || '' }
  editOriginalId.value = s.student_id
}

async function saveStudent() {
  if (!canSave.value) return
  isSaving.value = true
  modalError.value = ''

  try {
    if (showEditModal.value) {
      const body: Record<string, string> = { student_name: modalForm.value.student_name.trim() }
      if (modalForm.value.student_id !== editOriginalId.value) {
        body.new_student_id = modalForm.value.student_id
      }
      const res = await put(`/api/teacher/students/${editOriginalId.value}`, body)
      if (!res.success) {
        modalError.value = res.message || '更新失败'
        return
      }
    } else {
      const res = await post('/api/teacher/students', {
        student_id: modalForm.value.student_id,
        student_name: modalForm.value.student_name.trim(),
      })
      if (!res.success) {
        modalError.value = res.message || '创建失败'
        return
      }
    }
    closeModal()
    await loadStudents()
  } catch (err) {
    modalError.value = '操作失败，请重试'
  } finally {
    isSaving.value = false
  }
}

function confirmDelete(s: Student) {
  deleteTarget.value = s
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    const res = await del(`/api/teacher/students/${deleteTarget.value.student_id}`)
    if (res.success) {
      showDeleteConfirm.value = false
      deleteTarget.value = null
      await loadStudents()
    }
  } catch (err) {
    console.error('删除失败:', err)
  } finally {
    isDeleting.value = false
  }
}

async function resetPassword(s: Student) {
  if (!confirm(`确定将学生 ${s.student_name || s.student_id} 的密码重置为 123456 吗？`)) return
  try {
    const res = await post('/api/auth/reset-student-password', { student_id: s.student_id })
    if (res.success) {
      alert('密码已重置为 123456')
    } else {
      alert(res.message || '重置失败')
    }
  } catch (err) {
    alert('重置失败')
  }
}

onMounted(() => {
  loadStudents()
})
</script>

<style scoped>
.manage-page {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header h2 {
  font-size: 1.5rem;
  color: #1a1a1a;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.filter-bar select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.student-table-wrap {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.student-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.student-table th,
.student-table td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.student-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.student-table tr:hover {
  background: #f9fafb;
}

.student-table .empty {
  text-align: center;
  color: #9ca3af;
  padding: 2rem;
}

.student-table .actions {
  display: flex;
  gap: 0.5rem;
}

.btn-small {
  padding: 0.375rem 0.625rem;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  background: #e0e7ff;
  color: #4f46e5;
}

.btn-small:hover {
  background: #c7d2fe;
}

.btn-small.btn-warning {
  background: #fef3c7;
  color: #d97706;
}

.btn-small.btn-warning:hover {
  background: #fde68a;
}

.btn-small.btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.btn-small.btn-danger:hover {
  background: #fecaca;
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
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.modal-content.confirm {
  text-align: center;
}

.modal-content h3 {
  margin-bottom: 1rem;
  color: #1a1a1a;
}

.modal-error {
  padding: 0.625rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.modal-content .form-group {
  margin-bottom: 1rem;
}

.modal-content .form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.modal-content .form-group input {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.modal-content .hint {
  font-size: 0.75rem;
  color: #9ca3af;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.btn-cancel {
  padding: 0.625rem 1rem;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.btn-danger {
  padding: 0.625rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.btn-danger:hover {
  background: #dc2626;
}
</style>
