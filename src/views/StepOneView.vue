<!--
  StepOneView.vue - 字词学习 + 多角色朗读 + 一级测验组合页面

  布局说明：
  - 上方：WordList 组件（字词注释）
  - 中部：MultiRoleReading 组件（多角色朗读）
  - 下方：Level1Quiz 组件（一级阅读测验）
  - 底部：BackContinue 导航按钮

  页面顺序：rules -> stepone -> rule1 -> rule2 -> rule3 -> detail
-->
<template>
  <div class="annotated-segment-view">
    <!-- 字词注释区域 -->
    <section class="annotated-section">
      <WordList :wen-id="wenId" />
    </section>

    <!-- 分割线 -->
    <SectionDivider text="音频学习" />

    <!-- 多角色朗读区域 -->
    <section class="audio-section">
      <MultiRoleReading
        ref="audioPlayer"
        :wen-id="wenId"
        @load-success="handleAudioLoadSuccess"
        @load-error="handleAudioLoadError"
        @segment-change="handleSegmentChange"
      />
    </section>

    <!-- 分割线 -->
    <SectionDivider text="课后小测" />

    <!-- 一级测验区域 -->
    <section class="quiz-section">
      <Level1Quiz
        :wen-id="wenId"
        @load-success="handleQuizLoadSuccess"
        @load-error="handleQuizLoadError"
        @submit="handleQuizSubmit"
        @complete="handleQuizComplete"
      />
    </section>

    <!-- 底部导航按钮 -->
    <BackContinue
      back-text="返回"
      continue-text="继续"
      @back="handleGoPrev"
      @continue="handleGoNext"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WordList from '@/components/WordList.vue'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import Level1Quiz from '@/components/Level1Quiz.vue'
import BackContinue from '@/components/BackContinue.vue'
import SectionDivider from '@/components/common/SectionDivider.vue'
import { useNavigation } from '@/composables/useNavigation'
import { submitAnswers, get } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import type { ProcessedMultiRoleData } from '@/adapters/multiPoleAdapter'

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

const route = useRoute()
const router = useRouter()

// 篇目ID（路由参数）
const poemId = route.params.id as string

// 将路由参数 id（数字）转换为 wenId 格式
const wenId = computed(() => {
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

// 组件引用
const audioPlayer = ref<InstanceType<typeof MultiRoleReading> | null>(null)

// 测验题目数据（用于提交答案时获取正确答案）
const quizData = ref<Level1QuizItem[]>([])

// 是否正在提交答案
const isSubmitting = ref(false)

// 使用导航composable（新版，需要传入router）
const { goNext, goPrev } = useNavigation('stepone', poemId)

/**
 * 获取学生ID（优先从authStore，其次从studentStore）
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
 * 获取学生姓名
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
      console.warn('[StepOneView] 获取学生姓名失败:', error)
    }
  }
  return ''
}

/**
 * 提交答案到后端
 */
async function submitAnswersToBackend(answers: Record<number, number>) {
  const studentId = getStudentId()
  if (!studentId) {
    console.warn('[StepOneView] 未登录，跳过后端提交')
    return
  }

  if (!quizData.value.length) {
    console.warn('[StepOneView] 无题目数据，跳过后端提交')
    return
  }

  try {
    isSubmitting.value = true

    // 构建题目信息（包含正确答案和题目ID）
    const questions = quizData.value.map((quiz, index) => ({
      id: `${wenId.value}_level1_q${quiz.question_number || index + 1}`,
      correctAnswer: quiz.correct_answer,
    }))

    // 构建答案映射
    const answerMap: Record<string, number> = {}
    Object.entries(answers).forEach(([index, answer]) => {
      const quiz = quizData.value[parseInt(index)]
      if (quiz) {
        const key = `${wenId.value}_level1_q${quiz.question_number || parseInt(index) + 1}`
        answerMap[key] = answer
      }
    })

    const studentName = await getStudentName()

    // 提交到后端
    await submitAnswers({ answers: answerMap, questions }, wenId.value, studentId, studentName)

    console.log('[StepOneView] 答题数据已成功提交到后端')
  } catch (error) {
    console.error('[StepOneView] 答案提交失败:', error)
  } finally {
    isSubmitting.value = false
  }
}

// 导航函数包装
function handleGoNext() {
  goNext(router)
}

function handleGoPrev() {
  goPrev(router)
}

// MultiRoleReading 事件处理
function handleAudioLoadSuccess(data: ProcessedMultiRoleData) {
  console.log('[StepOneView] 音频数据加载成功:', data)
}

function handleAudioLoadError(error: string) {
  console.error('[StepOneView] 音频数据加载失败:', error)
}

function handleSegmentChange(index: number) {
  console.log('[StepOneView] 当前段落切换到:', index)
}

// Level1Quiz 事件处理
function handleQuizLoadSuccess(data: Level1QuizItem[]) {
  quizData.value = data
  console.log('[StepOneView] 测验题目加载成功:', data.length, '道题')
}

function handleQuizLoadError(error: string) {
  console.error('[StepOneView] 测验题目加载失败:', error)
}

function handleQuizSubmit(answers: Record<number, number>) {
  console.log('[StepOneView] 测验答案已提交:', answers)
  // 提交答案到后端
  submitAnswersToBackend(answers)
}

function handleQuizComplete(result: { correct: number; total: number }) {
  console.log('[StepOneView] 测验完成:', result)
}
</script>

<style scoped>
.annotated-segment-view {
  padding: 1rem;
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

/* 课文注释区域 */
.annotated-section {
  margin-bottom: 1rem;
}

/* 音频区域 */
.audio-section {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  position: relative;
  min-height: 200px;
}

/* 测验区域 */
.quiz-section {
  background-color: #ffffff;
  border-radius: 0.5rem;
  padding: 0.5rem 0;
}

/* 加载覆盖层 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(249, 250, 251, 0.95);
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #6b7280;
  font-size: 0.875rem;
}

/* 错误覆盖层 */
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(249, 250, 251, 0.95);
  z-index: 10;
  padding: 1rem;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-message {
  color: #dc2626;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.error-detail {
  color: #6b7280;
  font-size: 0.875rem;
  text-align: center;
  margin-bottom: 1rem;
}

.retry-btn {
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #2563eb;
}
</style>
