<template>
  <div class="student-login-page" :style="{ backgroundImage: `url(${bgUrl})` }">
    <div class="login-card">
      <!-- 返回首页 -->
      <button type="button" class="back-btn" @click="goHome" aria-label="返回首页">
        ← 返回首页
      </button>

      <!-- 角色 Tab 切换：教师/管理员跳转独立页面 -->
      <div class="role-tabs" role="tablist" aria-label="登录角色">
        <button
          v-for="r in roles"
          :key="r.value"
          type="button"
          role="tab"
          :aria-selected="activeRole === r.value"
          class="role-tab"
          :class="{ active: activeRole === r.value }"
          @click="onRoleClick(r.value)"
        >
          {{ r.label }}
        </button>
      </div>

      <!-- 标题（随角色变化） -->
      <div class="card-header">
        <h1 class="card-title">{{ currentRoleLabel }}登录</h1>
        <p class="card-subtitle">{{ currentSubtitle }}</p>
      </div>

      <!-- 表单 -->
      <form class="login-form" @submit.prevent="handleSubmit" novalidate>
        <!-- 主字段（根据角色切换） -->
        <div class="form-group">
          <label :for="primaryFieldId" class="form-label">{{ primaryLabel }}</label>
          <input
            ref="primaryInputRef"
            :id="primaryFieldId"
            v-model="primaryField"
            :type="primaryFieldType"
            :inputmode="primaryInputMode"
            :autocomplete="primaryAutocomplete"
            class="form-input"
            :class="{ error: hasError && !primaryField }"
            :aria-invalid="Boolean(hasError && !primaryField)"
            :placeholder="primaryPlaceholder"
            :disabled="isLoading"
            @input="clearValidation"
          />
          <span v-if="hasError && !primaryField" role="alert" class="error-message">
            请输入{{ primaryLabel }}
          </span>
        </div>

        <!-- 学生姓名显示（仅学生角色） -->
        <div v-if="activeRole === 'student' && studentName" class="student-name-display" role="status">
          <span class="name-label">学生姓名：</span>
          <span class="name-value">{{ studentName }}</span>
        </div>

        <!-- 密码输入（带眼睛图标） -->
        <div class="form-group password-group">
          <label for="password" class="form-label">密码</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ error: hasError && !password }"
              :aria-invalid="Boolean(hasError && !password)"
              placeholder="请输入密码（不少于 6 位）"
              :disabled="isLoading"
              autocomplete="current-password"
              @input="clearValidation"
            />
            <button
              type="button"
              class="toggle-password-btn"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <span v-if="showPassword" aria-hidden="true">
                <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <span v-else aria-hidden="true">
                <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </span>
            </button>
          </div>
          <span v-if="hasError && !password" role="alert" class="error-message">请输入密码</span>
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
        <button
          type="submit"
          class="login-btn"
          :disabled="isLoading || !primaryField || password.length < 6"
        >
          <span v-if="isLoading" class="loading-spinner" aria-hidden="true"></span>
          <span>{{ isLoading ? '登录中...' : `${currentRoleLabel}登录` }}</span>
        </button>

        <!-- 忘记密码 -->
        <p class="forgot-hint">忘记密码：请联系教师重置密码</p>
      </form>

      <!-- 测试账号提示 -->
      <div v-if="showTestHint" class="test-account-hint">
        <p>测试账号：</p>
        <p class="test-accounts">{{ testAccountsText }}</p>
        <p class="format-hint">学号格式：8 位数字（如：99999999）</p>
        <p class="format-hint">默认密码：99999999</p>
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

type Role = 'student' | 'teacher' | 'admin'

interface RoleOption {
  value: Role
  label: string
}

const roles: RoleOption[] = [
  { value: 'student', label: '学生' },
  { value: 'teacher', label: '教师' },
  { value: 'admin', label: '管理员' },
]

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { queryStudentName } = useStudentQuery()

// 背景图
const bgUrl = getAssetUrl('images', 'login_bg.png')

// 埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'login-page', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'login-page', { duration })
})

// 测试账号
const VITE_TEST_ACCOUNTS = import.meta.env.VITE_TEST_ACCOUNTS as string | undefined
const parsedTestAccounts =
  VITE_TEST_ACCOUNTS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? []
const showTestHint = computed(() => import.meta.env.DEV && parsedTestAccounts.length > 0)
const testAccountsText = computed(() => parsedTestAccounts.join(' | '))

// ===== 表单状态 =====
const activeRole = ref<Role>('student')
const primaryField = ref('')
const password = ref('')
const showPassword = ref(false)
const studentName = ref('')
const rememberMe = ref(true)
const hasError = ref(false)

/** 点击角色 tab：教师/管理员跳独立页面，学生留在本页 */
function onRoleClick(role: Role) {
  if (role === 'teacher') router.push('/teacher-login')
  else if (role === 'admin') router.push('/admin-login')
  else activeRole.value = 'student'
}
const isSubmitting = ref(false)
const primaryInputRef = ref<HTMLInputElement | null>(null)

const isLoading = computed(() => authStore.isLoading)

// ===== 根据角色计算的 UI 字段 =====
const currentRoleLabel = computed(() => roles.find((r) => r.value === activeRole.value)?.label ?? '学生')

const currentSubtitle = computed(() => {
  switch (activeRole.value) {
    case 'student':
      return '请输入学号和密码'
    case 'teacher':
      return '请输入手机号和密码'
    case 'admin':
      return '请输入管理员账号和密码'
  }
})

const primaryFieldId = computed(() => {
  switch (activeRole.value) {
    case 'student':
      return 'studentId'
    case 'teacher':
      return 'phone'
    case 'admin':
      return 'username'
  }
})

const primaryLabel = computed(() => {
  switch (activeRole.value) {
    case 'student':
      return '学号'
    case 'teacher':
      return '手机号'
    case 'admin':
      return '用户名'
  }
})

const primaryPlaceholder = computed(() => `请输入${primaryLabel.value}`)

const primaryFieldType = computed(() => {
  // 管理员用户名可能含字母，其他角色纯数字
  return activeRole.value === 'admin' ? 'text' : 'text'
})

const primaryInputMode = computed(() => {
  switch (activeRole.value) {
    case 'student':
      return 'numeric'
    case 'teacher':
      return 'tel'
    case 'admin':
      return 'text'
  }
})

const primaryAutocomplete = computed(() => {
  switch (activeRole.value) {
    case 'student':
      return 'username'
    case 'teacher':
      return 'tel'
    case 'admin':
      return 'username'
  }
})

// ===== 防抖查询学生姓名 =====
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

// 切换角色时清空字段、重置焦点
watch(activeRole, () => {
  primaryField.value = ''
  studentName.value = ''
  hasError.value = false
  authStore.clearError()
  nextTick(() => {
    primaryInputRef.value?.focus()
  })
})

onMounted(() => {
  primaryField.value = ''
  password.value = ''
  studentName.value = ''
  hasError.value = false
  lastQuerySeq = 0
  authStore.clearError()
  nextTick(() => {
    primaryInputRef.value?.focus()
  })
})

onUnmounted(() => {
  debouncedQueryName.cancel()
})

async function handlePrimaryInput(): Promise<void> {
  clearValidation()
  if (activeRole.value === 'student') {
    debouncedQueryName(primaryField.value)
  }
}

function clearValidation(): void {
  hasError.value = false
  authStore.clearError()
}

async function handleSubmit(): Promise<void> {
  if (!primaryField.value.trim()) {
    hasError.value = true
    return
  }
  if (password.value.length < 6) {
    hasError.value = true
    return
  }

  if (isSubmitting.value) return
  isSubmitting.value = true
  debouncedQueryName.cancel()

  try {
    await authStore.login(
      primaryField.value.trim(),
      password.value,
      activeRole.value === 'student' ? studentName.value : undefined,
      activeRole.value,
    )
    // 登录成功：按角色跳转
    const redirect = route.query.redirect as string | undefined
    if (redirect && redirect !== '/') {
      router.push(redirect)
      return
    }
    switch (activeRole.value) {
      case 'student':
        router.push('/rules/1')
        break
      case 'teacher':
        router.push('/answer-query')
        break
      case 'admin':
        router.push('/admin-console')
        break
    }
  } catch (err) {
    debugError('登录失败:', err)
  } finally {
    isSubmitting.value = false
  }
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

/* ===== 角色 Tab ===== */
.role-tabs {
  display: flex;
  justify-content: center;
  gap: 0;
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.role-tab {
  flex: 1;
  padding: var(--spacing-sm) 0;
  background: none;
  border: none;
  font-family: var(--font-family-serif);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  position: relative;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.role-tab:hover {
  color: var(--color-primary);
}

.role-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
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

/* ===== 密码眼睛图标 ===== */
.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper .form-input {
  padding-right: 2.75rem;
}

.toggle-password-btn {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-small);
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.toggle-password-btn:hover {
  color: var(--color-primary);
  background-color: var(--color-placeholder);
}

.eye-icon {
  width: 1.25rem;
  height: 1.25rem;
  display: block;
}

.student-name-display {
  padding: var(--spacing-sm);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  font-size: 0.875rem;
  text-align: center;
}

.name-label {
  color: var(--color-text-secondary);
  margin-right: var(--spacing-xs);
}

.name-value {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
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

/* ===== 忘记密码纯文本提示 ===== */
.forgot-hint {
  text-align: center;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  margin: var(--spacing-sm) 0 0;
  line-height: 1.5;
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
  padding: var(--spacing-sm);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  font-size: var(--font-size-small);
  text-align: center;
  color: var(--color-text-secondary);
}

.test-account-hint p {
  margin: 0.125rem 0;
}

.test-accounts {
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.format-hint {
  font-size: 0.75rem;
}

@media (max-width: 480px) {
  .login-card {
    padding: var(--spacing-lg);
    border-radius: var(--radius-small);
  }
}
</style>
