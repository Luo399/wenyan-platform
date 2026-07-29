<template>
  <div class="base-timeout">
    <i class="fas fa-clock"></i>
    <p>{{ timeoutText }}</p>
    <button @click="$emit('retry')" class="retry-btn">重试</button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  timeoutText?: string
}

withDefaults(defineProps<Props>(), {
  timeoutText: '请求超时，请稍后重试',
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
  padding: var(--spacing-2xl);
  gap: var(--spacing-sm);
  color: var(--color-accent);
}

.base-timeout i {
  font-size: 2.5rem;
}

.base-timeout p {
  margin: 0;
}

/* 重试按钮：朱红底色 + 橄榄绿边框 + 胶囊圆角 */
.retry-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  cursor: pointer;
}

.retry-btn:hover {
  background-color: var(--color-primary-hover);
}
</style>
