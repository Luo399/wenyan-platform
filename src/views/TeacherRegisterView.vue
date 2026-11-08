<template>
  <div class="teacher-register-page" :style="{ backgroundImage: `url(${bgUrl})` }">
    <div class="register-card">
      <!-- 返回上一页 -->
      <button type="button" class="back-btn" @click="goBack" aria-label="返回上一页">
        ← 返回上一页
      </button>

      <!-- 标题 -->
      <div class="card-header">
        <h1 class="card-title">教师注册</h1>
        <p class="card-subtitle">填写姓名、手机号和密码（审批后激活）</p>
      </div>

      <!-- 成功提示 -->
      <div v-if="success" class="success-box" role="alert" aria-live="assertive">
        <span class="success-icon" aria-hidden="true">✓</span>
        <span class="success-text">注册成功！等待管理员审批后即可登录</span>
      </div>

      <!-- 表单 -->
      <form v-else class="register-form" @submit.prevent="handleSubmit" novalidate>
        <!-- 姓名 -->
        <div class="form-group">
          <label for="name" class="form-label">教师姓名</label>
          <input
            id="name"
            v-model="name"
            type="text"
            autocomplete="name"
            class="form-input"
            :class="{ error: (touched.name && nameError) }"
            :aria-invalid="Boolean(touched.name && nameError)"
            placeholder="请输入真实姓名"
            :disabled="isSubmitting"
            maxlength="20"
            @blur="touched.name = true"
            @input="clearValidation"
          />
          <span v-if="touched.name && nameError" role="alert" class="error-message">
            {{ nameError }}
          </span>
        </div>

        <!-- 手机号 -->
        <div class="form-group">
          <label for="phone" class="form-label">手机号</label>
          <input
            ref="phoneInput"
            id="phone"
            v-model="phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            class="form-input"
            :class="{ error: (touched.phone && phoneError) }"
            :aria-invalid="Boolean(touched.phone && phoneError)"
            placeholder="11 位手机号"
            :disabled="isSubmitting"
            maxlength="11"
            @blur="touched.phone = true"
            @input="clearValidation"
          />
          <span v-if="touched.phone && phoneError" role="alert" class="error-message">
            {{ phoneError }}
          </span>
        </div>

        <!-- 密码（带眼睛图标） -->
        <div class="form-group">
          <label for="password" class="form-label">密码</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ error: (touched.password && passwordError) }"
              :aria-invalid="Boolean(touched.password && passwordError)"
              placeholder="不少于 6 位"
              :disabled="isSubmitting"
              autocomplete="new-password"
              @blur="touched.password = true"
              @input="onPasswordInput"
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
          <span v-if="touched.password && passwordError" role="alert" class="error-message">
            {{ passwordError }}
          </span>
        </div>

        <!-- 确认密码（带眼睛图标） -->
        <div class="form-group">
          <label for="confirmPassword" class="form-label">确认密码</label>
          <div class="password-input-wrapper">
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ error: (touched.confirmPassword && confirmError) }"
              :aria-invalid="Boolean(touched.confirmPassword && confirmError)"
              placeholder="再次输入密码"
              :disabled="isSubmitting"
              autocomplete="new-password"
              @blur="touched.confirmPassword = true"
              @input="onConfirmInput"
            />
            <button
              type="button"
              class="toggle-password-btn"
              :aria-label="showConfirmPassword ? '隐藏密码' : '显示密码'"
              :aria-pressed="showConfirmPassword"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <span v-if="showConfirmPassword" aria-hidden="true">
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
          <span v-if="touched.confirmPassword && confirmError" role="alert" class="error-message">
            {{ confirmError }}
          </span>
        </div>

        <!-- 所教班级（可选，独立 ClassPicker 子组件） -->
        <div class="form-group">
          <label class="form-label">所教班级 <span class="optional-hint">（可选）</span></label>
          <ClassPicker v-model="classCodes" @update:full-access="onFullAccessChange" />
        </div>

        <!-- 后端错误 -->
        <div v-if="serverError" class="error-box" role="alert" aria-live="assertive">
          <span class="error-icon" aria-hidden="true">⚠</span>
          <span class="error-text">{{ serverError }}</span>
        </div>

        <!-- 提交按钮 -->
        <button
          type="submit"
          class="submit-btn"
          :disabled="isSubmitting || !canSubmit"
        >
          <span v-if="isSubmitting" class="loading-spinner" aria-hidden="true"></span>
          <span>{{ isSubmitting ? '提交中...' : '提交注册' }}</span>
        </button>

        <!-- 登录入口提示 -->
        <p class="back-login-hint">已有教师账号？<button type="button" class="back-login-btn" @click="goBack">返回教师登录</button></p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import ClassPicker from '@/components/ClassPicker.vue'
import { getAssetUrl } from '@/utils/asset'
import { debugError } from '@/utils/debug'
import { track } from '@/utils/tracking'
import { teacherRegister } from '@/services/apiService'

const PHONE_REGEX = /^1[3-9]\d{9}$/

const router = useRouter()
const bgUrl = getAssetUrl('images', 'login_bg.png')

// 埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'teacher-register', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'teacher-register', { duration })
})

// 表单状态
const phoneInput = ref<HTMLInputElement | null>(null)
const name = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const success = ref(false)
const serverError = ref('')
// 班级选择器状态（由独立 ClassPicker 子组件驱动）
const classCodes = ref<string[]>([])
const canViewAll = ref(false)

/** ClassPicker 全权限开关回调 */
function onFullAccessChange(v: boolean): void {
  canViewAll.value = v
}

const touched = reactive({
  name: false,
  phone: false,
  password: false,
  confirmPassword: false,
})

// 字段级校验
const nameError = computed(() => {
  if (!name.value.trim()) return '请输入姓名'
  if (name.value.trim().length > 20) return '姓名不能超过 20 个字符'
  return ''
})

const phoneError = computed(() => {
  if (!phone.value.trim()) return '请输入手机号'
  if (!PHONE_REGEX.test(phone.value.trim())) return '手机号格式不正确（应为 11 位 1 开头）'
  return ''
})

const passwordError = computed(() => {
  if (!password.value) return '请输入密码'
  if (password.value.length < 6) return '密码长度不能少于 6 位'
  return ''
})

const confirmError = computed(() => {
  if (!confirmPassword.value) return '请再次输入密码'
  if (password.value && confirmPassword.value !== password.value) return '两次输入的密码不一致'
  return ''
})

const canSubmit = computed(() => {
  return !nameError.value && !phoneError.value && !passwordError.value && !confirmError.value
})

function clearValidation(): void {
  serverError.value = ''
}

function onPasswordInput(): void {
  clearValidation()
  if (confirmPassword.value && confirmPassword.value !== password.value) {
    touched.confirmPassword = true
  }
}

function onConfirmInput(): void {
  clearValidation()
}

async function handleSubmit(): Promise<void> {
  // 触发所有 blur 校验
  touched.name = true
  touched.phone = true
  touched.password = true
  touched.confirmPassword = true

  if (!canSubmit.value) return

  isSubmitting.value = true
  serverError.value = ''

  try {
    await teacherRegister({
      name: name.value.trim(),
      phone: phone.value.trim(),
      password: password.value,
      class_codes: canViewAll.value ? undefined : classCodes.value,
      can_view_all: canViewAll.value,
    })
    // post() 非 2xx 已由 api.ts 抛 ApiError，到此即为成功
    success.value = true
    setTimeout(() => {
      router.push('/teacher-login')
    }, 2000)
  } catch (err: unknown) {
    // ApiError: 后端返回的业务错误（如手机号已被占用）
    // 其他: 网络异常（断网/DNS/超时）
    const message = err instanceof Error ? err.message : '注册失败'
    debugError('教师注册请求失败:', err)
    serverError.value = message.includes('网络') || message.includes('fetch')
      ? '网络异常，请检查网络后重试'
      : message || '注册失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}

function goBack(): void {
  // 回登录页——auth 流程分支例外，不走 useNavigation
  router.push('/teacher-login')
}

onMounted(() => {
  nextTick(() => {
    phoneInput.value?.focus()
  })
})
</script>

<style scoped>
.teacher-register-page {
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

.register-card {
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

.register-form {
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

.error-message {
  display: block;
  font-size: 0.75rem;
  color: var(--color-primary);
  margin-top: 0.25rem;
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

.success-box {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  background-color: color-mix(in srgb, #22c55e 12%, transparent);
  border: 1px solid color-mix(in srgb, #22c55e 30%, transparent);
  border-radius: var(--radius-small);
  text-align: center;
}

.success-icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background-color: #22c55e;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: var(--spacing-sm);
  flex-shrink: 0;
}

.success-text {
  font-size: 0.9rem;
  color: #166534;
  font-weight: var(--font-weight-semibold);
}

.submit-btn {
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
  margin-top: var(--spacing-sm);
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.submit-btn:disabled {
  background-color: var(--color-placeholder);
  cursor: not-allowed;
}

.back-login-hint {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: var(--spacing-sm) 0 0;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.back-login-btn {
  background: none;
  border: none;
  font-family: var(--font-family-serif);
  font-size: 0.85rem;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  margin-left: 0.25rem;
}

.back-login-btn:hover {
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
  .register-card {
    padding: var(--spacing-lg);
    border-radius: var(--radius-small);
  }
}
</style>
