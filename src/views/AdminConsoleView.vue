<!--
  AdminConsoleView.vue - 管理员账号管理控制台

  功能说明：
  - 教师账号：新增 / 查询 / 修改（姓名·学校·所教班级·状态）/ 删除 / 重置密码
  - 学生账号：新增 / 查询 / 修改（姓名·班级）/ 删除 / 重置密码
  所有请求统一走 services/adminService.ts 封装。
-->
<template>
  <div class="admin-console">
    <header class="console-header">
      <div class="header-main">
        <h1>管理员控制台</h1>
        <p class="subtitle">教师与学生账号的增删查改</p>
      </div>
      <button type="button" class="back-btn" @click="goHome">← 返回首页</button>
    </header>

    <nav class="tab-bar">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'teacher' }"
        @click="switchTab('teacher')"
      >
        教师账号
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'student' }"
        @click="switchTab('student')"
      >
        学生账号
      </button>
    </nav>

    <p v-if="loading" class="loading-tip">加载中...</p>

    <!-- ============ 教师账号 ============ -->
    <section v-show="activeTab === 'teacher'" class="panel">
      <form class="edit-form" @submit.prevent="submitTeacher">
        <h2>{{ editingTeacherPhone ? '修改教师账号' : '新增教师账号' }}</h2>
        <div class="form-grid">
          <label class="field">
            <span>手机号/用户名</span>
            <input v-model.trim="teacherForm.phone" type="text" :disabled="!!editingTeacherPhone" placeholder="如 a001" />
          </label>
          <label class="field">
            <span>姓名</span>
            <input v-model.trim="teacherForm.name" type="text" placeholder="教师姓名" />
          </label>
          <label class="field">
            <span>密码{{ editingTeacherPhone ? '（留空则不改）' : '' }}</span>
            <input v-model="teacherForm.password" type="text" placeholder="不少于 6 位" />
          </label>
          <label class="field">
            <span>学校 ID</span>
            <input v-model.number="teacherForm.schoolId" type="number" min="1" />
          </label>
          <label class="field">
            <span>所教班级（逗号分隔 6 位编码）</span>
            <input v-model.trim="teacherForm.classCodesText" type="text" placeholder="如 202401,202402" />
          </label>
          <label v-if="editingTeacherPhone" class="field">
            <span>状态</span>
            <select v-model="teacherForm.status">
              <option value="active">启用</option>
              <option value="disabled">禁用</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="primary-btn" :disabled="submitting">
            {{ submitting ? '提交中...' : editingTeacherPhone ? '保存修改' : '创建教师' }}
          </button>
          <button v-if="editingTeacherPhone" type="button" class="plain-btn" @click="cancelTeacherEdit">
            取消修改
          </button>
        </div>
      </form>

      <div class="table-wrap">
        <div class="table-head-row">
          <h2>教师列表（{{ teachers.length }}）</h2>
          <div class="filter-row">
            <select v-model="teacherFilter" @change="loadTeachers">
              <option value="">全部状态</option>
              <option value="pending">待审批</option>
              <option value="active">已激活</option>
              <option value="disabled">已禁用</option>
            </select>
            <button type="button" class="plain-btn" @click="loadTeachers">刷新</button>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>手机号</th>
              <th>姓名</th>
              <th>学校</th>
              <th>所教班级</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in teachers" :key="t.phone">
              <td>{{ t.phone }}</td>
              <td>{{ t.name }}</td>
              <td>{{ t.school_name || t.school_id || '-' }}</td>
              <td>{{ (t.class_codes || []).join(', ') || '-' }}</td>
              <td>{{ t.status === 'pending' ? '待审批' : t.status === 'active' ? '启用' : '禁用' }}</td>
              <td class="op-cell">
                <button v-if="t.status === 'pending'" type="button" class="link-btn" @click="approveTeacherFn(t)">审批通过</button>
                <button type="button" class="link-btn" @click="editTeacher(t)">修改</button>
                <button type="button" class="link-btn" @click="resetTeacherPwd(t)">重置密码</button>
                <button type="button" class="link-btn danger" @click="removeTeacher(t)">删除</button>
              </td>
            </tr>
            <tr v-if="teachers.length === 0">
              <td colspan="6" class="empty-cell">暂无教师账号</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ============ 学生账号 ============ -->
    <section v-show="activeTab === 'student'" class="panel">
      <form class="edit-form" @submit.prevent="submitStudent">
        <h2>{{ editingStudentId ? '修改学生账号' : '新增学生账号' }}</h2>
        <div class="form-grid">
          <label class="field">
            <span>学号</span>
            <input v-model.trim="studentForm.studentId" type="text" :disabled="!!editingStudentId" placeholder="8 位学号（格式 YYYYNNNN）" />
          </label>
          <label class="field">
            <span>姓名</span>
            <input v-model.trim="studentForm.studentName" type="text" placeholder="学生姓名" />
          </label>
          <label class="field">
            <span>班级编码（6 位）</span>
            <input v-model.trim="studentForm.classCode" type="text" placeholder="留空则取学号前 6 位" />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="primary-btn" :disabled="submitting">
            {{ submitting ? '提交中...' : editingStudentId ? '保存修改' : '创建学生' }}
          </button>
          <button v-if="editingStudentId" type="button" class="plain-btn" @click="cancelStudentEdit">
            取消修改
          </button>
        </div>
      </form>

      <div class="table-wrap">
        <div class="table-head-row">
          <h2>学生列表（{{ students.length }}）</h2>
          <div class="filter-row">
            <input v-model.trim="studentFilter" type="text" placeholder="按班级编码筛选" />
            <button type="button" class="plain-btn" @click="loadStudents">刷新</button>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>学号</th>
              <th>姓名</th>
              <th>班级</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in students" :key="s.student_id">
              <td>{{ s.student_id }}</td>
              <td>{{ s.student_name }}</td>
              <td>{{ s.class_code }}</td>
              <td class="op-cell">
                <button type="button" class="link-btn" @click="editStudent(s)">修改</button>
                <button type="button" class="link-btn" @click="resetStudentPwd(s)">重置密码</button>
                <button type="button" class="link-btn danger" @click="removeStudent(s)">删除</button>
              </td>
            </tr>
            <tr v-if="students.length === 0">
              <td colspan="4" class="empty-cell">暂无学生账号</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Transition name="fade">
      <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { debugError } from '@/utils/debug'
import {
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  approveTeacher,
  resetTeacherPassword,
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudentPassword,
  type AdminTeacher,
  type AdminStudent,
} from '@/services/adminService'

const router = useRouter()

const activeTab = ref<'teacher' | 'student'>('teacher')
const loading = ref(false)
const submitting = ref(false)
const teachers = ref<AdminTeacher[]>([])
const students = ref<AdminStudent[]>([])
const teacherFilter = ref<'pending' | 'active' | 'disabled' | ''>('')
const studentFilter = ref('')

const editingTeacherPhone = ref('')
const editingStudentId = ref('')

const teacherForm = reactive({
  phone: '',
  name: '',
  password: '',
  schoolId: 1,
  classCodesText: '',
  status: 'active' as 'pending' | 'active' | 'disabled',
})

const studentForm = reactive({
  studentId: '',
  studentName: '',
  classCode: '',
})

const toast = reactive({ show: false, type: 'success' as 'success' | 'error', message: '' })
let toastTimer: ReturnType<typeof setTimeout> | null = null

/** 展示操作反馈 */
function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  toast.show = true
  toast.type = type
  toast.message = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.show = false
  }, 3000)
}

/** 解析班级编码文本：逗号/空格分隔，过滤空值 */
function parseClassCodes(text: string): string[] {
  return text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function loadTeachers(): Promise<void> {
  try {
    teachers.value = await listTeachers(teacherFilter.value || undefined)
  } catch (err) {
    debugError('[AdminConsole] 加载教师列表失败:', err)
    showToast(err instanceof Error ? err.message : '加载教师列表失败', 'error')
  }
}

async function loadStudents(): Promise<void> {
  try {
    students.value = await listStudents(studentFilter.value || undefined)
  } catch (err) {
    debugError('[AdminConsole] 加载学生列表失败:', err)
    showToast(err instanceof Error ? err.message : '加载学生列表失败', 'error')
  }
}

async function switchTab(tab: 'teacher' | 'student'): Promise<void> {
  activeTab.value = tab
  loading.value = true
  try {
    if (tab === 'teacher') {
      await loadTeachers()
    } else {
      await loadStudents()
    }
  } finally {
    loading.value = false
  }
}

/** 新增或更新教师 */
async function submitTeacher(): Promise<void> {
  if (!teacherForm.phone || !teacherForm.name) {
    showToast('请填写手机号与姓名', 'error')
    return
  }
  const classCodes = parseClassCodes(teacherForm.classCodesText)
  if (classCodes.length === 0) {
    showToast('请至少填写一个所教班级（6 位编码）', 'error')
    return
  }
  if (!editingTeacherPhone.value && (!teacherForm.password || teacherForm.password.length < 6)) {
    showToast('新增教师时密码不能少于 6 位', 'error')
    return
  }

  submitting.value = true
  try {
    const result = editingTeacherPhone.value
      ? await updateTeacher(editingTeacherPhone.value, {
          name: teacherForm.name,
          school_id: teacherForm.schoolId,
          class_codes: classCodes,
          ...(teacherForm.status !== 'pending' ? { status: teacherForm.status } : {}),
        })
      : await createTeacher({
          phone: teacherForm.phone,
          name: teacherForm.name,
          password: teacherForm.password,
          school_id: teacherForm.schoolId,
          class_codes: classCodes,
        })

    if (!result.success) {
      showToast(result.message, 'error')
      return
    }
    showToast(result.message)
    cancelTeacherEdit()
    await loadTeachers()
  } finally {
    submitting.value = false
  }
}

function editTeacher(t: AdminTeacher): void {
  editingTeacherPhone.value = t.phone
  teacherForm.phone = t.phone
  teacherForm.name = t.name
  teacherForm.password = ''
  teacherForm.schoolId = t.school_id || 1
  teacherForm.classCodesText = (t.class_codes || []).join(',')
  teacherForm.status = t.status
}

function cancelTeacherEdit(): void {
  editingTeacherPhone.value = ''
  teacherForm.phone = ''
  teacherForm.name = ''
  teacherForm.password = ''
  teacherForm.schoolId = 1
  teacherForm.classCodesText = ''
  teacherForm.status = 'active'
}

async function removeTeacher(t: AdminTeacher): Promise<void> {
  if (!window.confirm(`确认删除教师 ${t.phone}？该操作不可恢复。`)) return
  const result = await deleteTeacher(t.phone)
  showToast(result.message, result.success ? 'success' : 'error')
  if (result.success) await loadTeachers()
}

async function resetTeacherPwd(t: AdminTeacher): Promise<void> {
  const result = await resetTeacherPassword(t.phone)
  const tip = result.data?.temporary_password
    ? `${result.message}：${result.data.temporary_password}`
    : result.message
  showToast(tip, result.success ? 'success' : 'error')
}

async function approveTeacherFn(t: AdminTeacher): Promise<void> {
  const result = await approveTeacher(t.phone)
  showToast(result.message, result.success ? 'success' : 'error')
  if (result.success) await loadTeachers()
}

/** 新增或更新学生 */
async function submitStudent(): Promise<void> {
  if (!studentForm.studentId || !studentForm.studentName) {
    showToast('请填写学号与姓名', 'error')
    return
  }
  submitting.value = true
  try {
    const result = editingStudentId.value
      ? await updateStudent(editingStudentId.value, {
          student_name: studentForm.studentName,
          class_code: studentForm.classCode || undefined,
        })
      : await createStudent({
          student_id: studentForm.studentId,
          student_name: studentForm.studentName,
          class_code: studentForm.classCode || undefined,
        })

    showToast(result.message, result.success ? 'success' : 'error')
    if (!result.success) return
    cancelStudentEdit()
    await loadStudents()
  } finally {
    submitting.value = false
  }
}

function editStudent(s: AdminStudent): void {
  editingStudentId.value = s.student_id
  studentForm.studentId = s.student_id
  studentForm.studentName = s.student_name
  studentForm.classCode = s.class_code
}

function cancelStudentEdit(): void {
  editingStudentId.value = ''
  studentForm.studentId = ''
  studentForm.studentName = ''
  studentForm.classCode = ''
}

async function removeStudent(s: AdminStudent): Promise<void> {
  if (!window.confirm(`确认删除学生 ${s.student_id}？该操作不可恢复。`)) return
  const result = await deleteStudent(s.student_id)
  showToast(result.message, result.success ? 'success' : 'error')
  if (result.success) await loadStudents()
}

async function resetStudentPwd(s: AdminStudent): Promise<void> {
  const result = await resetStudentPassword(s.student_id)
  showToast(result.message, result.success ? 'success' : 'error')
}

function goHome(): void {
  router.push('/')
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadTeachers(), loadStudents()])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.admin-console {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--spacing-lg) var(--spacing-md) var(--spacing-xl);
  font-family: var(--font-family-serif);
  color: var(--color-text);
}

.console-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.console-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.back-btn,
.plain-btn,
.primary-btn,
.link-btn,
.tab-btn {
  font-family: var(--font-family-serif);
  cursor: pointer;
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.875rem;
}

.tab-bar {
  display: flex;
  gap: var(--spacing-sm);
  border-bottom: var(--border-width-hairline) solid var(--color-border);
  margin-bottom: var(--spacing-lg);
}

.tab-btn {
  background: none;
  border: none;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.edit-form {
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--spacing-md);
  background: var(--color-white);
}

.edit-form h2,
.table-head-row h2 {
  margin: 0 0 var(--spacing-sm);
  font-size: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.field input,
.field select,
.filter-row input,
.filter-row select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-size: 0.9rem;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.primary-btn {
  background: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-button);
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: 0.9rem;
}

.primary-btn:disabled {
  background: var(--color-placeholder);
  cursor: not-allowed;
}

.plain-btn {
  background: none;
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 0.8rem;
  color: var(--color-text);
}

.table-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.filter-row {
  display: flex;
  gap: var(--spacing-xs);
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

.op-cell {
  display: flex;
  gap: var(--spacing-xs);
}

.link-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.8rem;
  padding: 0;
}

.link-btn.danger {
  color: var(--color-primary);
  text-decoration: underline;
}

.empty-cell,
.loading-tip {
  text-align: center;
  color: var(--color-text-secondary);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 2rem;
  transform: translateX(-50%);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-small);
  font-size: 0.85rem;
  color: var(--color-white);
  background: var(--color-primary);
  z-index: 100;
}

.toast.error {
  background: #b23b3b;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
