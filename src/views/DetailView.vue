<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import Question, { type QuestionData } from '../components/Question.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useDataLoader } from '@/composables/useDataLoader'
import type { RawTextBasicInfo } from '@/adapters/wordListAdapter'
import { getWenId } from '@/utils/wenUtils'
import { debugWarn } from '@/utils/debug'

const route = useRoute()
const articleId = route.params.id as string
const wenId = getWenId(articleId)

// 使用导航 composable
const { goNext, goPrev } = useNavigation('detail', articleId)

// 加载课文基础数据（title / author / original_text 等），走统一 useDataLoader 分层
const basicInfoUrl = `/data/text_basic_info/${wenId}.json`
const {
  loading,
  error,
  data: basicInfo,
  retry,
} = useDataLoader<RawTextBasicInfo>(() => basicInfoUrl, {
  timeout: 10000,
  retryCount: 1,
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000,
  onLoadError: (msg) => debugWarn('[DetailView] 加载课文基础信息失败:', msg),
})

// 文章视图模型：优先取数据层，加载失败时降级为空态，不再使用本地伪造的 articlesMap
const article = computed(() => {
  if (basicInfo.value) {
    return {
      title: basicInfo.value.title,
      author: basicInfo.value.author,
      dynasty: basicInfo.value.dynasty,
      content: basicInfo.value.original_text,
    }
  }
  return { title: '加载中...', author: '', dynasty: '', content: '' }
})

// 收集答案（预留）
const answers = ref<Record<string, string | number | (string | number)[]>>({})

// 课后题：当前 JSON 数据管线尚未生成该视图专用题目，保持空数组
// 后续接入 level1_quiz / 自定义 detail_quiz 后可替换为数据驱动
const questions: QuestionData[] = []

/**
 * 处理答案变化
 */
function handleAnswerChange(questionId: string, answer: string | number | (string | number)[]) {
  answers.value[questionId] = answer
}
</script>

<template>
  <div class="detail-view">
    <div v-if="loading" class="loading-state">正在加载课文内容…</div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="retry">重新加载</button>
    </div>
    <template v-else>
      <h1>{{ article.title }}</h1>
      <p v-if="article.author || article.dynasty" class="meta">
        {{ article.dynasty }} · {{ article.author }}
      </p>
      <!-- 按换行符分段渲染原文，保留语义分段 -->
      <div class="article-content">
        <p v-for="(para, idx) in article.content.split('\n')" :key="idx" class="paragraph">
          {{ para }}
        </p>
      </div>

      <div v-if="questions.length > 0" class="questions-section">
        <h2>课后练习</h2>
        <div v-for="question in questions" :key="question.id" class="question-wrapper">
          <Question :question="question" @answer-change="handleAnswerChange" />
        </div>
      </div>
    </template>

    <!-- 底部导航按钮 -->
    <BackContinue back-text="返回" continue-text="继续" @back="goPrev" @continue="goNext" />
  </div>
</template>

<style scoped>
.detail-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.error-state .retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: #fff;
  cursor: pointer;
}

.meta {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.article-content {
  line-height: 2;
}

.paragraph {
  text-indent: 2em;
  margin-bottom: 1rem;
  white-space: pre-wrap;
}

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
