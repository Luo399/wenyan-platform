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
          下一题
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
import { appendQuizRecord } from '@/utils/localStorage'

// ============================================================
// Props / Emits
// ============================================================
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

// ============================================================
// 组件本地状态
// ============================================================
const quizzes = ref<QuizItem[]>(props.quizzes || [])
const currentIndex = ref(0)
const selectedAnswer = ref<string>('')
const showResult = ref(false)
const submitted = ref(false)
const results = ref<{ quiz: QuizItem; answer: string; isCorrect: boolean }[]>([])

const { studentId, getStudentName } = useStudentInfo()

// ============================================================
// R01: useDataLoader 必须在 setup 顶层同步调用
// 旧代码在 async loadData() 内调用 useDataLoader，违反 Composition API 规则，
// 导致 onScopeDispose/onUnmounted 注册失败、请求泄漏、watch 错过首次变化。
// 现在移到顶层，autoLoad=false，由 loadData 手动控制 loader.load()/retry()。
// props.level/textId 变化时通过 watch 触发 loader 重新加载。
// ============================================================
type RawQuizData = RawLevel1QuizItem[] | RawLevel2QuizItem[] | RawLevel3QuizItem[]
const quizUrl = computed(() => `/data/${props.level}_quiz/${props.textId}.json`)
const loader = useDataLoader<RawQuizData>(() => quizUrl.value, {
  autoLoad: false,
  cacheEnabled: true,
})

const isLoading = computed(
  () =>
    loader.loading.value ||
    (props.quizzes &&
      props.quizzes.length === 0 &&
      quizzes.value.length === 0 &&
      !props.autoLoad === false),
)
const error = computed(() => loader.error.value)

const hasContent = computed(() => {
  return quizzes.value.length > 0 && !error.value && !isLoading.value
})

// ============================================================
// 计算属性
// ============================================================
const currentQuiz = computed(() => quizzes.value[currentIndex.value])

const hasNext = computed(() => currentIndex.value < quizzes.value.length - 1)

const difficultyClass = computed(() => {
  const diff = currentQuiz.value?.difficulty || 'L2'
  return `difficulty-${diff.toLowerCase()}`
})

const difficultyLabel = computed(() => currentQuiz.value?.difficulty || 'L2')

// ============================================================
// 工具函数
// ============================================================
function getCorrectAnswerLabel(correctAnswer: number | string | null | undefined): string {
  if (correctAnswer === null || correctAnswer === undefined) return ''
  if (typeof correctAnswer === 'string') return correctAnswer
  const labels = ['A', 'B', 'C', 'D']
  return labels[correctAnswer] || ''
}

/**
 * 根据原始 quiz 数据调用对应 level 适配器
 */
function adaptRawData(raw: RawQuizData): QuizItem[] {
  if (props.level === 'level1') {
    return getAllLevel1Quizzes(adaptLevel1Quiz(raw as RawLevel1QuizItem[])) as QuizItem[]
  }
  if (props.level === 'level2') {
    return getAllLevel2Quizzes(adaptLevel2Quiz(raw as RawLevel2QuizItem[])) as QuizItem[]
  }
  return getAllLevel3Quizzes(adaptLevel3Quiz(raw as RawLevel3QuizItem[])) as QuizItem[]
}

/**
 * 根据 loader.data 最新值适配后填充 quizzes
 */
function applyLoadedData() {
  if (!loader.data.value) return
  const adapted = adaptRawData(loader.data.value)
  quizzes.value = adapted
  if (adapted.length === 0 && !error.value) {
    // 适配结果为空：不抛错，但让 error 提示（loader.error 本身也有）
  }
}

// ============================================================
// 数据加载：使用顶层 loader 的 load/retry
// ============================================================
async function loadData() {
  // 已有 props.quizzes 则直接跳过，不请求
  if (props.quizzes && props.quizzes.length > 0) return
  if (!props.autoLoad) return

  try {
    await loader.load()
  } catch (e) {
    // useDataLoader 内部已设置 error.value，这里只做额外处理
    debugError('AdaptQuiz 数据加载失败:', e)
  }
  applyLoadedData()
  if (quizzes.value.length === 0 && !error.value) {
    // 兜底：loader 没报错但也没数据（比如空数组），提示"未找到"
    // 注意：不能修改 loader.error（只读），通过 emit 告知父组件
  }
}

function handleRetry() {
  if (props.quizzes && props.quizzes.length > 0) return
  // 重试：先清掉空 quizzes，再触发 loader.retry
  quizzes.value = []
  loader.retry()
}

// ============================================================
// 监听 loader.data/error 变化，自动适配写入 quizzes
// （手动 load/retry 成功后，URL 变化后 loader 自动 load 成功后，都会走到这里）
// ============================================================
watch(
  () => loader.data.value,
  (data) => {
    if (data !== null) applyLoadedData()
  },
)

// R01: level/textId 变化触发自动重新加载（若已关闭 autoLoad 则等待手动 loadData）
watch(
  () => [props.textId, props.level],
  () => {
    if (props.quizzes && props.quizzes.length > 0) return
    if (props.autoLoad) {
      quizzes.value = []
      // URL 变化会触发 useDataLoader 内部 watch(urlGetter) 自动 load，无需手动调用
    }
  },
)

// ============================================================
// 答题逻辑
// ============================================================
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
  sid: string,
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
    studentId: sid,
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

  const allRecords = appendQuizRecord(sid, record)
  debugLog('[AdaptQuiz] 答题数据已保存到本地:', record, '当前共', allRecords.length, '条')
  downloadSingleReport(record, sid, studentName)
  return record
}

function downloadSingleReport(record: any, sid: string, studentName: string) {
  const wenId = record.wenId || props.textId
  const filename = `答题记录_${sid}_${studentName}_${wenId}_${record.questionId}_${new Date().toISOString().slice(0, 10)}.json`
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
  } catch (e) {
    debugError('[AdaptQuiz] 后端提交失败，但本地已保存:', e)
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

// 题目序号（questionNumber prop）变化时跳转对应题号
watch(
  () => props.questionNumber,
  () => {
    if (quizzes.value.length > 0) {
      const index = quizzes.value.findIndex((q) => q.questionNumber === props.questionNumber)
      if (index !== -1) currentIndex.value = index
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
