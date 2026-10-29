<!--
  StepView.vue — 三合一通用步骤壳子（R1 重构）

  一个组件承载 stepone / steptwo / stepthree 三个路由，
  内容差异通过 route.name 映射的 stepNumber switch 渲染。
  路由路径、route.name、pageSequence 顺序**保持原样**。
-->
<template>
  <!-- ========== Step 1: 字词学习 + 多角色朗读（静态，无 PageScaffold） ========== -->
  <div v-if="stepNumber === 1" class="step-1-view">
    <section class="annotated-section">
      <WordList :wen-id="wenId" />
    </section>
    <div class="divider">
      <span class="divider-text">音频学习</span>
    </div>
    <section class="audio-section">
      <MultiRoleReading
        :wen-id="wenId"
        :auto-load="true"
        @load-success="debugLog('音频数据加载成功')"
        @load-error="debugError('音频数据加载失败')"
        @segment-change="debugLog('当前段落变化:')"
        @play="trackModule.trackInteraction('朗读', '播放', 0)"
        @pause="trackModule.trackInteraction('朗读', '暂停', 0)"
        @ended="trackModule.trackInteraction('朗读', '完成', 0)"
      />
    </section>

    <!-- 随堂练习：只在 level1_quiz 有数据时出现，缺数据不阻塞继续 -->
    <template v-if="step1Cards.length">
      <div class="divider">
        <span class="divider-text">随堂练习</span>
      </div>
      <section class="quiz-section">
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: step1Flow.progressPercent.value + '%' }"
            ></div>
          </div>
          <span class="progress-text">
            {{ step1Flow.completedCount.value }} / {{ step1Flow.totalQuestions.value }}
          </span>
        </div>

        <div class="quiz-list">
          <div
            v-for="(quiz, index) in step1Cards"
            :key="quiz.question_id"
            class="quiz-item"
            :class="{ hidden: index > step1Flow.currentIndex.value }"
          >
            <div class="quiz-header">
              <span class="quiz-number">第 {{ index + 1 }} 题</span>
            </div>
            <QuizCard
              :data="quiz"
              :submitted="isStep1Submitted(index)"
              @submit="
                (option: number | null) => option !== null && handleStep1Submit(index, option)
              "
            />
          </div>
        </div>

        <div class="complete-state" v-if="step1Flow.isCompleted.value">
          <div class="complete-icon"><i class="fas fa-trophy"></i></div>
          <h2 class="complete-title">练习完成！</h2>
          <p class="complete-stats">
            答对 {{ step1CorrectCount }} / {{ step1Flow.completedCount.value }} 题
          </p>
        </div>
      </section>
    </template>

    <BackContinue @back="handleGoPrev" @continue="handleGoNext" />
  </div>

  <!-- ========== Step 2: Figma blocks + BlockRenderer + useQuizFlow ========== -->
  <div v-else-if="stepNumber === 2" class="step-2-view">
    <PageScaffold
      :title="meta?.title || pageConfig?.title || '课文研读'"
      :loading="loading"
      :error="error"
      :is-empty="!pageConfig"
      empty-text="暂无内容"
      :show-navigation="showNavigation"
      :show-continue="step2Flow.isCompleted.value"
      @retry="retry"
      @back="handleGoPrev"
      @continue="handleGoNext"
    >
      <div class="blocks-container" v-if="pageConfig">
        <BlockRenderer
          v-for="(block, index) in pageConfig.blocks"
          :key="`${block.type}-${index}`"
          :block="block"
          :show="isQuizBlockVisible(index)"
          @quiz-answer="handleQuizAnswer"
        />
      </div>
    </PageScaffold>
  </div>

  <!-- ========== Step 3: Figma quiz-list + QuizCard + useQuizFlow + CultureCards ========== -->
  <div v-else-if="stepNumber === 3" class="step-3-view">
    <PageScaffold
      :title="meta?.title || '情景测验'"
      subtitle="完成以下测验，检验你的学习成果"
      :loading="pageLoading"
      :error="pageError"
      :is-empty="!pageData"
      empty-text="暂无测验数据"
      :show-navigation="true"
      :show-continue="step3Flow.isCompleted.value"
      @retry="retryPage"
      @back="handleGoPrev"
      @continue="handleGoNext"
    >
      <!-- 进度条 -->
      <div class="progress-bar-container" v-if="pageData">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: step3Flow.progressPercent.value + '%' }"
          ></div>
        </div>
        <span class="progress-text"
          >{{ step3Flow.completedCount.value }} / {{ step3Flow.totalQuestions.value }}</span
        >
      </div>

      <!-- 测验内容 -->
      <template v-if="pageData">
        <div class="quiz-list">
          <div
            v-for="(item, index) in pageData.items"
            :key="index"
            class="quiz-item"
            :class="{ hidden: index > step3Flow.currentIndex.value }"
          >
            <div class="scenario-text" v-if="index === 0 && item.text">
              <p>{{ item.text }}</p>
            </div>
            <div class="quiz-header">
              <span class="quiz-number">第 {{ index + 1 }} 题</span>
            </div>
            <QuizCard
              :data="item.quiz as any"
              :submitted="isQuestionSubmitted(index)"
              @submit="
                (option: number | null) => option !== null && handleStep3Submit(index, option)
              "
            />
          </div>
        </div>

        <!-- 完成状态 -->
        <div class="complete-state" v-if="step3Flow.isCompleted.value">
          <div class="complete-icon"><i class="fas fa-trophy"></i></div>
          <h2 class="complete-title">测验完成！</h2>
          <p class="complete-stats">
            答对 {{ correctCount }} / {{ step3Flow.completedCount.value }} 题
          </p>
        </div>

        <!-- 文化卡片 -->
        <div class="culture-cards-section" v-if="step3Flow.isCompleted.value">
          <CultureCards :wen-id="wenId" />
        </div>
      </template>
    </PageScaffold>
  </div>
</template>

<script setup lang="ts">
// 注意：所有 import 直接指向源文件，不经过 barrel (quiz/index.ts, composables/index.ts)
// 避免 barrel 循环初始化链导致运行时 TDZ (Temporal Dead Zone) 错误
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getWenId } from '@/utils/wenUtils'
import { useNavigation } from '@/composables/useNavigation'
import { useTracking } from '@/composables/useTracking'
import { useDataLoader } from '@/composables/useDataLoader'
import { useQuizFlow } from '@/composables/quiz/useQuizFlow'
import { markNextEnterFromBackButton } from '@/utils/tracking'
import { getFigmaPageMeta } from '@/config/pageRegistry'
import { resolveQuestionId } from '@/utils/questionId'
import { getDataUrlWithVersion } from '@/utils/asset'
import { adaptLevel1Quiz, type RawLevel1QuizItem } from '@/adapters/level1QuizAdapter'
import type { PageBlock } from '@/types/pageConfig'
import { debugLog, debugError } from '@/utils/debug'

// ======== 模板里用到的组件（必须显式 import，Vue script setup 不会自动扫描） ========
import WordList from '@/components/WordList.vue'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import BackContinue from '@/components/BackContinue.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import BlockRenderer from '@/components/BlockRenderer.vue'
import QuizCard from '@/components/QuizCard.vue'
import CultureCards from '@/components/CultureCards.vue'

// ======== 共用骨架（所有 step case） ========
const route = useRoute()
const stepMap: Record<string, 1 | 2 | 3> = { stepone: 1, steptwo: 2, stepthree: 3 }
const stepNumber = computed(() => stepMap[route.name as string] ?? 1)

const poemId = computed(() => route.params.id as string)
const wenId = computed(() => getWenId(poemId.value))

// R140: 不再传快照值 —— useNavigation 内部实时读当前路由。
// 旧注释写的「内部自动 unwrap」并不成立：useNavigation 当时只是把参数存进闭包，
// stepone → steptwo 复用实例时冻结在 'stepone'，点继续会跳回上一页。
const { goNext, goPrev } = useNavigation()
const trackModule = useTracking(String(route.name ?? ''), String(route.params.id ?? ''))

function handleGoPrev() {
  markNextEnterFromBackButton()
  goPrev()
}
function handleGoNext() {
  goNext()
}

// ======== Step 2 & 3 共用：Figma 注册表 + 数据加载 ========
const meta = computed(() => getFigmaPageMeta(route.name as string))
const pageUrl = computed(() => {
  if (!meta.value?.dataDir) return ''
  return `/data/${meta.value.dataDir}/${wenId.value}.json`
})

// ======== Step 1: 随堂练习（A 关，level1_quiz） ========
// 数据目录只有 WEN_01–04 有题；05 起缺文件时 loader 报错，模板按空数组整段隐藏，
// 不影响字词/朗读，也不阻塞「继续」。
interface Step1QuizCard {
  question_id: string
  question_type: 'radio' | 'checkbox'
  question_text: string
  options: string[]
  correct_answer?: number
  explanation?: string
  difficulty?: string
}

const step1QuizUrl = computed(() => {
  if (stepNumber.value !== 1 || !wenId.value) return ''
  return getDataUrlWithVersion('level1_quiz', `${wenId.value}.json`)
})

const { data: step1RawQuizzes } = useDataLoader<RawLevel1QuizItem[]>(() => step1QuizUrl.value, {
  timeout: 10000,
  retryCount: 1,
  cacheEnabled: true,
})

const step1Quizzes = computed(() =>
  step1RawQuizzes.value ? adaptLevel1Quiz(step1RawQuizzes.value) : [],
)
const step1QuizCount = computed(() => step1Quizzes.value.length)

/**
 * level1_quiz 里的 correct_answer 可能是 "C" / "c" / 2 / "2"，统一归一成 0 基下标。
 * 无法识别时返回 undefined（QuizCard 不标正确项，提交时 correctAnswer 也留空）。
 */
function normalizeCorrectIndex(value: string | number | null | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 3 ? value : undefined
  }
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  if (normalized.length === 1) {
    const letterIndex = normalized.charCodeAt(0) - 65
    if (letterIndex >= 0 && letterIndex <= 3) return letterIndex
  }
  const numeric = Number(normalized)
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 3 ? numeric : undefined
}

const step1Cards = computed<Step1QuizCard[]>(() =>
  step1Quizzes.value.map((quiz) => ({
    question_id: quiz.questionId,
    question_type: quiz.questionType === 'checkbox' ? 'checkbox' : 'radio',
    question_text: quiz.questionText,
    options: quiz.options.map((option) => option.value),
    correct_answer: normalizeCorrectIndex(quiz.correctAnswer),
    explanation: quiz.explanation,
    difficulty: quiz.difficulty,
  })),
)

const step1Flow = useQuizFlow({
  totalQuestions: step1QuizCount,
  // 三关完成记录分开存，避免共用 wenId 时互相覆盖；后端仍收到纯 WEN_xx
  completionKey: () => `stepone:${wenId.value}`,
  wenId: () => wenId.value,
})

const step1SubmittedIndexSet = computed(
  () => new Set(step1Flow.answers.value.map((a) => a.questionIndex)),
)

function isStep1Submitted(index: number): boolean {
  return step1SubmittedIndexSet.value.has(index)
}

const step1CorrectCount = computed(
  () => step1Flow.answers.value.filter((answer) => answer.isCorrect).length,
)

async function handleStep1Submit(quizIndex: number, selectedOption: number) {
  const quiz = step1Quizzes.value[quizIndex]
  const card = step1Cards.value[quizIndex]
  if (!quiz || !card) return

  const isCorrect =
    card.correct_answer === undefined ? undefined : selectedOption === card.correct_answer

  await step1Flow.submit({
    answer: selectedOption,
    isCorrect,
    questionId: quiz.questionId,
    module: 'A',
    correctAnswer: card.correct_answer,
  })

  if (isCorrect) {
    trackModule.trackQuizSubmit(100, [])
  } else {
    trackModule.trackQuizSubmit(0, [quiz.questionId])
  }
}

watch(wenId, () => step1Flow.reset())

// Step 2 的 PageConfig 类型（从 pageRegistry 读取 blocks 渲染）
// 复用 @/types/pageConfig 的 PageBlock，与 BlockRenderer 的 props 类型保持一致
interface PageConfig {
  title?: string
  blocks: PageBlock[]
}

// Step 3 的数据类型
interface QuizItem {
  question_id?: string
  module?: string
  question_type: 'radio' | 'checkbox'
  question_text: string
  options: string[]
  correct_answer: number
  explanation: string
  difficulty: string
}
interface PageItem {
  text?: string
  quiz: QuizItem
}
interface PageData {
  pageId?: string
  items: PageItem[]
}

const {
  data: pageConfig,
  loading,
  error,
  retry,
} = useDataLoader<PageConfig>(() => (stepNumber.value === 2 ? pageUrl.value : ''))
// StepThree 独立的 loading/error（不能共用 StepTwo 的，否则 stepNumber 切换时空 URL 会污染 error 显示）
const {
  data: pageData,
  loading: pageLoading,
  error: pageError,
  retry: retryPage,
} = useDataLoader<PageData>(() => (stepNumber.value === 3 ? pageUrl.value : ''))

// ======== Step 2: quiz 进度（useQuizFlow） ========
const step2QuizCount = ref(0)
watch(
  () => pageConfig.value,
  (config) => {
    if (!config) return
    step2QuizCount.value = config.blocks.filter((b) => b.type === 'quiz').length
  },
  { immediate: true, deep: true },
)

const step2Flow = useQuizFlow({
  totalQuestions: step2QuizCount,
  completionKey: () => `steptwo:${wenId.value}`,
  wenId: () => wenId.value,
})

const showNavigation = computed(() => Boolean(!loading.value && !error.value && pageConfig.value))

// Step 2: 统计 quiz 块索引，实现 Block 可见性控制
const quizBlockIndices = computed(() => {
  if (!pageConfig.value) return []
  return pageConfig.value.blocks.map((b, i) => (b.type === 'quiz' ? i : -1)).filter((i) => i !== -1)
})

function isQuizBlockVisible(blockIndex: number): boolean {
  if (!pageConfig.value) return false
  if (!quizBlockIndices.value.length) return true
  // 最后一题提交后 currentIndex 不再前进（useQuizFlow 不会越过 totalQuestions），
  // 仅按「最后一个已解锁 quiz」截断会把题目后面的解析对话永远藏住 → 全部解锁。
  if (step2Flow.isCompleted.value) return true
  const lastUnlockedQuiz = quizBlockIndices.value[step2Flow.currentIndex.value] ?? Infinity
  return blockIndex <= lastUnlockedQuiz
}

async function handleQuizAnswer(event: {
  answer: string | number
  isCorrect: boolean
  questionId?: string
  module?: string
  correctAnswer?: string | number | (string | number)[]
}) {
  await step2Flow.submit({
    answer: event.answer,
    isCorrect: event.isCorrect,
    questionId: event.questionId,
    module: event.module || 'B',
    correctAnswer: event.correctAnswer,
  })
  // 埋点
  if (event.isCorrect) {
    trackModule.trackQuizSubmit(100, [])
  } else if (event.questionId) {
    trackModule.trackQuizSubmit(0, [event.questionId])
  }
}

watch(wenId, () => step2Flow.reset())

// ======== Step 3: quiz 进度（useQuizFlow） ========
const step3QuizCount = ref(0)
watch(
  () => pageData.value,
  (data) => {
    step3QuizCount.value = data?.items?.length || 0
  },
  { immediate: true },
)

const step3Flow = useQuizFlow({
  totalQuestions: step3QuizCount,
  completionKey: () => `stepthree:${wenId.value}`,
  wenId: () => wenId.value,
})

const submittedIndexSet = computed(
  () => new Set(step3Flow.answers.value.map((a) => a.questionIndex)),
)

function isQuestionSubmitted(index: number): boolean {
  return submittedIndexSet.value.has(index)
}

const correctCount = computed(() => {
  if (!pageData.value) return 0
  return step3Flow.answers.value.filter((a) => {
    const item = pageData.value?.items[a.questionIndex]
    if (!item) return false
    return String(a.answer) === String(item.quiz.correct_answer)
  }).length
})

async function handleStep3Submit(quizIndex: number, selectedOption: number) {
  const item = pageData.value?.items[quizIndex]
  const isCorrect = item ? selectedOption === item.quiz.correct_answer : undefined
  const questionId = resolveQuestionId(wenId.value, item?.quiz.question_id, quizIndex + 1)
  const module = item?.quiz.module || 'C'

  await step3Flow.submit({
    answer: selectedOption,
    isCorrect,
    questionId,
    module,
    correctAnswer: item?.quiz.correct_answer,
  })

  // 埋点
  if (isCorrect) {
    trackModule.trackQuizSubmit(100, [])
  } else if (questionId) {
    trackModule.trackQuizSubmit(0, [questionId])
  }
}

watch(wenId, () => step3Flow.reset())

onMounted(() => {
  debugLog(`[StepView] 页面加载: route=${String(route.name)}, wenId=${wenId.value}`)
})
</script>

<style scoped>
/* ============ Step 1 样式 ============ */
.step-1-view {
  padding: var(--spacing-md);
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 5rem;
}
.step-1-view .annotated-section {
  margin-bottom: var(--spacing-md);
}
.step-1-view .divider {
  display: flex;
  align-items: center;
  margin: var(--spacing-lg) 0;
  gap: var(--spacing-md);
}
.step-1-view .divider::before,
.step-1-view .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: var(--color-border);
  opacity: 0.4;
}
.step-1-view .divider-text {
  color: var(--color-text);
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  white-space: nowrap;
}
.step-1-view .audio-section {
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  padding: var(--spacing-md);
}

/* ============ Step 2 样式 ============ */
.step-2-view {
  padding: var(--spacing-md);
  max-width: 1000px;
  margin: 0 auto;
  padding-bottom: 5rem;
}
.step-2-view .blocks-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
@media (max-width: 768px) {
  .step-2-view {
    padding: var(--spacing-sm);
  }
}

/* ============ Step 3 样式 ============ */
.step-3-view {
  padding: var(--spacing-md);
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 5rem;
}
/* Step 1 随堂练习与 Step 3 共用同一套答题卡片样式 */
.step-1-view .quiz-section {
  margin-top: var(--spacing-md);
}
.step-1-view .quiz-list,
.step-3-view .quiz-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.step-1-view .quiz-item,
.step-3-view .quiz-item {
  animation: fadeInUp 0.5s ease forwards;
}
.step-1-view .quiz-item.hidden,
.step-3-view .quiz-item.hidden {
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
.step-1-view .progress-bar-container,
.step-3-view .progress-bar-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-xs);
  background-color: var(--color-placeholder);
  border-radius: var(--radius-small);
}
.step-1-view .progress-bar,
.step-3-view .progress-bar {
  flex: 1;
  height: 8px;
  background-color: var(--color-placeholder);
  border-radius: 4px;
  overflow: hidden;
}
.step-1-view .progress-fill,
.step-3-view .progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.step-1-view .progress-text,
.step-3-view .progress-text {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  min-width: 60px;
  text-align: right;
}
.step-3-view .scenario-text {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  border-left: var(--border-width-thin) solid var(--color-accent);
}
.step-3-view .scenario-text p {
  margin: 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  line-height: 1.8;
  color: var(--color-text);
}
.step-1-view .quiz-header,
.step-3-view .quiz-header {
  display: flex;
  justify-content: flex-start;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small) var(--radius-small) 0 0;
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
}
.step-1-view .quiz-number,
.step-3-view .quiz-number {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.step-1-view .complete-state,
.step-3-view .complete-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl) var(--spacing-xl);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  margin-top: var(--spacing-lg);
}
.step-1-view .complete-icon,
.step-3-view .complete-icon {
  width: 64px;
  height: 64px;
  background: var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: var(--font-size-heading);
  margin-bottom: var(--spacing-md);
}
.step-1-view .complete-title,
.step-3-view .complete-title {
  margin: 0 0 var(--spacing-xs) 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.step-1-view .complete-stats,
.step-3-view .complete-stats {
  margin: 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  color: var(--color-text);
}
.step-3-view .culture-cards-section {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) 0;
  border-top: var(--border-width-hairline) solid var(--color-placeholder);
}
@media (max-width: 767px) {
  .step-3-view {
    padding: var(--spacing-sm);
  }
}
</style>
