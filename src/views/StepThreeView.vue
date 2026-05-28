<!--
  StepThreeView.vue - 情景测验组合页面

  布局说明：
  - 批量展示多个ScenQuiz组件
  - 支持响应式布局，适配不同屏幕尺寸
  - 底部：BackContinue 导航按钮

  页面顺序：stepone -> stepthree -> detail
-->
<template>
  <div class="stepthree-view">
    <!-- 页面标题 -->
    <header class="page-header">
      <h1 class="page-title">{{ pageTitle }}</h1>
      <p class="page-subtitle">完成以下测验，检验你的学习成果</p>
    </header>

    <!-- 进度统计 -->
    <div class="progress-bar-container">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
      <span class="progress-text">{{ completedCount }} / {{ totalQuestions }}</span>
    </div>

    <!-- 批量ScenQuiz区域 -->
    <div class="quiz-grid">
      <div 
        v-for="(config, index) in quizConfigs" 
        :key="config.questionNumber"
        class="quiz-card"
        :class="{ 'completed': completedQuizzes.includes(config.questionNumber) }"
        :style="{ animationDelay: `${index * 100}ms` }"
      >
        <div class="quiz-card-header">
          <span class="quiz-number">第 {{ config.questionNumber }} 题</span>
          <span 
            class="quiz-status" 
            :class="{ 
              'completed': completedQuizzes.includes(config.questionNumber),
              'current': currentQuizIndex === index
            }"
          >
            <i v-if="completedQuizzes.includes(config.questionNumber)" class="fas fa-check"></i>
            <i v-else-if="currentQuizIndex === index" class="fas fa-circle"></i>
            <i v-else class="fas fa-circle-notch"></i>
          </span>
        </div>
        
        <div class="quiz-card-content">
          <ScenQuiz
            :text-id="textId"
            :quiz-level="quizLevel"
            :key="config.questionNumber"
            @answer="(qn, ans, correct) => handleAnswer(qn, ans, correct)"
            @complete="handleComplete"
            @error="handleQuizError"
          />
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div class="empty-state" v-if="quizConfigs.length === 0">
      <div class="empty-icon">
        <i class="fas fa-search"></i>
      </div>
      <p class="empty-message">暂无匹配的测验数据</p>
    </div>

    <!-- 底部导航按钮 -->
    <BackContinue
      back-text="返回"
      continue-text="完成"
      :disabled="completedCount < totalQuestions"
      @back="handleGoPrev"
      @continue="handleGoNext"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ScenQuiz from '@/components/ScenQuiz.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useDataLoader } from '@/composables/useDataLoader'
import { adaptScenarioText } from '@/adapters/scenarioAdapter'
import { adaptLevel1Quiz } from '@/adapters/level1QuizAdapter'
import { adaptLevel2Quiz } from '@/adapters/level2QuizAdapter'
import { adaptLevel3Quiz } from '@/adapters/level3QuizAdapter'
import type { RawScenarioText } from '@/adapters/scenarioAdapter'
import type { RawLevel1QuizItem } from '@/adapters/level1QuizAdapter'
import type { RawLevel2QuizItem } from '@/adapters/level2QuizAdapter'
import type { RawLevel3QuizItem } from '@/adapters/level3QuizAdapter'

interface QuizConfig {
  questionNumber: number
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

// 测验级别配置
const quizLevel = ref<'level1' | 'level2' | 'level3'>('level1')

// 页面标题
const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    level1: '基础测验',
    level2: '进阶测验',
    level3: '高级测验'
  }
  return titles[quizLevel.value] || '情景测验'
})

// 测验配置列表
const quizConfigs = ref<QuizConfig[]>([])

// 已完成的测验
const completedQuizzes = ref<number[]>([])

// 当前激活的测验索引
const currentQuizIndex = ref(0)

// 统计信息
const totalQuestions = computed(() => quizConfigs.value.length)
const completedCount = computed(() => completedQuizzes.value.length)
const progressPercent = computed(() => {
  if (totalQuestions.value === 0) return 0
  return Math.round((completedCount.value / totalQuestions.value) * 100)
})

// 使用导航composable
const { goNext, goPrev } = useNavigation('stepthree', poemId)

// 加载测验配置
async function loadQuizConfigs() {
  try {
    // 并行加载情景文本和测验数据
    const [scenarioData, quizData] = await Promise.all([
      loadScenarioData(),
      loadQuizData()
    ])

    // 获取匹配的questionNumber
    const scenarioNumbers = new Set(scenarioData.map(s => s.questionNumber))
    const quizNumbers = new Set(quizData.map(q => q.questionNumber))
    
    // 找出共同的questionNumber
    const commonNumbers = [...scenarioNumbers].filter(n => quizNumbers.has(n))
    
    // 生成配置列表
    quizConfigs.value = commonNumbers.map(num => ({
      questionNumber: num
    })).sort((a, b) => a.questionNumber - b.questionNumber)

    // 如果没有匹配的数据，尝试使用所有可用的题目
    if (quizConfigs.value.length === 0 && quizData.length > 0) {
      quizConfigs.value = quizData.slice(0, 5).map(q => ({
        questionNumber: q.questionNumber
      }))
    }
  } catch (e) {
    console.error('[StepThreeView] 加载测验配置失败:', e)
    // 使用默认配置
    quizConfigs.value = [
      { questionNumber: 1 },
      { questionNumber: 2 },
      { questionNumber: 3 }
    ]
  }
}

// 加载情景文本数据
async function loadScenarioData() {
  const url = `/data/level3_scenario_text/${textId.value}.json`
  const { data: rawData } = useDataLoader<RawScenarioText[]>(() => url)
  if (rawData.value) {
    return adaptScenarioText(rawData.value)
  }
  return []
}

// 加载测验数据
async function loadQuizData() {
  const url = `/data/${quizLevel.value}_quiz/${textId.value}.json`
  
  if (quizLevel.value === 'level1') {
    const { data: rawData } = useDataLoader<RawLevel1QuizItem[]>(() => url)
    if (rawData.value) {
      return adaptLevel1Quiz(rawData.value)
    }
  } else if (quizLevel.value === 'level2') {
    const { data: rawData } = useDataLoader<RawLevel2QuizItem[]>(() => url)
    if (rawData.value) {
      return adaptLevel2Quiz(rawData.value)
    }
  } else {
    const { data: rawData } = useDataLoader<RawLevel3QuizItem[]>(() => url)
    if (rawData.value) {
      return adaptLevel3Quiz(rawData.value)
    }
  }
  return []
}

// 处理答题
function handleAnswer(questionNumber: number, answer: string, isCorrect: boolean) {
  console.log(`[StepThreeView] 第${questionNumber}题作答: ${answer}, 正确: ${isCorrect}`)
  
  // 标记为已完成
  if (!completedQuizzes.value.includes(questionNumber)) {
    completedQuizzes.value.push(questionNumber)
  }
  
  // 更新当前索引
  const currentIndex = quizConfigs.value.findIndex(c => c.questionNumber === questionNumber)
  if (currentIndex !== -1) {
    currentQuizIndex.value = currentIndex + 1
  }
}

// 处理完成
function handleComplete(results: { questionNumber: number; answer: string; isCorrect: boolean }[]) {
  console.log('[StepThreeView] 所有测验完成:', results)
  completedQuizzes.value = results.map(r => r.questionNumber)
}

// 处理错误
function handleQuizError(error: string) {
  console.error('[StepThreeView] 测验错误:', error)
}

// 导航函数包装
function handleGoNext() {
  goNext(router)
}

function handleGoPrev() {
  goPrev(router)
}

// 组件挂载时加载配置
onMounted(() => {
  loadQuizConfigs()
})
</script>

<style scoped>
.stepthree-view {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 5rem;
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

/* 测验网格 */
.quiz-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .quiz-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .quiz-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 测验卡片 */
.quiz-card {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  animation: fadeInUp 0.5s ease forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.quiz-card.completed {
  border: 2px solid #22c55e;
}

.quiz-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.quiz-number {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.quiz-status {
  font-size: 0.75rem;
}

.quiz-status.completed {
  color: #22c55e;
}

.quiz-status.current {
  color: #667eea;
  animation: pulse 1.5s infinite;
}

.quiz-status:not(.completed):not(.current) {
  color: #9ca3af;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.quiz-card-content {
  padding: 0;
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
  
  .quiz-card-header {
    padding: 0.75rem 1rem;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .quiz-grid {
    gap: 1rem;
  }
}
</style>