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
      <template v-else> 请登录 </template>
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

        <!-- R103: 密码输入 -->
        <div class="input-group">
          <label for="passwordInput" class="input-label">密码</label>
          <input
            id="passwordInput"
            v-model="inputPassword"
            type="password"
            placeholder="请输入密码"
            @keyup.enter="handleSave"
            :class="{ error: hasError }"
            :disabled="isLoading"
            autocomplete="current-password"
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
            {{
              isLoading ? (isLoggedIn ? '保存中...' : '登录中...') : isLoggedIn ? '保存' : '登录'
            }}
          </button>
          <button v-if="isLoggedIn" class="logout-btn" @click="handleLogout" :disabled="isLoading">
            退出登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import { useStudentQuery } from '@/composables/useStudentQuery'
import { debugError } from '@/utils/debug'

// 使用新的 auth store
const authStore = useAuthStore()
const { user, isLoggedIn, isLoading: authLoading, error: authError } = storeToRefs(authStore)

// 是否显示编辑弹窗
const showEditModal = ref(false)
// 输入的学号
const inputId = ref('')
// R103: 输入的密码
const inputPassword = ref('')
// 是否有错误
const hasError = ref(false)
// 错误消息
const errorMessage = ref('')
// 查询到的学生姓名
const searchedName = ref('')
// 当前加载状态
const isLoading = ref(false)

// 学生查询
const { queryStudentName } = useStudentQuery()

// 计算属性：学号
const studentId = computed(() => user.value?.studentId || '')

// 计算属性：用户姓名
const userName = computed(() => user.value?.username || '')

/**
 * 验证输入是否为有效学号（纯数字）且密码已填
 */
const isValid = computed(() => {
  return inputId.value.trim() && /^\d+$/.test(inputId.value) && inputPassword.value.length > 0
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
  // R103: 打开弹窗时清空密码
  inputPassword.value = ''
}

/**
 * 输入处理 - 查询学生姓名
 */
async function handleInput() {
  clearError()

  if (inputId.value.trim()) {
    searchedName.value = await queryStudentName(inputId.value)
  } else {
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
    await authStore.login(inputId.value.trim(), inputPassword.value, searchedName.value)
    showEditModal.value = false
    inputId.value = ''
    inputPassword.value = '' // R103: 关闭弹窗时清空密码
    searchedName.value = ''
  } catch (err) {
    hasError.value = true
    errorMessage.value = authError.value || '操作失败，请重试'
    debugError('登录/修改失败:', err)
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
  font-family: var(--font-family-serif);
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--radius-small);
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.student-id:hover {
  background-color: var(--color-placeholder);
  color: var(--color-primary);
}

.id-text {
  color: var(--color-text);
}

.name-text {
  color: var(--color-border);
  font-weight: var(--font-weight-semibold);
}

.edit-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
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
  padding: var(--spacing-md);
}

/* 弹窗内容卡片：30px 圆角 + token 阴影 */
.modal-content {
  background: var(--color-white);
  padding: var(--spacing-lg);
  border-radius: var(--radius-card);
  min-width: 280px;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-card);
}

.modal-content h3 {
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-subheading);
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.input-group {
  margin-bottom: var(--spacing-xs);
}

.input-label {
  display: block;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}

.input-group input {
  width: 100%;
  padding: var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  text-align: center;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.input-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(133, 30, 14, 0.1);
}

.input-group input.error {
  border-color: var(--color-primary);
}

.input-group input::placeholder {
  color: var(--color-placeholder);
}

.input-group input:disabled {
  background-color: var(--color-bg-highlight);
  cursor: not-allowed;
}

/* 学生姓名显示（米色高亮条 + 橄榄绿边框） */
.name-display {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  margin-bottom: var(--spacing-xs);
  border: var(--border-width-hairline) solid var(--color-border);
}

.name-label {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-border);
  font-weight: var(--font-weight-semibold);
}

.name-value {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.error-message {
  color: var(--color-primary);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  margin-bottom: var(--spacing-xs);
  text-align: center;
}

.modal-buttons {
  display: flex;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-md);
}

/* 弹窗按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
.modal-buttons button {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  box-sizing: border-box;
  cursor: pointer;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.cancel-btn {
  background-color: var(--color-white);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.cancel-btn:hover:not(:disabled) {
  background-color: var(--color-bg-highlight);
}

.save-btn {
  background-color: var(--color-primary);
  color: var(--color-white);
}

.save-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.save-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.save-btn:disabled {
  background-color: var(--color-text-secondary);
  border-color: var(--color-text-secondary);
  cursor: not-allowed;
}

.logout-btn {
  background-color: var(--color-primary);
  color: var(--color-white);
}

.logout-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.logout-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.logout-btn:disabled {
  background-color: var(--color-text-secondary);
  border-color: var(--color-text-secondary);
  cursor: not-allowed;
}

/* 加载动画 */
.loading-spinner {
  width: var(--spacing-sm);
  height: var(--spacing-sm);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--color-white);
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
    font-size: var(--font-size-small);
    padding: 0.125rem 0.375rem;
  }

  .edit-text {
    display: none;
  }

  .modal-content {
    padding: var(--spacing-md);
    border-radius: var(--radius-small);
  }

  .modal-content h3 {
    font-size: var(--font-size-body-lg);
  }

  .modal-buttons {
    flex-direction: column;
  }
}
</style>
