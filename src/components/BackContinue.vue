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
  padding: 1rem 2rem;
  background: linear-gradient(to top, rgba(255, 255, 255, 1) 60%, rgba(255, 255, 255, 0));
  z-index: 100;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn {
  background-color: #e5e7eb;
  color: #374151;
}

.back-btn:hover {
  background-color: #d1d5db;
}

.continue-btn {
  background-color: #3b82f6;
  color: white;
}

.continue-btn:hover {
  background-color: #2563eb;
}
</style>
