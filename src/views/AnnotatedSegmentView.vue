<!--
  AnnotatedSegmentView.vue - 注释文本 + 音频分段组合页面

  布局说明：
  - 上方：AnnotatedText 组件（课文注释）
  - 下方：AudioSegmentPlayer 组件（音频分段）
  - 底部：BackContinue 导航按钮

  页面顺序：rules -> audio -> annotated-segment -> detail
-->
<template>
  <div class="annotated-segment-view">
    <!-- 上方：课文注释区域 -->
    <section class="annotated-section">
      <AnnotatedText :wen-id="wenId" />
    </section>

    <!-- 分割线 -->
    <div class="divider">
      <span class="divider-text">音频学习</span>
    </div>

    <!-- 下方：音频分段播放器 -->
    <section class="audio-section">
      <AudioSegmentPlayer
        :wen-id="wenId"
        :auto-load="true"
        @load-success="handleAudioLoadSuccess"
        @load-error="handleAudioLoadError"
        @segment-change="handleSegmentChange"
      />
    </section>

    <!-- 底部导航按钮 -->
    <BackContinue back-text="返回" continue-text="继续" @back="goPrev" @continue="goNext" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import AnnotatedText from '@/components/AnnotatedText.vue'
import AudioSegmentPlayer from '@/components/AudioSegmentPlayer.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import type { WenData } from '@/components/AudioSegmentPlayer.vue'

const route = useRoute()

// 将路由参数 id（数字）转换为 wenId 格式
const wenId = computed(() => {
  const id = route.params.id as string
  if (!id) return 'WEN_01'
  // 如果已经是 WEN_xx 格式，直接返回
  if (id.startsWith('WEN_')) return id
  // 将数字转换为 WEN_xx 格式（如 1 -> WEN_01）
  const num = parseInt(id, 10)
  if (isNaN(num)) return 'WEN_01'
  return `WEN_${num.toString().padStart(2, '0')}`
})

const isAudioLoaded = ref(false)
const currentSegment = ref<number | null>(null)

// 使用导航composable
const { goNext, goPrev } = useNavigation('annotated-segment', wenId.value)

function handleAudioLoadSuccess(data: WenData) {
  console.log('音频数据加载成功:', data)
  isAudioLoaded.value = true
}

function handleAudioLoadError(error: string) {
  console.error('音频数据加载失败:', error)
}

function handleSegmentChange(index: number) {
  currentSegment.value = index
}
</script>

<style scoped>
.annotated-segment-view {
  padding: 1rem;
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

/* 课文注释区域 */
.annotated-section {
  margin-bottom: 1rem;
}

/* 分割线 */
.divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  gap: 1rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: #e5e7eb;
}

.divider-text {
  color: #6b7280;
  font-size: 0.875rem;
  white-space: nowrap;
}

/* 音频区域 */
.audio-section {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
}
</style>
