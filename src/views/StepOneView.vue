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
    <BackContinue back-text="返回" continue-text="继续" @back="goPrev" @continue="goNext" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeMount } from 'vue'
import { useRoute } from 'vue-router'
import WordList from '@/components/WordList.vue'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import type { MultiRoleData } from '@/components/MultiRoleReading.vue'

console.log('[StepOne] 🔄 StepOneView 组件开始初始化')

const route = useRoute()

onBeforeMount(() => {
  console.log('[StepOne] 🚀 onBeforeMount 钩子执行')
})

// 篇目ID（路由参数）
const poemId = route.params.id as string

console.log(`[StepOne] 📍 路由参数 id: ${poemId}`)

// 将路由参数 id（数字）转换为 wenId 格式
const wenId = computed(() => {
  console.log(`[StepOne] 🧮 wenId computed 开始计算`)

  if (!poemId) {
    console.log(`[StepOne] ⚠️ poemId为空，使用默认值 WEN_01`)
    return 'WEN_01'
  }
  // 如果已经是 WEN_xx 格式，直接返回
  if (poemId.startsWith('WEN_')) {
    console.log(`[StepOne] ✅ poemId已是WEN格式: ${poemId}`)
    return poemId
  }
  // 将数字转换为 WEN_xx 格式（如 1 -> WEN_01）
  const num = parseInt(poemId, 10)
  if (isNaN(num)) {
    console.log(`[StepOne] ⚠️ poemId解析失败: ${poemId}，使用默认值 WEN_01`)
    return 'WEN_01'
  }
  const result = `WEN_${num.toString().padStart(2, '0')}`
  console.log(`[StepOne] ✅ poemId转换完成: ${poemId} -> ${result}`)
  return result
})

const isAudioLoaded = ref(false)
const currentSegment = ref<number | null>(null)

// 使用导航composable
console.log('[StepOne] 🔧 初始化导航composable...')
const { goNext, goPrev } = useNavigation('stepone', poemId)
console.log('[StepOne] ✅ 导航初始化完成')

function handleAudioLoadSuccess(data: MultiRoleData) {
  console.log(`[StepOne] ✅ 音频数据加载成功`)
  console.log(`[StepOne] 📊 段落数: ${data.segments?.length || 0}`)
  isAudioLoaded.value = true
}

function handleAudioLoadError(error: string) {
  console.error(`[StepOne] ❌ 音频数据加载失败:`, error)
}

function handleSegmentChange(index: number) {
  currentSegment.value = index
}

onMounted(() => {
  console.log(`[StepOne] 🎯 StepOneView 挂载完成，wenId: ${wenId.value}`)
})
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
