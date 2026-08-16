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
        <button type="submit" class="login-btn" :disabled="isLoading || !phone || !password">
          <span v-if="isLoading" class="loading-spinner" aria-hidden="true"></span>
          <span>{{ isLoading ? '登录中...' : '登录' }}</span>
        </button>

        <!-- 底部链接 -->
        <div class="links-row">
          <button type="button" class="text-link" @click="handleForgotPassword">忘记密码</button>
          <span class="link-separator">|</span>
          <button type="button" class="text-link" @click="handleRegister">注册入口</button>
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
    await authStore.login(phone.value.trim(), password.value, undefined, 'teacher')
    // 登录成功，跳转到教师管理页面
    router.push('/answer-query')
  } catch (err) {
    debugError('教师登录失败:', err)
  } finally {
    isSubmitting.value = false
  }
}

function handleForgotPassword(): void {
  alert('请联系管理员重置密码')
}

function handleRegister(): void {
  alert('请联系管理员申请教师账号')
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

.links-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
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

.link-separator {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
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
