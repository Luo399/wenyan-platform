<template>
  <div class="base-timeout">
    <i class="fas fa-clock"></i>
    <p>{{ timeoutText }}</p>
    <button @click="$emit('retry')" class="retry-btn">
      重试
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  timeoutText?: string
}

withDefaults(defineProps<Props>(), {
  timeoutText: '请求超时，请稍后重试'
})

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<style scoped>
.base-timeout {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  gap: 0.75rem;
  color: #f59e0b;
}

.base-timeout i {
  font-size: 2.5rem;
}

.base-timeout p {
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