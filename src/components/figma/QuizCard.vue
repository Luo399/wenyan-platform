<!--
  QuizCard - 单题纯展示卡片（figma 渲染层）

  约束：
  - 不判分、不提交、不持有「已提交」状态；
  - 只接收父级传入的 quiz / selected / submitted / verdict；
  - 只向父级发 select / submit 事件。
-->
<template>
  <div class="fg-quiz-card" :class="{ 'is-invalid': quiz.invalid }">
    <div v-if="config.display.showDifficulty && quiz.difficulty" class="fg-quiz-meta">
      <span class="fg-quiz-difficulty" :class="`difficulty-${quiz.difficulty.toLowerCase()}`">
        {{ quiz.difficulty }}
      </span>
    </div>

    <div class="fg-quiz-body">
      <p class="fg-quiz-stem">{{ quiz.stem }}</p>

      <p v-if="quiz.invalid" class="fg-quiz-invalid">{{ config.texts.invalidQuestion }}</p>

      <div v-else class="fg-quiz-options">
        <button
          v-for="option in quiz.options"
          :key="option.key"
          type="button"
          class="fg-option"
          :class="optionClass(option.key)"
          :disabled="submitted"
          @click="$emit('select', option.key)"
        >
          <span class="fg-option-key">{{ option.key }}</span>
          <span class="fg-option-text">{{ option.text }}</span>
          <span v-if="submitted" class="fg-option-icon">
            <i v-if="quiz.answerKeys.includes(option.key)" class="fas fa-check"></i>
            <i v-else-if="selected.includes(option.key)" class="fas fa-times"></i>
          </span>
        </button>
      </div>

      <div v-if="showExplanation" class="fg-explanation">
        <div class="fg-explanation-title">
          <i class="fas fa-info-circle"></i>
          <span>答案解析</span>
        </div>
        <p class="fg-explanation-text">{{ quiz.explanation }}</p>
      </div>
    </div>

    <div v-if="!submitted && !quiz.invalid" class="fg-quiz-footer">
      <button
        type="button"
        class="fg-submit-btn"
        :disabled="!hasSelection"
        @click="$emit('submit')"
      >
        <i class="fas fa-check"></i>
        {{ config.texts.submit }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { QuizModel } from '@/adapters/pageAdapter'
import type { QuizInteractionConfig } from '@/config/quizInteraction'

interface Props {
  quiz: QuizModel
  /** 当前选中项（展示键） */
  selected: string[]
  /** 是否已成功提交 */
  submitted: boolean
  /** 判定结果，仅用于展示样式；渲染器不参与判分 */
  verdict: 'correct' | 'wrong' | null
  config: QuizInteractionConfig
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'select', key: string): void
  (e: 'submit'): void
}>()

const hasSelection = computed(() => props.selected.length > 0)

const showExplanation = computed(() => {
  const mode = props.config.display.showExplanation
  if (mode === 'always') return true
  if (mode === 'never') return false
  return props.submitted
})

/** 选项视觉状态：选中 / 正确 / 错误，全部由父级传入的状态派生 */
function optionClass(key: string): Record<string, boolean> {
  const isSelected = props.selected.includes(key)
  const isAnswer = props.quiz.answerKeys.includes(key)
  return {
    selected: isSelected && !props.submitted,
    correct: props.submitted && isAnswer,
    wrong: props.submitted && isSelected && !isAnswer,
  }
}
</script>

<style scoped>
.fg-quiz-card {
  background: var(--color-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  font-family: var(--font-family-serif);
}

.fg-quiz-card.is-invalid {
  border: var(--border-width-hairline) solid var(--color-primary);
}

.fg-quiz-meta {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-highlight);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
}

.fg-quiz-difficulty {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 20px;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

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

.fg-quiz-body {
  padding: var(--spacing-lg);
}

.fg-quiz-stem {
  margin: 0 0 var(--spacing-lg) 0;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-left: var(--border-width-thin) solid var(--color-primary);
  border-radius: var(--radius-small);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  line-height: 1.6;
  color: var(--color-text);
}

.fg-quiz-invalid {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-small);
}

.fg-quiz-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.fg-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-small);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.fg-option:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-bg-highlight);
}

.fg-option.selected {
  border-color: var(--color-primary);
  background: var(--color-bg-highlight);
}

.fg-option:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.fg-option.correct {
  border-color: #22c55e;
  background: #f0fdf4;
}

.fg-option.wrong {
  border-color: var(--color-primary);
  background: #fef2f2;
}

.fg-option-key {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-placeholder);
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.fg-option.selected .fg-option-key,
.fg-option.wrong .fg-option-key {
  background: var(--color-primary);
  color: var(--color-white);
}

.fg-option.correct .fg-option-key {
  background: #22c55e;
  color: var(--color-white);
}

.fg-option-text {
  flex: 1;
  font-size: var(--font-size-body);
  color: var(--color-text);
}

.fg-option-icon {
  font-size: var(--font-size-body);
}

.fg-option.correct .fg-option-icon {
  color: #22c55e;
}

.fg-option.wrong .fg-option-icon {
  color: var(--color-primary);
}

.fg-explanation {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-left: var(--border-width-thin) solid var(--color-primary);
  border-radius: var(--radius-small);
}

.fg-explanation-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.fg-explanation-text {
  margin: 0;
  font-size: var(--font-size-small);
  line-height: 1.6;
  color: var(--color-text);
}

.fg-quiz-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-top: var(--border-width-hairline) solid var(--color-placeholder);
}

.fg-submit-btn {
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

.fg-submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-small);
}

.fg-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .fg-quiz-body {
    padding: var(--spacing-md);
  }

  .fg-quiz-stem,
  .fg-option {
    padding: var(--spacing-sm) var(--spacing-md);
  }
}
</style>
