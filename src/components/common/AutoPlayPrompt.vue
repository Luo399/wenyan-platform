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
}

.prompt-content {
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.prompt-icon {
  font-size: 48px;
  color: #3b82f6;
  margin-bottom: 16px;
}

.prompt-text {
  margin-bottom: 20px;
}

.prompt-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.prompt-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  line-height: 1.5;
}

.prompt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.prompt-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-2px);
}

.prompt-btn:active {
  transform: translateY(0);
}

.prompt-btn i {
  font-size: 16px;
}
</style>
