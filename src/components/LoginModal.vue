<template>
  <Teleport to="body">
    <Transition name="modal">
      <!--
        R44/R45: modal 基础 ARIA
        - modal-overlay: role=dialog + aria-modal=true + aria-labelledby 指向标题
        - @keydown: Tab/Shift+Tab 循环（focus trap），ESC 关闭
      -->
      <div
        v-if="visible"
        class="modal-overlay"
        ref="overlayRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        aria-describedby="login-modal-subtitle"
        @click.self="handleOverlayClick"
        @keydown="handleModalKeydown"
      >
        <div class="modal-container" ref="modalRef">
          <!-- 关闭按钮 -->
          <button class="close-btn" type="button" @click="handleClose" aria-label="关闭登录对话框">
            <span class="close-icon" aria-hidden="true">×</span>
          </button>

          <!-- 标题 -->
          <div class="modal-header">
            <h2 id="login-modal-title" class="modal-title">
              {{ role === 'teacher' ? '教师登录' : '学生登录' }}
            </h2>
            <p id="login-modal-subtitle" class="modal-subtitle">
              {{ role === 'teacher' ? '请输入手机号和密码进行登录' : '请输入学号和密码进行登录' }}
            </p>
          </div>

          <!-- 表单 -->
          <form class="login-form" @submit.prevent="handleSubmit" novalidate>
            <!-- 学号/手机号输入 -->
            <div class="form-group">
              <label for="studentId" class="form-label">{{
                role === 'teacher' ? '手机号' : '学号'
              }}</label>
              <input
                ref="firstFocusableRef"
                id="studentId"
                v-model="studentId"
                type="text"
                :inputmode="role === 'teacher' ? 'tel' : 'numeric'"
                :autocomplete="role === 'teacher' ? 'tel' : 'username'"
                class="form-input"
                :class="{ error: hasError && !studentId }"
                :aria-invalid="Boolean(hasError && !studentId)"
                :aria-describedby="hasError && !studentId ? 'studentId-error' : undefined"
                :placeholder="role === 'teacher' ? '请输入手机号' : '请输入学号'"
                :disabled="isLoading"
                @input="handleStudentIdInput"
              />
              <span
                v-if="hasError && !studentId"
                id="studentId-error"
                role="alert"
                class="error-message"
              >
                {{ role === 'teacher' ? '请输入手机号' : '请输入学号' }}
              </span>
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
                :aria-describedby="hasError && !password ? 'password-error' : undefined"
                placeholder="请输入密码"
                :disabled="isLoading"
                autocomplete="current-password"
                @input="clearValidation"
              />
              <span
                v-if="hasError && !password"
                id="password-error"
                role="alert"
                class="error-message"
              >
                请输入密码
              </span>
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

            <!-- 错误提示（来自 store） -->
            <div v-if="authStore.error" class="error-box" role="alert" aria-live="assertive">
              <span class="error-icon" aria-hidden="true">⚠</span>
              <span class="error-text">{{ authStore.error }}</span>
            </div>

            <!-- 登录按钮 -->
            <button
              type="submit"
              class="login-btn"
              :disabled="isLoading || !studentId || !password"
            >
              <span v-if="isLoading" class="loading-spinner" aria-hidden="true"></span>
              <span>{{ isLoading ? '登录中...' : '登录' }}</span>
            </button>

            <!-- 底部链接区 - Figma: 忘记密码 + 注册入口（教师端） -->
            <div class="login-links">
              <button type="button" class="text-link" @click="handleForgotPassword">
                忘记密码
              </button>
              <span v-if="role === 'teacher'" class="link-separator">|</span>
              <button
                v-if="role === 'teacher'"
                type="button"
                class="text-link"
                @click="handleRegister"
              >
                注册入口
              </button>
            </div>
          </form>

          <!--
            R31: 测试账号提示默认仅在开发环境 + VITE_TEST_ACCOUNTS 配置时展示
            生产环境构建默认不显示，避免泄露测试账号
          -->
          <div v-if="showTestHint" class="test-account-hint">
            <p>测试账号：</p>
            <p class="test-accounts">{{ testAccountsText }}</p>
            <p class="format-hint">学号格式：数字（如：1、2024001）</p>
            <p class="format-hint">默认密码：123456（教师重置后同此值）</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useStudentQuery } from '@/composables/useStudentQuery'
import { debugError } from '@/utils/debug'

// ============================================================
// R31: 测试账号通过环境变量控制；生产默认不展示
// 开发环境：VITE_TEST_ACCOUNTS 空数组则不展示，有值（"1,2,3"）则展示
// 生产环境：import.meta.env.DEV=false，除非显式把 showTestHint 置 true
// ============================================================
const VITE_TEST_ACCOUNTS = import.meta.env.VITE_TEST_ACCOUNTS as string | undefined
const parsedTestAccounts =
  VITE_TEST_ACCOUNTS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? []
const showTestHint = computed(() => import.meta.env.DEV && parsedTestAccounts.length > 0)
const testAccountsText = computed(() => parsedTestAccounts.join(' | '))

// Props
interface Props {
  visible: boolean
  role?: 'student' | 'teacher'
}

const props = withDefaults(defineProps<Props>(), {
  role: 'student',
})

// Emits
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'login-success'): void
}>()

// ============================================================
// Refs: focus trap 用到 modal 容器 + 第一个可聚焦元素
// ============================================================
const modalRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)
const firstFocusableRef = ref<HTMLInputElement | null>(null)

// State
const studentId = ref('')
const password = ref('')
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

/**
 * R30: 手写 debounce（避免引入 lodash-es）
 * - 300ms 内重复输入只保留最后一次，停止输入 300ms 后发起请求
 * - 同时处理"请求序号"的竞态：后输入的响应即使后发出，也保证不会被先到的旧请求覆盖
 */
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

// R30 防抖 + 竞态控制
const QUERY_DEBOUNCE_MS = 300 as const
let lastQuerySeq = 0
async function queryNameInternal(id: string) {
  const trimmed = id.trim()
  if (trimmed.length < 1) {
    studentName.value = ''
    return
  }
  const seq = ++lastQuerySeq
  const name = await queryStudentName(trimmed)
  // 只保留"最后一次请求"的响应，避免先发的请求晚到后覆盖新结果
  if (seq === lastQuerySeq) {
    studentName.value = name
  }
}
const debouncedQueryName = debounce(queryNameInternal, QUERY_DEBOUNCE_MS)

// R33: authStore.error 为 falsy 时 hasError 自动置 false，解决"错误永远残留"的反模式
watch(
  () => authStore.error,
  (newError) => {
    hasError.value = !!newError
  },
)

// 监听可见性变化：打开时清空表单，focus 到第一个输入；关闭时清理资源
watch(
  () => props.visible,
  async (newVisible) => {
    if (newVisible) {
      studentId.value = ''
      password.value = ''
      studentName.value = ''
      hasError.value = false
      lastQuerySeq = 0
      authStore.clearError()
      // 记录 modal 打开前被 focus 的元素，关闭时归还给它（WAI-ARIA 规范）
      capturePreviouslyFocused()
      await nextTick()
      // 比 setTimeout 更可靠地 focus；nextTick 后 DOM 已渲染
      const el = firstFocusableRef.value || document.getElementById('studentId')
      if (el && typeof (el as HTMLElement).focus === 'function') {
        ;(el as HTMLElement).focus()
      }
    } else {
      // 关闭：取消未完成的 debounce，避免关闭后还在异步回调里 mutate state
      debouncedQueryName.cancel()
      lastQuerySeq = 0
      restorePreviouslyFocused()
    }
  },
)

// 学号输入处理：本地先清错误，然后异步防抖查询姓名
async function handleStudentIdInput(): Promise<void> {
  clearValidation()
  debouncedQueryName(studentId.value)
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
  if (!password.value) {
    hasError.value = true
    return
  }

  if (isSubmitting.value) return
  isSubmitting.value = true
  // 提交时取消尚未完成的学生姓名查询（不需要了）
  debouncedQueryName.cancel()

  try {
    await authStore.login(studentId.value.trim(), password.value, studentName.value, props.role)
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

// 忘记密码处理
function handleForgotPassword(): void {
  // 目前无独立找回密码页面，提示用户联系管理员
  alert('请联系管理员重置密码')
}

// 注册入口处理（教师端）
function handleRegister(): void {
  // 目前无独立注册页面，提示用户联系管理员
  alert('请联系管理员申请教师账号')
}

// 点击外部区域关闭
function handleOverlayClick(): void {
  emit('close')
}

// ESC 键关闭（全局监听版本；handleModalKeydown 已经负责 focus trap+ESC，这里保留兜底）
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.visible) {
    emit('close')
  }
}

// ============================================================
// R32: Focus trap
// 按 WAI-ARIA dialog 规范：Tab / Shift+Tab 在 modal 内部"第一↔最后"个可聚焦元素循环
// ============================================================
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let previouslyFocused: HTMLElement | null = null

function capturePreviouslyFocused() {
  const active = document.activeElement
  previouslyFocused = active instanceof HTMLElement ? active : null
}

function restorePreviouslyFocused() {
  try {
    previouslyFocused?.focus?.()
  } catch {
    /* ignore */
  }
  previouslyFocused = null
}

function getFocusableInModal(): HTMLElement[] {
  const root = modalRef.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled'),
  )
}

function handleModalKeydown(e: KeyboardEvent) {
  // 全局 ESC 监听也会处理；这里再处理一次保证 focus trap 内生效
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab') return
  const focusables = getFocusableInModal()
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  // 上一步已排除 length===0，first / last 一定非 undefined
  if (!first || !last) return
  const active = document.activeElement as HTMLElement | null

  if (e.shiftKey) {
    // Shift+Tab：在第一个元素上 Tab Shift 要回到最后
    if (!active || active === first || !modalRef.value?.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  } else {
    // Tab：在最后一个元素上 Tab 要回到第一个
    if (!active || active === last || !modalRef.value?.contains(active)) {
      e.preventDefault()
      first.focus()
    }
  }
}

// 生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  debouncedQueryName.cancel()
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

/* 底部链接区 - Figma: 忘记密码 / 注册入口 */
.login-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
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
  /* R28: 辅助小字统一用 font-size-xs token */
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/*
 * R29: 移除 !important
 * scoped 选择器 + 更具体的上下文（.test-account-hint .test-accounts）
 * 已经拥有足够特异性，不需要 !important 就能覆盖父级 p 的样式
 */
.test-account-hint .test-accounts {
  margin-top: 0.25rem;
  color: var(--color-primary);
  font-family: monospace;
}

.test-account-hint .format-hint {
  margin-top: var(--spacing-xs);
  color: var(--color-text-secondary);
  /* R28: 提示类说明文字统一用 font-size-caption token */
  font-size: var(--font-size-caption);
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
