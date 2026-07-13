<!--
  StudentLogin.vue - 学生学号输入组件

  功能说明：
  - 提供学号输入框，要求非空输入
  - 验证输入合法性
  - 调用登录API进行认证
-->
<template>
  <div class="student-login">
    <h2>请输入您的学号</h2>
    <p class="subtitle">请输入您的学号</p>

    <div class="input-group">
      <input
        v-model="inputId"
        type="text"
        placeholder="请输入学号"
        @keyup.enter="handleSubmit"
        :class="{ error: hasError }"
      />
      <button @click="handleSubmit" :disabled="!isValid || isLoading">
        <span v-if="isLoading" class="spinner"></span>
        {{ isLoading ? '登录中...' : '确认' }}
      </button>
    </div>

    <p v-if="hasError" class="error-message">学号不能为空</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const inputId = ref('')
const hasError = ref(false)
const isLoading = ref(false)

const isValid = computed(() => {
  return inputId.value.trim().length > 0
})

async function handleSubmit() {
  if (!isValid.value) {
    hasError.value = true
    return
  }

  hasError.value = false
  isLoading.value = true

  try {
    await authStore.login(inputId.value.trim())
    inputId.value = ''
  } catch (error) {
    hasError.value = true
    console.error('[StudentLogin] 登录失败:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.student-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
}

.student-login h2 {
  font-size: 1.5rem;
  color: #374151;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.input-group {
  display: flex;
  gap: 0.5rem;
}

.input-group input {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  width: 8rem;
  text-align: center;
}

.input-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.input-group input.error {
  border-color: #ef4444;
}

.input-group button {
  padding: 0.75rem 1.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.input-group button:hover:not(:disabled) {
  background-color: #2563eb;
}

.input-group button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>