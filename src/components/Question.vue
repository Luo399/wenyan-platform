<!-- eslint-disable vue/multi-word-component-names -->
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
    <Options
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
import Options, { type Option, type OptionsType } from './Options.vue'
import { submitAnswers, ApiError } from '@/utils/api'
import { useStudentStore } from '@/stores/student'
import { storeToRefs } from 'pinia'

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
    const stringUserAnswer = String(userAnswer ?? '')
    const stringCorrect = String(correct ?? '')
    return stringUserAnswer === stringCorrect
  } else {
    if (!Array.isArray(userAnswer) || !Array.isArray(correct)) {
      return false
    }
    if (userAnswer.length !== correct.length) {
      return false
    }
    const stringCorrect = correct.map((item) => String(item))
    return userAnswer.every((item) => stringCorrect.includes(String(item)))
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
      answers: { [props.question.id]: selectedAnswer.value },
      questions: [{ id: props.question.id, correctAnswer: props.question.correctAnswer }],
    }

    await submitAnswers(submitData, props.question.wenId, studentId.value, undefined, 30000)

    isCorrect.value = compareAnswers()
    isSubmitted.value = true
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      submitError.value = error.message
    } else if (error instanceof Error) {
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
.question-container {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background-color: #fff;
}
.question-container.submitted {
  border-color: #e5e7eb;
}
.question-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.question-seq {
  font-weight: 600;
  color: #374151;
}
.question-type {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background-color: #dbeafe;
  color: #1d4ed8;
}
.result-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
}
.result-badge.correct {
  background-color: #dcfce7;
  color: #16a34a;
}
.result-badge.wrong {
  background-color: #fee2e2;
  color: #dc2626;
}
.question-text {
  font-size: 1rem;
  line-height: 1.5;
  margin-bottom: 1rem;
  color: #111827;
}
.question-image {
  margin-top: 1rem;
}
.question-image img {
  max-width: 100%;
  border-radius: 0.375rem;
}
.question-audio {
  margin-top: 1rem;
}
.question-audio audio {
  width: 100%;
}
.action-area {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}
.submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}
.submit-btn:hover:not(:disabled) {
  background-color: #2563eb;
}
.submit-btn.disabled,
.submit-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}
.correct-answer {
  margin-top: 1rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  background-color: #fef3c7;
}
.correct-answer .label {
  font-weight: 600;
  color: #92400e;
}
.correct-answer .value {
  color: #b45309;
}
.submit-error {
  margin-top: 0.5rem;
  color: #dc2626;
  font-size: 0.875rem;
}
.spinner {
  width: 14px;
  height: 14px;
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
</style>
