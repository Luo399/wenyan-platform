<template>
  <div class="scen-quiz">
    <div class="scen-quiz-container" v-if="hasMatchingData">
      <div class="section-tabs">
        <button
          v-for="item in matchedItems"
          :key="item.questionNumber"
          class="tab-btn"
          :class="{ active: currentQuestionNumber === item.questionNumber }"
          @click="selectQuestion(item.questionNumber)"
        >
          <span class="tab-number">{{ item.questionNumber }}</span>
          <span class="tab-label">第{{ item.questionNumber }}题</span>
        </button>
      </div>

      <div class="content-area">
        <PreQuizText
          :question-number="currentQuestionNumber"
          :title="currentScenario?.scenarioText ? '情景导入' : ''"
          :show-footer="false"
          @loaded="handleScenarioLoaded"
          @error="handleScenarioError"
        />

        <div class="quiz-divider">
          <span class="divider-text">阅读理解</span>
        </div>

        <AdaptQuiz
          :text-id="textId"
          :level="quizLevel"
          :question-number="currentQuestionNumber"
          :title="''"
          @answer="handleAnswer"
          @complete="handleComplete"
          @error="handleQuizError"
        />
      </div>
    </div>

    <div class="scen-quiz-loading" v-else-if="isLoading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载中...</span>
      </div>
    </div>

    <div class="scen-quiz-error" v-else-if="error">
      <div class="error-icon">
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <p class="error-message">{{ error }}</p>
      <button class="error-retry" @click="handleRetry">
        <i class="fas fa-refresh"></i>
        重新加载
      </button>
    </div>

    <div class="scen-quiz-empty" v-else>
      <div class="empty-icon">
        <i class="fas fa-search"></i>
      </div>
      <p class="empty-message">未找到匹配的情景和题目数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PreQuizText from './PreQuizText.vue'
import AdaptQuiz from './AdaptQuiz.vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { adaptScenarioText, getAllScenarios } from '@/adapters/scenarioAdapter'
import { adaptLevel1Quiz, getAllLevel1Quizzes } from '@/adapters/level1QuizAdapter'
import { adaptLevel2Quiz, getAllLevel2Quizzes } from '@/adapters/level2QuizAdapter'
import { adaptLevel3Quiz, getAllLevel3Quizzes } from '@/adapters/level3QuizAdapter'
import type { ProcessedScenarioText, RawScenarioText } from '@/adapters/scenarioAdapter'
import type { ProcessedLevel1QuizItem, RawLevel1QuizItem } from '@/adapters/level1QuizAdapter'
import type { ProcessedLevel2QuizItem, RawLevel2QuizItem } from '@/adapters/level2QuizAdapter'
import type { ProcessedLevel3QuizItem, RawLevel3QuizItem } from '@/adapters/level3QuizAdapter'
import type { QuizItem } from '@/adapters/quizAdapter'
import { debugLog, debugError } from '@/utils/debug'

interface Props {
  textId?: string
  quizLevel?: 'level1' | 'level2' | 'level3'
}

const props = withDefaults(defineProps<Props>(), {
  textId: 'WEN_01',
  quizLevel: 'level1',
})

const emit = defineEmits<{
  (e: 'answer', questionNumber: number, answer: string, isCorrect: boolean): void
  (e: 'complete', results: { questionNumber: number; answer: string; isCorrect: boolean }[]): void
  (e: 'error', error: string): void
}>()

// R51 修复：useDataLoader 必须在 setup 顶层同步调用，不能放在 async 函数内。
// 之前 loadScenarios/loadQuizzes 在 async 函数内调用 useDataLoader，导致：
//   1) onUnmounted 在无 active instance 时注册，卸载时 abort 不触发
//   2) 每次 prop 变化都新建 loader 实例，旧 watcher 永不清理
//   3) watch 在异步上下文注册，错过首次 URL 变化
// 现在改为 setup 顶层声明两个 loader，URL 通过闭包响应 props 变化。
type RawQuizUnion = RawLevel1QuizItem[] | RawLevel2QuizItem[] | RawLevel3QuizItem[]

const scenarioLoader = useDataLoader<RawScenarioText[]>(
  () => `/data/level3_scenario_text/${props.textId}.json`,
  { autoLoad: false, timeout: 30000, retryCount: 1 },
)

const quizLoader = useDataLoader<RawQuizUnion>(
  () => `/data/${props.quizLevel}_quiz/${props.textId}.json`,
  { autoLoad: false, timeout: 30000, retryCount: 1 },
)

// 适配后的数据：通过 computed 响应 loader.data 变化，无需手写 watch
const scenarios = computed<ProcessedScenarioText[]>(() => {
  const raw = scenarioLoader.data.value
  return raw ? getAllScenarios(adaptScenarioText(raw)) : []
})

const quizzes = computed<
  (ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem)[]
>(() => {
  const raw = quizLoader.data.value
  if (!raw) return []
  // 根据 quizLevel 选择对应 adapter，类型断言由 level 唯一决定
  if (props.quizLevel === 'level1') {
    return getAllLevel1Quizzes(adaptLevel1Quiz(raw as RawLevel1QuizItem[]))
  }
  if (props.quizLevel === 'level2') {
    return getAllLevel2Quizzes(adaptLevel2Quiz(raw as RawLevel2QuizItem[]))
  }
  return getAllLevel3Quizzes(adaptLevel3Quiz(raw as RawLevel3QuizItem[]))
})

// 聚合 loading/error 状态：任一 loader 加载中即为加载中
const isLoading = computed(() => scenarioLoader.loading.value || quizLoader.loading.value)
const error = computed<string | null>(() => scenarioLoader.error.value || quizLoader.error.value)

const currentQuestionNumber = ref(1)

interface MatchedItem {
  questionNumber: number
  scenario: ProcessedScenarioText | null
  quiz: (ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem) | null
}

const matchedItems = computed<MatchedItem[]>(() => {
  const result: MatchedItem[] = []

  const scenarioNumbers = new Set(scenarios.value.map((s) => s.questionNumber))
  const quizNumbers = new Set(quizzes.value.map((q) => q.questionNumber))

  const commonNumbers = [...scenarioNumbers].filter((n) => quizNumbers.has(n))

  commonNumbers.forEach((num) => {
    result.push({
      questionNumber: num,
      scenario: scenarios.value.find((s) => s.questionNumber === num) || null,
      quiz: quizzes.value.find((q) => q.questionNumber === num) || null,
    })
  })

  return result.sort((a, b) => a.questionNumber - b.questionNumber)
})

const hasMatchingData = computed(
  () => matchedItems.value.length > 0 && !error.value && !isLoading.value,
)

const currentScenario = computed(() => {
  return scenarios.value.find((s) => s.questionNumber === currentQuestionNumber.value) || null
})

// 触发两个 loader 并行加载；load() 返回 Promise<void>，可被外部 await
async function loadData() {
  await Promise.all([scenarioLoader.load(), quizLoader.load()])
  // 加载完成后重置到第一题（保留原 loadData 行为）
  if (matchedItems.value.length > 0 && matchedItems.value[0]) {
    currentQuestionNumber.value = matchedItems.value[0].questionNumber
  }
}

// 任一 loader 出错时向上冒泡 error 事件（保留原 emit('error', ...) 行为）
watch(error, (err) => {
  if (err) emit('error', err)
})

function selectQuestion(questionNumber: number) {
  currentQuestionNumber.value = questionNumber
}

function handleScenarioLoaded(scenario: ProcessedScenarioText) {
  debugLog('Scenario loaded:', scenario)
}

function handleScenarioError(err: string) {
  debugError('Scenario error:', err)
}

function handleAnswer(quiz: QuizItem, answer: string, isCorrect: boolean) {
  emit('answer', quiz.questionNumber, answer, isCorrect)
}

function handleComplete(
  results: {
    quiz: QuizItem
    answer: string
    isCorrect: boolean
  }[],
) {
  const formattedResults = results.map((r) => ({
    questionNumber: r.quiz.questionNumber,
    answer: r.answer,
    isCorrect: r.isCorrect,
  }))
  emit('complete', formattedResults)
}

function handleQuizError(err: string) {
  debugError('Quiz error:', err)
}

function handleRetry() {
  loadData()
}

// prop 变化时触发重新加载（URL 由 urlGetter 闭包响应，但 autoLoad:false 时
// useDataLoader 内部 watch 不会自动触发 load，需要手动触发）
watch(
  () => props.quizLevel,
  () => {
    loadData()
  },
)

watch(
  () => props.textId,
  () => {
    loadData()
  },
)

onMounted(() => {
  loadData()
})

defineExpose({
  reload: loadData,
  goToQuestion: (questionNumber: number) => {
    const exists = matchedItems.value.some((item) => item.questionNumber === questionNumber)
    if (exists) {
      currentQuestionNumber.value = questionNumber
    }
  },
  currentQuestionNumber,
  matchedItems,
})
</script>

<style scoped>
.scen-quiz {
  width: 100%;
  min-height: 500px;
  font-family: var(--font-family-serif);
}

/* 容器：30px 圆角 + 设计 token 阴影 */
.scen-quiz-container {
  background: var(--color-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.section-tabs {
  display: flex;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--color-bg-highlight);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
  flex-wrap: wrap;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-highlight);
}

/* 激活标签：朱红底色 */
.tab-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}

.tab-number {
  width: 24px;
  height: 24px;
  background: var(--color-placeholder);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.tab-btn.active .tab-number {
  background: rgba(255, 255, 255, 0.2);
}

.tab-label {
  font-size: var(--font-size-small);
}

.content-area {
  padding: var(--spacing-xl);
}

.quiz-divider {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin: var(--spacing-xl) 0;
}

.quiz-divider::before,
.quiz-divider::after {
  content: '';
  flex: 1;
  height: var(--border-width-hairline);
  background: linear-gradient(90deg, transparent, var(--color-placeholder), transparent);
}

.divider-text {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  padding: 0 var(--spacing-md);
}

.scen-quiz-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-primary);
}

.loading-spinner i {
  font-size: var(--font-size-heading);
}

.loading-spinner span {
  font-size: var(--font-size-small);
}

/* 错误态：语义色红色 */
.scen-quiz-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: var(--spacing-xl);
  background: #fef2f2;
  border-radius: var(--radius-card);
  border: var(--border-width-hairline) solid #fecaca;
}

.error-icon {
  width: 50px;
  height: 50px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: var(--font-size-subheading);
  margin-bottom: var(--spacing-md);
}

.error-message {
  color: var(--color-primary-hover);
  font-size: var(--font-size-small);
  margin: 0 0 var(--spacing-md) 0;
  text-align: center;
}

.error-retry {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-button);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: background 0.3s ease;
}

.error-retry:hover {
  background: var(--color-primary-hover);
}

/* 空状态 */
.scen-quiz-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: var(--spacing-xl);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
}

.empty-icon {
  width: 50px;
  height: 50px;
  background: var(--color-placeholder);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-subheading);
  margin-bottom: var(--spacing-md);
}

.empty-message {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  margin: 0;
  text-align: center;
}
</style>
