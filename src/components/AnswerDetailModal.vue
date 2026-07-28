<!--
  AnswerDetailModal.vue - 答题详情弹窗
  从 AnswerQueryView 拆分而来：展示单次/多次答题明细。
-->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content answer-detail-modal">
      <div class="modal-header">
        <h3>答题详情</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div v-if="answers.length > 0" class="modal-body">
        <div class="answer-detail-header">
          <span>{{ studentInfo }}</span>
        </div>
        <div v-for="(answer, index) in answers" :key="index" class="answer-item">
          <div class="answer-header">
            <span class="question-num">第 {{ index + 1 }} 题</span>
            <span class="score-badge" :class="{ correct: answer.isCorrect }">
              {{ answer.isCorrect ? '正确' : '错误' }}
            </span>
          </div>
          <div class="answer-content">
            <div class="answer-row">
              <span class="label">提交时间：</span>
              <span class="value">{{ formatDate(answer.submittedAt) }}</span>
            </div>
            <div class="answer-row">
              <span class="label">答题次数：</span>
              <span class="value">第 {{ answer.attemptNumber }} 次</span>
            </div>
            <div class="answer-row">
              <span class="label">你的答案：</span>
              <span class="value">{{ formatAnswer(answer.userAnswer) }}</span>
            </div>
            <div class="answer-row" v-if="answer.correctAnswer">
              <span class="label">正确答案：</span>
              <span class="value correct">{{ formatAnswer(answer.correctAnswer) }}</span>
            </div>
            <div class="answer-row">
              <span class="label">得分：</span>
              <span class="value">{{ answer.score }}分</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate, formatAnswer } from '@/utils/format'

defineProps<{
  /** 顶部展示的学生信息（学号 - 姓名） */
  studentInfo: string
  /** 答题明细列表，结构由后端返回决定 */
  answers: Array<Record<string, any>>
}>()

defineEmits<{
  (e: 'close'): void
}>()
</script>
