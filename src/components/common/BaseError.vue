<template>
  <div class="base-error">
    <i class="fas fa-exclamation-circle"></i>
    <p class="error-message">{{ error }}</p>
    <button v-if="showRetry" @click="$emit('retry')" class="retry-btn">
      重试
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  error: string
  showRetry?: boolean
}

withDefaults(defineProps<Props>(), {
  showRetry: true
})

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<style scoped>
.base-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  gap: 0.75rem;
  color: #ef4444;
}

.base-error i {
  font-size: 2.5rem;
}

.error-message {
  margin: 0;
}

.retry-btn {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.retry-btn:hover {
  background-color: #2563eb;
}
</style>