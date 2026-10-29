<!--
  DashboardPanel.vue - 看板区块外壳

  统一「标题 + 口径说明 + 加载/错误态 + 内容插槽」四件事，
  让教师页和管理员页的每个模块长得一样、错误处理也一样。

  口径说明（hint）是有意保留的：看板数字最容易被误读（平均正确率到底包不包含
  没答题的学生？完成率的分母是谁给的？），把口径写在数字旁边比写在文档里有效。
-->
<template>
  <section class="dashboard-panel" data-testid="dashboard-panel">
    <header class="panel-head">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="hint" class="panel-hint">{{ hint }}</p>
      </div>
      <div class="panel-actions">
        <slot name="actions"></slot>
      </div>
    </header>

    <div v-if="error" class="panel-error">
      <span>{{ error }}</span>
      <button v-if="retryable" type="button" class="plain-btn" @click="$emit('retry')">重试</button>
    </div>

    <div v-else-if="loading" class="panel-loading" data-testid="panel-loading">{{ loadingText }}</div>

    <div v-else class="panel-body">
      <slot></slot>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface DashboardPanelProps {
  title: string
  /** 口径说明，显示在标题下 */
  hint?: string
  loading?: boolean
  loadingText?: string
  /** 只影响本区块，不做整页白屏 */
  error?: string
  retryable?: boolean
}

withDefaults(defineProps<DashboardPanelProps>(), {
  hint: '',
  loading: false,
  loadingText: '加载中...',
  error: '',
  retryable: true,
})

defineEmits<{ (e: 'retry'): void }>()
</script>

<style scoped>
.dashboard-panel {
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-white);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.panel-title {
  margin: 0;
  font-size: 1rem;
  font-weight: var(--font-weight-semibold);
}

.panel-hint {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.panel-loading {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.panel-error {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-danger);
  font-size: 0.85rem;
}

.plain-btn {
  font-family: inherit;
  cursor: pointer;
  background: none;
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 0.8rem;
}
</style>
