<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useTracking } from '@/composables/useTracking'
import { markNextEnterFromBackButton } from '@/utils/tracking'
import { useDataLoader } from '@/composables/useDataLoader'
import type { RawTextBasicInfo } from '@/adapters/wordListAdapter'
import { getWenId } from '@/utils/wenUtils'
import { debugWarn } from '@/utils/debug'

const route = useRoute()
const articleId = route.params.id as string
const wenId = getWenId(articleId)

// 使用导航 composable
const { goNext, goPrev } = useNavigation('detail', articleId)

// 使用埋点 composable
useTracking('detail', articleId)

// 包装 goPrev 以标记后退按钮
function handleGoPrev() {
  markNextEnterFromBackButton()
  goPrev()
}

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

/**
 * R17: 空内容 / 空段落过滤
 * - content 为空字符串时返回空数组（不渲染任何空段落）
 * - 连续换行产生的纯空白段落过滤掉（.trim() === '' 跳过）
 */
const paragraphs = computed(() => {
  const content = article.value.content
  if (!content) return []
  return content.split('\n').filter((line) => line.trim() !== '')
})

// ============================================================
// R16（顺手修 P3）：answers + handleAnswerChange 是 dead state
//   - questions 恒为空数组，QuizQuestion 永不渲染
//   - @answer-change 永远不会触发
//   - 清理：删除 answers ref / handleAnswerChange 函数 / 模板 @answer-change 绑定
//   - QuizQuestion 导入也移除（未使用）
// ============================================================
</script>

<template>
  <div class="detail-view">
    <div v-if="loading" class="loading-state">正在加载课文内容…</div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button type="button" class="retry-btn" @click="retry">重新加载</button>
    </div>
    <template v-else>
      <h1>{{ article.title }}</h1>
      <p v-if="article.author || article.dynasty" class="meta">
        {{ article.dynasty }} · {{ article.author }}
      </p>
      <!-- R17: 用 paragraphs computed 替代内联 split('\n')，避免空段落 -->
      <div class="article-content">
        <p v-for="(para, idx) in paragraphs" :key="idx" class="paragraph">
          {{ para }}
        </p>
      </div>
    </template>

    <!-- 底部导航按钮 -->
    <BackContinue back-text="返回" continue-text="继续" @back="handleGoPrev" @continue="goNext" />
  </div>
</template>

<style scoped>
.detail-view {
  padding: var(--spacing-xl);
  max-width: 800px;
  margin: 0 auto;
  /* R15: 5rem → spacing-2xl (3rem) 过大；取 spacing-xl + spacing-lg 用 padding-bottom 叠加 */
  padding-bottom: var(--spacing-2xl);
}

/* R15: loading/error 状态样式全部走 design token */
.loading-state,
.error-state {
  text-align: center;
  /* 3rem 1rem → 2xl md */
  padding: var(--spacing-2xl) var(--spacing-md);
  color: var(--color-text-secondary);
}

/* R15: retry-btn 硬编码颜色/尺寸 → token */
.error-state .retry-btn {
  margin-top: var(--spacing-md);
  /* 0.5rem 1.25rem → sm lg */
  padding: var(--spacing-sm) var(--spacing-lg);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  background: var(--color-white);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.error-state .retry-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.meta {
  color: var(--color-text-secondary);
  /* 1.5rem → lg */
  margin-bottom: var(--spacing-lg);
}

.article-content {
  /* 2 → line-height-loose；若未来在 design-tokens 定义，可改为 var(--line-height-loose) */
  line-height: 2;
}

.paragraph {
  text-indent: 2em;
  /* 1rem → md */
  margin-bottom: var(--spacing-md);
  white-space: pre-wrap;
}
</style>
