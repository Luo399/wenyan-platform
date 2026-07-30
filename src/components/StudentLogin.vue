<!--
  StudentLogin.vue - 学生学号输入组件

  功能说明：
  - 提供学号输入框，接受任意位数字学号
  - 验证输入合法性
  - 保存学号到 Pinia Store
-->
<template>
  <div class="student-login">
    <h2>请输入您的学号</h2>
    <p class="subtitle">请输入学号数字</p>

    <div class="input-group">
      <input
        v-model="inputId"
        type="text"
        inputmode="numeric"
        placeholder="请输入学号"
        @keyup.enter="handleSubmit"
        :class="{ error: hasError }"
      />
      <button @click="handleSubmit" :disabled="!isValid">确认</button>
    </div>

    <p v-if="hasError" class="error-message">学号必须为数字</p>
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
 * 验证输入是否为非空纯数字（兼容 1-5 测试账号与 2024001 正式学号）
 */
const isValid = computed(() => {
  return /^\d+$/.test(inputId.value)
})

/**
 * 提交学号
 */
function handleSubmit() {
  if (!isValid.value) {
    hasError.value = true
    return
  }

  hasError.value = false
  studentStore.setStudentId(inputId.value)
  inputId.value = ''
}
</script>

<style scoped>
.student-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl);
}

.student-login h2 {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  margin-bottom: var(--spacing-xl);
}

.input-group {
  display: flex;
  gap: var(--spacing-sm);
}

/* 输入框 - Figma 设计：底部下划线样式 */
.input-group input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-bottom: 2px solid var(--color-text);
  border-radius: 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  width: 10rem;
  text-align: center;
  background: transparent;
  color: var(--color-text);
}

.input-group input::placeholder {
  color: var(--color-text-secondary);
}

.input-group input:focus {
  outline: none;
  border-bottom-color: var(--color-primary);
}

.input-group input.error {
  border-bottom-color: var(--color-primary);
}

/* 确认按钮 - Figma 设计：朱红底 + 橄榄绿边框 + 50px 圆角 */
.input-group button {
  padding: var(--spacing-sm) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
  white-space: nowrap;
}

.input-group button:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.input-group button:active:not(:disabled) {
  transform: scale(0.98);
}

.input-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  color: var(--color-primary);
  font-size: var(--font-size-small);
  margin-top: var(--spacing-sm);
}
</style>
