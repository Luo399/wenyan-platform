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
          :class="{ locked: !isUnlocked(card) }"
          @click="handleCardClick(card)"
        >
          <div class="card-header">
            <span class="card-name">{{ card.card_name }}</span>
            <span v-if="!isUnlocked(card)" class="lock-icon">🔒</span>
          </div>

          <div class="card-content">
            <p class="knowledge-text">{{ card.knowledge_text }}</p>
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
  baseUrl: '/api/texts/',
  autoLoad: true,
})

const emit = defineEmits<{
  (e: 'load-success', data: CardsData): void
  (e: 'load-error', error: string): void
  (e: 'card-click', card: CultureCard): void
}>()

const cardsUrl = computed(() => `${props.baseUrl}${props.wenId}/culture-cards`)

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
  font-family: 'Microsoft YaHei', sans-serif;
}

.cards-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.cards-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.cards-count {
  font-size: 14px;
  color: #666;
}

.cards-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.card-item {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.card-item:hover:not(.locked) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border-color: #4a90d9;
}

.card-item.locked {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f5f5f5;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.lock-icon {
  font-size: 20px;
}

.card-content {
  margin-bottom: 12px;
}

.knowledge-text {
  font-size: 14px;
  line-height: 1.8;
  color: #555;
  text-align: justify;
}

.unlock-tip {
  padding: 8px 12px;
  background: #f0f7ff;
  border-radius: 6px;
  font-size: 12px;
}

.unlock-label {
  color: #4a90d9;
  font-weight: 500;
}

.unlock-text {
  color: #666;
}

@media (max-width: 768px) {
  .culture-cards-container {
    padding: 16px;
  }

  .cards-list {
    grid-template-columns: 1fr;
  }

  .card-item {
    padding: 16px;
  }
}
</style>
