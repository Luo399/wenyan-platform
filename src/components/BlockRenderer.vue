<!--
  BlockRenderer.vue - 组件动态渲染器

  根据 block.type 动态渲染对应的业务组件
  使用 v-bind="block.data" 直接将数据传递给子组件
-->
<template>
  <div class="block-renderer" :class="`block-type-${block.type}`" v-if="show">
    <!-- 针对 quiz 类型，透传事件 -->
    <AdaptQuiz
      v-if="block.type === 'quiz'"
      v-bind="block.data"
      @quiz-submitted="$emit('quiz-submitted')"
      @answer="
        (quiz, answer, isCorrect, questionId, module, correctAnswer) =>
          $emit('quiz-answer', { quiz, answer, isCorrect, questionId, module, correctAnswer })
      "
    />
    <!-- 其他类型直接渲染 -->
    <component v-else :is="componentMap[block.type]" v-bind="block.data" />
  </div>
</template>

<script setup lang="ts">
import type { PageBlock } from '@/types/pageConfig'

// 业务组件导入
import DialogueCard from './DialogueCard.vue'
import DialogText from './DialogText.vue'
import AdaptQuiz from './AdaptQuiz.vue'
import WordList from './WordList.vue'
import MultiRoleReading from './MultiRoleReading.vue'
import VideoPlayer from './VideoPlayer.vue'

// 组件映射表
const componentMap: Record<string, any> = {
  // 对话文本块（Block模式）- 使用DialogueCard组件
  dialogue: DialogueCard,

  // 对话文本块（旧版）- 使用DialogText组件
  dialog: DialogText,

  // 测验块 - 使用AdaptQuiz组件
  quiz: AdaptQuiz,

  // 字词注释块 - 使用WordList组件
  wordlist: WordList,

  // 多角色朗读块 - 使用MultiRoleReading组件
  'multi-role-reading': MultiRoleReading,

  // 视频块 - 使用VideoPlayer组件
  video: VideoPlayer,

  // 音频图片文本块 - 暂用DialogText作为占位，可创建专门的AudioImageText组件
  'audio-image-text': DialogText,

  // 纯文本块 - 暂用DialogText作为占位，可创建专门的PlainText组件
  'plain-text': DialogText,
}

// Props定义
interface Props {
  block: PageBlock
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
})

// 事件定义
const emit = defineEmits<{
  (e: 'quiz-submitted'): void
  (
    e: 'quiz-answer',
    answer: {
      quiz: unknown
      answer: string
      isCorrect: boolean
      questionId?: string
      module?: string
      correctAnswer?: string | number | (string | number)[]
    },
  ): void
}>()
</script>

<style scoped>
.block-renderer {
  width: 100%;
  margin-bottom: 1rem;
}

.block-renderer:last-child {
  margin-bottom: 0;
}

/* 块类型特定样式 */
.block-type-dialogue {
  /* 对话文本块样式（Block模式） */
}

.block-type-dialog {
  /* 对话文本块样式（旧版） */
}

.block-type-quiz {
  /* 测验块样式 */
}

.block-type-wordlist {
  /* 字词注释块样式 */
}

.block-type-multi-role-reading {
  /* 多角色朗读块样式 */
}

.block-type-video {
  /* 视频块样式 */
}

.block-type-audio-image-text {
  /* 音频图片文本块样式 */
}

.block-type-plain-text {
  /* 纯文本块样式 */
}
</style>
