<!--
  StepThreeView.vue - 情景测验组合页面（逐题显示模式）

  布局说明：
  - 使用 visibleIndex 控制逐题显示
  - 提交后显示答案和解析，并在下方显示下一题
  - 底部：BackContinue 导航按钮

  数据来源：pages_level3_adaptive_quiz（与Block模式隔离）
  页面顺序：stepone -> stepthree -> detail
-->
<template>
  <div class="stepthree-view">
    <!-- 页面标题 -->
    <header class="page-header">
      <h1 class="page-title">情景测验</h1>
      <p class="page-subtitle">完成以下测验，检验你的学习成果</p>
    </header>

    <!-- 进度统计 -->
    <div class="progress-bar-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <span class="progress-text">{{ completedCount }} / {{ totalQuestions }}</span>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-if="loading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载测验数据...</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div class="error-state" v-else-if="error">
      <div class="error-icon">
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <p class="error-message">{{ error }}</p>
      <button class="error-retry" @click="retry">
        <i class="fas fa-refresh"></i>
        重新加载
      </button>
    </div>

    <!-- 测验内容区域 -->
    <template v-else-if="pageData">
      <!-- 题目列表 -->
      <div class="quiz-list">
        <div
          v-for="(item, index) in pageData.items"
          :key="index"
          class="quiz-item"
          :class="{ hidden: index > currentIndex }"
        >
          <!-- 情景文本（仅显示第一个题目的情景） -->
          <div class="scenario-text" v-if="index === 0 && item.text">
            <p>{{ item.text }}</p>
          </div>

          <!-- 题目头部 -->
          <div class="quiz-header">
            <span class="quiz-number">第 {{ index + 1 }} 题</span>
          </div>

          <!-- QuizCard 组件 -->
          <QuizCard
            :data="item.quiz as any"
            :submitted="isSubmitted(index)"
            @submit="(option) => option !== null && handleSubmit(index, option)"
          />
        </div>
      </div>

      <!-- 完成状态 -->
      <div class="complete-state" v-if="isCompleted">
        <div class="complete-icon">
          <i class="fas fa-trophy"></i>
        </div>
        <h2 class="complete-title">测验完成！</h2>
        <p class="complete-stats">答对 {{ correctCount }} / {{ completedCount }} 题</p>
      </div>

      <!-- 文化卡片区域（测验完成后显示） -->
      <div class="culture-cards-section" v-if="isCompleted">
        <CultureCards
          :wen-id="textId"
          @load-success="handleCultureCardsLoad"
          @card-click="handleCultureCardClick"
        />
      </div>
    </template>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <div class="empty-icon">
        <i class="fas fa-search"></i>
      </div>
      <p class="empty-message">暂无测验数据</p>
    </div>

    <!-- 底部导航按钮（全程显示返回，完成后显示继续） -->
    <BackContinue
      :show-continue="isCompleted"
      back-text="返回"
      @back="handleGoPrev"
      @continue="handleGoNext"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackContinue from '@/components/BackContinue.vue'
import QuizCard from '@/components/QuizCard.vue'
import CultureCards from '@/components/CultureCards.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useDataLoader } from '@/composables/useDataLoader'
import { useQuizProgress } from '@/composables/useQuizProgress'

// 数据类型定义
interface QuizItem {
  question_id: string
  module: string
  question_type: 'radio' | 'checkbox' | string
  question_text: string
  options: string[]
  correct_answer: number
  explanation: string
  difficulty: string
}

interface PageItem {
  text: string
  quiz: QuizItem
}

interface PageData {
  pageId: string
  items: PageItem[]
}

const route = useRoute()
const router = useRouter()

// 篇目ID（路由参数）
const poemId = route.params.id as string

// 将路由参数转换为wenId格式
const textId = computed(() => {
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

// 页面配置URL（从pages_level3_adaptive_quiz目录加载）
const pageUrl = computed(() => `/data/pages_level3_adaptive_quiz/${textId.value}.json`)

// 使用数据加载器获取页面配置
const { data: pageData, loading, error, retry } = useDataLoader<PageData>(() => pageUrl.value)

// 题目总数（Ref类型，支持响应式更新）
const totalQuizCount = ref(0)

// 监听 pageData 变化，更新题目数量
watch(
  () => pageData.value,
  (data) => {
    const count = data?.items.length || 0
    totalQuizCount.value = count
    console.log(`[StepThreeView] 题目数量更新: ${count}`)
  },
  { immediate: true, deep: true },
)

// 使用 useQuizProgress Composable 管理测验进度
// 传入 textId 作为 completionKeyPrefix，确保不同课文的完成记录相互独立
const {
  currentIndex,
  completedCount,
  totalQuestions,
  progressPercent,
  isCompleted,
  hasCompletionRecord,
  answers,
  handleSubmit: handleQuizSubmit,
  resetProgress,
} = useQuizProgress(
  totalQuizCount,
  (questionIndex, answer, isCorrect) => {
    console.log(
      `[StepThreeView] 第 ${questionIndex + 1} 题提交，答案: ${answer}，正确: ${isCorrect}`,
    )
  },
  textId.value,
)

// 判断指定题目是否已提交
function isSubmitted(index: number): boolean {
  return answers.value.some((a) => a.questionIndex === index)
}

// 答对数量
const correctCount = computed(() => {
  if (!pageData.value) return 0
  return answers.value.filter((a) => {
    const item = pageData.value?.items[a.questionIndex]
    if (!item) return false
    const stringAnswer = String(a.answer)
    const stringCorrect = String(item.quiz.correct_answer)
    return stringAnswer === stringCorrect
  }).length
})

// 使用导航composable
const { goNext, goPrev } = useNavigation('stepthree', poemId)

// 处理提交
async function handleSubmit(quizIndex: number, selectedOption: number) {
  console.log(`[StepThreeView] handleSubmit - 题目索引: ${quizIndex}，选择: ${selectedOption}`)

  // 判断答案是否正确
  const item = pageData.value?.items[quizIndex]
  const isCorrect = item ? selectedOption === item.quiz.correct_answer : undefined

  // 获取 questionId、module 和 correctAnswer
  const questionId = item?.quiz.question_id || ''
  const module = item?.quiz.module || 'C'
  const correctAnswer = item?.quiz.correct_answer

  // 调用 useQuizProgress 的 handleSubmit，传递 questionId、module 和 correctAnswer
  await handleQuizSubmit(selectedOption, isCorrect, questionId, module, correctAnswer)

  console.log(
    `[StepThreeView] 提交完成 - 当前完成数: ${completedCount.value}，是否全部完成: ${isCompleted.value}，questionId: ${questionId}，module: ${module}`,
  )
}

// 导航函数包装
function handleGoNext() {
  goNext(router)
}

function handleGoPrev() {
  goPrev(router)
}

function handleCultureCardsLoad(data: unknown) {
  console.log('[StepThreeView] 文化卡片加载成功:', data)
}

function handleCultureCardClick(card: { card_id: number; card_name: string }) {
  console.log('[StepThreeView] 文化卡片点击:', card)
}

// 监听 textId 变化，重置进度
watch(textId, () => {
  console.log(`[StepThreeView] textId 变化，重置进度`)
  resetProgress()
})

// 组件挂载时初始化
onMounted(() => {
  console.log('[StepThreeView] 页面加载:', textId.value)
})
</script>

<style scoped>
.stepthree-view {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

/* 题目列表 */
.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.quiz-item {
  animation: fadeInUp 0.5s ease forwards;
}

.quiz-item.hidden {
  display: none;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 页面标题 */
.page-header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1rem;
  color: white;
}

.page-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.page-subtitle {
  margin: 0;
  font-size: 0.875rem;
  opacity: 0.9;
}

/* 进度条 */
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 0.5rem;
  background-color: #f3f4f6;
  border-radius: 0.5rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  min-width: 60px;
  text-align: right;
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #667eea;
}

.loading-spinner i {
  font-size: 2rem;
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
  background: #fef2f2;
  border-radius: 1rem;
}

.error-icon {
  font-size: 2rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

.error-message {
  margin: 0 0 1rem 0;
  color: #dc2626;
  font-size: 0.875rem;
}

.error-retry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

/* 情景文本 */
.scenario-text {
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 1rem;
  border-left: 4px solid #f59e0b;
}

.scenario-text p {
  margin: 0;
  font-size: 1rem;
  line-height: 1.8;
  color: #78350f;
}

/* 题目头部 */
.quiz-header {
  display: flex;
  justify-content: flex-start;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 0.75rem 0.75rem 0 0;
  border-bottom: 1px solid #e2e8f0;
}

.quiz-number {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

/* 完成状态 */
.complete-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-radius: 1rem;
  margin-top: 1.5rem;
}

.complete-icon {
  width: 64px;
  height: 64px;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2rem;
  margin-bottom: 1rem;
}

.complete-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #166534;
}

.complete-stats {
  margin: 0;
  font-size: 1rem;
  color: #15803d;
}

/* 文化卡片区域 */
.culture-cards-section {
  margin-top: 1.5rem;
  padding: 1rem 0;
  border-top: 1px solid #e2e8f0;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background-color: #f9fafb;
  border-radius: 1rem;
}

.empty-icon {
  width: 64px;
  height: 64px;
  background-color: #e5e7eb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.empty-message {
  color: #6b7280;
  font-size: 0.875rem;
}

/* 响应式调整 */
@media (max-width: 767px) {
  .stepthree-view {
    padding: 0.75rem;
  }

  .page-header {
    padding: 1rem;
  }

  .page-title {
    font-size: 1.25rem;
  }
}
</style>
