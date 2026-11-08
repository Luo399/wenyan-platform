<!--
  QuizProgressBar - 答题进度展示（纯展示，不计算业务状态）
-->
<template>
  <div class="fg-progress">
    <div class="fg-progress-track">
      <div class="fg-progress-fill" :style="{ width: percent + '%' }"></div>
    </div>
    <span v-if="showText" class="fg-progress-text">{{ current }} / {{ total }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 已答数量 */
  current: number
  /** 总题数 */
  total: number
  /** 是否显示 x / y 文本 */
  showText?: boolean
}

const props = withDefaults(defineProps<Props>(), { showText: true })

const percent = computed(() => {
  if (props.total <= 0) return 0
  return Math.min(Math.round((props.current / props.total) * 100), 100)
})
</script>

<style scoped>
.fg-progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-xs);
  background-color: var(--color-placeholder);
  border-radius: var(--radius-small);
}

.fg-progress-track {
  flex: 1;
  height: 8px;
  background-color: var(--color-placeholder);
  border-radius: 4px;
  overflow: hidden;
}

.fg-progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.fg-progress-text {
  min-width: 60px;
  text-align: right;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
</style>
