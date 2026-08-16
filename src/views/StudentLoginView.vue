<template>
  <div class="student-login-page" :style="{ backgroundImage: `url(${bgUrl})` }">
    <div class="login-card">
      <!-- 返回首页 -->
      <button type="button" class="back-btn" @click="goHome" aria-label="返回首页">
        ← 返回首页
      </button>

      <!-- 标题 -->
      <div class="card-header">
        <h1 class="card-title">学生登录</h1>
        <p class="card-subtitle">请输入学号和密码进行登录</p>
      </div>

      <!-- 表单 -->
      <form class="login-form" @submit.prevent="handleSubmit" novalidate>
        <!-- 学号输入 -->
        <div class="form-group">
          <label for="studentId" class="form-label">学号</label>
          <input
            ref="studentIdInput"
            id="studentId"
            v-model="studentId"
            type="text"
            inputmode="numeric"
            autocomplete="username"
            class="form-input"
            :class="{ error: hasError && !studentId }"
            :aria-invalid="Boolean(hasError && !studentId)"
            placeholder="请输入学号"
            :disabled="isLoading"
            @input="handleStudentIdInput"
          />
          <span v-if="hasError && !studentId" role="alert" class="error-message"> 请输入学号 </span>
        </div>

        <!-- 密码输入 -->
        <div class="form-group">
          <label for="password" class="form-label">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-input"
            :class="{ error: hasError && !password }"
            :aria-invalid="Boolean(hasError && !password)"
            placeholder="请输入密码"
            :disabled="isLoading"
            autocomplete="current-password"
            @input="clearValidation"
          />
          <span v-if="hasError && !password" role="alert" class="error-message"> 请输入密码 </span>
        </div>

        <!-- 学生姓名显示 -->
        <div v-if="studentName" class="student-name-display" role="status">
          <span class="name-label">学生姓名：</span>
          <span class="name-value">{{ studentName }}</span>
        </div>

        <!-- 记住登录状态 -->
        <div class="form-group remember-group">
          <label class="checkbox-label">
            <input
              v-model="rememberMe"
              type="checkbox"
              class="checkbox-input"
              :disabled="isLoading"
            />
            <span class="checkbox-text">记住登录状态</span>
          </label>
        </div>

        <!-- 错误提示 -->
        <div v-if="authStore.error" class="error-box" role="alert" aria-live="assertive">
          <span class="error-icon" aria-hidden="true">⚠</span>
          <span class="error-text">{{ authStore.error }}</span>
        </div>

        <!-- 登录按钮 -->
        <button type="submit" class="login-btn" :disabled="isLoading || !studentId || !password">
          <span v-if="isLoading" class="loading-spinner" aria-hidden="true"></span>
          <span>{{ isLoading ? '登录中...' : '登录' }}</span>
        </button>

        <!-- 忘记密码 -->
        <div class="links-row">
          <button type="button" class="text-link" @click="handleForgotPassword">忘记密码</button>
        </div>
      </form>

      <!-- 测试账号提示 -->
      <div v-if="showTestHint" class="test-account-hint">
        <p>测试账号：</p>
        <p class="test-accounts">{{ testAccountsText }}</p>
        <p class="format-hint">学号格式：数字（如：1、2024001）</p>
        <p class="format-hint">默认密码：123456</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStudentQuery } from '@/composables/useStudentQuery'
import { getAssetUrl } from '@/utils/asset'
import { debugError } from '@/utils/debug'
import { track } from '@/utils/tracking'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { queryStudentName } = useStudentQuery()

// 背景图
const bgUrl = getAssetUrl('images', 'login_bg.png')

// 埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'student-login', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'student-login', { duration })
})

// 测试账号
const VITE_TEST_ACCOUNTS = import.meta.env.VITE_TEST_ACCOUNTS as string | undefined
const parsedTestAccounts =
  VITE_TEST_ACCOUNTS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? []
const showTestHint = computed(() => import.meta.env.DEV && parsedTestAccounts.length > 0)
const testAccountsText = computed(() => parsedTestAccounts.join(' | '))

// 表单状态
const studentId = ref('')
const password = ref('')
const studentName = ref('')
const rememberMe = ref(true)
const hasError = ref(false)
const isSubmitting = ref(false)
const studentIdInput = ref<HTMLInputElement | null>(null)

const isLoading = computed(() => authStore.isLoading)

// 防抖查询学生姓名
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = function (this: unknown, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), waitMs)
  } as T & { cancel: () => void; flush: () => void }
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  return debounced
}

const QUERY_DEBOUNCE_MS = 300
let lastQuerySeq = 0
async function queryNameInternal(id: string) {
  const trimmed = id.trim()
  if (trimmed.length < 1) {
    studentName.value = ''
    return
  }
  const seq = ++lastQuerySeq
  const name = await queryStudentName(trimmed)
  if (seq === lastQuerySeq) {
    studentName.value = name
  }
}
const debouncedQueryName = debounce(queryNameInternal, QUERY_DEBOUNCE_MS)

watch(
  () => authStore.error,
  (newError) => {
    hasError.value = !!newError
  },
)

onMounted(() => {
  studentId.value = ''
  password.value = ''
  studentName.value = ''
  hasError.value = false
  lastQuerySeq = 0
  authStore.clearError()
  nextTick(() => {
    studentIdInput.value?.focus()
  })
})

onUnmounted(() => {
  debouncedQueryName.cancel()
})

async function handleStudentIdInput(): Promise<void> {
  clearValidation()
  debouncedQueryName(studentId.value)
}

function clearValidation(): void {
  hasError.value = false
  authStore.clearError()
}

async function handleSubmit(): Promise<void> {
  if (!studentId.value.trim()) {
    hasError.value = true
    return
  }
  if (!password.value) {
    hasError.value = true
    return
  }

  if (isSubmitting.value) return
  isSubmitting.value = true
  debouncedQueryName.cancel()

  try {
    await authStore.login(studentId.value.trim(), password.value, studentName.value, 'student')
    // 登录成功：优先跳转 redirect 参数指向的页面，否则跳转到规则页
    const redirect = route.query.redirect as string | undefined
    if (redirect && redirect !== '/') {
      router.push(redirect)
    } else {
      router.push('/rules/1')
    }
  } catch (err) {
    debugError('登录失败:', err)
  } finally {
    isSubmitting.value = false
  }
}

function handleForgotPassword(): void {
  alert('请联系管理员重置密码')
}

function goHome(): void {
  router.push('/')
}
</script>

<style scoped>
.student-login-page {
  display: flex;
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.login-card {
  position: relative;
  background-color: var(--color-white);
  border-radius: var(--radius-card);
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
  padding: var(--spacing-xl);
}

.back-btn {
  background: none;
  border: none;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-primary);
  cursor: pointer;
  padding: 0;
  margin-bottom: var(--spacing-lg);
  display: inline-block;
  transition: color 0.2s ease;
}

.back-btn:hover {
  color: var(--color-primary-hover);
}

.card-header {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.card-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
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

.student-name-display {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
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

.error-box {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
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
  font-family: var(--font-family-serif);
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

.links-row {
  display: flex;
  justify-content: center;
  margin-top: var(--spacing-sm);
}

.text-link {
  background: none;
  border: none;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.text-link:hover {
  color: var(--color-primary-hover);
}

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

.test-account-hint {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) 0 0;
  border-top: var(--border-width-hairline) solid var(--color-placeholder);
  text-align: center;
}

.test-account-hint p {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.test-account-hint .test-accounts {
  margin-top: 0.25rem;
  color: var(--color-primary);
  font-family: monospace;
}

.test-account-hint .format-hint {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-caption);
}

@media (max-width: 480px) {
  .login-card {
    padding: var(--spacing-lg);
    border-radius: var(--radius-small);
  }
}
</style>
