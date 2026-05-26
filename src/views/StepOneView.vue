<!--
  StepOneView.vue - 字词学习 + 多角色朗读组合页面

  布局说明：
  - 上方：WordList 组件（字词注释）
  - 下方：MultiRoleReading 组件（多角色朗读）
  - 底部：BackContinue 导航按钮

  页面顺序：rules -> stepone -> rule1 -> rule2 -> rule3 -> detail
-->
<template>
  <!-- 测试：确认页面组件是否被渲染（正式上线后请删除） -->
  <div
    style="color: red; border: 2px solid red; padding: 10px; text-align: center; font-weight: bold"
  >
    StepOneView 已渲染
  </div>

  <div class="annotated-segment-view">
    <!-- 【二分测试】恢复 WordList 组件 -->
    <section class="annotated-section">
      <WordList :wen-id="wenId" />
    </section>

    <!-- 分割线 -->
    <SectionDivider text="音频学习" />

    <!-- 【二分测试】继续注释 MultiRoleReading 组件 -->
    <!-- <section class="audio-section">
      <div v-if="!isAudioLoaded && !audioLoadingError" class="loading-overlay">
        <div class="loading-spinner"></div>
        <span class="loading-text">正在加载音频资源...</span>
      </div>
      <div v-else-if="audioLoadingError" class="error-overlay">
        <div class="error-icon">⚠️</div>
        <p class="error-message">音频加载失败</p>
        <p class="error-detail">{{ audioLoadingError }}</p>
        <button class="retry-btn" @click="audioPlayer?.loadData()">重试加载</button>
      </div>
      <MultiRoleReading
        v-show="isAudioLoaded || !audioLoadingError"
        ref="audioPlayer"
        :wen-id="wenId"
        :auto-load="true"
        @load-success="handleAudioLoadSuccess"
        @load-error="handleAudioLoadError"
        @segment-change="handleSegmentChange"
      />
    </section> -->

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
import { useRoute, useRouter } from 'vue-router'
import WordList from '@/components/WordList.vue'
import BackContinue from '@/components/BackContinue.vue'
import SectionDivider from '@/components/common/SectionDivider.vue'
import { useNavigation } from '@/composables/useNavigation'

const route = useRoute()
const router = useRouter()

// 篇目ID（路由参数）
const poemId = route.params.id as string

// 将路由参数 id（数字）转换为 wenId 格式
const wenId = computed(() => {
  if (!poemId) {
    return 'WEN_01'
  }
  if (poemId.startsWith('WEN_')) {
    return poemId
  }
  const num = parseInt(poemId, 10)
  if (isNaN(num)) {
    return 'WEN_01'
  }
  return `WEN_${num.toString().padStart(2, '0')}`
})

// 使用导航composable（新版，需要传入router）
const { goNext, goPrev } = useNavigation('stepone', poemId)

// 导航函数包装
function handleGoNext() {
  goNext(router)
}

function handleGoPrev() {
  goPrev(router)
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

/* 音频区域 */
.audio-section {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  position: relative;
  min-height: 200px;
}

/* 加载覆盖层 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(249, 250, 251, 0.95);
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #6b7280;
  font-size: 0.875rem;
}

/* 错误覆盖层 */
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(249, 250, 251, 0.95);
  z-index: 10;
  padding: 1rem;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-message {
  color: #dc2626;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.error-detail {
  color: #6b7280;
  font-size: 0.875rem;
  text-align: center;
  margin-bottom: 1rem;
}

.retry-btn {
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #2563eb;
}
</style>
