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
import { submitAnswers as submitAnswersApi } from '@/utils/api'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'

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

  // 保存到 localStorage
  const storageKey = `quiz_records_${studentId}`
  const existingRecords = JSON.parse(localStorage.getItem(storageKey) || '[]')
  existingRecords.push(report)
  localStorage.setItem(storageKey, JSON.stringify(existingRecords))

  console.log('[Level1Quiz] 答题数据已保存到本地:', report)

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
    console.log('[Level1Quiz] 报告已下载:', filename)
  } else {
    console.log('[Level1Quiz] 报告生成成功（非浏览器环境跳过下载）:', filename)
  }
}

/**
 * 提交答题数据到后端（同时保存本地）
 */
async function submitToBackend(answers: Record<number, number>) {
  const id = studentId.value
  if (!id) {
    console.warn('[Level1Quiz] 未登录，跳过后端提交')
    return
  }

  if (!quizList.value?.length) {
    console.warn('[Level1Quiz] 无题目数据，跳过后端提交')
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

    console.log('[Level1Quiz] 提交答题数据到后端:', {
      answers: answerMap,
      questions,
      wenId: props.wenId,
      studentId: id,
      studentName: name,
    })

    const result = await submitAnswersApi({ answers: answerMap, questions }, props.wenId, id, name)

    console.log('[Level1Quiz] 答题数据已成功提交到后端:', result)
  } catch (error) {
    console.error('[Level1Quiz] 后端提交失败，但本地已保存:', error)
    console.log('[Level1Quiz] 本地保存的报告:', localReport)
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
  padding: 20px;
  font-family: 'Microsoft YaHei', sans-serif;
}

.quiz-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.quiz-item {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.question-number {
  font-weight: 600;
  color: #333;
  font-size: 16px;
}

.difficulty-tag {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.difficulty-tag.L1 {
  background-color: #dcfce7;
  color: #166534;
}

.difficulty-tag.L2 {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.difficulty-tag.L3 {
  background-color: #fee2e2;
  color: #991b1b;
}

.question-text {
  font-size: 16px;
  line-height: 1.8;
  color: #333;
  margin-bottom: 20px;
  text-align: justify;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-btn {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background-color: #f8f9fa;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  transition: all 0.3s ease;
  text-align: left;
}

.option-btn:hover:not(.disabled) {
  background-color: #e8f0fe;
  border-color: #4a90d9;
}

.option-btn.selected {
  background-color: #e8f0fe;
  border-color: #4a90d9;
}

.option-btn.correct {
  background-color: #f0fdf4;
  border-color: #22c55e;
}

.option-btn.wrong {
  background-color: #fef2f2;
  border-color: #ef4444;
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
  background-color: #e0e0e0;
  border-radius: 50%;
  margin-right: 16px;
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.option-btn.selected .option-letter {
  background-color: #4a90d9;
  color: white;
}

.option-btn.correct .option-letter {
  background-color: #22c55e;
  color: white;
}

.option-btn.wrong .option-letter {
  background-color: #ef4444;
  color: white;
}

.option-content {
  flex: 1;
  color: #333;
  line-height: 1.6;
}

.correct-icon,
.wrong-icon {
  margin-left: 12px;
  font-size: 20px;
  font-weight: bold;
}

.correct-icon {
  color: #22c55e;
}

.wrong-icon {
  color: #ef4444;
}

.explanation {
  margin-top: 20px;
  padding: 16px;
  background-color: #f5f5f5;
  border-radius: 8px;
  border-left: 4px solid #4a90d9;
}

.explanation-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: 14px;
}

.explanation-content {
  color: #666;
  font-size: 14px;
  line-height: 1.7;
}

.quiz-actions {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.submit-btn {
  padding: 14px 48px;
  background-color: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: background-color 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  background-color: #357abd;
}

.submit-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.result-panel {
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  color: white;
  padding: 32px;
  border-radius: 12px;
  text-align: center;
}

.result-header {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 24px;
}

.correct-count,
.score {
  font-size: 18px;
  font-weight: 500;
}

.reset-btn {
  padding: 12px 32px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.reset-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

@media (max-width: 768px) {
  .level1-quiz-container {
    padding: 16px;
  }

  .quiz-item {
    padding: 16px;
  }

  .question-text {
    font-size: 15px;
  }

  .option-btn {
    padding: 12px 16px;
    font-size: 14px;
  }

  .option-letter {
    width: 28px;
    height: 28px;
    font-size: 13px;
    margin-right: 12px;
  }

  .quiz-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
