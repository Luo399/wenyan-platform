<template>
  <AdaptQuiz
    :quizzes="adaptedQuizzes"
    :title="title"
    @answer="handleAnswer"
    @complete="handleComplete"
    @error="handleError"
    @quiz-submitted="handleQuizSubmitted"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AdaptQuiz from './AdaptQuiz.vue'
import { adaptBlockQuizToQuizItem, isValidQuizItem, type QuizItem } from '@/adapters/quizAdapter'

interface Props {
  text_id?: string
  question_id?: string
  module?: string
  question_number?: number | string
  question_text?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  audio_file?: string
  difficulty?: string
  pre_dialog?: string
  correct_answer?: number | string | null
  explanation?: string
  question_type?: string

  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '阅读理解',
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

const adaptedQuizzes = computed<QuizItem[]>(() => {
  const quizItem = adaptBlockQuizToQuizItem(
    {
      text_id: props.text_id,
      question_id: props.question_id,
      module: props.module,
      question_number: props.question_number,
      question_text: props.question_text,
      option_a: props.option_a,
      option_b: props.option_b,
      option_c: props.option_c,
      option_d: props.option_d,
      audio_file: props.audio_file,
      difficulty: props.difficulty,
      correct_answer: props.correct_answer,
      explanation: props.explanation,
      question_type: props.question_type,
    },
    props.text_id || '',
    props.question_id || '',
  )

  return isValidQuizItem(quizItem) ? [quizItem] : []
})

function handleAnswer(
  quiz: QuizItem,
  answer: string,
  isCorrect: boolean,
  questionId?: string,
  module?: string,
  correctAnswer?: string | number | (string | number)[],
) {
  emit('answer', quiz, answer, isCorrect, questionId, module, correctAnswer)
}

function handleComplete(results: { quiz: QuizItem; answer: string; isCorrect: boolean }[]) {
  emit('complete', results)
}

function handleError(error: string) {
  emit('error', error)
}

function handleQuizSubmitted() {
  emit('quiz-submitted')
}
</script>
