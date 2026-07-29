<!--
  BackContinue.vue - 底部导航按钮组件

  功能说明：
  - 提供统一的底部导航按钮（返回、继续）
  - 支持自定义按钮文本和点击事件
  - 样式封装，避免冲突

  使用示例：
  <BackContinue
    back-text="返回"
    continue-text="继续"
    :show-continue="true"
    @back="handleBack"
    @continue="handleContinue"
  />
-->
<template>
  <div class="back-continue-bar">
    <button class="nav-btn back-btn" @click="handleBack">
      <i class="fas fa-arrow-left"></i>
      {{ backText }}
    </button>
    <button v-if="showContinue" class="nav-btn continue-btn" @click="handleContinue">
      {{ continueText }}
      <i class="fas fa-arrow-right"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * BackContinue Props 定义
 */
interface Props {
  /** 返回按钮文本 */
  backText?: string
  /** 继续按钮文本 */
  continueText?: string
  /** 是否显示继续按钮 */
  showContinue?: boolean
  /** 自定义返回事件（默认使用 router.back()） */
  backEvent?: () => void
  /** 自定义继续事件 */
  continueEvent?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  backText: '返回',
  continueText: '继续',
  showContinue: true,
})

const emit = defineEmits<{
  /** 返回按钮点击事件 */
  (e: 'back'): void
  /** 继续按钮点击事件 */
  (e: 'continue'): void
}>()

/**
 * 处理返回按钮点击
 */
function handleBack() {
  if (props.backEvent) {
    props.backEvent()
  } else {
    emit('back')
  }
}

/**
 * 处理继续按钮点击
 */
function handleContinue() {
  if (props.continueEvent) {
    props.continueEvent()
  } else {
    emit('continue')
  }
}
</script>

<style scoped>
.back-continue-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-xl);
  background: linear-gradient(to top, rgba(255, 255, 255, 1) 60%, rgba(255, 255, 255, 0));
  z-index: 100;
}

/* 导航按钮 - Figma 设计：圆角 50px，思源宋体 */
.nav-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-xl);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
}

/* 返回按钮 - 白底 */
.back-btn {
  background-color: var(--color-white);
  color: var(--color-text);
}

.back-btn:hover {
  background-color: var(--color-bg-highlight);
}

/* 继续按钮 - 朱红底 */
.continue-btn {
  background-color: var(--color-primary);
  color: var(--color-white);
}

.continue-btn:hover {
  background-color: var(--color-primary-hover);
}

.nav-btn:active {
  transform: scale(0.98);
}
</style>
