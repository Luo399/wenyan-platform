<!--
  BlocksRenderer - 块流渲染器（blocks 模式）

  约束：
  - 按 block.type 映射既有业务组件，quiz 块用 figma/QuizCard；
  - 全量挂载 + v-show 显隐，隐藏块不销毁（保留音频/滚动等状态）；
  - 不判分、不提交、不读路由/存储。
-->
<template>
  <div class="fg-blocks">
    <div
      v-for="(block, index) in blocks"
      :key="`${block.type}-${index}`"
      class="fg-block"
      v-show="isVisible(index)"
      :aria-hidden="isVisible(index) ? 'false' : 'true'"
    >
      <FigmaQuizCard
        v-if="block.type === 'quiz'"
        :quiz="block.data"
        :selected="snapshot.selections[block.data.id] || []"
        :submitted="snapshot.submittedIds.includes(block.data.id)"
        :verdict="verdictOf(block.data.id)"
        :config="config"
        @select="(key) => $emit('select', block.data.id, key)"
        @submit="$emit('submit', block.data.id)"
      />

      <component
        v-else-if="componentMap[block.type]"
        :is="componentMap[block.type]"
        v-bind="block.data"
      />

      <div v-else-if="block.type === 'unknown'" class="fg-block-unknown">
        暂不支持的块类型：{{ block.data.rawType || '未知' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import FigmaQuizCard from '@/components/figma/QuizCard.vue'
import DialogueCard from '@/components/DialogueCard.vue'
import WordList from '@/components/WordList.vue'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import type { BlockModel } from '@/adapters/pageAdapter'
import type { QuizInteractionConfig } from '@/config/quizInteraction'
import type { QuizSnapshot } from '@/composables/useQuizSession'

interface Props {
  blocks: BlockModel[]
  snapshot: QuizSnapshot
  config: QuizInteractionConfig
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'select', quizId: string, key: string): void
  (e: 'submit', quizId: string): void
}>()

/** 非 quiz 块的渲染组件映射（新增块类型在此注册） */
const componentMap: Record<string, Component> = {
  dialogue: DialogueCard,
  wordlist: WordList,
  'multi-role-reading': MultiRoleReading,
  video: VideoPlayer,
}

/**
 * 每个块之前出现过的 quiz 数量（quiz 块自身按当前序号计）。
 * 用于把「第 n 道 quiz 已解锁」映射回「第几个块可见」。
 */
const quizOrdinalBefore = computed(() => {
  let seen = -1
  return props.blocks.map((block) => {
    if (block.type === 'quiz') seen += 1
    return seen
  })
})

function isVisible(index: number): boolean {
  const ordinal = quizOrdinalBefore.value[index] ?? -1
  return ordinal <= props.snapshot.unlockedIndex
}

function verdictOf(quizId: string): 'correct' | 'wrong' | null {
  if (!props.snapshot.submittedIds.includes(quizId)) return null
  return props.snapshot.results[quizId] ? 'correct' : 'wrong'
}
</script>

<style scoped>
.fg-blocks {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.fg-block {
  width: 100%;
}

.fg-block-unknown {
  padding: var(--spacing-md);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
}
</style>
