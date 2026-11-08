<!--
  QuizListRenderer - 逐题渲染器（quiz-list 模式）

  约束：
  - 全量挂载（v-show 控制显隐，不用 v-if 销毁）；
  - 不判分、不提交、不读路由/存储；
  - 只读 snapshot + config，向上发 select / submit。
-->
<template>
  <div class="fg-quiz-list">
    <QuizProgressBar :current="snapshot.answeredCount" :total="snapshot.total" />

    <div
      v-for="(item, index) in items"
      :key="item.quiz.id"
      class="fg-quiz-item"
      v-show="isVisible(index)"
      :aria-hidden="isVisible(index) ? 'false' : 'true'"
    >
      <p v-if="showScenario(index) && item.scenario" class="fg-scenario">{{ item.scenario }}</p>

      <div v-if="config.display.showQuizNumber" class="fg-quiz-number">第 {{ index + 1 }} 题</div>

      <FigmaQuizCard
        :quiz="item.quiz"
        :selected="snapshot.selections[item.quiz.id] || []"
        :submitted="isSubmitted(item.quiz.id)"
        :verdict="verdictOf(item.quiz.id)"
        :config="config"
        @select="(key) => $emit('select', item.quiz.id, key)"
        @submit="$emit('submit', item.quiz.id)"
      />
    </div>

    <div v-if="snapshot.isCompleted" class="fg-complete-state">
      <div class="fg-complete-icon">
        <i class="fas fa-trophy"></i>
      </div>
      <h2 class="fg-complete-title">{{ config.texts.completed }}</h2>
      <p class="fg-complete-stats">
        {{ config.texts.completedStats(snapshot.correctCount, snapshot.total) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import FigmaQuizCard from '@/components/figma/QuizCard.vue'
import QuizProgressBar from '@/components/figma/QuizProgressBar.vue'
import type { QuizListItemModel } from '@/adapters/pageAdapter'
import type { QuizInteractionConfig } from '@/config/quizInteraction'
import type { QuizSnapshot } from '@/composables/useQuizSession'

interface Props {
  items: QuizListItemModel[]
  snapshot: QuizSnapshot
  config: QuizInteractionConfig
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'select', quizId: string, key: string): void
  (e: 'submit', quizId: string): void
}>()

/** 显隐：未解锁不展示；allowReview=false 时只展开当前题（旧题收起但不卸载） */
function isVisible(index: number): boolean {
  if (index < 0 || index > props.snapshot.unlockedIndex) return false
  if (props.config.display.allowReview) return true
  return index === props.snapshot.unlockedIndex
}

/** 情景文本展示范围 */
function showScenario(index: number): boolean {
  if (props.config.display.showScenario === 'none') return false
  if (props.config.display.showScenario === 'every-item') return true
  return index === 0
}

function isSubmitted(quizId: string): boolean {
  return props.snapshot.submittedIds.includes(quizId)
}

function verdictOf(quizId: string): 'correct' | 'wrong' | null {
  if (!isSubmitted(quizId)) return null
  return props.snapshot.results[quizId] ? 'correct' : 'wrong'
}
</script>

<style scoped>
.fg-quiz-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.fg-quiz-item {
  animation: fgFadeInUp 0.5s ease forwards;
}

@keyframes fgFadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fg-scenario {
  margin: 0 0 var(--spacing-lg) 0;
  padding: var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-left: var(--border-width-thin) solid var(--color-accent);
  border-radius: var(--radius-card);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  line-height: 1.8;
  color: var(--color-text);
}

.fg-quiz-number {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-highlight);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small) var(--radius-small) 0 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.fg-complete-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: var(--spacing-lg);
  padding: var(--spacing-2xl) var(--spacing-xl);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
}

.fg-complete-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--spacing-md);
  background: var(--color-border);
  border-radius: 50%;
  color: var(--color-white);
  font-size: var(--font-size-heading);
}

.fg-complete-title {
  margin: 0 0 var(--spacing-xs) 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.fg-complete-stats {
  margin: 0;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  color: var(--color-text);
}

@media (max-width: 767px) {
  .fg-scenario {
    padding: var(--spacing-md);
  }
}
</style>
