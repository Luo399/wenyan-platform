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

const isLoading = ref(false)
const error = ref<string | null>(null)
const scenarios = ref<ProcessedScenarioText[]>([])
const quizzes = ref<
  (ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem)[]
>([])
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

const quizLevel = computed(() => props.quizLevel)

async function loadData() {
  isLoading.value = true
  error.value = null

  try {
    await Promise.all([loadScenarios(), loadQuizzes()])

    if (matchedItems.value.length > 0 && matchedItems.value[0]) {
      currentQuestionNumber.value = matchedItems.value[0].questionNumber
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '数据加载失败'
    emit('error', error.value)
    debugError('ScenQuiz 数据加载失败:', e)
  } finally {
    isLoading.value = false
  }
}

async function loadScenarios(): Promise<void> {
  const url = `/data/level3_scenario_text/${props.textId}.json`
  const loader = useDataLoader<RawScenarioText[]>(() => url)

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('情景数据加载超时'))
    }, 30000)

    const unwatchData = watch(
      () => loader.data.value,
      (data) => {
        if (data !== null) {
          clearTimeout(timeoutId)
          unwatchData()
          unwatchError()
          scenarios.value = getAllScenarios(adaptScenarioText(data))
          resolve()
        }
      },
    )

    const unwatchError = watch(
      () => loader.error.value,
      (err) => {
        if (err !== null) {
          clearTimeout(timeoutId)
          unwatchData()
          unwatchError()
          reject(new Error(`情景数据加载失败: ${err}`))
        }
      },
    )
  })
}

async function loadQuizzes(): Promise<void> {
  const url = `/data/${props.quizLevel}_quiz/${props.textId}.json`

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('题目数据加载超时'))
    }, 30000)

    if (props.quizLevel === 'level1') {
      const loader = useDataLoader<RawLevel1QuizItem[]>(() => url)

      const unwatchData = watch(
        () => loader.data.value,
        (data) => {
          if (data !== null) {
            clearTimeout(timeoutId)
            unwatchData()
            unwatchError()
            quizzes.value = getAllLevel1Quizzes(adaptLevel1Quiz(data)) as (
              | ProcessedLevel1QuizItem
              | ProcessedLevel2QuizItem
              | ProcessedLevel3QuizItem
            )[]
            resolve()
          }
        },
      )

      const unwatchError = watch(
        () => loader.error.value,
        (err) => {
          if (err !== null) {
            clearTimeout(timeoutId)
            unwatchData()
            unwatchError()
            reject(new Error(`题目数据加载失败: ${err}`))
          }
        },
      )
    } else if (props.quizLevel === 'level2') {
      const loader = useDataLoader<RawLevel2QuizItem[]>(() => url)

      const unwatchData = watch(
        () => loader.data.value,
        (data) => {
          if (data !== null) {
            clearTimeout(timeoutId)
            unwatchData()
            unwatchError()
            quizzes.value = getAllLevel2Quizzes(adaptLevel2Quiz(data)) as (
              | ProcessedLevel1QuizItem
              | ProcessedLevel2QuizItem
              | ProcessedLevel3QuizItem
            )[]
            resolve()
          }
        },
      )

      const unwatchError = watch(
        () => loader.error.value,
        (err) => {
          if (err !== null) {
            clearTimeout(timeoutId)
            unwatchData()
            unwatchError()
            reject(new Error(`题目数据加载失败: ${err}`))
          }
        },
      )
    } else {
      const loader = useDataLoader<RawLevel3QuizItem[]>(() => url)

      const unwatchData = watch(
        () => loader.data.value,
        (data) => {
          if (data !== null) {
            clearTimeout(timeoutId)
            unwatchData()
            unwatchError()
            quizzes.value = getAllLevel3Quizzes(adaptLevel3Quiz(data)) as (
              | ProcessedLevel1QuizItem
              | ProcessedLevel2QuizItem
              | ProcessedLevel3QuizItem
            )[]
            resolve()
          }
        },
      )

      const unwatchError = watch(
        () => loader.error.value,
        (err) => {
          if (err !== null) {
            clearTimeout(timeoutId)
            unwatchData()
            unwatchError()
            reject(new Error(`题目数据加载失败: ${err}`))
          }
        },
      )
    }
  })
}

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
