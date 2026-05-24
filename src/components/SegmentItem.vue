<!--
  SegmentItem.vue - 音频分段项组件

  功能说明：
  - 渲染单个段落：角色头像、角色名、文本内容
  - 根据 isActive prop 改变背景高亮样式
  - 包含独立播放按钮，点击后从该段落的 startTime 开始播放
-->
<template>
  <div class="segment-item" :class="{ active: isActive }" @click="handleClick">
    <div class="avatar">{{ segment.avatar }}</div>
    <div class="content">
      <div class="role-name">{{ segment.role }}</div>
      <div class="text">{{ segment.text }}</div>
    </div>
    <button class="play-btn" @click.stop="handlePlay">
      <i class="fas fa-play"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Segment } from './AudioSegmentPlayer.vue'

interface Props {
  segment: Segment
  isActive: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'play', startTime: number): void
  (e: 'click'): void
}>()

function handleClick() {
  emit('click')
}

function handlePlay() {
  emit('play', props.segment.startTime)
}
</script>

<style scoped>
.segment-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
}

.segment-item:hover {
  background-color: #f9fafb;
}

.segment-item.active {
  background-color: #dbeafe;
  border-color: #3b82f6;
}

.avatar {
  font-size: 1.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  border-radius: 50%;
  flex-shrink: 0;
}

.content {
  flex: 1;
  min-width: 0;
}

.role-name {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.text {
  color: #4b5563;
  font-size: 0.9rem;
  line-height: 1.5;
  word-break: break-word;
}

.play-btn {
  flex-shrink: 0;
  padding: 0.5rem;
  border: none;
  border-radius: 50%;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.play-btn:hover {
  background-color: #2563eb;
}
</style>
