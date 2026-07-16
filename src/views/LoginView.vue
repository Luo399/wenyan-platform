<template>
  <div class="login-page">
    <div class="login-container">
      <h1 class="title">文言文学习平台</h1>

      <!-- 登录 Tab -->
      <div class="tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'student' }]"
          @click="activeTab = 'student'"
        >
          学生登录
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'teacher' }]"
          @click="activeTab = 'teacher'"
        >
          教师登录
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="authStore.error" class="error-box">
        <span class="error-text">{{ authStore.error }}</span>
      </div>

      <!-- 学生登录表单 -->
      <form v-if="activeTab === 'student'" class="login-form" @submit.prevent="handleStudentLogin">
        <div class="form-group">
          <label>学号</label>
          <input
            v-model="studentForm.student_id"
            type="text"
            maxlength="8"
            placeholder="请输入8位学号"
            :disabled="authStore.isLoading"
          />
          <span v-if="studentForm.student_id && !isValidStudentId" class="hint">
            学号格式：8位数字（如 20240001）
          </span>
        </div>

        <div class="form-group">
          <label>密码</label>
          <input
            v-model="studentForm.password"
            type="password"
            placeholder="请输入密码"
            :disabled="authStore.isLoading"
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="!canStudentSubmit || authStore.isLoading">
          {{ authStore.isLoading ? '登录中...' : '登录' }}
        </button>

        <div class="extra-links">
          <a href="javascript:void(0)" @click="showForgotHint('student')">忘记密码？</a>
        </div>

        <div v-if="forgotHint.student" class="forgot-hint">
          请联系你的老师重置密码
        </div>
      </form>

      <!-- 教师登录表单 -->
      <form v-else class="login-form" @submit.prevent="handleTeacherLogin">
        <div class="form-group">
          <label>手机号</label>
          <input
            v-model="teacherForm.phone"
            type="text"
            maxlength="11"
            placeholder="请输入手机号"
            :disabled="authStore.isLoading"
          />
        </div>

        <div class="form-group">
          <label>密码</label>
          <input
            v-model="teacherForm.password"
            type="password"
            placeholder="请输入密码"
            :disabled="authStore.isLoading"
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="!canTeacherSubmit || authStore.isLoading">
          {{ authStore.isLoading ? '登录中...' : '登录' }}
        </button>

        <div class="extra-links">
          <a href="javascript:void(0)" @click="showForgotHint('teacher')">忘记密码？</a>
          <router-link to="/teacher/register">注册账号</router-link>
        </div>

        <div v-if="forgotHint.teacher" class="forgot-hint">
          请联系管理员重置密码
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'student' | 'teacher'>('student')

const studentForm = ref({ student_id: '', password: '' })
const teacherForm = ref({ phone: '', password: '' })

const forgotHint = ref({ student: false, teacher: false })

const isValidStudentId = computed(() => /^\d{8}$/.test(studentForm.value.student_id))
const canStudentSubmit = computed(() => isValidStudentId.value && studentForm.value.password.length > 0)
const canTeacherSubmit = computed(() => /^1[3-9]\d{9}$/.test(teacherForm.value.phone) && teacherForm.value.password.length > 0)

function showForgotHint(type: 'student' | 'teacher') {
  forgotHint.value[type] = true
}

async function handleStudentLogin() {
  if (!canStudentSubmit.value) return
  authStore.clearError()
  try {
    await authStore.studentLogin(studentForm.value.student_id, studentForm.value.password)
    router.push('/')
  } catch {
    // 错误已在 store 中处理
  }
}

async function handleTeacherLogin() {
  if (!canTeacherSubmit.value) return
  authStore.clearError()
  try {
    await authStore.teacherLogin(teacherForm.value.phone, teacherForm.value.password)
    router.push('/')
  } catch {
    // 错误已在 store 中处理
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  background: white;
  padding: 2.5rem;
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 420px;
}

.title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 1.5rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.tab-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: none;
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-btn.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-group input {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.hint {
  font-size: 0.75rem;
  color: #9ca3af;
}

.submit-btn {
  padding: 0.875rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  background: #4338ca;
}

.submit-btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}

.extra-links {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.extra-links a {
  color: #4f46e5;
  text-decoration: none;
}

.extra-links a:hover {
  text-decoration: underline;
}

.error-box {
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.error-text {
  font-size: 0.875rem;
  color: #dc2626;
}

.forgot-hint {
  text-align: center;
  padding: 0.75rem;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 0.5rem;
  color: #c2410c;
  font-size: 0.875rem;
}
</style>
