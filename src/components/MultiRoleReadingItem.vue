<!--
  MultiRoleReadingItem.vue - 多角色朗读分段项组件

  功能说明：
  - 渲染单个段落：角色头像、角色名、文本内容
  - 根据 isActive prop 改变背景高亮样式
  - 包含独立播放按钮，点击后从该段落的 startTime 开始播放

  使用方式：
  <MultiRoleReadingItem
    :segment="segment"
    :is-active="isActive"
    @play="handlePlay"
    @click="handleClick"
  />

  Props:
  - segment: 段落数据
  - isActive: 是否为当前播放段落
-->

<template>
  <div class="segment-item" :class="{ active: isActive }" @click="handleClick">
    <div class="avatar">{{ emoji }}</div>
    <div class="content">
      <div class="role-name">{{ roleName }}</div>
      <div class="text">{{ segment.dialogue }}</div>
    </div>
    <button class="play-btn" @click.stop="handlePlay">
      <i class="fas fa-play"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MultiRoleSegment } from './MultiRoleReading.vue'

interface Props {
  segment: MultiRoleSegment
  isActive: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'click'): void
}>()

/**
 * 从 role_name 中提取角色名称（去掉emoji）
 */
const roleName = computed(() => {
  const name = props.segment.role_name
  // 移除 emoji 字符
  return name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
})

/**
 * 从 role_name 中提取 emoji
 */
const emoji = computed(() => {
  const name = props.segment.role_name
  // 匹配 emoji 字符
  const match = name.match(/[\u{1F300}-\u{1F9FF}]/gu)
  return match ? match[match.length - 1] : '📖' // 默认使用书本emoji
})

function handleClick() {
  emit('click')
}

function handlePlay() {
  emit('play')
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
