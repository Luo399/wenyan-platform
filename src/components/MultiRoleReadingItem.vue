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
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  // 默认不高亮，由父组件通过 :is-active="..." 控制
  isActive: false,
})

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
/* 段落卡片项 */
.segment-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  /* 卡片圆角 */
  border-radius: var(--radius-card);
  background-color: var(--color-white);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  /* 卡片阴影 */
  box-shadow: var(--shadow-small);
  cursor: pointer;
  transition: all 0.2s;
  /* 使用设计 token 衬线字体 */
  font-family: var(--font-family-serif);
}

.segment-item:hover {
  /* 半透明米色高亮背景 */
  background-color: var(--color-bg-highlight);
}

.segment-item.active {
  /* 半透明米色高亮背景 */
  background-color: var(--color-bg-highlight);
  /* 朱红主色边框 */
  border-color: var(--color-primary);
}

.avatar {
  font-size: var(--font-size-subheading);
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 半透明米色高亮背景 */
  background-color: var(--color-bg-highlight);
  border-radius: 50%;
  flex-shrink: 0;
}

.content {
  flex: 1;
  min-width: 0;
}

.role-name {
  font-weight: var(--font-weight-semibold);
  /* 黑色主文字 */
  color: var(--color-text);
  font-size: var(--font-size-small);
  margin-bottom: 0.25rem;
}

.text {
  /* 灰色次要文字 */
  color: var(--color-text-secondary);
  font-size: var(--font-size-body);
  line-height: 1.5;
  word-break: break-word;
}

/* 播放按钮（圆形图标按钮） */
.play-btn {
  flex-shrink: 0;
  padding: var(--spacing-xs);
  border: none;
  border-radius: 50%;
  /* 朱红主色底 */
  background-color: var(--color-primary);
  color: var(--color-white);
  cursor: pointer;
  transition: background-color 0.2s;
}

.play-btn:hover {
  /* 暗红悬浮态 */
  background-color: var(--color-primary-hover);
}
</style>
