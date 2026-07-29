<template>
  <div class="question-container" :class="{ submitted: isSubmitted }">
    <div class="question-header">
      <span class="question-seq">第 {{ question.questionSeq }} 题</span>
      <span class="question-type">{{ question.type === 'radio' ? '单选' : '多选' }}</span>
      <span v-if="isSubmitted" class="result-badge" :class="isCorrect ? 'correct' : 'wrong'">
        {{ isCorrect ? '正确' : '错误' }}
      </span>
    </div>
    <div class="question-text">{{ question.text }}</div>
    <QuizOptions
      :options="question.options"
      :type="question.type"
      v-model="selectedAnswer"
      :disabled="isSubmitted"
      @change="handleAnswerChange"
    />
    <div v-if="question.imageUrl" class="question-image">
      <img :src="question.imageUrl" :alt="'题目图片'" />
    </div>
    <div v-if="question.audioUrl" class="question-audio">
      <audio :src="question.audioUrl" controls />
    </div>
    <div class="action-area">
      <button
        class="submit-btn"
        :class="{ disabled: isSubmitted || isSubmitting }"
        @click="submitAnswer"
        :disabled="isSubmitted || isSubmitting"
      >
        <span v-if="isSubmitting" class="spinner"></span>
        {{ isSubmitting ? '提交中...' : isSubmitted ? '已提交' : '提交答案' }}
      </button>
    </div>
    <div v-if="isSubmitted && !isCorrect" class="correct-answer">
      <span class="label">正确答案：</span>
      <span class="value">{{ formatCorrectAnswer() }}</span>
    </div>
    <p v-if="submitError" class="submit-error">{{ submitError }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import QuizOptions, { type Option, type OptionsType } from './QuizOptions.vue'
import { submitAnswers } from '@/services/apiService'
import { ApiError } from '@/utils/api'
import { useStudentStore } from '@/stores/student'

export interface QuestionData {
  id: string
  wenId: string
  questionSeq: number
  text: string
  type: OptionsType
  options: Option[]
  correctAnswer: string | number | (string | number)[]
  audioUrl?: string | null
  imageUrl?: string | null
}

const props = defineProps<{
  question: QuestionData
  modelValue?: string | number | (string | number)[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | (string | number)[]): void
  (e: 'answer-change', questionId: string, answer: string | number | (string | number)[]): void
}>()

const studentStore = useStudentStore()
const { studentId, isLoggedIn } = storeToRefs(studentStore)

const getInitialValue = (): string | number | (string | number)[] => {
  if (props.question.type === 'radio') {
    return props.modelValue ?? ''
  } else {
    return Array.isArray(props.modelValue) ? [...props.modelValue] : []
  }
}

const selectedAnswer = ref<string | number | (string | number)[]>(getInitialValue())
const isSubmitted = ref(false)
const isCorrect = ref(false)
const isSubmitting = ref(false)
const submitError = ref('')

watch(
  () => props.modelValue,
  (newVal) => {
    if (props.question.type === 'radio') {
      selectedAnswer.value = newVal ?? ''
    } else {
      selectedAnswer.value = Array.isArray(newVal) ? [...newVal] : []
    }
  },
)

function handleAnswerChange(value: string | number | (string | number)[]) {
  emit('update:modelValue', value)
  emit('answer-change', props.question.id, value)
}

function isAnswerEmpty(): boolean {
  if (props.question.type === 'radio') {
    return (
      selectedAnswer.value === '' ||
      selectedAnswer.value === undefined ||
      selectedAnswer.value === null
    )
  } else {
    return !Array.isArray(selectedAnswer.value) || selectedAnswer.value.length === 0
  }
}

function compareAnswers(): boolean {
  if (isAnswerEmpty()) {
    return false
  }

  const userAnswer = selectedAnswer.value
  const correct = props.question.correctAnswer

  if (props.question.type === 'radio') {
    return userAnswer === correct
  } else {
    if (!Array.isArray(userAnswer) || !Array.isArray(correct)) {
      return false
    }
    if (userAnswer.length !== correct.length) {
      return false
    }
    return userAnswer.every((item) => correct.includes(item))
  }
}

async function submitAnswer() {
  // 检查登录状态
  if (!isLoggedIn.value) {
    submitError.value = '请先登录'
    return
  }

  // 检查是否已选择答案
  if (isAnswerEmpty()) {
    submitError.value = '请先选择答案'
    return
  }

  submitError.value = ''
  isSubmitting.value = true

  try {
    const submitData = {
      studentId: studentId.value,
      wenId: props.question.wenId,
      submittedAt: new Date().toISOString(),
      answers: { [props.question.id]: selectedAnswer.value },
      questions: [{ id: props.question.id, correctAnswer: props.question.correctAnswer }],
    }

    await submitAnswers(
      {
        answers: { [props.question.id]: selectedAnswer.value },
        questions: [{ id: props.question.id, correctAnswer: props.question.correctAnswer }],
      },
      props.question.wenId,
      studentId.value,
      undefined,
      30000,
    )

    isCorrect.value = compareAnswers()
    isSubmitted.value = true
  } catch (error) {
    if (error instanceof ApiError) {
      submitError.value = error.message
    } else {
      submitError.value = '提交失败'
    }
  } finally {
    isSubmitting.value = false
  }
}

function formatCorrectAnswer(): string {
  const answer = props.question.correctAnswer
  if (Array.isArray(answer)) {
    return answer.join('、')
  }
  return String(answer)
}
</script>

<style scoped>
/* 题目容器 */
.question-container {
  padding: var(--spacing-md);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  background-color: var(--color-white);
  font-family: var(--font-family-serif);
}
.question-container.submitted {
  border-color: var(--color-placeholder);
}
.question-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  flex-wrap: wrap;
}
.question-seq {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.question-type {
  font-size: var(--font-size-small);
  padding: 0.125rem var(--spacing-xs);
  border-radius: var(--radius-small);
  background-color: var(--color-bg-highlight);
  color: var(--color-primary);
}
.result-badge {
  font-size: var(--font-size-small);
  padding: 0.125rem var(--spacing-xs);
  border-radius: var(--radius-small);
  font-weight: var(--font-weight-semibold);
}
/* 正确徽章：语义色绿色 */
.result-badge.correct {
  background-color: #dcfce7;
  color: #16a34a;
}
/* 错误徽章：语义色红色 */
.result-badge.wrong {
  background-color: #fee2e2;
  color: var(--color-primary-hover);
}
.question-text {
  font-size: var(--font-size-body);
  line-height: 1.5;
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
}
.question-image {
  margin-top: var(--spacing-md);
}
.question-image img {
  max-width: 100%;
  border-radius: var(--radius-small);
}
.question-audio {
  margin-top: var(--spacing-md);
}
.question-audio audio {
  width: 100%;
}
.action-area {
  display: flex;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-md);
}
/* 提交按钮：朱红底色 + 橄榄绿边框 + 50px 圆角 */
.submit-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  background-color: var(--color-primary);
  color: var(--color-white);
  cursor: pointer;
  font-size: var(--font-size-small);
  transition: background-color 0.2s;
}
.submit-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}
.submit-btn.disabled,
.submit-btn:disabled {
  background-color: var(--color-text-secondary);
  cursor: not-allowed;
}
.correct-answer {
  margin-top: var(--spacing-md);
  padding: var(--spacing-xs);
  border-radius: var(--radius-small);
  background-color: var(--color-bg-highlight);
}
.correct-answer .label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.correct-answer .value {
  color: var(--color-text);
}
.submit-error {
  margin-top: var(--spacing-xs);
  color: var(--color-primary-hover);
  font-size: var(--font-size-small);
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-white);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
