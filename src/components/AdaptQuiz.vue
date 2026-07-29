<template>
  <div class="adapt-quiz">
    <div class="quiz-container" v-if="hasContent">
      <div class="quiz-header">
        <div class="quiz-icon">
          <i class="fas fa-question-circle"></i>
        </div>
        <div class="quiz-info">
          <h3 class="quiz-title">{{ title }}</h3>
          <span class="quiz-difficulty" :class="difficultyClass">{{ difficultyLabel }}</span>
        </div>
      </div>

      <div class="quiz-content">
        <div class="question-text">{{ currentQuiz?.questionText }}</div>

        <div class="options-list">
          <button
            v-for="option in currentQuiz?.options"
            :key="option.label"
            class="option-btn"
            :class="{
              selected: selectedAnswer === option.label,
              correct:
                showResult && option.label === getCorrectAnswerLabel(currentQuiz?.correctAnswer),
              wrong:
                showResult &&
                selectedAnswer === option.label &&
                option.label !== getCorrectAnswerLabel(currentQuiz?.correctAnswer),
            }"
            :disabled="submitted"
            @click="selectOption(option.label)"
          >
            <span class="option-label">{{ option.label }}</span>
            <span class="option-text">{{ option.value }}</span>
            <span class="option-icon" v-if="showResult">
              <i
                v-if="option.label === getCorrectAnswerLabel(currentQuiz?.correctAnswer)"
                class="fas fa-check"
              ></i>
              <i v-else-if="selectedAnswer === option.label" class="fas fa-times"></i>
            </span>
          </button>
        </div>

        <div class="explanation-box" v-if="showResult && currentQuiz?.explanation">
          <div class="explanation-header">
            <i class="fas fa-info-circle"></i>
            <span>解析</span>
          </div>
          <p class="explanation-text">{{ currentQuiz.explanation }}</p>
        </div>
      </div>

      <div class="quiz-footer">
        <button
          v-if="!showResult"
          class="submit-btn"
          :disabled="!selectedAnswer"
          @click="submitAnswer"
        >
          <i class="fas fa-check"></i>
          提交答案
        </button>
        <button v-else class="next-btn" @click="handleNext">
          <i class="fas fa-arrow-right"></i>
          {{ hasNext ? '下一题' : '完成' }}
        </button>
      </div>
    </div>

    <div class="quiz-loading" v-else-if="isLoading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载题目中...</span>
      </div>
    </div>

    <div class="quiz-error" v-else-if="error">
      <div class="error-icon">
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <p class="error-message">{{ error }}</p>
      <button class="error-retry" @click="handleRetry">
        <i class="fas fa-refresh"></i>
        重新加载
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { useStudentInfo } from '@/composables/useStudentInfo'
import { submitSingleAnswer } from '@/services/apiService'
import type { QuizItem } from '@/adapters/quizAdapter'
import type { ProcessedLevel1QuizItem, RawLevel1QuizItem } from '@/adapters/level1QuizAdapter'
import type { ProcessedLevel2QuizItem, RawLevel2QuizItem } from '@/adapters/level2QuizAdapter'
import type { ProcessedLevel3QuizItem, RawLevel3QuizItem } from '@/adapters/level3QuizAdapter'
import { adaptLevel1Quiz, getAllLevel1Quizzes } from '@/adapters/level1QuizAdapter'
import { adaptLevel2Quiz, getAllLevel2Quizzes } from '@/adapters/level2QuizAdapter'
import { adaptLevel3Quiz, getAllLevel3Quizzes } from '@/adapters/level3QuizAdapter'
import { debugLog, debugError, debugWarn } from '@/utils/debug'

interface Props {
  quizzes?: QuizItem[]
  textId?: string
  level?: 'level1' | 'level2' | 'level3'
  questionNumber?: number
  title?: string
  autoLoad?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  textId: 'WEN_01',
  level: 'level1',
  questionNumber: 1,
  title: '阅读理解',
  autoLoad: true,
})

const emit = defineEmits<{
  (
    e: 'answer',
    quiz: QuizItem,
    answer: string,
    isCorrect: boolean,
    questionId?: string,
    module?: string,
    correctAnswer?: string | number | (string | number)[],
  ): void
  (e: 'complete', results: { quiz: QuizItem; answer: string; isCorrect: boolean }[]): void
  (e: 'error', error: string): void
  (e: 'quiz-submitted'): void
}>()

const isLoading = ref(false)
const error = ref<string | null>(null)
const quizzes = ref<QuizItem[]>(props.quizzes || [])
const currentIndex = ref(0)
const selectedAnswer = ref<string>('')
const showResult = ref(false)
const submitted = ref(false)
const results = ref<{ quiz: QuizItem; answer: string; isCorrect: boolean }[]>([])

const hasContent = computed(() => {
  return quizzes.value.length > 0 && !error.value && !isLoading.value
})

const { studentId, getStudentName } = useStudentInfo()

const currentQuiz = computed(() => {
  return quizzes.value[currentIndex.value]
})

const hasNext = computed(() => {
  return currentIndex.value < quizzes.value.length - 1
})

const difficultyClass = computed(() => {
  const diff = currentQuiz.value?.difficulty || 'L2'
  return `difficulty-${diff.toLowerCase()}`
})

const difficultyLabel = computed(() => {
  const diff = currentQuiz.value?.difficulty || 'L2'
  return diff
})

function getCorrectAnswerLabel(correctAnswer: number | string | null | undefined): string {
  if (correctAnswer === null || correctAnswer === undefined) return ''
  if (typeof correctAnswer === 'string') return correctAnswer
  const labels = ['A', 'B', 'C', 'D']
  return labels[correctAnswer] || ''
}

async function loadData() {
  if (props.quizzes && props.quizzes.length > 0) {
    return
  }

  if (!props.autoLoad) return

  isLoading.value = true
  error.value = null

  try {
    const url = `/data/${props.level}_quiz/${props.textId}.json`
    const loader = useDataLoader<RawLevel1QuizItem[] | RawLevel2QuizItem[] | RawLevel3QuizItem[]>(
      () => url,
    )

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('数据加载超时'))
      }, 30000)

      if (loader.data.value !== null) {
        clearTimeout(timeoutId)
        resolve()
        return
      }

      if (loader.error.value !== null) {
        clearTimeout(timeoutId)
        resolve()
        return
      }

      const unwatchData = watch(
        () => loader.data.value,
        (data) => {
          if (data !== null) {
            clearTimeout(timeoutId)
            unwatchData()
            unwatchError()
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
            resolve()
          }
        },
      )
    })

    if (loader.error.value) throw new Error(`数据加载失败: ${loader.error.value}`)

    let adaptedData: QuizItem[]
    if (props.level === 'level1') {
      adaptedData = getAllLevel1Quizzes(
        adaptLevel1Quiz(loader.data.value as RawLevel1QuizItem[]),
      ) as QuizItem[]
    } else if (props.level === 'level2') {
      adaptedData = getAllLevel2Quizzes(
        adaptLevel2Quiz(loader.data.value as RawLevel2QuizItem[]),
      ) as QuizItem[]
    } else {
      adaptedData = getAllLevel3Quizzes(
        adaptLevel3Quiz(loader.data.value as RawLevel3QuizItem[]),
      ) as QuizItem[]
    }

    quizzes.value = adaptedData

    if (quizzes.value.length === 0) {
      error.value = '未找到题目数据'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '数据处理失败'
    emit('error', error.value)
    debugError('AdaptQuiz 数据加载失败:', e)
  } finally {
    isLoading.value = false
  }
}

function selectOption(label: string) {
  if (showResult.value) return
  selectedAnswer.value = label
}

function submitAnswer() {
  if (!selectedAnswer.value || !currentQuiz.value || submitted.value) return

  const correctLabel = getCorrectAnswerLabel(currentQuiz.value.correctAnswer)
  const isCorrect = selectedAnswer.value === correctLabel
  results.value.push({
    quiz: currentQuiz.value,
    answer: selectedAnswer.value,
    isCorrect,
  })

  showResult.value = true
  submitted.value = true
  emit(
    'answer',
    currentQuiz.value,
    selectedAnswer.value,
    isCorrect,
    currentQuiz.value.questionId,
    currentQuiz.value.module,
    currentQuiz.value.correctAnswer ?? undefined,
  )
  emit('quiz-submitted')

  submitToBackend(currentQuiz.value, selectedAnswer.value, currentQuiz.value.correctAnswer)
}

function saveToLocal(
  quiz: QuizItem,
  userAnswer: string,
  correctAnswer: string | number | (string | number)[] | null | undefined,
  studentId: string,
  studentName: string,
) {
  const now = new Date()
  const submittedAt = now.toISOString()
  const wenId = quiz.textId || props.textId
  const questionId =
    quiz.questionId ||
    `${wenId}_level${props.level === 'level1' ? 1 : props.level === 'level2' ? 2 : 3}_q${quiz.questionNumber || 1}`

  const isCorrect = String(userAnswer) === String(correctAnswer ?? '')

  const record = {
    studentId,
    studentName,
    wenId,
    questionId,
    questionNumber: quiz.questionNumber || 1,
    level: props.level,
    userAnswer,
    correctAnswer,
    isCorrect,
    score: isCorrect ? 100 : 0,
    submittedAt,
  }

  const storageKey = `quiz_records_${studentId}`
  const existingRecords = JSON.parse(localStorage.getItem(storageKey) || '[]')
  existingRecords.push(record)
  localStorage.setItem(storageKey, JSON.stringify(existingRecords))

  debugLog('[AdaptQuiz] 答题数据已保存到本地:', record)

  downloadSingleReport(record, studentId, studentName)

  return record
}

function downloadSingleReport(record: any, studentId: string, studentName: string) {
  const wenId = record.wenId || props.textId
  const filename = `答题记录_${studentId}_${studentName}_${wenId}_${record.questionId}_${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  debugLog('[AdaptQuiz] 报告已下载:', filename)
}

async function submitToBackend(
  quiz: QuizItem,
  userAnswer: string,
  correctAnswer: string | number | (string | number)[] | null | undefined,
) {
  const id = studentId.value
  if (!id) {
    debugWarn('[AdaptQuiz] 未登录，跳过后端提交')
    return
  }

  const name = await getStudentName()

  const localRecord = saveToLocal(quiz, userAnswer, correctAnswer, id, name)

  try {
    const wenId = quiz.textId || props.textId
    const questionId =
      quiz.questionId ||
      `${wenId}_level${props.level === 'level1' ? 1 : props.level === 'level2' ? 2 : 3}_q${quiz.questionNumber || 1}`

    debugLog('[AdaptQuiz] 提交答题数据到后端:', {
      studentId: id,
      studentName: name,
      wenId,
      questionId,
      userAnswer,
      correctAnswer,
    })

    const result = await submitSingleAnswer({
      studentId: id,
      studentName: name,
      wenId,
      questionId,
      userAnswer,
      correctAnswer: correctAnswer ?? undefined,
      submittedAt: new Date().toISOString(),
    })

    debugLog('[AdaptQuiz] 答题数据已成功提交到后端:', result)
  } catch (error) {
    debugError('[AdaptQuiz] 后端提交失败，但本地已保存:', error)
    debugLog('[AdaptQuiz] 本地保存的记录:', localRecord)
  }
}

function handleNext() {
  if (hasNext.value) {
    currentIndex.value++
    selectedAnswer.value = ''
    showResult.value = false
  } else {
    emit('complete', results.value)
  }
}

function handleRetry() {
  loadData()
}

watch(
  () => props.questionNumber,
  () => {
    if (quizzes.value.length > 0) {
      const index = quizzes.value.findIndex((q) => q.questionNumber === props.questionNumber)
      if (index !== -1) {
        currentIndex.value = index
      }
    }
  },
)

onMounted(() => {
  loadData()
})

defineExpose({
  reload: loadData,
  goToQuestion: (index: number) => {
    if (index >= 0 && index < quizzes.value.length) {
      currentIndex.value = index
      selectedAnswer.value = ''
      showResult.value = false
    }
  },
  currentIndex,
  totalQuestions: computed(() => quizzes.value.length),
})
</script>

<style scoped>
.adapt-quiz {
  width: 100%;
  min-height: 400px;
  font-family: var(--font-family-serif);
}

/* 测验容器：30px 圆角 + 设计 token 阴影 */
.quiz-container {
  background: var(--color-white);
  border-radius: var(--radius-card);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-card);
}

.quiz-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: var(--border-width-thin) solid var(--color-border);
}

.quiz-icon {
  width: 40px;
  height: 40px;
  background: var(--color-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: var(--font-size-body-lg);
}

.quiz-info {
  flex: 1;
}

.quiz-title {
  margin: 0;
  font-size: var(--font-size-body-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.quiz-difficulty {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 20px;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

/* 难度标签配色（语义色，无对应 token，保持原值） */
.difficulty-l1 {
  background: #dcfce7;
  color: #166534;
}

.difficulty-l2 {
  background: #dbeafe;
  color: var(--color-primary);
}

.difficulty-l3 {
  background: #fee2e2;
  color: #991b1b;
}

.quiz-content {
  margin-bottom: var(--spacing-lg);
}

.question-text {
  font-size: var(--font-size-body-lg);
  font-weight: var(--font-weight-semibold);
  line-height: 1.6;
  color: var(--color-text);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  border-left: var(--border-width-thin) solid var(--color-primary);
  word-break: break-word;
  overflow-wrap: break-word;
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
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-small);
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.option-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-bg-highlight);
}

/* 选项卡片选中状态：朱红色边框 + 米色背景 */
.option-btn.selected {
  border-color: var(--color-primary);
  background: var(--color-bg-highlight);
}

/* 正确状态：语义色绿色 */
.option-btn.correct {
  border-color: #22c55e;
  background: #f0fdf4;
}

/* 错误状态：语义色红色 */
.option-btn.wrong {
  border-color: var(--color-primary);
  background: #fef2f2;
}

.option-btn:disabled {
  cursor: default;
}

.option-label {
  width: 28px;
  height: 28px;
  background: var(--color-placeholder);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.option-btn.selected .option-label {
  background: var(--color-primary);
  color: var(--color-white);
}

.option-btn.correct .option-label {
  background: #22c55e;
  color: var(--color-white);
}

.option-btn.wrong .option-label {
  background: var(--color-primary);
  color: var(--color-white);
}

.option-text {
  flex: 1;
  font-size: var(--font-size-small);
  color: var(--color-text);
}

.option-icon {
  font-size: var(--font-size-body-lg);
}

.option-btn.correct .option-icon {
  color: #22c55e;
}

.option-btn.wrong .option-icon {
  color: var(--color-primary);
}

/* 解析框 */
.explanation-box {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  border-left: var(--border-width-thin) solid var(--color-accent);
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.explanation-text {
  margin: 0;
  font-size: var(--font-size-small);
  line-height: 1.6;
  color: var(--color-text);
}

.quiz-footer {
  display: flex;
  justify-content: flex-end;
}

/* 按钮：朱红底色 + 橄榄绿边框 + 50px 圆角 */
.submit-btn,
.next-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-btn {
  background: var(--color-primary);
  color: var(--color-white);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-small);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.next-btn {
  background: var(--color-accent);
  color: var(--color-white);
}

.next-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-small);
}

.quiz-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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
.quiz-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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
</style>
