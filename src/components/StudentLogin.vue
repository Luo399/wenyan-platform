<!--
  StudentLogin.vue - 学生学号输入组件

  功能说明：
  - 提供学号输入框，要求4位数字
  - 验证输入合法性
  - 保存学号到 Pinia Store
-->
<template>
  <div class="student-login">
    <h2>请输入您的学号</h2>
    <p class="subtitle">学号为4位数字</p>

    <div class="input-group">
      <input
        v-model="inputId"
        type="text"
        maxlength="4"
        placeholder="请输入4位学号"
        @keyup.enter="handleSubmit"
        :class="{ 'error': hasError }"
      />
      <button @click="handleSubmit" :disabled="!isValid">
        确认
      </button>
    </div>

    <p v-if="hasError" class="error-message">
      学号必须为4位数字
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()

// 输入的学号
const inputId = ref('')
// 是否有错误
const hasError = ref(false)

/**
 * 验证输入是否为4位数字
 */
const isValid = computed(() => {
  return /^\d{4}$/.test(inputId.value)
})

/**
 * 提交学号
 */
function handleSubmit() {
  // 验证格式
  if (!isValid.value) {
    hasError.value = true
    return
  }

  hasError.value = false
  // 保存到 Store
  studentStore.setStudentId(inputId.value)
  // 清空输入
  inputId.value = ''
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
</style>
