<template>
  <div class="word-list-container">
    <!-- 加载状态 -->
    <div v-if="wordListLoading || basicInfoLoading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="wordListError || basicInfoError" class="error-state">
      <i class="fas fa-exclamation-circle"></i>
      <p>{{ wordListError || basicInfoError || '加载失败' }}</p>
      <button @click="retry" class="retry-btn">重试</button>
    </div>

    <!-- 空数据状态 -->
    <div v-else-if="!wordListData?.length || !basicInfoData" class="empty-state">
      <p>暂无数据</p>
    </div>

    <!-- 主内容 -->
    <div v-else class="content-wrapper">
      <!-- 文章标题区域 -->
      <div class="article-header">
        <h1 class="article-title">{{ basicInfoData?.title || '未知标题' }}</h1>
        <p class="article-meta">
          <span class="author">{{ basicInfoData?.dynasty }} · {{ basicInfoData?.author }}</span>
        </p>
      </div>

      <!-- 文章内容 -->
      <div class="article-content" v-html="contentHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'

interface WordItem {
  text_id: string
  word: string
  basic_meaning: string
  synonym_analysis?: string
  follow_up_questions?: string[]
}

interface TextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration?: string
  bgm?: string
}

interface Props {
  wenId: string
  wordListBaseUrl?: string
  basicInfoBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  wordListBaseUrl: '/data/word_list/',
  basicInfoBaseUrl: '/data/text_basic_info/',
})

const wordListUrl = `${props.wordListBaseUrl}${props.wenId}.json`
const basicInfoUrl = `${props.basicInfoBaseUrl}${props.wenId}.json`

const {
  loading: wordListLoading,
  error: wordListError,
  data: wordListData,
  retry: retryWordList,
} = useDataLoader<WordItem[]>(() => wordListUrl, {
  timeout: 10000,
  retryCount: 1,
})

const {
  loading: basicInfoLoading,
  error: basicInfoError,
  data: basicInfoData,
  retry: retryBasicInfo,
} = useDataLoader<TextBasicInfo>(() => basicInfoUrl, {
  timeout: 10000,
  retryCount: 1,
})

function retry() {
  retryWordList()
  retryBasicInfo()
}

// 【测试重点】contentHtml 计算属性 - 逐步恢复词汇替换
const contentHtml = computed(() => {
  console.log('[WordList] contentHtml 开始计算')

  if (!basicInfoData.value?.original_text || !wordListData.value?.length) {
    console.log('[WordList] contentHtml 数据不足:', {
      hasOriginalText: !!basicInfoData.value?.original_text,
      wordListLength: wordListData.value?.length || 0,
    })
    return '<p>暂无内容</p>'
  }

  const originalText = basicInfoData.value.original_text
  const wordList = wordListData.value || []

  console.log(`[WordList] 原始文本长度: ${originalText.length}`)
  console.log(`[WordList] 词汇数量: ${wordList.length}`)

  // 按长度降序排列词汇（避免短词优先匹配）
  const sortedWords = [...wordList].sort((a, b) => b.word.length - a.word.length)
  const validWords = sortedWords.filter((item) => item.word && item.basic_meaning)

  console.log(`[WordList] 排序后词汇数量: ${sortedWords.length}`)
  console.log(`[WordList] 有效词汇数量: ${validWords.length}`)

  // 输出前5个词汇用于调试
  if (validWords.length > 0) {
    console.log(
      '[WordList] 前5个有效词汇:',
      validWords.slice(0, 5).map((w) => w.word),
    )
  }

  let content = originalText
  let processedCount = 0
  let replacedCount = 0

  // 【关键修改】处理所有词汇（83个）
  const maxProcessCount = validWords.length

  console.log(`[WordList] 开始处理，最大处理数量: ${maxProcessCount}`)

  for (const item of validWords) {
    if (processedCount >= maxProcessCount) {
      console.log(`[WordList] 已达到最大处理数量 ${maxProcessCount}，停止处理`)
      break
    }

    try {
      const escaped = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'g')
      const replacement = `<span class="annotated-word" data-def="${item.basic_meaning}">${item.word}</span>`
      const originalLength = content.length
      content = content.replace(regex, replacement)
      // 检查是否发生了替换
      if (content.length !== originalLength) {
        replacedCount++
      }
      processedCount++
      // 每处理10个词汇输出一次日志
      if (processedCount % 10 === 0) {
        console.log(`[WordList] 已处理 ${processedCount} 个词汇，成功替换 ${replacedCount} 个`)
      }
    } catch (err) {
      console.error(`[WordList] 处理词汇 "${item.word}" 失败:`, err)
    }
  }

  console.log(`[WordList] 实际处理词汇数量: ${processedCount}，成功替换: ${replacedCount}`)

  content = content.replace(/\n\n/g, '</p><p>')
  content = content.replace(/\n/g, '<br>')
  content = `<p>${content}</p>`

  console.log('[WordList] contentHtml 计算完成')
  return content
})
</script>

<style scoped>
.word-list-container {
  padding: 1rem;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.article-header {
  margin-bottom: 1rem;
}

.article-title {
  font-size: 1.5rem;
  margin: 0;
}

.article-meta {
  color: #666;
  margin: 0.5rem 0 0;
}

.article-content {
  line-height: 1.8;
}

.annotated-word {
  color: #3498db;
  text-decoration: underline;
  cursor: help;
}
</style>
