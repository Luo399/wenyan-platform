<template>
  <!-- R39: 空状态 role=status + aria-live=polite 让屏幕阅读器播报"暂无数据" -->
  <div class="base-empty" role="status" aria-live="polite">
    <i class="fas fa-inbox" aria-hidden="true"></i>
    <p>{{ emptyText }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  emptyText?: string
}

withDefaults(defineProps<Props>(), {
  emptyText: '暂无数据',
})
</script>

<style scoped>
.base-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-sm);
  color: var(--color-text-secondary);
}

.base-empty i {
  font-size: 2.5rem;
}

.base-empty p {
  margin: 0;
}
</style>
