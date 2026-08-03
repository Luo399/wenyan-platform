<template>
  <!-- R39: ARIA 状态组件：role=status + aria-live 让屏幕阅读器播报加载状态 -->
  <div class="base-loader" role="status" aria-live="polite">
    <!-- spinner 为装饰性元素，aria-hidden=true 避免屏幕阅读器读"空 div" -->
    <div class="spinner" aria-hidden="true"></div>
    <span>{{ loadingText }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  loadingText?: string
}

withDefaults(defineProps<Props>(), {
  loadingText: '加载中...',
})
</script>

<style scoped>
.base-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-sm);
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: var(--border-width-thin) solid var(--color-placeholder);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
