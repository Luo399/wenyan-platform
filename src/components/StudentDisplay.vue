<!--
  StudentDisplay.vue - 学生信息显示组件

  功能说明：
  - 显示当前登录学生的学号和姓名
  - 提供修改学号/退出登录功能
  - 放在 App.vue 右上角
  - 与 LoginModal 组件完全适配
-->
<template>
  <div class="student-display">
    <!-- 未登录显示"请登录"，已登录显示"学号：xxx | 姓名：xxx 修改" -->
    <span class="student-id" @click="handleClick">
      <template v-if="isLoggedIn">
        <span class="id-text">学号：{{ studentId }}</span>
        <span v-if="userName" class="name-text">| 姓名：{{ userName }}</span>
        <span class="edit-text"> 修改</span>
      </template>
      <template v-else>
        请登录
      </template>
    </span>

    <!-- 修改学号弹窗 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="handleClose">
      <div class="modal-content">
        <h3>{{ isLoggedIn ? '修改学号' : '登录' }}</h3>

        <div class="input-group">
          <label for="studentIdInput" class="input-label">学号</label>
          <input
            id="studentIdInput"
            v-model="inputId"
            type="text"
            placeholder="请输入学号"
            @keyup.enter="handleSave"
            @input="handleInput"
            :class="{ error: hasError }"
            :disabled="isLoading"
          />
        </div>

        <!-- 学生姓名显示 -->
        <div v-if="searchedName" class="name-display">
          <span class="name-label">查询到：</span>
          <span class="name-value">{{ searchedName }}</span>
        </div>

        <p v-if="hasError" class="error-message">{{ errorMessage }}</p>

        <div class="modal-buttons">
          <button class="cancel-btn" @click="handleClose" :disabled="isLoading">取消</button>
          <button class="save-btn" @click="handleSave" :disabled="!isValid || isLoading">
            <span v-if="isLoading" class="loading-spinner"></span>
            {{ isLoading ? (isLoggedIn ? '保存中...' : '登录中...') : (isLoggedIn ? '保存' : '登录') }}
          </button>
          <button v-if="isLoggedIn" class="logout-btn" @click="handleLogout" :disabled="isLoading">退出登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import { get } from '@/utils/api'

// 使用新的 auth store
const authStore = useAuthStore()
const { user, isLoggedIn, isLoading: authLoading, error: authError } = storeToRefs(authStore)

// 是否显示编辑弹窗
const showEditModal = ref(false)
// 输入的学号
const inputId = ref('')
// 是否有错误
const hasError = ref(false)
// 错误消息
const errorMessage = ref('')
// 查询到的学生姓名
const searchedName = ref('')
// 当前加载状态
const isLoading = ref(false)

// 计算属性：学号
const studentId = computed(() => user.value?.studentId || '')

// 计算属性：用户姓名
const userName = computed(() => user.value?.username || '')

/**
 * 验证输入是否为有效学号（纯数字）
 */
const isValid = computed(() => {
  return inputId.value.trim() && /^\d+$/.test(inputId.value)
})

/**
 * 处理点击事件
 */
function handleClick() {
  showEditModal.value = true
  // 如果已登录，显示当前学号
  if (isLoggedIn.value && studentId.value) {
    inputId.value = studentId.value
  }
}

/**
 * 输入处理 - 查询学生姓名
 */
async function handleInput() {
  clearError()
  
  if (inputId.value.trim()) {
    await fetchStudentName()
  } else {
    searchedName.value = ''
  }
}

/**
 * 查询学生姓名
 */
async function fetchStudentName() {
  try {
    const response = await get(`/api/students/${inputId.value.trim()}`)
    if (response.success && response.data) {
      searchedName.value = response.data.name || ''
    } else {
      searchedName.value = ''
    }
  } catch (err) {
    console.error('查询学生信息失败:', err)
    searchedName.value = ''
  }
}

/**
 * 清除错误状态
 */
function clearError() {
  hasError.value = false
  errorMessage.value = ''
  authStore.clearError()
}

/**
 * 保存新学号 / 登录
 */
async function handleSave() {
  if (!isValid.value) {
    hasError.value = true
    errorMessage.value = '请输入有效的数字学号'
    return
  }

  clearError()
  isLoading.value = true

  try {
    if (isLoggedIn.value) {
      // 修改学号 - 先登出再登录
      authStore.logout()
    }
    
    // 登录
    await authStore.login(inputId.value.trim(), searchedName.value)
    showEditModal.value = false
    inputId.value = ''
    searchedName.value = ''
  } catch (err) {
    hasError.value = true
    errorMessage.value = authError.value || '操作失败，请重试'
    console.error('登录/修改失败:', err)
  } finally {
    isLoading.value = false
  }
}

/**
 * 关闭弹窗
 */
function handleClose() {
  showEditModal.value = false
  inputId.value = ''
  searchedName.value = ''
  clearError()
}

/**
 * 退出登录
 */
function handleLogout() {
  authStore.logout()
  showEditModal.value = false
  inputId.value = ''
  searchedName.value = ''
  clearError()
}

/**
 * 监听错误变化
 */
watch(authError, (newError) => {
  if (newError) {
    hasError.value = true
    errorMessage.value = newError
  }
})

/**
 * 组件挂载时初始化
 */
onMounted(() => {
  authStore.initialize()
})
</script>

<style scoped>
.student-display {
  display: flex;
  align-items: center;
}

.student-id {
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.student-id:hover {
  background-color: #f3f4f6;
  color: #3b82f6;
}

.id-text {
  color: #374151;
}

.name-text {
  color: #10b981;
  font-weight: 500;
}

.edit-text {
  color: #6b7280;
  font-size: 0.75rem;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  min-width: 280px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.modal-content h3 {
  margin-bottom: 1rem;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 600;
  text-align: center;
}

.input-group {
  margin-bottom: 0.5rem;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.input-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  text-align: center;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-group input.error {
  border-color: #ef4444;
}

.input-group input::placeholder {
  color: #9ca3af;
}

.input-group input:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
}

/* 学生姓名显示 */
.name-display {
  display: flex;
  align-items: center;
  padding: 0.625rem 0.75rem;
  background-color: #ecfdf5;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  border: 1px solid #10b981;
}

.name-label {
  font-size: 0.875rem;
  color: #059669;
  font-weight: 500;
}

.name-value {
  font-size: 0.875rem;
  color: #047857;
  font-weight: 600;
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  text-align: center;
}

.modal-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.modal-buttons button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}

.cancel-btn {
  background-color: #f3f4f6;
  color: #374151;
}

.cancel-btn:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.save-btn {
  background-color: #3b82f6;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.save-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.save-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.logout-btn {
  background-color: #ef4444;
  color: white;
}

.logout-btn:hover:not(:disabled) {
  background-color: #dc2626;
}

.logout-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.logout-btn:disabled {
  background-color: #f87171;
  cursor: not-allowed;
}

/* 加载动画 */
.loading-spinner {
  width: 0.75rem;
  height: 0.75rem;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .student-id {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
  }
  
  .edit-text {
    display: none;
  }
  
  .modal-content {
    padding: 1rem;
    border-radius: 0.375rem;
  }
  
  .modal-content h3 {
    font-size: 1.125rem;
  }
  
  .modal-buttons {
    flex-direction: column;
  }
}
</style>