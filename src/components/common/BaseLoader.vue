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
  padding: 3rem;
  gap: 0.75rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
