<!--
  WeakQuestionBoard.vue - 薄弱题排行

  后端已按「最终答对率升序」排好并做了同题重做去重，这里只负责呈现：
  题号、所属篇目/关卡、作答人数、答对人数、正确率、错误选项分布。

  错误选项分布（top_wrong_answers）是这张表的价值所在：
  光知道「正确率 20%」老师没法讲评，知道「多数人错选 B」才知道坑在哪。
-->
<template>
  <div class="weak-questions" data-testid="weak-questions">
    <ol v-if="questions.length > 0" class="weak-list">
      <li v-for="(item, index) in questions" :key="item.question_id" class="weak-item">
        <div class="weak-rank">{{ index + 1 }}</div>
        <div class="weak-main">
          <div class="weak-title">
            <span class="weak-level" :class="`weak-level-${item.level || 'other'}`">{{ levelWord(item.level) }}</span>
            <span class="weak-name">{{ item.title }}</span>
            <span class="weak-code">{{ item.question_id }}</span>
          </div>
          <div class="weak-meta">
            {{ item.attempted_students }} 人作答 · {{ item.correct_students }} 人答对
          </div>
          <div v-if="item.top_wrong_answers.length" class="wrong-options">
            <span class="wrong-label">错选：</span>
            <span v-for="wrong in item.top_wrong_answers" :key="wrong.answer" class="wrong-chip">
              {{ wrong.answer || '空' }} · {{ wrong.count }}
            </span>
          </div>
        </div>
        <div class="weak-accuracy">
          <div class="weak-accuracy-value">{{ formatPercent(item.accuracy) }}</div>
          <div class="weak-accuracy-track">
            <span class="weak-accuracy-fill" :style="{ width: item.accuracy + '%' }"></span>
          </div>
        </div>
      </li>
    </ol>
    <p v-else class="weak-empty">暂无满足覆盖人数门槛的题目，可放宽「最少作答人数」再看。</p>
  </div>
</template>

<script setup lang="ts">
import { formatPercent } from '@/components/charts'
import type { WeakQuestionRow } from '@/services/teacherDashboardService'

export interface WeakQuestionsProps {
  questions: WeakQuestionRow[]
}

defineProps<WeakQuestionsProps>()

/** A/B/C 在页面上说人话：第一关（字词）/第二关（句译）/第三关（理解） */
function levelWord(level: string | null): string {
  if (level === 'A') return '第一关'
  if (level === 'B') return '第二关'
  if (level === 'C') return '第三关'
  return '其他'
}
</script>

<style scoped>
.weak-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.weak-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-white);
}

.weak-rank {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-bg-highlight);
  color: var(--color-primary);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weak-main {
  flex: 1;
  min-width: 0;
}

.weak-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.85rem;
}

.weak-level {
  font-size: 0.68rem;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-highlight);
  color: var(--color-primary);
}

.weak-name {
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.weak-code {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}

.weak-meta {
  font-size: 0.74rem;
  color: var(--color-text-secondary);
}

.wrong-options {
  margin-top: 2px;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}

.wrong-chip {
  display: inline-block;
  margin-right: 4px;
  padding: 0 5px;
  border-radius: var(--radius-small);
  background: var(--color-danger-bg-soft, rgba(153, 27, 27, 0.08));
  color: var(--color-danger);
}

.weak-accuracy {
  width: 92px;
  flex-shrink: 0;
  text-align: right;
}

.weak-accuracy-value {
  font-size: 0.9rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-danger);
}

.weak-accuracy-track {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: var(--color-placeholder);
  overflow: hidden;
  margin-top: 2px;
}

.weak-accuracy-fill {
  display: block;
  height: 100%;
  background: var(--color-accent);
}

.weak-empty {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
</style>
