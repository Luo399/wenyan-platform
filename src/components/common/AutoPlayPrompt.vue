<template>
  <div class="auto-play-prompt" v-if="show">
    <div class="prompt-content">
      <div class="prompt-icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="prompt-text">
        <p class="prompt-title">{{ title }}</p>
        <p class="prompt-desc">{{ description }}</p>
      </div>
      <button class="prompt-btn" @click="handleClick">
        <i class="fas fa-play"></i>
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  show: boolean
  title?: string
  description?: string
  buttonText?: string
}

withDefaults(defineProps<Props>(), {
  title: '需要您的操作',
  description: '由于浏览器安全策略限制，需要点击下方按钮开始播放媒体内容',
  buttonText: '开始播放',
})

const emit = defineEmits<{
  (e: 'play'): void
}>()

function handleClick() {
  emit('play')
}
</script>

<style scoped>
.auto-play-prompt {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  width: 90%;
  max-width: 400px;
  /* 使用设计 token 衬线字体 */
  font-family: var(--font-family-serif);
}

/* 提示卡片 */
.prompt-content {
  /* 半透明黑色遮罩背景（模态提示，设计 token 无对应半透明深色） */
  background: rgba(0, 0, 0, 0.8);
  /* 卡片圆角 */
  border-radius: var(--radius-card);
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-white);
  /* 卡片阴影 */
  box-shadow: var(--shadow-card);
}

.prompt-icon {
  font-size: var(--font-size-display);
  /* 朱红主色图标 */
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
}

.prompt-text {
  margin-bottom: var(--spacing-lg);
}

.prompt-title {
  font-size: var(--font-size-subheading);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-xs) 0;
}

.prompt-desc {
  font-size: var(--font-size-small);
  /* 半透明白色描述文字（模态背景上，保留透明度） */
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  line-height: 1.5;
}

/* 提示按钮（文字按钮：朱红底 + 橄榄绿边框 + 药丸圆角） */
.prompt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  /* 朱红主色底 */
  background: var(--color-primary);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  color: var(--color-white);
  font-size: var(--font-size-body-lg);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
}

.prompt-btn:hover {
  /* 暗红悬浮态 */
  background: var(--color-primary-hover);
  transform: translateY(-2px);
}

.prompt-btn:active {
  transform: translateY(0);
}

.prompt-btn i {
  font-size: var(--font-size-body-lg);
}
</style>
