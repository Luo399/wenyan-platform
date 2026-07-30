<!--
  CultureCards.vue - 文化卡片展示组件
  功能描述：展示文化知识点卡片，支持解锁状态和卡片展示
  Props:
    wenId: string - 课文ID
    baseUrl?: string - 数据基础URL，默认 '/api/texts/'
    autoLoad?: boolean - 是否自动加载数据，默认 true
  Events:
    load-success: 数据加载成功
    load-error: 数据加载失败
    card-click: 卡片点击事件
  使用:
    <CultureCards wen-id="WEN_01" @card-click="handleCardClick" />
-->
<template>
  <div class="culture-cards-container">
    <BaseLoader v-if="loading || (cardsData === null && !error)" loading-text="加载文化卡片中..." />
    <BaseError v-else-if="error" :error="error" @retry="retry" />
    <BaseEmpty v-else-if="!cardsData?.cards?.length" empty-text="暂无文化卡片数据" />
    <div v-else class="cards-content">
      <div class="cards-header">
        <h3 class="cards-title">文化知识卡片</h3>
        <span class="cards-count">共 {{ cardsData.cards.length }} 张</span>
      </div>

      <div class="cards-list">
        <div
          v-for="(card, index) in cardsData.cards"
          :key="card.card_id || index"
          class="card-item"
          :class="{ locked: !isUnlocked(card), 'text-only': card.image_file === '文字' }"
          :role="isUnlocked(card) ? 'button' : undefined"
          :tabindex="isUnlocked(card) ? 0 : -1"
          :aria-label="`文化卡片：${card.card_name}`"
          @click="handleCardClick(card)"
          @keydown.enter="handleCardClick(card)"
          @keydown.space.prevent="handleCardClick(card)"
        >
          <div class="card-header">
            <span class="card-name">{{ card.card_name }}</span>
            <span v-if="!isUnlocked(card)" class="lock-icon">🔒</span>
          </div>

          <div class="card-content">
            <div v-if="card.image_file === '文字'" class="text-container">
              <p class="knowledge-text">{{ card.knowledge_text }}</p>
            </div>
            <template v-else>
              <p class="knowledge-text">{{ card.knowledge_text }}</p>
            </template>
          </div>

          <div v-if="card.unlock_condition" class="unlock-tip">
            <span class="unlock-label">解锁条件：</span>
            <span class="unlock-text">{{ card.unlock_condition }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'

interface CultureCard {
  text_id: string
  card_id: number
  card_name: string
  image_file: string
  knowledge_text: string
  unlock_condition?: string
}

interface CardsData {
  text_id: string
  cards: CultureCard[]
}

interface Props {
  wenId: string
  baseUrl?: string
  autoLoad?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: '/data/culture_cards/',
  autoLoad: true,
})

const emit = defineEmits<{
  (e: 'load-success', data: CardsData): void
  (e: 'load-error', error: string): void
  (e: 'card-click', card: CultureCard): void
}>()

const cardsUrl = computed(() => `${props.baseUrl}${props.wenId}.json`)

const {
  loading,
  error,
  data: cardsData,
  retry,
} = useDataLoader<CardsData>(() => cardsUrl.value, {
  autoLoad: props.autoLoad,
  timeout: 10000,
  retryCount: 1,
  onLoadSuccess: (data) => emit('load-success', data),
  onLoadError: (err) => emit('load-error', err),
  transform: (raw) => {
    if (raw && typeof raw === 'object' && 'text_id' in raw) {
      return raw as CardsData
    }
    const result = raw as { success: boolean; data: CardsData }
    return result.data || { text_id: props.wenId, cards: [] }
  },
})

// 解锁状态判断（可根据实际业务逻辑调整）
function isUnlocked(card: CultureCard): boolean {
  // 默认全部解锁，后续可接入用户进度数据
  return true
}

function handleCardClick(card: CultureCard) {
  if (isUnlocked(card)) {
    emit('card-click', card)
  }
}
</script>

<style scoped>
.culture-cards-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: var(--font-family-serif);
}

.cards-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.cards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
}

.cards-title {
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.cards-count {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.cards-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.card-item {
  background: var(--color-white);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: var(--shadow-small);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.card-item:hover:not(.locked) {
  box-shadow: var(--shadow-card);
  border-color: var(--color-primary);
}

/* R62: 键盘聚焦可见样式，与 hover 保持一致 */
.card-item:focus-visible:not(.locked) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: var(--shadow-card);
  border-color: var(--color-primary);
}

.card-item.locked {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-placeholder);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.card-name {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.lock-icon {
  font-size: 20px;
}

.card-content {
  margin-bottom: var(--spacing-sm);
}

.knowledge-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--color-text-secondary);
  text-align: justify;
  margin: 0;
}

.text-container {
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  padding: var(--spacing-md);
  border-left: 4px solid var(--color-primary);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.text-container .knowledge-text {
  color: var(--color-text-secondary);
  font-style: italic;
}

.card-item.text-only {
  border: 2px solid var(--color-placeholder);
  background: var(--color-bg-highlight);
}

.unlock-tip {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-highlight);
  border-radius: 6px;
  font-size: 12px;
}

.unlock-label {
  color: var(--color-primary);
  font-weight: 500;
}

.unlock-text {
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .culture-cards-container {
    padding: var(--spacing-md);
  }

  .cards-list {
    grid-template-columns: 1fr;
  }

  .card-item {
    padding: var(--spacing-md);
  }
}
</style>
