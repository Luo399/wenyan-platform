<template>
  <div class="base-loader">
    <div class="spinner"></div>
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
