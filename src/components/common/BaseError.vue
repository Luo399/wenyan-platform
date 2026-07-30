<template>
  <!-- R39: ARIA role=alert 让屏幕阅读器立即广播错误消息（assertive 打断正在播报的内容） -->
  <div class="base-error" role="alert" aria-live="assertive">
    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
    <p class="error-message">{{ error }}</p>
    <button v-if="showRetry" @click="$emit('retry')" class="retry-btn" type="button">重试</button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  error: string
  showRetry?: boolean
}

withDefaults(defineProps<Props>(), {
  showRetry: true,
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
  padding: var(--spacing-2xl);
  gap: var(--spacing-sm);
  color: var(--color-primary);
}

.base-error i {
  font-size: 2.5rem;
}

.error-message {
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
