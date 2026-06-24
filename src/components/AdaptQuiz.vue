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
import { submitSingleAnswer, get } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import type { ProcessedLevel1QuizItem, RawLevel1QuizItem } from '@/adapters/level1QuizAdapter'
import type { ProcessedLevel2QuizItem, RawLevel2QuizItem } from '@/adapters/level2QuizAdapter'
import type { ProcessedLevel3QuizItem, RawLevel3QuizItem } from '@/adapters/level3QuizAdapter'
import { adaptLevel1Quiz, getAllLevel1Quizzes } from '@/adapters/level1QuizAdapter'
import { adaptLevel2Quiz, getAllLevel2Quizzes } from '@/adapters/level2QuizAdapter'
import { adaptLevel3Quiz, getAllLevel3Quizzes } from '@/adapters/level3QuizAdapter'

type QuizItem = ProcessedLevel1QuizItem | ProcessedLevel2QuizItem | ProcessedLevel3QuizItem

interface Props {
  text_id?: string
  question_id?: string
  module?: string
  question_number?: number
  question_text?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  audio_file?: string
  difficulty?: string
  pre_dialog?: string
  correct_answer?: number | string
  explanation?: string
  question_type?: string

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
const quizzes = ref<QuizItem[]>([])
const currentIndex = ref(0)
const selectedAnswer = ref<string>('')
const showResult = ref(false)
const submitted = ref(false)
const results = ref<{ quiz: QuizItem; answer: string; isCorrect: boolean }[]>([])

// 检测是否为Block模式数据（通过下划线属性判断）
const isBlockMode = computed(() => {
  return props.question_text !== undefined || props.question_number !== undefined
})

// 从props转换为QuizItem格式
const quizFromProps = computed<QuizItem | null>(() => {
  if (!isBlockMode.value) return null

  let correctAnswer: number | string | null = null
  if (props.correct_answer !== undefined && props.correct_answer !== null) {
    correctAnswer = props.correct_answer
  }

  return {
    textId: props.text_id || props.textId || '',
    questionId: props.question_id || '',
    module: props.module || '',
    questionNumber:
      typeof props.question_number === 'number'
        ? props.question_number
        : parseInt(String(props.question_number)) || 1,
    questionText: props.question_text || '',
    options: [
      { label: 'A', value: props.option_a || '' },
      { label: 'B', value: props.option_b || '' },
      { label: 'C', value: props.option_c || '' },
      { label: 'D', value: props.option_d || '' },
    ].filter((opt) => opt.value.trim() !== ''),
    audioFile: props.audio_file || null,
    difficulty: props.difficulty || 'L2',
    correctAnswer,
    explanation: props.explanation || '',
    questionType: props.question_type || 'radio',
  } as QuizItem
})

const hasContent = computed(() => {
  // Block模式：直接使用props数据
  if (isBlockMode.value && quizFromProps.value) {
    return true
  }
  // 传统模式：从quizzes数组获取
  return quizzes.value.length > 0 && !error.value && !isLoading.value
})

const currentQuiz = computed(() => {
  // Block模式：直接返回props数据
  if (isBlockMode.value && quizFromProps.value) {
    return quizFromProps.value
  }
  // 传统模式：从数组获取
  return quizzes.value[currentIndex.value]
})

const hasNext = computed(() => {
  if (isBlockMode.value) return false
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
  // Block模式：直接使用props数据，不需要加载
  if (isBlockMode.value) {
    return
  }

  if (!props.autoLoad) return

  isLoading.value = true
  error.value = null

  try {
    const url = `/data/${props.level}_quiz/${props.textId}.json`

    if (props.level === 'level1') {
      const { data: rawData, error: loadError } = useDataLoader<RawLevel1QuizItem[]>(() => url)
      if (loadError.value) throw new Error(`数据加载失败: ${loadError.value}`)
      if (rawData.value) {
        quizzes.value = getAllLevel1Quizzes(adaptLevel1Quiz(rawData.value)) as QuizItem[]
      }
    } else if (props.level === 'level2') {
      const { data: rawData, error: loadError } = useDataLoader<RawLevel2QuizItem[]>(() => url)
      if (loadError.value) throw new Error(`数据加载失败: ${loadError.value}`)
      if (rawData.value) {
        quizzes.value = getAllLevel2Quizzes(adaptLevel2Quiz(rawData.value)) as QuizItem[]
      }
    } else {
      const { data: rawData, error: loadError } = useDataLoader<RawLevel3QuizItem[]>(() => url)
      if (loadError.value) throw new Error(`数据加载失败: ${loadError.value}`)
      if (rawData.value) {
        quizzes.value = getAllLevel3Quizzes(adaptLevel3Quiz(rawData.value)) as QuizItem[]
      }
    }

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

  // 自动提交到后端
  submitToBackend(currentQuiz.value, selectedAnswer.value, currentQuiz.value.correctAnswer)
}

/**
 * 获取学生ID
 */
function getStudentId(): string {
  const authStore = useAuthStore()
  if (authStore.isLoggedIn && authStore.user) {
    return authStore.user.studentId
  }
  const studentStore = useStudentStore()
  return studentStore.studentId
}

/**
 * 异步获取学生姓名
 */
async function getStudentName(): Promise<string> {
  const authStore = useAuthStore()
  if (authStore.isLoggedIn && authStore.user) {
    return authStore.user.username
  }
  const studentId = getStudentId()
  if (studentId) {
    try {
      const response = await get(`/api/students/${studentId}`)
      if (response.success && response.data) {
        return response.data.name || ''
      }
    } catch (error) {
      console.warn('[AdaptQuiz] 获取学生姓名失败:', error)
    }
  }
  return ''
}

/**
 * 提交单题答题数据到后端
 */
async function submitToBackend(
  quiz: QuizItem,
  userAnswer: string,
  correctAnswer: string | number | (string | number)[] | null | undefined,
) {
  const studentId = getStudentId()
  if (!studentId) {
    console.warn('[AdaptQuiz] 未登录，跳过后端提交')
    return
  }

  try {
    const studentName = await getStudentName()
    const wenId = quiz.textId || props.textId
    const questionId =
      quiz.questionId ||
      `${wenId}_level${props.level === 'level1' ? 1 : props.level === 'level2' ? 2 : 3}_q${quiz.questionNumber || 1}`

    console.log('[AdaptQuiz] 提交答题数据到后端:', {
      studentId,
      studentName,
      wenId,
      questionId,
      userAnswer,
      correctAnswer,
    })

    const result = await submitSingleAnswer({
      studentId,
      studentName,
      wenId,
      questionId,
      userAnswer,
      correctAnswer: correctAnswer ?? undefined,
      submittedAt: new Date().toISOString(),
    })

    console.log('[AdaptQuiz] 答题数据已成功提交到后端:', result)
  } catch (error) {
    console.error('[AdaptQuiz] 答案提交失败:', error)
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
