<!--
  StepOneView.vue - 字词学习 + 多角色朗读组合页面

  布局说明：
  - 上方：WordList 组件（字词注释）
  - 下方：MultiRoleReading 组件（多角色朗读）
  - 底部：BackContinue 导航按钮

  页面顺序：rules -> stepone -> rule1 -> rule2 -> rule3 -> detail
-->
<template>
  <div class="annotated-segment-view">
    <!-- 上方：字词注释区域 -->
    <section class="annotated-section">
      <WordList :wen-id="wenId" />
    </section>

    <!-- 分割线 -->
    <div class="divider">
      <span class="divider-text">音频学习</span>
    </div>

    <!-- 下方：多角色朗读播放器 -->
    <section class="audio-section">
      <MultiRoleReading
        :wen-id="wenId"
        :auto-load="true"
        @load-success="handleAudioLoadSuccess"
        @load-error="handleAudioLoadError"
        @segment-change="handleSegmentChange"
      />
    </section>

    <!-- 底部导航按钮 -->
    <BackContinue
      back-text="返回"
      continue-text="继续"
      @back="handleGoPrev"
      @continue="handleGoNext"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import WordList from '@/components/WordList.vue'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useTracking } from '@/composables/useTracking'
import { markNextEnterFromBackButton } from '@/utils/tracking'
import type { MultiRoleData } from '@/components/MultiRoleReading.vue'
import { debugLog, debugError } from '@/utils/debug'

const route = useRoute()

// 篇目ID（路由参数）
const poemId = route.params.id as string

// 将路由参数 id（数字）转换为 wenId 格式
const wenId = computed(() => {
  if (!poemId) return 'WEN_01'
  // 如果已经是 WEN_xx 格式，直接返回
  if (poemId.startsWith('WEN_')) return poemId
  // 将数字转换为 WEN_xx 格式（如 1 -> WEN_01）
  const num = parseInt(poemId, 10)
  if (isNaN(num)) return 'WEN_01'
  return `WEN_${num.toString().padStart(2, '0')}`
})

// 使用导航composable
const { goNext, goPrev } = useNavigation('stepone', poemId)

// 使用埋点composable
const { trackInteraction, trackSearchWord } = useTracking('stepone', poemId)

// 包装 goPrev 以标记后退按钮
function handleGoPrev() {
  markNextEnterFromBackButton()
  goPrev()
}

function handleGoNext() {
  goNext()
}

function handleAudioLoadSuccess(data: MultiRoleData) {
  debugLog('音频数据加载成功:', data)
}

function handleAudioLoadError(error: string) {
  debugError('音频数据加载失败:', error)
}

function handleSegmentChange(index: number) {
  debugLog('当前段落变化:', index)
}
</script>

<style scoped>
.annotated-segment-view {
  padding: var(--spacing-md);
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

/* 课文注释区域 */
.annotated-section {
  margin-bottom: var(--spacing-md);
}

/* 分割线 - Figma 设计：橄榄绿 */
.divider {
  display: flex;
  align-items: center;
  margin: var(--spacing-lg) 0;
  gap: var(--spacing-md);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: var(--color-border);
  opacity: 0.4;
}

.divider-text {
  color: var(--color-text);
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  white-space: nowrap;
}

/* 音频区域 - Figma 设计：米色背景 */
.audio-section {
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  padding: var(--spacing-md);
}
</style>
