<!--
  QuizCard.vue - 可复用的测验卡片组件

  功能说明：
  - 提供选项选择界面，支持单选模式
  - 支持提交状态控制，提交后锁定选项
  - 通过自定义事件发射用户选择

  使用示例：
  <QuizCard
    :data="quizData"
    :submitted="false"
    @submit="handleSubmit"
  />

  数据结构：
  quizData = {
    question_id: string,
    question_type: 'radio' | 'checkbox',
    question_text: string,
    options: string[],
    correct_answer?: number | number[],
    explanation?: string,
    difficulty?: string
  }
-->
<template>
  <div class="quiz-card">
    <!-- 卡片头部 -->
    <div class="quiz-card-header" v-if="data.difficulty">
      <span class="quiz-difficulty" :class="`difficulty-${data.difficulty?.toLowerCase()}`">
        {{ data.difficulty }}
      </span>
    </div>

    <!-- 题目内容 -->
    <div class="quiz-card-body">
      <div class="question-text">{{ data.question_text }}</div>

      <!-- 选项列表 -->
      <div class="options-list">
        <button
          v-for="(option, index) in data.options"
          :key="index"
          class="option-btn"
          :class="{
            selected: selectedAnswer === index,
            locked: submitted,
            correct: submitted && isCorrectOption(index),
            wrong: submitted && isWrongOption(index),
          }"
          :disabled="submitted"
          @click="selectOption(index)"
        >
          <span class="option-label">{{ String.fromCharCode(65 + index) }}</span>
          <span class="option-text">{{ option }}</span>
          <span class="option-icon" v-if="submitted">
            <i v-if="isCorrectOption(index)" class="fas fa-check"></i>
            <i v-else-if="isWrongOption(index)" class="fas fa-times"></i>
          </span>
        </button>
      </div>

      <!-- 答案解析（提交后显示） -->
      <div class="explanation-box" v-if="submitted && data.explanation">
        <div class="explanation-header">
          <i class="fas fa-info-circle"></i>
          <span>答案解析</span>
        </div>
        <p class="explanation-text">{{ data.explanation }}</p>
      </div>
    </div>

    <!-- 卡片底部（未提交时显示） -->
    <div class="quiz-card-footer" v-if="!submitted">
      <button class="submit-btn" :disabled="selectedAnswer === null" @click="handleSubmit">
        <i class="fas fa-check"></i>
        提交答案
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

/**
 * 题目数据类型定义
 */
interface QuizCardData {
  question_id: string
  question_type?: 'radio' | 'checkbox'
  question_text: string
  options: string[]
  correct_answer?: number | number[]
  explanation?: string
  difficulty?: string
}

/**
 * 组件属性定义
 */
const props = defineProps<{
  /** 题目数据 */
  data: QuizCardData
  /** 提交状态 */
  submitted: boolean
}>()

/**
 * 自定义事件定义
 */
const emit = defineEmits<{
  /** 提交答案事件 */
  (e: 'submit', answer: number | null): void
}>()

/**
 * 当前选中的答案索引
 */
const selectedAnswer = ref<number | null>(null)

/**
 * 判断指定选项是否为正确答案
 */
const isCorrectOption = (index: number): boolean => {
  if (props.data.correct_answer === undefined) return false

  if (Array.isArray(props.data.correct_answer)) {
    return props.data.correct_answer.includes(index)
  }
  return props.data.correct_answer === index
}

/**
 * 判断指定选项是否为错误答案（用户选中但不正确）
 */
const isWrongOption = (index: number): boolean => {
  if (props.data.correct_answer === undefined) return false
  return selectedAnswer.value === index && !isCorrectOption(index)
}

/**
 * 选择选项
 */
const selectOption = (index: number) => {
  if (props.submitted) return

  // 根据题目类型处理选择
  const questionType = props.data.question_type || 'radio'

  if (questionType === 'radio') {
    // 单选题：直接替换选中项
    selectedAnswer.value = index
  }
  // 多选逻辑可在此扩展
}

/**
 * 处理提交
 */
const handleSubmit = () => {
  if (selectedAnswer.value === null || props.submitted) return

  // 发射提交事件
  emit('submit', selectedAnswer.value)
}

/**
 * 重置组件状态（供父组件调用）
 */
const reset = () => {
  selectedAnswer.value = null
}

// 暴露重置方法给父组件
defineExpose({ reset })
</script>

<style scoped>
.quiz-card {
  background: white;
  border-radius: 1rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

/* 卡片头部 */
.quiz-card-header {
  display: flex;
  justify-content: flex-end;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
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

/* 卡片主体 */
.quiz-card-body {
  padding: 1.5rem;
}

.question-text {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.6;
  color: #1e293b;
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 0.75rem;
  border-left: 4px solid #667eea;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
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

.option-btn.locked {
  cursor: not-allowed;
  opacity: 0.8;
}

.option-btn.correct {
  border-color: #22c55e;
  background: #f0fdf4;
}

.option-btn.wrong {
  border-color: #ef4444;
  background: #fef2f2;
}

.option-label {
  width: 24px;
  height: 24px;
  background: #e2e8f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
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
  font-size: 0.9rem;
  color: #475569;
}

.option-icon {
  font-size: 1rem;
}

.option-btn.correct .option-icon {
  color: #22c55e;
}

.option-btn.wrong .option-icon {
  color: #ef4444;
}

/* 解析框 */
.explanation-box {
  margin-top: 1.5rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 0.75rem;
  border-left: 4px solid #3b82f6;
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e40af;
}

.explanation-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #1e3a8a;
}

/* 卡片底部 */
.quiz-card-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.submit-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 响应式调整 */
@media (max-width: 767px) {
  .quiz-card-body {
    padding: 1rem;
  }

  .question-text {
    padding: 0.75rem 1rem;
  }

  .option-btn {
    padding: 0.875rem 1rem;
  }
}
</style>
