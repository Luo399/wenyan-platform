<template>
  <div class="register-page">
    <div class="register-container">
      <h1 class="title">教师注册</h1>

      <div v-if="authStore.error" class="error-box">
        <span class="error-text">{{ authStore.error }}</span>
      </div>

      <form class="register-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>姓名 <span class="required">*</span></label>
          <input v-model="form.name" type="text" placeholder="请输入姓名" :disabled="authStore.isLoading" />
        </div>

        <div class="form-group">
          <label>手机号 <span class="required">*</span></label>
          <input v-model="form.phone" type="text" maxlength="11" placeholder="请输入手机号" :disabled="authStore.isLoading" />
        </div>

        <div class="form-group">
          <label>学校</label>
          <input v-model="form.school" type="text" placeholder="请输入学校名称" :disabled="authStore.isLoading" />
        </div>

        <div class="form-group">
          <label>所教班级 <span class="required">*</span></label>
          <div class="class-input-row">
            <input
              v-model="classInput"
              type="text"
              maxlength="6"
              placeholder="如 202409"
              :disabled="authStore.isLoading"
              @keyup.enter="addClass"
            />
            <button type="button" class="add-btn" @click="addClass" :disabled="!isValidClassInput">添加</button>
          </div>
          <span class="hint">格式：6位数字，前4位年级+后2位班级</span>

          <div v-if="form.classes.length > 0" class="class-tags">
            <span v-for="(cls, idx) in form.classes" :key="cls" class="class-tag">
              {{ cls }}
              <button type="button" class="remove-btn" @click="removeClass(idx)">×</button>
            </span>
          </div>
        </div>

        <div class="form-group">
          <label>设置密码 <span class="required">*</span></label>
          <input v-model="form.password" type="password" placeholder="至少6位" :disabled="authStore.isLoading" />
        </div>

        <div class="form-group">
          <label>确认密码 <span class="required">*</span></label>
          <input v-model="form.confirmPassword" type="password" placeholder="再次输入密码" :disabled="authStore.isLoading" />
          <span v-if="passwordMismatch" class="hint error">两次输入的密码不一致</span>
        </div>

        <button type="submit" class="submit-btn" :disabled="!canSubmit || authStore.isLoading">
          {{ authStore.isLoading ? '注册中...' : '注册' }}
        </button>

        <div class="extra-links">
          <router-link to="/login">已有账号？去登录</router-link>
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

const form = ref({
  name: '',
  phone: '',
  school: '',
  classes: [] as string[],
  password: '',
  confirmPassword: '',
})

const classInput = ref('')

const isValidClassInput = computed(() => /^\d{6}$/.test(classInput.value))
const passwordMismatch = computed(() =>
  form.value.confirmPassword.length > 0 && form.value.password !== form.value.confirmPassword
)

const canSubmit = computed(() => {
  return (
    form.value.name.trim() &&
    /^1[3-9]\d{9}$/.test(form.value.phone) &&
    form.value.classes.length > 0 &&
    form.value.password.length >= 6 &&
    form.value.password === form.value.confirmPassword
  )
})

function addClass() {
  if (!isValidClassInput.value) return
  if (form.value.classes.includes(classInput.value)) {
    classInput.value = ''
    return
  }
  form.value.classes.push(classInput.value)
  classInput.value = ''
}

function removeClass(idx: number) {
  form.value.classes.splice(idx, 1)
}

async function handleSubmit() {
  if (!canSubmit.value) return
  authStore.clearError()
  try {
    await authStore.teacherRegister({
      name: form.value.name.trim(),
      phone: form.value.phone,
      school: form.value.school.trim(),
      classes: form.value.classes,
      password: form.value.password,
    })
    router.push('/')
  } catch {
    // 错误已在 store 中处理
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 1rem;
}

.register-container {
  background: white;
  padding: 2.5rem;
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 480px;
}

.title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 1.5rem;
}

.register-form {
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

.required {
  color: #ef4444;
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

.class-input-row {
  display: flex;
  gap: 0.5rem;
}

.class-input-row input {
  flex: 1;
}

.add-btn {
  padding: 0.75rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.add-btn:hover:not(:disabled) {
  background: #059669;
}

.add-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.hint {
  font-size: 0.75rem;
  color: #9ca3af;
}

.hint.error {
  color: #ef4444;
}

.class-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.class-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.remove-btn {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #4f46e5;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
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
  text-align: center;
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
</style>
