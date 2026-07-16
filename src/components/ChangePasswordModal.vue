<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container">
          <button class="close-btn" @click="handleClose">&times;</button>

          <div class="modal-header">
            <h2>修改密码</h2>
          </div>

          <form class="password-form" @submit.prevent="handleSubmit">
            <div v-if="error" class="error-box">{{ error }}</div>
            <div v-if="success" class="success-box">{{ success }}</div>

            <div class="form-group">
              <label>原密码</label>
              <input v-model="form.oldPassword" type="password" placeholder="请输入原密码" />
            </div>

            <div class="form-group">
              <label>新密码</label>
              <input v-model="form.newPassword" type="password" placeholder="至少6位" />
            </div>

            <div class="form-group">
              <label>确认新密码</label>
              <input v-model="form.confirmPassword" type="password" placeholder="再次输入新密码" />
              <span v-if="passwordMismatch" class="hint error">两次输入的密码不一致</span>
            </div>

            <button type="submit" class="submit-btn" :disabled="!canSubmit || isSubmitting">
              {{ isSubmitting ? '修改中...' : '确认修改' }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const authStore = useAuthStore()

const form = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const error = ref('')
const success = ref('')
const isSubmitting = ref(false)

const passwordMismatch = computed(() =>
  form.value.confirmPassword.length > 0 && form.value.newPassword !== form.value.confirmPassword
)

const canSubmit = computed(() => {
  return (
    form.value.oldPassword.length > 0 &&
    form.value.newPassword.length >= 6 &&
    form.value.newPassword === form.value.confirmPassword
  )
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
      error.value = ''
      success.value = ''
    }
  }
)

async function handleSubmit() {
  if (!canSubmit.value) return
  error.value = ''
  success.value = ''
  isSubmitting.value = true

  try {
    await authStore.changePassword(
      form.value.oldPassword,
      form.value.newPassword,
      form.value.confirmPassword
    )
    success.value = '密码修改成功'
    setTimeout(() => {
      emit('close')
    }, 1500)
  } catch (err) {
    error.value = authStore.error || '修改失败'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  position: relative;
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 400px;
  padding: 1.5rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.25rem;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.15);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 1rem;
}

.password-form {
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
  padding: 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.form-group input:focus {
  outline: none;
  border-color: #4f46e5;
}

.hint {
  font-size: 0.75rem;
  color: #9ca3af;
}

.hint.error {
  color: #ef4444;
}

.submit-btn {
  padding: 0.75rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  background: #4338ca;
}

.submit-btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}

.error-box {
  padding: 0.625rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #dc2626;
  font-size: 0.875rem;
}

.success-box {
  padding: 0.625rem;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 0.375rem;
  color: #059669;
  font-size: 0.875rem;
}
</style>
