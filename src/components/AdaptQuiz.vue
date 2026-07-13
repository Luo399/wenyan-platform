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
import { submitSingleAnswer } from '@/utils/api'
import type { QuizItem } from '@/adapters/quizAdapter'
import type { ProcessedLevel1QuizItem, RawLevel1QuizItem } from '@/adapters/level1QuizAdapter'
import type { ProcessedLevel2QuizItem, RawLevel2QuizItem } from '@/adapters/level2QuizAdapter'
import type { ProcessedLevel3QuizItem, RawLevel3QuizItem } from '@/adapters/level3QuizAdapter'
import { adaptLevel1Quiz, getAllLevel1Quizzes } from '@/adapters/level1QuizAdapter'
import { adaptLevel2Quiz, getAllLevel2Quizzes } from '@/adapters/level2QuizAdapter'
import { adaptLevel3Quiz, getAllLevel3Quizzes } from '@/adapters/level3QuizAdapter'

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
    console.error('AdaptQuiz 数据加载失败:', e)
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

  console.log('[AdaptQuiz] 答题数据已保存到本地:', record)

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
  console.log('[AdaptQuiz] 报告已下载:', filename)
}

async function submitToBackend(
  quiz: QuizItem,
  userAnswer: string,
  correctAnswer: string | number | (string | number)[] | null | undefined,
) {
  const id = studentId.value
  if (!id) {
    console.warn('[AdaptQuiz] 未登录，跳过后端提交')
    return
  }

  const name = await getStudentName()

  const localRecord = saveToLocal(quiz, userAnswer, correctAnswer, id, name)

  try {
    const wenId = quiz.textId || props.textId
    const questionId =
      quiz.questionId ||
      `${wenId}_level${props.level === 'level1' ? 1 : props.level === 'level2' ? 2 : 3}_q${quiz.questionNumber || 1}`

    console.log('[AdaptQuiz] 提交答题数据到后端:', {
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

    console.log('[AdaptQuiz] 答题数据已成功提交到后端:', result)
  } catch (error) {
    console.error('[AdaptQuiz] 后端提交失败，但本地已保存:', error)
    console.log('[AdaptQuiz] 本地保存的记录:', localRecord)
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
}

.quiz-container {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
}

.quiz-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(59, 130, 246, 0.2);
}

.quiz-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
}

.quiz-info {
  flex: 1;
}

.quiz-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.quiz-difficulty {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.difficulty-l1 {
  background: #dcfce7;
  color: #166534;
}

.difficulty-l2 {
  background: #dbeafe;
  color: #1d4ed8;
}

.difficulty-l3 {
  background: #fee2e2;
  color: #991b1b;
}

.quiz-content {
  margin-bottom: 20px;
}

.question-text {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.6;
  color: #1e293b;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  border-left: 4px solid #667eea;
  word-break: break-word;
  overflow-wrap: break-word;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.option-btn:hover:not(:disabled) {
  border-color: #667eea;
  background: #eff6ff;
}

.option-btn.selected {
  border-color: #667eea;
  background: #eff6ff;
}

.option-btn.correct {
  border-color: #22c55e;
  background: #f0fdf4;
}

.option-btn.wrong {
  border-color: #ef4444;
  background: #fef2f2;
}

.option-btn:disabled {
  cursor: default;
}

.option-label {
  width: 28px;
  height: 28px;
  background: #e2e8f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  flex-shrink: 0;
}

.option-btn.selected .option-label {
  background: #667eea;
  color: white;
}

.option-btn.correct .option-label {
  background: #22c55e;
  color: white;
}

.option-btn.wrong .option-label {
  background: #ef4444;
  color: white;
}

.option-text {
  flex: 1;
  font-size: 14px;
  color: #475569;
}

.option-icon {
  font-size: 18px;
}

.option-btn.correct .option-icon {
  color: #22c55e;
}

.option-btn.wrong .option-icon {
  color: #ef4444;
}

.explanation-box {
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 8px;
  border-left: 4px solid #f59e0b;
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
}

.explanation-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #78350f;
}

.quiz-footer {
  display: flex;
  justify-content: flex-end;
}

.submit-btn,
.next-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.next-btn {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.next-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
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
  gap: 12px;
  color: #667eea;
}

.loading-spinner i {
  font-size: 32px;
}

.loading-spinner span {
  font-size: 14px;
}

.quiz-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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
</style>
