<template>
  <div class="teacher-login-page" :style="{ backgroundImage: `url(${bgUrl})` }">
    <div class="login-card">
      <!-- 返回首页 -->
      <button type="button" class="back-btn" @click="goHome" aria-label="返回首页">
        ← 返回首页
      </button>

      <!-- 标题 -->
      <div class="card-header">
        <h1 class="card-title">教师登录</h1>
        <p class="card-subtitle">请输入手机号和密码进行登录</p>
      </div>

      <!-- 表单 -->
      <form class="login-form" @submit.prevent="handleSubmit" novalidate>
        <!-- 手机号输入 -->
        <div class="form-group">
          <label for="phone" class="form-label">手机号</label>
          <input
            ref="phoneInput"
            id="phone"
            v-model="phone"
            type="text"
            inputmode="tel"
            autocomplete="tel"
            class="form-input"
            :class="{ error: hasError && !phone }"
            :aria-invalid="Boolean(hasError && !phone)"
            placeholder="请输入手机号"
            :disabled="isLoading"
            @input="clearValidation"
          />
          <span v-if="hasError && !phone" role="alert" class="error-message"> 请输入手机号 </span>
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
          <span v-if="hasError && !password" role="alert" class="error-message"> 请输入密码 </span>
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
        <button type="submit" class="login-btn" :disabled="isLoading || !phone || password.length < 6">
          <span v-if="isLoading" class="loading-spinner" aria-hidden="true"></span>
          <span>{{ isLoading ? '登录中...' : '登录' }}</span>
        </button>

        <!-- 忘记密码：纯文本提示 -->
        <p class="forgot-hint">忘记密码：请联系管理员重置密码</p>

        <!-- 教师注册入口 -->
        <div class="register-entry">
          <span class="register-text">还没有教师账号？</span>
          <button type="button" class="register-btn" @click="router.push('/teacher-register')">教师注册</button>
          <!-- 注册入口 router.push 不走 useNavigation——属于 auth 流程分支，见 StudentLoginView.onRoleClick 注释 -->
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAssetUrl } from '@/utils/asset'
import { debugError } from '@/utils/debug'
import { track } from '@/utils/tracking'

const router = useRouter()
const authStore = useAuthStore()

// 背景图
const bgUrl = getAssetUrl('images', 'login_bg.png')

// 埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'teacher-login', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'teacher-login', { duration })
})

// 表单状态
const phone = ref('')
const password = ref('')
const showPassword = ref(false)
const rememberMe = ref(true)
const hasError = ref(false)
const isSubmitting = ref(false)
const phoneInput = ref<HTMLInputElement | null>(null)

const isLoading = computed(() => authStore.isLoading)

watch(
  () => authStore.error,
  (newError) => {
    hasError.value = !!newError
  },
)

onMounted(() => {
  phone.value = ''
  password.value = ''
  hasError.value = false
  authStore.clearError()
  nextTick(() => {
    phoneInput.value?.focus()
  })
})

function clearValidation(): void {
  hasError.value = false
  authStore.clearError()
}

async function handleSubmit(): Promise<void> {
  if (!phone.value.trim()) {
    hasError.value = true
    return
  }
  if (!password.value) {
    hasError.value = true
    return
  }

  if (isSubmitting.value) return
  isSubmitting.value = true

  try {
    await authStore.login(
      phone.value.trim(),
      password.value,
      undefined,
      'teacher',
      rememberMe.value,
    )
    // 登录成功，跳转到教师管理页面
    router.push('/answer-query')
  } catch (err) {
    debugError('教师登录失败:', err)
  } finally {
    isSubmitting.value = false
  }
}

function goHome(): void {
  router.push('/')
}
</script>

<style scoped>
.teacher-login-page {
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

/* ===== 忘记密码纯文本提示 ===== */
.forgot-hint {
  text-align: center;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  margin: var(--spacing-sm) 0 0;
  line-height: 1.5;
}

/* ===== 教师注册入口 ===== */
.register-entry {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.register-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.register-btn {
  background: none;
  border: none;
  font-family: var(--font-family-serif);
  font-size: 0.875rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}

.register-btn:hover {
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

@media (max-width: 480px) {
  .login-card {
    padding: var(--spacing-lg);
    border-radius: var(--radius-small);
  }
}
</style>
