<!--
  StatCard.vue - 看板顶部指标卡

  只负责「一个数字 + 一句说明」，数字口径完全由调用方（视图层）决定，
  组件内不做任何计算，避免同一指标在不同页面算出两个结果。

  tone 用来给需要盯的指标上色（例如「未开始学生」偏危险色），
  颜色一律取 design-tokens 变量，不写死色值。
-->
<template>
  <div class="stat-card" :class="toneClass" data-testid="stat-card">
    <div class="stat-value">
      {{ displayValue }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
    </div>
    <div class="stat-label">{{ label }}</div>
    <div v-if="hint" class="stat-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface StatCardProps {
  /** 指标名，如「平均正确率」 */
  label: string
  /** 已格式化好的数值；传 number 时组件只做 toString，四舍五入请在上游做 */
  value: string | number
  /** 单位后缀，如 % 或 人 */
  unit?: string
  /** 副说明文案，如「近 7 日活跃 3 人」 */
  hint?: string
  /** 语义色：默认中性，warn/danger 用于需要老师立刻处理的指标 */
  tone?: 'default' | 'success' | 'warn' | 'danger'
}

const props = withDefaults(defineProps<StatCardProps>(), {
  unit: '',
  hint: '',
  tone: 'default',
})

const displayValue = computed(() => (typeof props.value === 'number' ? String(props.value) : props.value))

const toneClass = computed(() => (props.tone === 'default' ? '' : `stat-card--${props.tone}`))
</script>

<style scoped>
.stat-card {
  flex: 1 1 150px;
  min-width: 150px;
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-white);
}

.stat-value {
  font-size: 1.4rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  color: var(--color-text);
}

.stat-unit {
  font-size: 0.8rem;
  margin-left: 2px;
  color: var(--color-text-secondary);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.stat-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.stat-card--success .stat-value {
  color: var(--color-success);
}

.stat-card--warn .stat-value {
  color: var(--color-accent);
}

.stat-card--danger .stat-value {
  color: var(--color-danger);
}
</style>
