<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BackContinue from '@/components/BackContinue.vue'
import AiChatPanel from '@/components/AiChatPanel.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useTracking } from '@/composables/useTracking'
import { markNextEnterFromBackButton } from '@/utils/tracking'
import { useDataLoader } from '@/composables/useDataLoader'
import { getDataUrlWithVersion } from '@/utils/asset'
import { getWenScreenTitleUrl } from '@/config/figmaAssets'
import type { RawTextBasicInfo } from '@/adapters/wordListAdapter'
import { getWenId } from '@/utils/wenUtils'
import { debugWarn } from '@/utils/debug'

const route = useRoute()
// R140: 用 computed 取路由参数。本组件实例在 /detail/1 → /detail/2 时会被复用，
// 快照式取值会让正文和 AI 面板停在第一篇。
const articleId = computed(() => String(route.params.id ?? ''))
const wenId = computed(() => getWenId(articleId.value))

// 使用导航 composable（实时读当前路由；detail 是 pageSequence 末页，没有下一页）
const { goPrev } = useNavigation()

// 使用埋点 composable
useTracking('detail', articleId.value)

// 包装 goPrev 以标记后退按钮
function handleGoPrev() {
  markNextEnterFromBackButton()
  goPrev()
}

// 加载课文基础数据（title / author / original_text 等），走统一 useDataLoader 分层
// R107: 通过 getDataUrlWithVersion 生成 OSS 地址并携带版本戳，资源更新后自动刷新缓存
const basicInfoUrl = (): Promise<string> =>
  getDataUrlWithVersion('text_basic_info', `${wenId.value}.json`)
const {
  loading,
  error,
  data: basicInfo,
  retry,
} = useDataLoader<RawTextBasicInfo>(basicInfoUrl, {
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

// 标题书法图：Figma 插件按篇扫描的 article_title_*.png（11–29KB），
// 从 OSS images/screens/WEN_xx/... 读取。加载失败就回退到原来的文字标题，
// 不额外 HEAD 探测——目录本身来自 OSS 清单。
const titleImageUrl = computed(() => getWenScreenTitleUrl(wenId.value))
const titleImageError = ref(false)
const showTitleImage = computed(() => !!titleImageUrl.value && !titleImageError.value)
watch(wenId, () => {
  titleImageError.value = false
})
function handleTitleImageError() {
  titleImageError.value = true
}

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
      <h1 :class="{ 'sr-only': showTitleImage }">{{ article.title }}</h1>
      <!-- Figma 扫描的整篇书法标题图（OSS images/screens）；失败时上面的 h1 文字兜底 -->
      <img
        v-if="showTitleImage"
        :src="titleImageUrl ?? ''"
        class="article-title-art"
        alt=""
        aria-hidden="true"
        @error="handleTitleImageError"
      />
      <p v-if="article.author || article.dynasty" class="meta">
        {{ article.dynasty }} · {{ article.author }}
      </p>
      <!-- R17: 用 paragraphs computed 替代内联 split('\n')，避免空段落 -->
      <div class="article-content">
        <p v-for="(para, idx) in paragraphs" :key="idx" class="paragraph">
          {{ para }}
        </p>
      </div>

      <!-- AI 讲解面板 -->
      <AiChatPanel :wen-id="wenId" :article="article" />
    </template>

    <!-- 底部导航按钮 -->
    <!-- R140: detail 是 pageSequence 的最后一页，goNext 只会命中「无下一页」直接 return，
         生产环境 debugWarn 又是空函数，学生看到的就是「点了继续没反应」。
         这里不再渲染继续按钮，只留返回。 -->
    <BackContinue back-text="返回" :show-continue="false" @back="handleGoPrev" />
  </div>
</template>

<style scoped>
.detail-view {
  padding: var(--spacing-xl);
  max-width: 800px;
  margin: 0 auto;
  /* 底部安全留白：避开固定定位的 BackContinue 按钮 + AI 面板自身底部间距 */
  padding-bottom: var(--spacing-bottom-safe);
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

/* Figma 扫描的书法标题图：保持原比例，居中，最大 150px 高 */
.article-title-art {
  display: block;
  max-width: 100%;
  max-height: 150px;
  margin: 0 auto var(--spacing-md);
  object-fit: contain;
}

/* 有标题图时 h1 只留给读屏，视觉上不重复显示文字 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
