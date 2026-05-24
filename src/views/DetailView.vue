<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Question, { type QuestionData } from '../components/Question.vue'
import StudentDisplay from '@/components/StudentDisplay.vue'
import { useStudentStore } from '@/stores/student'
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const articleId = route.params.id ?? ''

// 获取学号状态
const studentStore = useStudentStore()
const { studentId, isLoggedIn } = storeToRefs(studentStore)

// 提交状态
const showLoginModal = ref(false)
const submitMessage = ref('')
const submitSuccess = ref(false)

// 收集答案
const answers = ref<Record<string, string | number | (string | number)[]>>({})

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
 * 提交答案
 */
function handleSubmit() {
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

  // 模拟提交
  console.log('学号:', studentId.value)
  console.log('答案:', answers.value)

  submitMessage.value = `学号 ${studentId.value}，答案已提交！`
  submitSuccess.value = true
}

/**
 * 关闭登录弹窗
 */
function handleCloseLoginModal() {
  showLoginModal.value = false
  submitMessage.value = ''
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
        <button class="submit-btn" @click="handleSubmit">提交答案</button>
        <p v-if="submitMessage" :class="['submit-message', { success: submitSuccess }]">
          {{ submitMessage }}
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
  padding: 0.75rem 2rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover {
  background-color: #2563eb;
}

.submit-message {
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
</style>
