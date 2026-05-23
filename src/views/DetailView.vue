<script setup lang="ts">
import { useRoute } from 'vue-router'
import Question, { type QuestionData } from './Question.vue'

const route = useRoute()
const articleId = route.params.id ?? ''

function getArticleById(id: number) {
  const articlesMap: Record<number, { title: string; content: string }> = {
    1: { title: '论语·学而篇', content: '学而时习之，不亦说乎？...'

    },

    2: {
      title: '孟子·梁惠王上',
      content: "孟子见梁惠王。王曰：'叟！不远千里而来，亦将有以利吾国乎？'...",
    },
    3: {
      title: '劝学',
      content: '君子曰：学不可以已。青，取之于蓝，而青于蓝；冰，水为之，而寒于水。',
    },
  }
  return articlesMap[Number(id)] || { title: '未知篇目', content: '暂无内容' }
}

const article = getArticleById(Number(articleId))

// 示例题目数据（可替换为从接口获取）
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

function handleAnswerChange(questionId: string, answer: string | number | (string | number)[]) {
  console.log('题目ID:', questionId, '答案:', answer)
}
</script>

<template>
  <div>
    <h1>{{ article.title }}</h1>
    <p>{{ article.content }}</p>

    <div class="questions-section">
      <h2>课后练习</h2>
      <div v-for="question in questions" :key="question.id" class="question-wrapper">
        <Question :question="question" @answer-change="handleAnswerChange" />
      </div>
    </div>

    <button @click="$router.back()">返回列表</button>
  </div>
</template>

<style scoped>
.questions-section {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
.questions-section h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: #374151;
}
.question-wrapper {
  margin-bottom: 1.5rem;
}
</style>
