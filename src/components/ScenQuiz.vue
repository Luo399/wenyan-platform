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
const quizzes = ref<(ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem)[]>([])
const currentQuestionNumber = ref(1)

interface MatchedItem {
  questionNumber: number
  scenario: ProcessedScenarioText | null
  quiz: (ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem) | null
}

const matchedItems = computed<MatchedItem[]>(() => {
  const result: MatchedItem[] = []
  
  const scenarioNumbers = new Set(scenarios.value.map(s => s.questionNumber))
  const quizNumbers = new Set(quizzes.value.map(q => q.questionNumber))
  
  const commonNumbers = [...scenarioNumbers].filter(n => quizNumbers.has(n))
  
  commonNumbers.forEach(num => {
    result.push({
      questionNumber: num,
      scenario: scenarios.value.find(s => s.questionNumber === num) || null,
      quiz: quizzes.value.find(q => q.questionNumber === num) || null
    })
  })
  
  return result.sort((a, b) => a.questionNumber - b.questionNumber)
})

const hasMatchingData = computed(() => matchedItems.value.length > 0 && !error.value && !isLoading.value)

const currentScenario = computed(() => {
  return scenarios.value.find(s => s.questionNumber === currentQuestionNumber.value) || null
})

const quizLevel = computed(() => props.quizLevel)

async function loadData() {
  isLoading.value = true
  error.value = null

  try {
    await Promise.all([
      loadScenarios(),
      loadQuizzes()
    ])

    if (matchedItems.value.length > 0 && matchedItems.value[0]) {
      currentQuestionNumber.value = matchedItems.value[0].questionNumber
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '数据加载失败'
    emit('error', error.value)
    console.error('ScenQuiz 数据加载失败:', e)
  } finally {
    isLoading.value = false
  }
}

async function loadScenarios() {
  const url = `/data/level3_scenario_text/${props.textId}.json`
  const { data: rawData, error: loadError } = useDataLoader<RawScenarioText[]>(() => url)
  
  if (loadError.value) {
    throw new Error(`情景数据加载失败: ${loadError.value}`)
  }
  
  if (rawData.value) {
    scenarios.value = getAllScenarios(adaptScenarioText(rawData.value))
  }
}

async function loadQuizzes() {
  const url = `/data/${props.quizLevel}_quiz/${props.textId}.json`
  
  if (props.quizLevel === 'level1') {
    const { data: rawData, error: loadError } = useDataLoader<RawLevel1QuizItem[]>(() => url)
    if (loadError.value) throw new Error(`题目数据加载失败: ${loadError.value}`)
    if (rawData.value) {
      quizzes.value = getAllLevel1Quizzes(adaptLevel1Quiz(rawData.value)) as (ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem)[]
    }
  } else if (props.quizLevel === 'level2') {
    const { data: rawData, error: loadError } = useDataLoader<RawLevel2QuizItem[]>(() => url)
    if (loadError.value) throw new Error(`题目数据加载失败: ${loadError.value}`)
    if (rawData.value) {
      quizzes.value = getAllLevel2Quizzes(adaptLevel2Quiz(rawData.value)) as (ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem)[]
    }
  } else {
    const { data: rawData, error: loadError } = useDataLoader<RawLevel3QuizItem[]>(() => url)
    if (loadError.value) throw new Error(`题目数据加载失败: ${loadError.value}`)
    if (rawData.value) {
      quizzes.value = getAllLevel3Quizzes(adaptLevel3Quiz(rawData.value)) as (ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem)[]
    }
  }
}

function selectQuestion(questionNumber: number) {
  currentQuestionNumber.value = questionNumber
}

function handleScenarioLoaded(scenario: ProcessedScenarioText) {
  console.log('Scenario loaded:', scenario)
}

function handleScenarioError(err: string) {
  console.error('Scenario error:', err)
}

function handleAnswer(quiz: ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem, answer: string, isCorrect: boolean) {
  emit('answer', quiz.questionNumber, answer, isCorrect)
}

function handleComplete(results: { quiz: ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem; answer: string; isCorrect: boolean }[]) {
  const formattedResults = results.map(r => ({
    questionNumber: r.quiz.questionNumber,
    answer: r.answer,
    isCorrect: r.isCorrect
  }))
  emit('complete', formattedResults)
}

function handleQuizError(err: string) {
  console.error('Quiz error:', err)
}

function handleRetry() {
  loadData()
}

watch(() => props.quizLevel, () => {
  loadData()
})

watch(() => props.textId, () => {
  loadData()
})

onMounted(() => {
  loadData()
})

defineExpose({
  reload: loadData,
  goToQuestion: (questionNumber: number) => {
    const exists = matchedItems.value.some(item => item.questionNumber === questionNumber)
    if (exists) {
      currentQuestionNumber.value = questionNumber
    }
  },
  currentQuestionNumber,
  matchedItems
})
</script>

<style scoped>
.scen-quiz {
  width: 100%;
  min-height: 500px;
}

.scen-quiz-container {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.section-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  border-color: #667eea;
  background: #eff6ff;
}

.tab-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
}

.tab-number {
  width: 24px;
  height: 24px;
  background: #e2e8f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.tab-btn.active .tab-number {
  background: rgba(255, 255, 255, 0.2);
}

.tab-label {
  font-size: 14px;
}

.content-area {
  padding: 24px;
}

.quiz-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
}

.quiz-divider::before,
.quiz-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
}

.divider-text {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  padding: 0 16px;
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
  gap: 12px;
  color: #667eea;
}

.loading-spinner i {
  font-size: 32px;
}

.loading-spinner span {
  font-size: 14px;
}

.scen-quiz-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 24px;
  background: #fef2f2;
  border-radius: 16px;
  border: 1px solid #fecaca;
}

.error-icon {
  width: 50px;
  height: 50px;
  background: #ef4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  margin-bottom: 16px;
}

.error-message {
  color: #dc2626;
  font-size: 14px;
  margin: 0 0 16px 0;
  text-align: center;
}

.error-retry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.error-retry:hover {
  background: #dc2626;
}

.scen-quiz-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 16px;
}

.empty-icon {
  width: 50px;
  height: 50px;
  background: #e2e8f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 24px;
  margin-bottom: 16px;
}

.empty-message {
  color: #94a3b8;
  font-size: 14px;
  margin: 0;
  text-align: center;
}
</style>