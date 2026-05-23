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
        :class="{ disabled: isSubmitted }"
        @click="submitAnswer"
        :disabled="isSubmitted"
      >
        {{ isSubmitted ? '已提交' : '提交答案' }}
      </button>
      <button v-if="isSubmitted" class="reset-btn" @click="resetAnswer">重新答题</button>
    </div>
    <div v-if="isSubmitted && !isCorrect" class="correct-answer">
      <span class="label">正确答案：</span>
      <span class="value">{{ formatCorrectAnswer() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Options, { type Option, type OptionsType } from './Options.vue'

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
  (
    e: 'answer-submit',
    questionId: string,
    isCorrect: boolean,
    selectedAnswer: string | number | (string | number)[],
    correctAnswer: string | number | (string | number)[],
  ): void
}>()

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

function submitAnswer() {
  isCorrect.value = compareAnswers()
  isSubmitted.value = true
  emit(
    'answer-submit',
    props.question.id,
    isCorrect.value,
    selectedAnswer.value,
    props.question.correctAnswer,
  )
}

function resetAnswer() {
  isSubmitted.value = false
  isCorrect.value = false
  if (props.question.type === 'radio') {
    selectedAnswer.value = ''
  } else {
    selectedAnswer.value = []
  }
  emit('update:modelValue', selectedAnswer.value)
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
.reset-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #374151;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}
.reset-btn:hover {
  background-color: #f3f4f6;
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
</style>
