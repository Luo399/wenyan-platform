<!--
  SortMark.vue - 表头排序方向标记

  只有当前排序列显示箭头，其余列留一个占位空格，
  这样点表头时列宽不会跳动（原来用 ↑↓ 常显会让每列都变宽）。
-->
<template>
  <span class="sort-mark" :class="{ 'sort-mark--active': active }" aria-hidden="true">
    {{ active ? (order === 'asc' ? '▲' : '▼') : '' }}
  </span>
</template>

<script setup lang="ts">
export interface SortMarkProps {
  active?: boolean
  order?: 'asc' | 'desc'
}

withDefaults(defineProps<SortMarkProps>(), {
  active: false,
  order: 'asc',
})
</script>

<style scoped>
.sort-mark {
  font-size: 0.6rem;
  line-height: 1;
  min-width: 0.6rem;
  display: inline-block;
  color: var(--color-primary);
}

.sort-mark--active {
  font-weight: var(--font-weight-semibold);
}
</style>
