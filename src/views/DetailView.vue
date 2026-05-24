<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Question, { type QuestionData } from '../components/Question.vue'
import StudentDisplay from '@/components/StudentDisplay.vue'
import { useStudentStore } from '@/stores/student'
import { storeToRefs } from 'pinia'
import { submitAnswers, ApiError } from '@/utils/api'

const route = useRoute()
const router = useRouter()
const articleId = route.params.id ?? ''

// 获取学号状态
const studentStore = useStudentStore()
const { studentId, isLoggedIn } = storeToRefs(studentStore)

// 提交状态
const showLoginModal = ref(false)
const showResultModal = ref(false)
const submitMessage = ref('')
const submitSuccess = ref(false)
const isSubmitting = ref(false)
const submitResult = ref<{
  questionCount?: number
  totalScore?: number
  avgScore?: number
}>({})

// 收集答案
const answers = ref<Record<string, string | number | (string | number)[]>>({})

// 课文ID（用于API提交）
const wenId = `WEN_${String(articleId).padStart(2, '0')}`

function getArticleById(id: number) {
  const articlesMap: Record<number, { title: string; content: string }> = {
    1: { title: '论语·学而篇', content: '学而时习之，不亦说乎？...' },
    2: { title: '孟子·梁惠王上', content: "孟子见梁惠王。王曰：'叟！不远千里而来，亦将有以利吾国乎？'..." },
    3: { title: '劝学', content: '君子曰：学不可以已。青，取之于蓝，而青于蓝；冰，水为之，而寒于水。' },
  }
  return articlesMap[Number(id)] || { title: '未知篇目', content: '暂无内容' }
}

const article = getArticleById(Number(articleId))

// 示例题目数据
const questions: QuestionData[] = [
  {
    id: 'WEN_01_Q1',
    wenId: 'WEN_01',
    questionSeq: 1,
    text: '斯是陋室，惟吾德馨中的馨字是什么意思？',
    type: 'radio',
    options: [
      { id: 'A', label: '散布很远的香气' },
      { id: 'B', label: '温馨' },
      { id: 'C', label: '德行' },
      { id: 'D', label: '名声' },
    ],
    correctAnswer: 'A',
    audioUrl: null,
    imageUrl: null,
  },
  {
    id: 'WEN_01_Q2',
    wenId: 'WEN_01',
    questionSeq: 2,
    text: '下列哪一项不是《陋室铭》中提到的生活场景？',
    type: 'checkbox',
    options: [
      { id: 'A', label: '调素琴' },
      { id: 'B', label: '阅金经' },
      { id: 'C', label: '饮酒赋诗' },
      { id: 'D', label: '谈笑有鸿儒' },
    ],
    correctAnswer: ['A', 'C'],
    audioUrl: null,
    imageUrl: null,
  },
]

/**
 * 处理答案变化
 */
function handleAnswerChange(questionId: string, answer: string | number | (string | number)[]) {
  answers.value[questionId] = answer
}

/**
 * 提交答案到后端
 */
async function handleSubmit() {
  // 检测是否登录
  if (!isLoggedIn.value) {
    submitMessage.value = '请先登录后再提交答案'
    submitSuccess.value = false
    showLoginModal.value = true
    return
  }

  // 检查是否已回答所有题目
  const unanswered = questions.filter(q => answers.value[q.id] === undefined)
  if (unanswered.length > 0) {
    submitMessage.value = `请先回答所有题目，还有 ${unanswered.length} 题未答`
    submitSuccess.value = false
    return
  }

  // 设置提交中状态
  isSubmitting.value = true
  submitMessage.value = '正在提交...'

  try {
    // 构建提交数据
    const submitData = {
      studentId: studentId.value,
      wenId: wenId,
      submittedAt: new Date().toISOString(),
      answers: answers.value,
      questions: questions.map(q => ({
        id: q.id,
        correctAnswer: q.correctAnswer
      }))
    }

    // 调用 API 提交
    const response = await submitAnswers(submitData)

    if (response.success) {
      submitSuccess.value = true
      submitMessage.value = '答案提交成功！'
      submitResult.value = {
        questionCount: response.data?.questionCount,
        totalScore: response.data?.totalScore,
        avgScore: response.data?.avgScore
      }
      showResultModal.value = true
    } else {
      submitSuccess.value = false
      submitMessage.value = response.message || '提交失败'
    }
  } catch (error) {
    submitSuccess.value = false
    if (error instanceof ApiError) {
      // 处理不同类型的错误
      switch (error.errorCode) {
        case 'TIMEOUT':
          submitMessage.value = '请求超时，请稍后重试'
          break
        case 'NETWORK_ERROR':
          submitMessage.value = '网络连接失败，请检查网络后重试'
          break
        case 'INVALID_STUDENT_ID':
          submitMessage.value = '学号格式不正确'
          break
        case 'INVALID_REQUEST':
          submitMessage.value = '请求数据格式错误'
          break
        case 'DATABASE_ERROR':
          submitMessage.value = '服务器数据库错误，请稍后重试'
          break
        default:
          submitMessage.value = `提交失败: ${error.message}`
      }
    } else {
      submitMessage.value = '提交失败，未知错误'
    }
  } finally {
    isSubmitting.value = false
  }
}

/**
 * 关闭登录弹窗
 */
function handleCloseLoginModal() {
  showLoginModal.value = false
  submitMessage.value = ''
}

/**
 * 关闭结果弹窗
 */
function handleCloseResultModal() {
  showResultModal.value = false
  submitMessage.value = ''
}

/**
 * 重试提交
 */
function handleRetrySubmit() {
  submitMessage.value = ''
  handleSubmit()
}
</script>

<template>
  <div class="detail-view">
    <h1>{{ article.title }}</h1>
    <p>{{ article.content }}</p>

    <div class="questions-section">
      <h2>课后练习</h2>
      <div v-for="question in questions" :key="question.id" class="question-wrapper">
        <Question :question="question" @answer-change="handleAnswerChange" />
      </div>

      <!-- 提交按钮 -->
      <div class="submit-section">
        <button class="submit-btn" @click="handleSubmit" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="spinner"></span>
          {{ isSubmitting ? '提交中...' : '提交答案' }}
        </button>
        <p v-if="submitMessage && !showResultModal" :class="['submit-message', { success: submitSuccess }]">
          {{ submitMessage }}
          <button v-if="!submitSuccess" class="retry-btn" @click="handleRetrySubmit">重试</button>
        </p>
      </div>
    </div>

    <button class="back-btn" @click="$router.back()">返回列表</button>

    <!-- 未登录提示弹窗 -->
    <div v-if="showLoginModal" class="modal-overlay" @click.self="handleCloseLoginModal">
      <div class="modal-content">
        <h3>提示</h3>
        <p>{{ submitMessage }}</p>
        <div class="modal-buttons">
          <button class="close-btn" @click="handleCloseLoginModal">关闭</button>
          <StudentDisplay />
        </div>
      </div>
    </div>

    <!-- 提交成功弹窗 -->
    <div v-if="showResultModal" class="modal-overlay" @click.self="handleCloseResultModal">
      <div class="modal-content result-modal">
        <div class="success-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <h3>提交成功</h3>
        <p>{{ submitMessage }}</p>
        
        <div v-if="submitResult" class="result-stats">
          <div class="stat-item">
            <span class="stat-label">答题数量</span>
            <span class="stat-value">{{ submitResult.questionCount }} 题</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总得分</span>
            <span class="stat-value">{{ submitResult.totalScore }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均分</span>
            <span class="stat-value">{{ submitResult.avgScore }} 分</span>
          </div>
        </div>

        <p class="submit-time">提交时间：{{ new Date().toLocaleString('zh-CN') }}</p>
        
        <div class="modal-buttons">
          <button class="close-btn" @click="handleCloseResultModal">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.questions-section {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.questions-section h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: #374151;
}

.question-wrapper {
  margin-bottom: 1.5rem;
}

.submit-section {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px dashed #e5e7eb;
}

.submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 2rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.submit-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

/* 加载动画 */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.submit-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.375rem;
  background-color: #fef2f2;
  color: #dc2626;
  font-size: 0.875rem;
}

.submit-message.success {
  background-color: #f0fdf4;
  color: #16a34a;
}

.retry-btn {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.back-btn {
  margin-top: 2rem;
  padding: 0.5rem 1rem;
  background-color: #e5e7eb;
  color: #374151;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.back-btn:hover {
  background-color: #d1d5db;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  min-width: 300px;
}

.modal-content h3 {
  margin-bottom: 0.5rem;
  color: #374151;
}

.modal-content p {
  color: #6b7280;
  margin-bottom: 1rem;
}

.modal-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.close-btn {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

/* 结果弹窗特殊样式 */
.result-modal {
  text-align: center;
}

.success-icon {
  font-size: 3rem;
  color: #16a34a;
  margin-bottom: 1rem;
}

.result-stats {
  display: flex;
  justify-content: space-around;
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: bold;
  color: #374151;
}

.submit-time {
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>
