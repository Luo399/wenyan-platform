<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleOverlayClick">
        <div class="modal-container" ref="modalRef">
          <!-- 关闭按钮 -->
          <button class="close-btn" @click="handleClose" aria-label="关闭">
            <span class="close-icon">×</span>
          </button>

          <!-- 标题 -->
          <div class="modal-header">
            <h2 class="modal-title">用户登录</h2>
            <p class="modal-subtitle">请输入学号进行登录</p>
          </div>

          <!-- 表单 -->
          <form class="login-form" @submit.prevent="handleSubmit">
            <!-- 学号输入 -->
            <div class="form-group">
              <label for="studentId" class="form-label">学号</label>
              <input
                id="studentId"
                v-model="studentId"
                type="text"
                class="form-input"
                :class="{ error: hasError && !studentId }"
                placeholder="请输入学号"
                :disabled="isLoading"
                @input="handleStudentIdInput"
              />
              <span v-if="hasError && !studentId" class="error-message"> 请输入学号 </span>
            </div>

            <!-- 学生姓名显示 -->
            <div v-if="studentName" class="student-name-display">
              <span class="name-label">学生姓名：</span>
              <span class="name-value">{{ studentName }}</span>
            </div>

            <!-- 记住登录状态 -->
            <div class="form-group remember-group">
              <label class="checkbox-label">
                <input v-model="rememberMe" type="checkbox" class="checkbox-input" />
                <span class="checkbox-text">记住登录状态</span>
              </label>
            </div>

            <!-- 错误提示 -->
            <div v-if="authStore.error" class="error-box">
              <span class="error-icon">⚠</span>
              <span class="error-text">{{ authStore.error }}</span>
            </div>

            <!-- 登录按钮 -->
            <button type="submit" class="login-btn" :disabled="isLoading || !studentId">
              <span v-if="isLoading" class="loading-spinner"></span>
              <span>{{ isLoading ? '登录中...' : '登录' }}</span>
            </button>
          </form>

          <!-- 测试账号提示 -->
          <div class="test-account-hint">
            <p>测试账号：</p>
            <p class="test-accounts">1 | 2 | 3 | 4 | 5</p>
            <p class="format-hint">学号格式：数字（如：1、2024001）</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useStudentQuery } from '@/composables/useStudentQuery'
import { debugError } from '@/utils/debug'

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'login-success'): void
}>()

// Refs
const modalRef = ref<HTMLElement | null>(null)

// State
const studentId = ref('')
const studentName = ref('')
const rememberMe = ref(true)
const hasError = ref(false)
const isSubmitting = ref(false)

// Store
const authStore = useAuthStore()

// 学生查询
const { queryStudentName } = useStudentQuery()

// 计算属性
const isLoading = authStore.isLoading

// 监听错误变化
watch(
  () => authStore.error,
  (newError) => {
    if (newError) {
      hasError.value = true
    }
  },
)

// 监听可见性变化
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible) {
      studentId.value = ''
      studentName.value = ''
      hasError.value = false
      authStore.clearError()
      setTimeout(() => {
        const input = document.getElementById('studentId')
        input?.focus()
      }, 300)
    }
  },
)

// 学号输入处理
async function handleStudentIdInput(): Promise<void> {
  clearValidation()

  // 当学号长度 >= 1 时查询学生姓名
  if (studentId.value.trim().length >= 1) {
    studentName.value = await queryStudentName(studentId.value)
  } else {
    studentName.value = ''
  }
}

// 清除验证状态
function clearValidation(): void {
  hasError.value = false
  authStore.clearError()
}

// 提交表单
async function handleSubmit(): Promise<void> {
  if (!studentId.value.trim()) {
    hasError.value = true
    return
  }

  if (isSubmitting.value) return
  isSubmitting.value = true

  try {
    await authStore.login(studentId.value.trim(), studentName.value)
    emit('login-success')
    handleClose()
  } catch (err) {
    debugError('登录失败:', err)
  } finally {
    isSubmitting.value = false
  }
}

// 关闭弹窗
function handleClose(): void {
  emit('close')
}

// 点击外部区域关闭
function handleOverlayClick(): void {
  emit('close')
}

// ESC 键关闭
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.visible) {
    emit('close')
  }
}

// 生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* 模态框过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9) translateY(-20px);
}

/* 遮罩层 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: var(--spacing-md);
}

/* 模态框容器 */
.modal-container {
  position: relative;
  background-color: var(--color-white);
  border-radius: var(--radius-card);
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.2);
}

.close-icon {
  font-size: 1.25rem;
  color: var(--color-text-secondary);
  line-height: 1;
}

/* 头部 */
.modal-header {
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
  text-align: center;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
}

.modal-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

/* 表单 */
.login-form {
  padding: 0 var(--spacing-lg) var(--spacing-lg);
}

.form-group {
  margin-bottom: var(--spacing-md);
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}

.form-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-size: 1rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.form-input.error {
  border-color: var(--color-primary);
}

.form-input::placeholder {
  color: var(--color-placeholder);
}

.form-input:disabled {
  background-color: var(--color-placeholder);
  cursor: not-allowed;
}

/* 学生姓名显示 */
.student-name-display {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  margin-bottom: var(--spacing-md);
  border: var(--border-width-hairline) solid var(--color-border);
}

.name-label {
  font-size: 0.875rem;
  color: var(--color-border);
  font-weight: 500;
}

.name-value {
  font-size: 0.875rem;
  color: var(--color-border);
  font-weight: var(--font-weight-semibold);
}

/* 记住我选项 */
.remember-group {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  margin-right: var(--spacing-xs);
  accent-color: var(--color-primary);
}

.checkbox-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

/* 错误提示 */
.error-box {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  margin-bottom: var(--spacing-md);
}

.error-icon {
  font-size: 1rem;
  margin-right: var(--spacing-xs);
}

.error-text {
  font-size: 0.875rem;
  color: var(--color-primary);
}

.error-message {
  display: block;
  font-size: 0.75rem;
  color: var(--color-primary);
  margin-top: 0.25rem;
}

/* 登录按钮：朱红底色 + 橄榄绿边框 + 胶囊圆角 */
.login-btn {
  width: 100%;
  padding: 0.875rem;
  background-color: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-xs);
}

.login-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.login-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.login-btn:disabled {
  background-color: var(--color-placeholder);
  cursor: not-allowed;
}

/* 加载动画 */
.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--color-white);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 测试账号提示 */
.test-account-hint {
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  background-color: var(--color-bg-highlight);
  border-top: var(--border-width-hairline) solid var(--color-placeholder);
  text-align: center;
}

.test-account-hint p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.test-accounts {
  margin-top: 0.25rem !important;
  color: var(--color-primary) !important;
  font-family: monospace;
}

.format-hint {
  margin-top: var(--spacing-xs) !important;
  color: var(--color-text-secondary) !important;
  font-size: 0.625rem !important;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .modal-overlay {
    padding: var(--spacing-xs);
  }

  .modal-container {
    border-radius: var(--radius-small);
  }

  .modal-header {
    padding: var(--spacing-md) var(--spacing-md) var(--spacing-xs);
  }

  .modal-title {
    font-size: 1.25rem;
  }

  .login-form {
    padding: 0 var(--spacing-md) var(--spacing-md);
  }
}
</style>
