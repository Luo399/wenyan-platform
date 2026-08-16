<template>
  <div class="admin-login-page" :style="{ backgroundImage: `url(${bgUrl})` }">
    <div class="login-card">
      <button type="button" class="back-btn" @click="goHome" aria-label="返回首页">
        ← 返回首页
      </button>

      <div class="card-header">
        <h1 class="card-title">管理员登录</h1>
        <p class="card-subtitle">请输入管理员账号和密码进行登录</p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit" novalidate>
        <div class="form-group">
          <label for="username" class="form-label">用户名</label>
          <input
            ref="usernameInput"
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            class="form-input"
            :class="{ error: hasError && !username }"
            :aria-invalid="Boolean(hasError && !username)"
            placeholder="请输入管理员用户名"
            :disabled="isLoading"
            @input="clearValidation"
          />
          <span v-if="hasError && !username" role="alert" class="error-message">请输入用户名</span>
        </div>

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
          <span v-if="hasError && !password" role="alert" class="error-message">请输入密码</span>
        </div>

        <div v-if="authStore.error" class="error-box" role="alert" aria-live="assertive">
          <span class="error-icon" aria-hidden="true">⚠</span>
          <span class="error-text">{{ authStore.error }}</span>
        </div>

        <button type="submit" class="login-btn" :disabled="isLoading || !username || !password">
          <span v-if="isLoading" class="loading-spinner" aria-hidden="true"></span>
          <span>{{ isLoading ? '登录中...' : '登录' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAssetUrl } from '@/utils/asset'
import { debugError } from '@/utils/debug'

const router = useRouter()
const authStore = useAuthStore()

const bgUrl = getAssetUrl('images', 'login_bg.png')

const username = ref('')
const password = ref('')
const hasError = ref(false)
const usernameInput = ref<HTMLInputElement | null>(null)

const isLoading = computed(() => authStore.isLoading)

watch(
  () => authStore.error,
  (newError) => {
    hasError.value = !!newError
  },
)

onMounted(() => {
  username.value = ''
  password.value = ''
  hasError.value = false
  authStore.clearError()
  nextTick(() => {
    usernameInput.value?.focus()
  })
})

function clearValidation(): void {
  hasError.value = false
  authStore.clearError()
}

async function handleSubmit(): Promise<void> {
  if (!username.value.trim()) {
    hasError.value = true
    return
  }
  if (!password.value) {
    hasError.value = true
    return
  }

  try {
    await authStore.login(username.value.trim(), password.value, undefined, 'admin')
    router.push('/answer-query')
  } catch (err) {
    debugError('管理员登录失败:', err)
  }
}

function goHome(): void {
  router.push('/')
}
</script>

<style scoped>
.admin-login-page {
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
