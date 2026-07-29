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
/* 测验卡片容器：30px 圆角 + 设计 token 阴影 */
.quiz-card {
  background: var(--color-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  font-family: var(--font-family-serif);
}

/* 卡片头部 */
.quiz-card-header {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-highlight);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
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

/* 卡片主体 */
.quiz-card-body {
  padding: var(--spacing-lg);
}

.question-text {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  line-height: 1.6;
  color: var(--color-text);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  border-left: var(--border-width-thin) solid var(--color-primary);
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
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-small);
  cursor: pointer;
  transition: all 0.2s ease;
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

.option-btn.locked {
  cursor: not-allowed;
  opacity: 0.8;
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

.option-label {
  width: 24px;
  height: 24px;
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
  font-size: var(--font-size-body);
  color: var(--color-text);
}

.option-icon {
  font-size: var(--font-size-body);
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
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  border-left: var(--border-width-thin) solid var(--color-primary);
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

/* 卡片底部 */
.quiz-card-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-top: var(--border-width-hairline) solid var(--color-placeholder);
}

/* 提交按钮：朱红底色 + 橄榄绿边框 + 50px 圆角 */
.submit-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.2s ease;
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

/* 响应式调整 */
@media (max-width: 767px) {
  .quiz-card-body {
    padding: var(--spacing-md);
  }

  .question-text {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .option-btn {
    padding: var(--spacing-sm) var(--spacing-md);
  }
}
</style>
