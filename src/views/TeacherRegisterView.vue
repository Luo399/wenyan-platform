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

        <!-- 所教班级（可选） -->
        <div class="form-group">
          <label class="form-label">所教班级 <span class="optional-hint">（可选，注册后也可由管理员设置）</span></label>
          <div class="class-picker">
            <!-- 全年级开关 -->
            <label class="checkbox-label full-access-label">
              <input v-model="canViewAll" type="checkbox" class="checkbox-input" />
              <span class="checkbox-text">全年级权限（可查看所有学生答题记录）</span>
            </label>

            <div v-if="!canViewAll" class="class-picker-body">
              <!-- 年级多选 -->
              <div class="picker-row">
                <span class="picker-label">年级：</span>
                <div class="multi-select">
                  <label v-for="g in grades" :key="g" class="chip-label">
                    <input
                      type="checkbox"
                      :value="g"
                      v-model="selectedGrades"
                      class="chip-checkbox"
                    />
                    <span class="chip">{{ g }}级</span>
                  </label>
                  <span v-if="grades.length === 0" class="empty-hint">暂无数据，可直接输入班级编码</span>
                </div>
              </div>

              <!-- 班级多选（按所选年级动态显示） -->
              <div v-if="selectedGrades.length > 0" class="picker-row">
                <span class="picker-label">班级：</span>
                <div class="multi-select">
                  <label
                    v-for="code in availableClassCodes"
                    :key="code"
                    class="chip-label"
                  >
                    <input
                      type="checkbox"
                      :value="code"
                      v-model="classCodes"
                      class="chip-checkbox"
                    />
                    <span class="chip">{{ code.slice(4) }}班</span>
                  </label>
                </div>
              </div>

              <!-- 手动输入 class_code -->
              <div class="picker-row manual-row">
                <span class="picker-label">手动添加：</span>
                <input
                  v-model="manualClassCode"
                  type="text"
                  class="form-input manual-input"
                  placeholder="6 位班级编码，如 202401"
                  maxlength="6"
                  @keyup.enter="addManualClass"
                />
                <button type="button" class="add-class-btn" @click="addManualClass" :disabled="!manualClassCode">添加</button>
              </div>

              <!-- 已选班级展示 -->
              <div v-if="classCodes.length > 0" class="selected-classes">
                <span class="picker-label">已选 {{ classCodes.length }} 个班级：</span>
                <span class="selected-list">
                  <span v-for="code in classCodes" :key="code" class="selected-code">
                    {{ code }}
                    <button type="button" class="remove-btn" @click="removeClass(code)" aria-label="移除">×</button>
                  </span>
                </span>
              </div>
            </div>
          </div>
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
import { getAssetUrl } from '@/utils/asset'
import { debugError } from '@/utils/debug'
import { track } from '@/utils/tracking'

const PHONE_REGEX = /^1[3-9]\d{9}$/

const router = useRouter()
const bgUrl = getAssetUrl('images', 'login_bg.png')

// 埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'teacher-register', {})
  fetchGrades()
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

// 班级选择器状态
const canViewAll = ref(false)
const grades = ref<string[]>([])
const gradeMap = ref<Record<string, string[]>>({})
const selectedGrades = ref<string[]>([])
const classCodes = ref<string[]>([])
const manualClassCode = ref('')

/** 所选年级对应的所有班级编码（去重） */
const availableClassCodes = computed(() => {
  const set = new Set<string>()
  for (const g of selectedGrades.value) {
    for (const code of gradeMap.value[g] || []) set.add(code)
  }
  return Array.from(set).sort()
})

/** 拉取年级/班级选项 */
async function fetchGrades(): Promise<void> {
  try {
    const res = await fetch('/api/admin/options/grades-classes')
    if (res.ok) {
      const data = await res.json()
      grades.value = data.data?.grades || []
      gradeMap.value = data.data?.gradeMap || {}
    }
  } catch { /* 忽略：下拉失败不影响注册主流程 */ }
}

/** 手动添加班级编码 */
function addManualClass(): void {
  const code = manualClassCode.value.trim()
  if (!/^\d{6}$/.test(code)) {
    serverError.value = '班级编码应为 6 位数字（格式 YYYYCC）'
    return
  }
  if (!classCodes.value.includes(code)) {
    classCodes.value.push(code)
  }
  manualClassCode.value = ''
  serverError.value = ''
}

/** 移除一个已选班级 */
function removeClass(code: string): void {
  classCodes.value = classCodes.value.filter((c) => c !== code)
  // 同步清理 selectedGrades（如果移除导致年级下无班级）
  const leftGrades = new Set(classCodes.value.map((c) => c.slice(0, 4)))
  selectedGrades.value = selectedGrades.value.filter((g) => leftGrades.has(g))
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
    const response = await fetch('/api/auth/teacher/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        phone: phone.value.trim(),
        password: password.value,
        class_codes: canViewAll.value ? undefined : classCodes.value,
        can_view_all: canViewAll.value,
      }),
    })

    const data = await response.json()
    if (response.ok && data.success) {
      success.value = true
      setTimeout(() => {
        router.push('/teacher-login')
      }, 2000)
    } else {
      serverError.value = data.message || '注册失败，请稍后重试'
    }
  } catch (err) {
    debugError('教师注册请求失败:', err)
    serverError.value = '网络异常，请检查网络后重试'
  } finally {
    isSubmitting.value = false
  }
}

function goBack(): void {
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

/* ===== 班级选择器 ===== */
.optional-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #888);
  font-weight: normal;
}

.class-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) 0;
}

.full-access-label {
  font-size: 0.875rem;
  padding: 8px 12px;
  background: var(--color-bg-highlight, #f5f5f5);
  border-radius: var(--radius-small, 6px);
  cursor: pointer;
}

.picker-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.picker-label {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #666);
  min-width: 48px;
  padding-top: 4px;
}

.multi-select {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.chip-label {
  position: relative;
  cursor: pointer;
  user-select: none;
}

.chip-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.chip {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 999px;
  font-size: 0.8125rem;
  color: var(--color-text, #333);
  background: #fff;
  transition: all 0.15s ease;
}

.chip-checkbox:checked + .chip {
  background: var(--color-primary, #4a6cf7);
  border-color: var(--color-primary, #4a6cf7);
  color: #fff;
}

.chip-label:hover .chip {
  border-color: var(--color-primary-hover, #3a5ce5);
}

.empty-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #999);
  padding: 4px 0;
}

.manual-row {
  gap: 6px;
}

.manual-input {
  flex: 1;
  max-width: 180px;
  font-size: 0.875rem;
  padding: 6px 10px;
}

.add-class-btn {
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-family: var(--font-family-serif, inherit);
  background: var(--color-primary, #4a6cf7);
  color: #fff;
  border: none;
  border-radius: var(--radius-small, 6px);
  cursor: pointer;
  transition: background 0.15s;
}
.add-class-btn:hover:not(:disabled) { background: var(--color-primary-hover, #3a5ce5); }
.add-class-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.selected-classes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.selected-code {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--color-bg-highlight, #eef2ff);
  border-radius: 4px;
  font-size: 0.8125rem;
  color: var(--color-primary, #4a6cf7);
}

.remove-btn {
  background: none;
  border: none;
  color: var(--color-primary, #4a6cf7);
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0 2px;
}
.remove-btn:hover { color: #d33; }
