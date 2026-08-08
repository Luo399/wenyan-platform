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
        <button :disabled="!allAnswered" class="submit-btn" @click="handleSubmit">提交答案</button>
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
import { ref, computed, watch } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { useStudentInfo } from '@/composables/useStudentInfo'
import { submitAnswers as submitAnswersApi } from '@/services/apiService'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'
import { debugLog, debugError, debugWarn } from '@/utils/debug'
import { appendQuizRecord } from '@/utils/localStorage'
import { getDataUrlWithVersion } from '@/utils/asset'

// ============================================================
// R13: correct_answer 类型规范 + 归一化工具
// 后端 JSON 可能写成 number 或 string（"0"/"1"/...），这里显式声明联合，
// 并提供 normalizeCorrectAnswer 在读取时统一转 number。
// ============================================================
interface Level1QuizItem {
  text_id: string
  question_number: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: number | string
  correct_index?: number
  explanation: string
  difficulty: string
}

/**
 * 将 correct_answer（string | number）归一化为从 0 开始的选项索引。
 * 无法解析时返回 0（容错，避免全串 NaN）。
 */
function normalizeCorrectAnswer(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 0
  const num = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isFinite(num) ? num : 0
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

const quizUrl = (): string | Promise<string> => {
  // 外部显式传入自定义 baseUrl 时沿用（兼容旧用法）；否则走版本戳 OSS 地址
  if (props.baseUrl !== '/data/level1_quiz/') {
    return `${props.baseUrl}${props.wenId}.json`
  }
  return getDataUrlWithVersion('level1_quiz', `${props.wenId}.json`)
}

const {
  loading,
  error,
  data: quizList,
  retry,
} = useDataLoader<Level1QuizItem[]>(quizUrl, {
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

// P2 顺手修 oxlint unicorn/no-new-array：用 Array.from 替代 new Array(n).fill()
const selectedAnswers = ref<(number | null)[]>([])
const submitted = ref<boolean[]>([])
const showResult = ref(false)

const { studentId, getStudentName } = useStudentInfo()

function initState() {
  const length = quizList.value?.length || 0
  selectedAnswers.value = Array.from({ length }, () => null)
  submitted.value = Array.from({ length }, () => false)
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

/**
 * R13: 统一使用 normalizeCorrectAnswer，
 * 避免 parseInt(String(...)) 到处分散 + correct_index 优先逻辑写两次。
 */
function getCorrectIndex(quiz: Level1QuizItem): number {
  if (quiz.correct_index !== undefined) {
    return quiz.correct_index
  }
  return normalizeCorrectAnswer(quiz.correct_answer)
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

/**
 * R14（顺手修 P3）: 本地函数改名为 handleSubmit，
 * 避免和顶部 import 的 submitAnswersApi 造成"同名易混淆"。
 */
function handleSubmit() {
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

  submitToBackend(answersRecord)
}

/**
 * 保存答题数据到本地存储
 */
function saveToLocal(answers: Record<number, number>, id: string, studentName: string) {
  if (!quizList.value?.length) return

  const now = new Date()
  const submittedAt = now.toISOString()

  const records = quizList.value.map((quiz, index) => {
    const userAnswer = answers[index]
    const correctAnswer = normalizeCorrectAnswer(quiz.correct_answer)
    // R13: 统一用数值比较，避免 String(userAnswer) === String(correctAnswer)
    // （当类型混乱时字符串比较会出现 "1" !== 1 的伪负例）
    const isCorrect = Number(userAnswer) === correctAnswer
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
    studentId: id,
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

  const allRecords = appendQuizRecord(id, report)

  debugLog('[Level1Quiz] 答题数据已保存到本地:', report, '当前共', allRecords.length, '条')

  downloadReport(report, id, studentName)

  return report
}

/**
 * 下载答题报告
 */
function downloadReport(report: unknown, id: string, studentName: string) {
  const filename = `答题报告_${id}_${studentName}_${props.wenId}_${new Date().toISOString().slice(0, 10)}.json`
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
  const localReport = saveToLocal(answers, id, name)

  try {
    const questions = quizList.value.map((quiz, index) => ({
      id: `${props.wenId}_level1_q${quiz.question_number || index + 1}`,
      correctAnswer: normalizeCorrectAnswer(quiz.correct_answer),
    }))

    const answerMap: Record<string, number> = {}
    Object.entries(answers).forEach(([index, answer]) => {
      const idxNum = parseInt(index)
      const quiz = quizList.value?.[idxNum]
      if (quiz) {
        const key = `${props.wenId}_level1_q${quiz.question_number || idxNum + 1}`
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
  } catch (err) {
    debugError('[Level1Quiz] 后端提交失败，但本地已保存:', err)
    debugLog('[Level1Quiz] 本地保存的报告:', localReport)
  }
}

function resetQuiz() {
  initState()
}

// R11: 删除空 onMounted(() => {})
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

/* R12: 难度标签配色统一走语义 token，不再硬编码 HEX */
.difficulty-tag.L1 {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.difficulty-tag.L2 {
  background-color: var(--color-info-bg);
  color: var(--color-primary);
}

.difficulty-tag.L3 {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
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

/* R12: 正确状态 - 走成功语义 token */
.option-btn.correct {
  background-color: var(--color-success-bg-soft);
  border-color: var(--color-success-light);
}

/* R12: 错误状态 - 走错误语义 token */
.option-btn.wrong {
  background-color: var(--color-danger-bg-soft);
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

/* R12: correct/wrong 选项字母底色走语义 token */
.option-btn.correct .option-letter {
  background-color: var(--color-success-light);
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

/* R12: 正确/错误图标颜色走语义 token */
.correct-icon {
  color: var(--color-success-light);
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
