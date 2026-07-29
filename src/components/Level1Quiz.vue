<!--
  Level1Quiz.vue - Level 1 阅读测验组件
  功能描述：展示单选题测验，支持选项选择、答案提交、结果展示和解析
  Props:
    wenId: string - 课文ID
    baseUrl?: string - 数据基础URL，默认 '/data/level1_quiz/'
    autoLoad?: boolean - 是否自动加载数据，默认 true
  Events:
    load-success: 数据加载成功
    load-error: 数据加载失败
    submit: 答案提交事件
    complete: 答题完成事件
  使用:
    <Level1Quiz wen-id="WEN_01" @submit="handleSubmit" />
-->
<template>
  <div class="level1-quiz-container">
    <BaseLoader v-if="loading || (quizList === null && !error)" loading-text="加载题目中..." />
    <BaseError v-else-if="error" :error="error" @retry="retry" />
    <BaseEmpty v-else-if="!quizList?.length" empty-text="暂无题目数据" />
    <div v-else class="quiz-content">
      <div v-for="(quiz, index) in quizList" :key="quiz.question_number || index" class="quiz-item">
        <div class="quiz-header">
          <span class="question-number">第 {{ quiz.question_number || index + 1 }} 题</span>
          <span :class="['difficulty-tag', quiz.difficulty]">{{ quiz.difficulty }}</span>
        </div>

        <div class="question-text">{{ quiz.question_text }}</div>

        <div class="options-list">
          <button
            v-for="(option, optIndex) in getOptions(quiz)"
            :key="optIndex"
            :class="[
              'option-btn',
              {
                selected: selectedAnswers[index] === optIndex,
                correct: submitted[index] && optIndex === getCorrectIndex(quiz),
                wrong:
                  submitted[index] &&
                  selectedAnswers[index] === optIndex &&
                  optIndex !== getCorrectIndex(quiz),
                disabled: submitted[index],
              },
            ]"
            @click="selectOption(index, optIndex)"
          >
            <span class="option-letter">{{ option.letter }}</span>
            <span class="option-content">{{ option.content }}</span>
            <span v-if="submitted[index] && optIndex === getCorrectIndex(quiz)" class="correct-icon"
              >✓</span
            >
            <span
              v-if="
                submitted[index] &&
                selectedAnswers[index] === optIndex &&
                optIndex !== getCorrectIndex(quiz)
              "
              class="wrong-icon"
              >✗</span
            >
          </button>
        </div>

        <div v-if="submitted[index] && quiz.explanation" class="explanation">
          <div class="explanation-title">答案解析</div>
          <div class="explanation-content">{{ quiz.explanation }}</div>
        </div>
      </div>

      <div class="quiz-actions">
        <button :disabled="!allAnswered" class="submit-btn" @click="submitAnswers">提交答案</button>
      </div>

      <div v-if="showResult" class="result-panel">
        <div class="result-header">测试结果</div>
        <div class="result-stats">
          <span class="correct-count">正确: {{ correctCount }}/{{ quizList?.length || 0 }}</span>
          <span class="score"
            >得分: {{ Math.round((correctCount / (quizList?.length || 1)) * 100) }}分</span
          >
        </div>
        <button class="reset-btn" @click="resetQuiz">重新测试</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { useStudentInfo } from '@/composables/useStudentInfo'
import { submitAnswers as submitAnswersApi } from '@/services/apiService'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'
import { debugLog, debugError, debugWarn } from '@/utils/debug'
import { appendQuizRecord } from '@/utils/localStorage'

interface Level1QuizItem {
  text_id: string
  question_number: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: number
  correct_index?: number
  explanation: string
  difficulty: string
}

interface Props {
  wenId: string
  baseUrl?: string
  autoLoad?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: '/data/level1_quiz/',
  autoLoad: true,
})

const emit = defineEmits<{
  (e: 'load-success', data: Level1QuizItem[]): void
  (e: 'load-error', error: string): void
  (e: 'submit', answers: Record<number, number>): void
  (e: 'complete', result: { correct: number; total: number }): void
}>()

const quizUrl = computed(() => `${props.baseUrl}${props.wenId}.json`)

const {
  loading,
  error,
  data: quizList,
  retry,
} = useDataLoader<Level1QuizItem[]>(() => quizUrl.value, {
  autoLoad: props.autoLoad,
  timeout: 10000,
  retryCount: 1,
  onLoadSuccess: (data) => emit('load-success', data),
  onLoadError: (err) => emit('load-error', err),
  transform: (raw) => {
    if (Array.isArray(raw)) {
      return raw as Level1QuizItem[]
    }
    const result = raw as { success: boolean; data: Level1QuizItem[] }
    return result.data || []
  },
})

const selectedAnswers = ref<(number | null)[]>([])
const submitted = ref<boolean[]>([])
const showResult = ref(false)

const { studentId, getStudentName } = useStudentInfo()

function initState() {
  const data = quizList.value
  const length = data?.length || 0
  selectedAnswers.value = new Array(length).fill(null)
  submitted.value = new Array(length).fill(false)
  showResult.value = false
}

watch(
  () => quizList.value,
  () => {
    initState()
  },
  { immediate: true },
)

function getOptions(quiz: Level1QuizItem) {
  return [
    { letter: 'A', content: quiz.option_a },
    { letter: 'B', content: quiz.option_b },
    { letter: 'C', content: quiz.option_c },
    { letter: 'D', content: quiz.option_d },
  ]
}

function getCorrectIndex(quiz: Level1QuizItem): number {
  if (quiz.correct_index !== undefined) {
    return quiz.correct_index
  }
  if (typeof quiz.correct_answer === 'number') {
    return quiz.correct_answer
  }
  const parsed = parseInt(String(quiz.correct_answer), 10)
  return isNaN(parsed) ? 0 : parsed
}

function selectOption(quizIndex: number, optIndex: number) {
  if (submitted.value[quizIndex]) return
  selectedAnswers.value[quizIndex] = optIndex
}

const allAnswered = computed(() => {
  if (!quizList.value?.length) return false
  return selectedAnswers.value.every((answer) => answer !== null)
})

const correctCount = computed(() => {
  if (!quizList.value?.length) return 0
  let count = 0
  quizList.value.forEach((quiz, index) => {
    if (submitted.value[index] && selectedAnswers.value[index] === getCorrectIndex(quiz)) {
      count++
    }
  })
  return count
})

function submitAnswers() {
  if (!allAnswered.value) return

  submitted.value = submitted.value.map(() => true)
  showResult.value = true

  const answersRecord: Record<number, number> = {}
  selectedAnswers.value.forEach((answer, index) => {
    if (answer !== null) {
      answersRecord[index] = answer
    }
  })
  emit('submit', answersRecord)
  emit('complete', { correct: correctCount.value, total: quizList.value?.length || 0 })

  // 自动提交到后端
  submitToBackend(answersRecord)
}

/**
 * 保存答题数据到本地存储
 */
function saveToLocal(answers: Record<number, number>, studentId: string, studentName: string) {
  if (!quizList.value?.length) return

  const now = new Date()
  const submittedAt = now.toISOString()

  // 构建答题记录
  const records = quizList.value.map((quiz, index) => {
    const userAnswer = answers[index]
    const correctAnswer = quiz.correct_answer
    const isCorrect = String(userAnswer) === String(correctAnswer)
    const questionId = `${props.wenId}_level1_q${quiz.question_number || index + 1}`

    return {
      questionId,
      questionNumber: quiz.question_number || index + 1,
      userAnswer,
      correctAnswer,
      isCorrect,
      score: isCorrect ? 100 : 0,
      submittedAt,
    }
  })

  const report = {
    studentId,
    studentName,
    wenId: props.wenId,
    submittedAt,
    totalQuestions: records.length,
    correctCount: records.filter((r) => r.isCorrect).length,
    wrongCount: records.filter((r) => !r.isCorrect).length,
    totalScore: records.filter((r) => r.isCorrect).length * 100,
    avgScore: Math.round((records.filter((r) => r.isCorrect).length / records.length) * 100),
    records,
  }

  // 保存到 localStorage（通过 utils/localStorage 封装，避免组件直接操作 storage）
  const allRecords = appendQuizRecord(studentId, report)

  debugLog('[Level1Quiz] 答题数据已保存到本地:', report, '当前共', allRecords.length, '条')

  // 自动下载报告
  downloadReport(report, studentId, studentName)

  return report
}

/**
 * 下载答题报告
 */
function downloadReport(report: any, studentId: string, studentName: string) {
  const filename = `答题报告_${studentId}_${studentName}_${props.wenId}_${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })

  if (typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    debugLog('[Level1Quiz] 报告已下载:', filename)
  } else {
    debugLog('[Level1Quiz] 报告生成成功（非浏览器环境跳过下载）:', filename)
  }
}

/**
 * 提交答题数据到后端（同时保存本地）
 */
async function submitToBackend(answers: Record<number, number>) {
  const id = studentId.value
  if (!id) {
    debugWarn('[Level1Quiz] 未登录，跳过后端提交')
    return
  }

  if (!quizList.value?.length) {
    debugWarn('[Level1Quiz] 无题目数据，跳过后端提交')
    return
  }

  const name = await getStudentName()

  // 先保存到本地（确保数据不丢失）
  const localReport = saveToLocal(answers, id, name)

  try {
    // 构建题目信息（包含正确答案和题目ID）
    const questions = quizList.value.map((quiz, index) => ({
      id: `${props.wenId}_level1_q${quiz.question_number || index + 1}`,
      correctAnswer: quiz.correct_answer,
    }))

    // 构建答案映射
    const answerMap: Record<string, number> = {}
    Object.entries(answers).forEach(([index, answer]) => {
      const quiz = quizList.value![parseInt(index)]
      if (quiz) {
        const key = `${props.wenId}_level1_q${quiz.question_number || parseInt(index) + 1}`
        answerMap[key] = answer
      }
    })

    debugLog('[Level1Quiz] 提交答题数据到后端:', {
      answers: answerMap,
      questions,
      wenId: props.wenId,
      studentId: id,
      studentName: name,
    })

    const result = await submitAnswersApi(
      { answers: answerMap, questions },
      props.wenId,
      id,
      name,
      30000,
    )

    debugLog('[Level1Quiz] 答题数据已成功提交到后端:', result)
  } catch (error) {
    debugError('[Level1Quiz] 后端提交失败，但本地已保存:', error)
    debugLog('[Level1Quiz] 本地保存的报告:', localReport)
  }
}

function resetQuiz() {
  initState()
}

onMounted(() => {})
</script>

<style scoped>
.level1-quiz-container {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-lg);
  font-family: var(--font-family-serif);
}

.quiz-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* 测验卡片：30px 圆角 + 设计 token 阴影 */
.quiz-item {
  background: var(--color-white);
  border-radius: var(--radius-card);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-card);
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.question-number {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  font-size: var(--font-size-body);
}

.difficulty-tag {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 20px;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

/* 难度标签配色（语义色，无对应 token，保持原值） */
.difficulty-tag.L1 {
  background-color: #dcfce7;
  color: #166534;
}

.difficulty-tag.L2 {
  background-color: #dbeafe;
  color: var(--color-primary);
}

.difficulty-tag.L3 {
  background-color: #fee2e2;
  color: #991b1b;
}

.question-text {
  font-size: var(--font-size-body);
  line-height: 1.8;
  color: var(--color-text);
  margin-bottom: var(--spacing-lg);
  text-align: justify;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* 选项按钮：橄榄绿细边框 */
.option-btn {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-white);
  border: var(--border-width-thin) solid transparent;
  border-radius: var(--radius-small);
  cursor: pointer;
  font-size: var(--font-size-body);
  transition: all 0.3s ease;
  text-align: left;
}

.option-btn:hover:not(.disabled) {
  background-color: var(--color-bg-highlight);
  border-color: var(--color-primary);
}

/* 选项卡片选中状态：朱红色边框 + 米色背景 */
.option-btn.selected {
  background-color: var(--color-bg-highlight);
  border-color: var(--color-primary);
}

/* 正确状态：语义色绿色 */
.option-btn.correct {
  background-color: #f0fdf4;
  border-color: #22c55e;
}

/* 错误状态：语义色红色 */
.option-btn.wrong {
  background-color: #fef2f2;
  border-color: var(--color-primary);
}

.option-btn.disabled {
  cursor: not-allowed;
}

.option-letter {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-placeholder);
  border-radius: 50%;
  margin-right: var(--spacing-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
}

.option-btn.selected .option-letter {
  background-color: var(--color-primary);
  color: var(--color-white);
}

.option-btn.correct .option-letter {
  background-color: #22c55e;
  color: var(--color-white);
}

.option-btn.wrong .option-letter {
  background-color: var(--color-primary);
  color: var(--color-white);
}

.option-content {
  flex: 1;
  color: var(--color-text);
  line-height: 1.6;
}

.correct-icon,
.wrong-icon {
  margin-left: var(--spacing-sm);
  font-size: var(--font-size-body-lg);
  font-weight: bold;
}

.correct-icon {
  color: #22c55e;
}

.wrong-icon {
  color: var(--color-primary);
}

/* 解析框 */
.explanation {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  border-left: var(--border-width-thin) solid var(--color-primary);
}

.explanation-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-small);
}

.explanation-content {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.7;
}

.quiz-actions {
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg) 0;
}

/* 提交按钮：朱红底色 + 橄榄绿边框 + 50px 圆角 */
.submit-btn {
  padding: var(--spacing-sm) var(--spacing-2xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  cursor: pointer;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  transition: background-color 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.submit-btn:disabled {
  background-color: var(--color-placeholder);
  cursor: not-allowed;
}

/* 结果面板 */
.result-panel {
  background: var(--color-primary);
  color: var(--color-white);
  padding: var(--spacing-xl);
  border-radius: var(--radius-card);
  text-align: center;
}

.result-header {
  font-size: var(--font-size-subheading);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-lg);
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-lg);
}

.correct-count,
.score {
  font-size: var(--font-size-body-lg);
  font-weight: var(--font-weight-semibold);
}

.reset-btn {
  padding: var(--spacing-sm) var(--spacing-xl);
  background-color: rgba(255, 255, 255, 0.2);
  color: var(--color-white);
  border: var(--border-width-hairline) solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-small);
  cursor: pointer;
  font-size: var(--font-size-small);
  transition: background-color 0.3s ease;
}

.reset-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

@media (max-width: 768px) {
  .level1-quiz-container {
    padding: var(--spacing-md);
  }

  .quiz-item {
    padding: var(--spacing-md);
  }

  .question-text {
    font-size: var(--font-size-small);
  }

  .option-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-small);
  }

  .option-letter {
    width: 28px;
    height: 28px;
    font-size: var(--font-size-small);
    margin-right: var(--spacing-sm);
  }

  .quiz-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }
}
</style>
