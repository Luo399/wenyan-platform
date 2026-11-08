<!--
  FigmaPageView - Figma/Excel 数据驱动页面的统一装配层

  职责：
  - 从 pageRegistry 取页面元信息；
  - 经 useDataLoader（带版本戳）加载原始 JSON；
  - 用 pageAdapter 归一为 PageModel；
  - 按 renderMode 选择 BlocksRenderer / QuizListRenderer；
  - 组装 useQuizSession（状态机）与 useQuizEffects（提交/完成记录/埋点）。

  约束：本视图不写题目 UI、不判分、不直接 fetch。
-->
<template>
  <div class="figma-page-view">
    <PageScaffold
      :title="displayTitle"
      :subtitle="meta.subtitle"
      :loading="loading"
      :error="error"
      :is-empty="isEmpty"
      empty-text="暂无内容"
      :show-navigation="showNavigation"
      :show-continue="showContinue"
      @retry="retry"
      @back="handleGoPrev"
      @continue="handleGoNext"
    >
      <p v-if="snapshot.error" class="figma-page-error">{{ snapshot.error }}</p>

      <BlocksRenderer
        v-if="pageModel?.kind === 'blocks'"
        :blocks="pageModel.blocks"
        :snapshot="snapshot"
        :config="config"
        @select="handleSelect"
        @submit="handleSubmit"
      />

      <QuizListRenderer
        v-else-if="pageModel?.kind === 'quizList'"
        :items="pageModel.items"
        :snapshot="snapshot"
        :config="config"
        @select="handleSelect"
        @submit="handleSubmit"
      />

      <!-- 情景测验完成后展示文化卡片（保持原 StepThree 行为） -->
      <section v-if="showCultureCards" class="figma-page-culture">
        <CultureCards :wen-id="wenId" @card-click="handleCultureCardClick" />
      </section>
    </PageScaffold>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageScaffold from '@/components/PageScaffold.vue'
import BlocksRenderer from '@/components/figma/BlocksRenderer.vue'
import QuizListRenderer from '@/components/figma/QuizListRenderer.vue'
import CultureCards from '@/components/CultureCards.vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { useNavigation } from '@/composables/useNavigation'
import { useQuizSession } from '@/composables/useQuizSession'
import { useQuizEffects } from '@/composables/useQuizEffects'
import { useTracking } from '@/composables/useTracking'
import { getFigmaPageMeta, type FigmaPageMeta } from '@/config/pageRegistry'
import { defaultQuizInteraction } from '@/config/quizInteraction'
import { adaptPage, extractQuizzes } from '@/adapters/pageAdapter'
import { getDataUrlWithVersion } from '@/utils/asset'
import { getWenId } from '@/utils/wenUtils'
import { markNextEnterFromBackButton, track } from '@/utils/tracking'
import { debugLog } from '@/utils/debug'

interface Props {
  /** pageRegistry 中的页面 key */
  pageKey: string
}

const props = defineProps<Props>()

const route = useRoute()
const config = defaultQuizInteraction

// 未注册页面时给出可读兜底，避免白屏
const fallbackMeta: FigmaPageMeta = {
  key: props.pageKey,
  dataDir: '',
  renderMode: 'blocks',
  title: '页面未注册',
  navKey: 'home',
  requiresAuth: true,
}
const meta = getFigmaPageMeta(props.pageKey) ?? fallbackMeta

// 篇目 ID：路由参数 → 规范化 wenId（响应式）
const poemId = computed(() => (route.params.id as string) || '1')
const wenId = computed(() => getWenId(poemId.value))

// 数据地址统一走版本戳（与 DetailView / WordList 对齐）
const dataUrl = computed(() => getDataUrlWithVersion(meta.dataDir, `${wenId.value}.json`))

const { data, loading, error, retry } = useDataLoader<unknown>(() => dataUrl.value)

// 原始 JSON → 归一化页面模型
const pageModel = computed(() => {
  if (!data.value) return null
  return adaptPage(data.value, {
    renderMode: meta.renderMode,
    wenId: wenId.value,
    pageKey: props.pageKey,
  })
})

const quizzes = computed(() => extractQuizzes(pageModel.value))

// blocks 页面沿用旧行为：没有 quiz 时直接允许继续
const session = useQuizSession({
  quizzes,
  config,
  emptyMeansCompleted: meta.renderMode === 'blocks',
})
const { snapshot } = session

// 埋点与副作用：视图注入，session 保持纯净
const { stepId, trackQuizSubmit } = useTracking(meta.navKey, poemId.value)
const effects = useQuizEffects({
  wenId,
  onTrack: ({ isCorrect, questionId }) => {
    trackQuizSubmit(isCorrect ? 100 : 0, isCorrect ? [] : [questionId])
  },
})

const { goNext, goPrev } = useNavigation(meta.navKey, poemId.value)

const displayTitle = computed(() => pageModel.value?.title || meta.title)

const isEmpty = computed(() => {
  if (!pageModel.value) return false
  return pageModel.value.kind === 'blocks'
    ? pageModel.value.blocks.length === 0
    : pageModel.value.items.length === 0
})

const showNavigation = computed(() => !loading.value && !error.value && !!pageModel.value)
const showContinue = computed(() => session.isCompleted.value)

/** 仅情景测验完成后展示文化卡片（与重构前行为一致） */
const showCultureCards = computed(
  () => meta.renderMode === 'quiz-list' && session.isCompleted.value && !isEmpty.value,
)

// 数据到达后进入作答态（跳过开头的无效题）
watch(
  () => pageModel.value,
  (model) => {
    if (!model) return
    session.setReady()
    debugLog('[FigmaPageView] 页面数据已就绪:', props.pageKey, wenId.value)
  },
  { immediate: true },
)

// 切篇目：重置答题状态与本 scope 的完成记录
watch(wenId, () => {
  session.reset()
  effects.resetCompletion()
  debugLog('[FigmaPageView] 篇目切换，答题状态已重置:', wenId.value)
})

function handleSelect(quizId: string, key: string): void {
  session.select(quizId, key)
}

async function handleSubmit(quizId: string): Promise<void> {
  const submission = session.beginSubmit(quizId)
  if (!submission) return

  const outcome = await effects.submitAnswer(submission.quiz, submission.keys)

  if (outcome.ok) {
    session.confirmSuccess(quizId)
    if (session.isCompleted.value) {
      effects.markCompleted(snapshot.value.total, snapshot.value.answeredCount)
    }
    return
  }

  session.confirmFailure(outcome.error || config.texts.submitFailed)
}

function handleGoNext(): void {
  goNext()
}

function handleGoPrev(): void {
  markNextEnterFromBackButton()
  goPrev()
}

function handleCultureCardClick(card: { card_id: number; card_name: string }): void {
  debugLog('[FigmaPageView] 文化卡片点击:', card)
  track('interaction', stepId, {
    module_type: '文化卡片',
    action: '点击',
    cost_time: 0,
  })
}
</script>

<style scoped>
.figma-page-view {
  padding: var(--spacing-md);
  max-width: 900px;
  margin: 0 auto;
}

.figma-page-error {
  margin: 0 0 var(--spacing-md) 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-highlight);
  border-left: var(--border-width-thin) solid var(--color-primary);
  border-radius: var(--radius-small);
  color: var(--color-primary);
  font-size: var(--font-size-small);
}

.figma-page-culture {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) 0;
  border-top: var(--border-width-hairline) solid var(--color-placeholder);
}

@media (max-width: 768px) {
  .figma-page-view {
    padding: var(--spacing-sm);
  }
}
</style>
