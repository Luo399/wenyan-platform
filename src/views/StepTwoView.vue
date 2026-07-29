<!--
  StepTwoView.vue - 数据驱动的页面组件

  通过PageConfig配置动态渲染不同类型的Block组件
  支持：dialog、quiz、wordlist、multi-role-reading等多种块类型

  布局说明：
  - 页面标题
  - 动态BlockRenderer区域
  - 底部导航按钮
-->
<template>
  <div class="steptwo-view">
    <!-- 页面标题 -->
    <header class="page-header" v-if="pageConfig?.title">
      <h1 class="page-title">{{ pageConfig.title }}</h1>
    </header>

    <!-- 加载状态 -->
    <div class="loading-state" v-if="loading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载页面内容...</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div class="error-state" v-else-if="error">
      <div class="error-content">
        <div class="error-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <p class="error-message">{{ error }}</p>
        <button class="retry-button" @click="retry">
          <i class="fas fa-redo"></i>
          重新加载
        </button>
      </div>
    </div>

    <!-- 页面内容 -->
    <template v-else-if="pageConfig">
      <div class="blocks-container">
        <BlockRenderer
          v-for="(block, index) in pageConfig.blocks"
          :key="`${block.type}-${index}`"
          :block="block"
          :show="isQuizBlockVisible(index)"
          @quiz-submitted="handleQuizSubmitted"
          @quiz-answer="handleQuizAnswer"
        />
      </div>
    </template>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <div class="empty-content">
        <div class="empty-icon">
          <i class="fas fa-inbox"></i>
        </div>
        <p class="empty-message">暂无内容</p>
      </div>
    </div>

    <!-- 底部导航按钮（全程显示返回，完成所有 quiz 后显示继续） -->
    <BackContinue
      v-if="showNavigation"
      :show-continue="allQuizzesSubmitted"
      back-text="返回"
      @back="handleGoPrev"
      @continue="handleGoNext"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BlockRenderer from '@/components/BlockRenderer.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useDataLoader } from '@/composables/useDataLoader'
import { useQuizProgress } from '@/composables/useQuizProgress'
import type { PageConfig } from '@/types/pageConfig'
import { debugLog } from '@/utils/debug'

const route = useRoute()
const router = useRouter()

// 篇目ID（路由参数）
const poemId = computed(() => route.params.id as string)

// 将路由参数转换为wenId格式
const wenId = computed(() => {
  const id = poemId.value
  if (!id) return 'WEN_01'
  if (id.startsWith('WEN_')) return id
  const num = parseInt(id, 10)
  if (isNaN(num)) return 'WEN_01'
  return `WEN_${num.toString().padStart(2, '0')}`
})

// 页面配置URL
const pageUrl = computed(() => `/data/pages_level2_dialog_quiz/${wenId.value}.json`)

// 使用数据加载器获取页面配置
const { data: pageConfig, loading, error, retry } = useDataLoader<PageConfig>(() => pageUrl.value)

// 是否显示导航按钮
const showNavigation = computed(() => !loading.value && !error.value && pageConfig.value)

// 统计所有 quiz 块的数量（Ref类型，支持响应式更新）
const totalQuizCount = ref(0)

// 监听 pageConfig 变化，更新 quiz 数量
watch(
  () => pageConfig.value,
  (config) => {
    const count = config?.blocks.filter((b) => b.type === 'quiz').length || 0
    totalQuizCount.value = count
    debugLog(`[StepTwoView] quiz数量更新: ${count}`)
  },
  { immediate: true, deep: true },
)

// 使用 useQuizProgress Composable 管理测验进度
// 传入 wenId 作为 completionKeyPrefix，确保不同课文的完成记录相互独立
const {
  currentIndex,
  completedCount,
  isCompleted,
  hasCompletionRecord,
  handleSubmit: handleQuizSubmit,
  resetProgress,
} = useQuizProgress(
  totalQuizCount,
  (questionIndex, answer, isCorrect) => {
    debugLog(`[StepTwoView] 第 ${questionIndex + 1} 题提交，答案: ${answer}，正确: ${isCorrect}`)
  },
  wenId.value,
)

// 获取所有 quiz 块的索引列表
const quizBlockIndices = computed(() => {
  return (
    pageConfig.value?.blocks
      .map((block, index) => (block.type === 'quiz' ? index : -1))
      .filter((index) => index !== -1) || []
  )
})

// 判断指定索引的 block 是否应该显示
// 逻辑：以 quiz 块为分割点，显示当前允许的最后一个 quiz 及之前的所有块
// currentIndex = 0: 显示第1个quiz及之前的所有内容
// currentIndex = 1: 显示第2个quiz及之前的所有内容
// ...
function isQuizBlockVisible(blockIndex: number): boolean {
  const quizIndices = quizBlockIndices.value

  // 如果没有 quiz 块，显示所有内容
  if (quizIndices.length === 0) return true

  // 当前允许显示到第 currentIndex 个 quiz（currentIndex 从 0 开始）
  const currentQuizIndex = currentIndex.value

  // 如果所有 quiz 都已解锁，显示所有内容
  if (currentQuizIndex >= quizIndices.length) {
    return true
  }

  // 获取当前已解锁的最后一个 quiz 的位置
  const lastUnlockedQuizPosition = quizIndices[currentQuizIndex] ?? Infinity

  // 显示该位置及之前的所有块（包括当前quiz）
  return blockIndex <= lastUnlockedQuizPosition
}

// 是否所有 quiz 都已提交（或没有 quiz）
const allQuizzesSubmitted = computed(() => {
  // 如果数据还没加载或没有 quiz，直接显示继续按钮
  if (!pageConfig.value || totalQuizCount.value === 0) return true
  return isCompleted.value
})

// 处理 quiz 答案事件（接收用户答案）
async function handleQuizAnswer(event: {
  quiz: unknown
  answer: string
  isCorrect: boolean
  questionId?: string
  module?: string
  correctAnswer?: string | number | (string | number)[]
}) {
  // 调用 useQuizProgress 的 handleSubmit，传递用户答案、questionId、module 和 correctAnswer
  await handleQuizSubmit(
    event.answer,
    event.isCorrect,
    event.questionId,
    event.module || 'B',
    event.correctAnswer,
  )
  debugLog(
    `[StepTwoView] Quiz 答案提交: 答案=${event.answer}, 是否正确=${event.isCorrect}, questionId=${event.questionId}, module=${event.module}`,
  )
}

// 处理 quiz 提交事件（适配原事件名，仅用于触发后续逻辑）
function handleQuizSubmitted() {
  debugLog(`[StepTwoView] Quiz 已提交，当前题目索引: ${currentIndex.value}`)
}

// 使用导航composable
const { goNext, goPrev } = useNavigation('steptwo', poemId.value)

// 导航函数包装
function handleGoNext() {
  goNext()
}

function handleGoPrev() {
  goPrev()
}

// 监听 wenId 变化，重置进度
watch(wenId, () => {
  debugLog(`[StepTwoView] wenId 变化，重置进度`)
  resetProgress()
})

onMounted(() => {
  debugLog('[StepTwoView] 页面加载:', wenId.value)
})
</script>

<style scoped>
.steptwo-view {
  padding: var(--spacing-md);
  max-width: 1000px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

/* 页面标题 */
.page-header {
  margin-bottom: var(--spacing-lg);
  text-align: center;
}

.page-title {
  margin: 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: var(--spacing-xl);
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-primary);
}

.loading-spinner i {
  font-size: var(--font-size-heading);
}

.loading-spinner span {
  font-size: var(--font-size-small);
}

/* 错误状态 */
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: var(--spacing-xl);
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  border: var(--border-width-hairline) solid var(--color-border);
}

.error-icon {
  font-size: var(--font-size-heading);
  color: var(--color-primary);
}

.error-message {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-small);
  text-align: center;
}

/* 重试按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
.retry-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-button:hover {
  background: var(--color-primary-hover);
}

/* 页面内容 */
.blocks-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: var(--spacing-xl);
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
}

.empty-icon {
  width: 64px;
  height: 64px;
  background: var(--color-placeholder);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-heading);
  color: var(--color-text-secondary);
}

.empty-message {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .steptwo-view {
    padding: var(--spacing-sm);
  }

  .page-title {
    font-size: var(--font-size-subheading);
  }
}
</style>
