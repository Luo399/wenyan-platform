<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import QuizQuestion, { type QuestionData } from '../components/QuizQuestion.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'

const route = useRoute()
const articleId = route.params.id as string

// 使用导航composable
const { goNext, goPrev } = useNavigation('detail', articleId)

// 收集答案（用于可能的批量操作）
const answers = ref<Record<string, string | number | (string | number)[]>>({})

function getArticleById(id: string) {
  const articlesMap: Record<string, { title: string; content: string }> = {
    '1': { title: '论语·学而篇', content: '学而时习之，不亦说乎？...' },
    '2': {
      title: '孟子·梁惠王上',
      content: "孟子见梁惠王。王曰：'叟！不远千里而来，亦将有以利吾国乎？'...",
    },
    '3': {
      title: '劝学',
      content: '君子曰：学不可以已。青，取之于蓝，而青于蓝；冰，水为之，而寒于水。',
    },
  }
  return articlesMap[id] || { title: '未知篇目', content: '暂无内容' }
}

const article = getArticleById(articleId)

// 示例题目数据
const questions: QuestionData[] = [
  {
    id: 'WEN_01_Q1',
    wenId: 'WEN_01',
    questionSeq: 1,
    text: '斯是陋室，惟吾德馨中的馨字是什么意思？',
    type: 'radio',
    options: [
      { id: 'A', label: '散布很远的香气' },
      { id: 'B', label: '温馨' },
      { id: 'C', label: '德行' },
      { id: 'D', label: '名声' },
    ],
    correctAnswer: 'A',
    audioUrl: null,
    imageUrl: null,
  },
  {
    id: 'WEN_01_Q2',
    wenId: 'WEN_01',
    questionSeq: 2,
    text: '下列哪一项不是《陋室铭》中提到的生活场景？',
    type: 'checkbox',
    options: [
      { id: 'A', label: '调素琴' },
      { id: 'B', label: '阅金经' },
      { id: 'C', label: '饮酒赋诗' },
      { id: 'D', label: '谈笑有鸿儒' },
    ],
    correctAnswer: ['A', 'C'],
    audioUrl: null,
    imageUrl: null,
  },
]

/**
 * 处理答案变化
 */
function handleAnswerChange(questionId: string, answer: string | number | (string | number)[]) {
  answers.value[questionId] = answer
}
</script>

<template>
  <div class="detail-view">
    <h1>{{ article.title }}</h1>
    <p>{{ article.content }}</p>

    <div class="questions-section">
      <h2>课后练习</h2>
      <div v-for="question in questions" :key="question.id" class="question-wrapper">
        <QuizQuestion :question="question" @answer-change="handleAnswerChange" />
      </div>
    </div>

    <!-- 底部导航按钮 -->
    <BackContinue back-text="返回" continue-text="继续" @back="goPrev" @continue="goNext" />
  </div>
</template>

<style scoped>
.detail-view {
  padding: var(--spacing-xl);
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

.questions-section {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-md);
  border-top: var(--border-width-hairline) solid var(--color-placeholder);
}

.questions-section h2 {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-subheading);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
}

.question-wrapper {
  margin-bottom: var(--spacing-lg);
}
</style>
