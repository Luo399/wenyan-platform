<!--
  PageScaffold.vue - 通用页面容器（P1 重构）

  承载 Figma 数据驱动页面的公共骨架：
  - 页面标题区（title/subtitle 或自定义 header slot）
  - 加载 / 错误 / 空态（BaseLoader / BaseError / BaseEmpty）
  - 内容区（default slot，各页面渲染自己的内容）
  - 底部导航（BackContinue：返回 / 继续）

  使用示例：
  PageScaffold 组件包裹各页面内容，插槽说明：
  - header slot：自定义标题区（默认展示 title/subtitle）
  - 默认 slot：页面内容
  - empty slot：自定义空态（默认 BaseEmpty）
-->
<template>
  <div class="page-scaffold">
    <header v-if="title || subtitle || $slots.header" class="page-scaffold-header">
      <slot name="header">
        <h1 v-if="title" class="page-scaffold-title">{{ title }}</h1>
        <p v-if="subtitle" class="page-scaffold-subtitle">{{ subtitle }}</p>
      </slot>
    </header>

    <!-- 加载态 -->
    <BaseLoader v-if="loading" :loading-text="loadingText" />

    <!-- 错误态 -->
    <BaseError v-else-if="error" :error="error" @retry="$emit('retry')" />

    <!-- 空态 -->
    <div v-else-if="isEmpty" class="page-scaffold-empty">
      <slot name="empty">
        <BaseEmpty :empty-text="emptyText" />
      </slot>
    </div>

    <!-- 内容区 -->
    <div v-else class="page-scaffold-content">
      <slot />
    </div>

    <!-- 底部导航 -->
    <BackContinue
      v-if="showNavigation"
      :show-continue="showContinue"
      :back-text="backText"
      :continue-text="continueText"
      @back="$emit('back')"
      @continue="$emit('continue')"
    />
  </div>
</template>

<script setup lang="ts">
import BackContinue from '@/components/BackContinue.vue'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'

interface Props {
  /** 页面标题（置顶展示）；也可通过 header slot 完全自定义 */
  title?: string
  /** 页面副标题 */
  subtitle?: string
  /** 是否处于加载状态 */
  loading: boolean
  /** 错误信息（非空即显示错误态） */
  error: string | null
  /** 是否为空态（无数据） */
  isEmpty?: boolean
  /** 加载提示文案 */
  loadingText?: string
  /** 空态文案 */
  emptyText?: string
  /** 是否渲染底部导航（加载/错误态下可隐藏） */
  showNavigation?: boolean
  /** 是否显示"继续"按钮（传给 BackContinue） */
  showContinue?: boolean
  /** 返回按钮文案 */
  backText?: string
  /** 继续按钮文案 */
  continueText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  isEmpty: false,
  loadingText: '加载中...',
  emptyText: '暂无内容',
  showNavigation: true,
  showContinue: true,
  backText: '返回',
  continueText: '继续',
})

defineEmits<{
  (e: 'retry'): void
  (e: 'back'): void
  (e: 'continue'): void
}>()

void props
</script>

<style scoped>
.page-scaffold {
  /* 底部为固定导航预留空间 */
  padding-bottom: var(--spacing-bottom-safe, 5rem);
}

.page-scaffold-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-lg);
  background-color: var(--color-primary);
  border-radius: var(--radius-card);
  color: var(--color-white);
}

.page-scaffold-title {
  margin: 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
}

.page-scaffold-subtitle {
  margin: var(--spacing-xs) 0 0 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  opacity: 0.9;
}

.page-scaffold-empty {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl) 0;
}

.page-scaffold-content {
  width: 100%;
}

@media (max-width: 768px) {
  .page-scaffold-header {
    padding: var(--spacing-md);
  }

  .page-scaffold-title {
    font-size: var(--font-size-subheading);
  }
}
</style>
