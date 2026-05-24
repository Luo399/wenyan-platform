<!--
  StudentDisplay.vue - 学生学号显示组件

  功能说明：
  - 显示当前登录学生的学号
  - 提供修改/退出登录按钮
  - 放在 App.vue 右上角
-->
<template>
  <div class="student-display">
    <span class="student-id">{{ displayId }}</span>
    <button class="edit-btn" @click="showEditModal = true" title="修改学号">
      <i class="fas fa-edit"></i>
    </button>

    <!-- 修改学号弹窗 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal-content">
        <h3>修改学号</h3>

        <div class="input-group">
          <input
            v-model="inputId"
            type="text"
            maxlength="4"
            placeholder="请输入4位学号"
            @keyup.enter="handleSave"
            :class="{ 'error': hasError }"
          />
        </div>

        <p v-if="hasError" class="error-message">学号必须为4位数字</p>

        <div class="modal-buttons">
          <button class="cancel-btn" @click="handleCancel">取消</button>
          <button class="save-btn" @click="handleSave" :disabled="!isValid">保存</button>
          <button class="logout-btn" @click="handleLogout">退出登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()

// 是否显示编辑弹窗
const showEditModal = ref(false)
// 输入的学号
const inputId = ref('')
// 是否有错误
const hasError = ref(false)

/**
 * 显示的学号
 */
const displayId = computed(() => studentStore.displayId)

/**
 * 验证输入是否为4位数字
 */
const isValid = computed(() => {
  return /^\d{4}$/.test(inputId.value)
})

/**
 * 保存新学号
 */
function handleSave() {
  if (!isValid.value) {
    hasError.value = true
    return
  }

  hasError.value = false
  studentStore.setStudentId(inputId.value)
  showEditModal.value = false
  inputId.value = ''
}

/**
 * 取消修改
 */
function handleCancel() {
  showEditModal.value = false
  inputId.value = ''
  hasError.value = false
}

/**
 * 退出登录
 */
function handleLogout() {
  studentStore.clearStudentId()
  showEditModal.value = false
  inputId.value = ''
  hasError.value = false
}
</script>

<style scoped>
.student-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.student-id {
  color: #6b7280;
  font-size: 0.875rem;
}

.edit-btn {
  padding: 0.25rem 0.5rem;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.edit-btn:hover {
  background-color: #f3f4f6;
  color: #3b82f6;
  border-color: #3b82f6;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  min-width: 280px;
}

.modal-content h3 {
  margin-bottom: 1rem;
  color: #374151;
}

.input-group {
  margin-bottom: 0.5rem;
}

.input-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  text-align: center;
}

.input-group input:focus {
  outline: none;
  border-color: #3b82f6;
}

.input-group input.error {
  border-color: #ef4444;
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.modal-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.modal-buttons button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.cancel-btn {
  background-color: #e5e7eb;
  color: #374151;
}

.save-btn {
  background-color: #3b82f6;
  color: white;
}

.save-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.logout-btn {
  background-color: #ef4444;
  color: white;
}
</style>
