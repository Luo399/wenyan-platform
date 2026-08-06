<!--
  CultureCards.vue - 文化卡片展示组件
  功能描述：展示文化知识点卡片，支持文字/图片/视频三种媒体类型
  Props:
    wenId: string - 课文ID
    baseUrl?: string - 数据基础URL，默认 '/data/culture_cards/'
    autoLoad?: boolean - 是否自动加载数据，默认 true
    cardDisplayMode?: 'grid' | 'stack' - 卡片展示模式：
      - 'grid'（默认）：网格平铺展示，全部可见
      - 'stack'：堆叠/翻牌模式，点击翻开（预留功能）
  Events:
    load-success: 数据加载成功
    load-error: 数据加载失败
    card-click: 卡片点击事件（返回 card 对象）
    video-click: 视频卡片点击事件（返回 card 对象）
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

      <!-- 卡片展示区域 -->
      <div
        class="cards-list"
        :class="{
          'grid-mode': cardDisplayMode === 'grid',
          'stack-mode': cardDisplayMode === 'stack',
        }"
      >
        <div
          v-for="(card, index) in cardsData.cards"
          :key="card.card_id || index"
          class="card-item"
          :class="{
            locked: !isUnlocked(card),
            'card-media-image': cardMediaType(card) === 'image',
            'card-media-video': cardMediaType(card) === 'video',
            'card-media-text': cardMediaType(card) === 'text',
            'card-flipped': flippedCards.has(card.card_id || index),
          }"
          :role="isUnlocked(card) ? 'button' : undefined"
          :tabindex="isUnlocked(card) ? 0 : -1"
          :aria-label="`文化卡片：${card.card_name}`"
          @click="handleCardClick(card)"
          @keydown.enter="handleCardClick(card)"
          @keydown.space.prevent="handleCardClick(card)"
        >
          <!-- 卡片正面（翻牌模式下显示） -->
          <div
            class="card-front"
            v-if="cardDisplayMode === 'stack' && !flippedCards.has(card.card_id || index)"
          >
            <div class="card-front-content">
              <span class="card-front-icon">?</span>
              <span class="card-front-label">点击翻开</span>
            </div>
          </div>

          <!-- 卡片内容（网格模式或已翻开的卡片） -->
          <div
            class="card-inner"
            v-if="cardDisplayMode === 'grid' || flippedCards.has(card.card_id || index)"
          >
            <div class="card-header">
              <span class="card-name">{{ card.card_name }}</span>
              <span v-if="!isUnlocked(card)" class="lock-icon">🔒</span>
              <span v-else-if="cardMediaType(card) === 'video'" class="video-badge">
                <i class="fas fa-play"></i>
              </span>
            </div>

            <div class="card-content">
              <!-- 文字类型 -->
              <div v-if="cardMediaType(card) === 'text'" class="text-container">
                <p class="knowledge-text">{{ card.knowledge_text }}</p>
              </div>
              <!-- 图片类型 -->
              <div v-else-if="cardMediaType(card) === 'image'" class="image-container">
                <img
                  :src="getCardImageUrl(card)"
                  :alt="card.card_name"
                  class="card-image"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <!-- 视频类型 -->
              <div v-else-if="cardMediaType(card) === 'video'" class="video-container">
                <div class="video-thumbnail" @click.stop="handleVideoClick(card)">
                  <img
                    v-if="card.poster_file"
                    :src="getCardImageUrl({ ...card, image_file: card.poster_file })"
                    :alt="card.card_name"
                    class="video-poster"
                    loading="lazy"
                  />
                  <div class="video-play-overlay">
                    <i class="fas fa-play-circle"></i>
                    <span class="video-play-text">点击播放</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 解锁条件提示 -->
            <div v-if="card.unlock_condition" class="unlock-tip">
              <span class="unlock-label">解锁条件：</span>
              <span class="unlock-text">{{ card.unlock_condition }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 翻牌模式控制按钮（预留功能） -->
      <div v-if="cardDisplayMode === 'stack' && cardsData.cards.length > 0" class="flip-controls">
        <button class="flip-btn flip-all-btn" @click="flipAllCards">
          <i class="fas fa-arrows-alt"></i>
          全部翻开
        </button>
        <button class="flip-btn flip-next-btn" @click="flipNextCard">
          <i class="fas fa-hand-pointer"></i>
          依次翻开
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'
import { ossBase, getDataUrlWithVersion } from '@/utils/asset'

interface CultureCard {
  text_id: string
  card_id: number
  card_name: string
  /** 媒体资源标识：
   *  - "文字" → 纯文本
   *  - "xxx.png" / "xxx.jpg" → 图片
   *  - "xxx.mp4" / "xxx.webm" → 视频
   */
  image_file: string
  /** 视频封面图（仅视频类型时有效） */
  poster_file?: string
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
  /** 卡片展示模式：'grid'（网格平铺）| 'stack'（堆叠翻牌） */
  cardDisplayMode?: 'grid' | 'stack'
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: '/data/culture_cards/',
  autoLoad: true,
  cardDisplayMode: 'grid',
})

const emit = defineEmits<{
  (e: 'load-success', data: CardsData): void
  (e: 'load-error', error: string): void
  (e: 'card-click', card: CultureCard): void
  (e: 'video-click', card: CultureCard): void
}>()

const cardsUrl = (): string | Promise<string> => {
  // 外部显式传入自定义 baseUrl 时沿用（兼容旧用法）；否则走版本戳 OSS 地址
  if (props.baseUrl !== '/data/culture_cards/') {
    return `${props.baseUrl}${props.wenId}.json`
  }
  return getDataUrlWithVersion('culture_cards', `${props.wenId}.json`)
}

const {
  loading,
  error,
  data: cardsData,
  retry,
} = useDataLoader<CardsData>(cardsUrl, {
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

// 翻牌状态（stack 模式下记录已翻开的卡片）
const flippedCards = reactive(new Set<number | string>())
const flipCardIndex = ref(0)

/**
 * 判断卡片媒体类型
 *  - "文字" → text
 *  - 以 .png/.jpg/.jpeg/.gif/.webp 结尾 → image
 *  - 以 .mp4/.webm/.ogg 结尾 → video
 *  - 其他 → text（兜底）
 */
function cardMediaType(card: CultureCard): 'text' | 'image' | 'video' {
  const file = card.image_file
  if (!file || file === '文字') return 'text'

  const lower = file.toLowerCase()
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  ) {
    return 'image'
  }
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg')) {
    return 'video'
  }
  return 'text'
}

/**
 * 获取卡片图片/视频 URL
 * 资源路径：{ossBase}/images/culture_cards/{wenId}/{image_file}
 * 通过 ossBase（VITE_OSS_BASE_URL）拼接完整 URL，确保 OSS 生产桶读取
 */
function getCardImageUrl(card: CultureCard): string {
  if (cardMediaType(card) === 'text') return ''
  return `${ossBase}/images/culture_cards/${card.text_id}/${card.image_file}`
}

/**
 * 获取卡片视频 URL（与 getCardImageUrl 同路径，语义化区分）
 */
function getCardVideoUrl(card: CultureCard): string {
  return `${ossBase}/images/culture_cards/${card.text_id}/${card.image_file}`
}

/**
 * 图片加载失败处理
 */
function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 解锁状态判断
// 当前恒 true 为占位实现；接入用户进度数据后再按 card.unlock_condition 判断
function isUnlocked(_card: CultureCard): boolean {
  return true
}

function handleCardClick(card: CultureCard) {
  if (!isUnlocked(card)) return
  emit('card-click', card)
}

function handleVideoClick(card: CultureCard) {
  if (!isUnlocked(card)) return
  const videoUrl = getCardVideoUrl(card)
  if (videoUrl) {
    window.open(videoUrl, '_blank')
  }
  emit('video-click', card)
}

/**
 * 全部翻开（预留功能：stack 模式下翻开所有卡片）
 */
function flipAllCards() {
  if (!cardsData.value?.cards) return
  cardsData.value.cards.forEach((card) => {
    flippedCards.add(card.card_id || card.card_name)
  })
}

/**
 * 依次翻开下一张卡片（预留功能：stack 模式下逐张翻开）
 */
function flipNextCard() {
  if (!cardsData.value?.cards) return
  if (flipCardIndex.value < cardsData.value.cards.length) {
    const card = cardsData.value.cards[flipCardIndex.value]
    if (card) {
      flippedCards.add(card.card_id || card.card_name)
    }
    flipCardIndex.value++
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

/* ============================================================
   网格模式：卡片网格布局
   ============================================================ */
.grid-mode {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

/* ============================================================
   堆叠模式：卡片堆叠布局（翻牌效果预留）
   ============================================================ */
.stack-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.stack-mode .card-item {
  width: 100%;
  max-width: 500px;
}

/* ============================================================
   卡片通用样式
   ============================================================ */
.card-item {
  background: var(--color-white);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: var(--shadow-small);
  transition: all 0.3s ease;
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.card-item:hover:not(.locked) {
  box-shadow: var(--shadow-card);
  border-color: var(--color-primary);
}

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

/* 虚线边框（Figma 设计同步） */
.card-item.card-media-text {
  border: 2px dashed var(--color-border);
}

.card-item.card-media-image {
  border: 2px solid var(--color-primary);
}

.card-item.card-media-video {
  border: 2px solid var(--color-accent);
}

/* 翻牌状态 */
.card-item.card-flipped {
  border-style: solid;
}

/* 卡片正面（翻牌模式） */
.card-front {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: transform 0.3s ease;
}

.card-front:hover {
  transform: scale(1.02);
}

.card-front-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-white);
}

.card-front-icon {
  font-size: 48px;
  font-weight: 900;
}

.card-front-label {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
}

/* 卡片内层 */
.card-inner {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
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

.video-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--color-accent);
  color: var(--color-white);
  border-radius: 12px;
  font-size: 12px;
}

.video-badge i {
  font-size: 10px;
}

.card-content {
  margin-bottom: var(--spacing-sm);
}

/* ============================================================
   文字内容样式
   ============================================================ */
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

/* ============================================================
   图片内容样式
   ============================================================ */
.image-container {
  border-radius: var(--radius-small);
  overflow: hidden;
  background: var(--color-bg-highlight);
}

.card-image {
  width: 100%;
  height: auto;
  max-height: 300px;
  object-fit: contain;
  display: block;
  transition: transform 0.3s ease;
}

.card-image:hover {
  transform: scale(1.02);
}

/* ============================================================
   视频内容样式
   ============================================================ */
.video-container {
  border-radius: var(--radius-small);
  overflow: hidden;
  background: var(--color-placeholder);
}

.video-thumbnail {
  position: relative;
  cursor: pointer;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.video-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
}

.video-play-overlay {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-white);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease;
}

.video-thumbnail:hover .video-play-overlay {
  transform: scale(1.1);
}

.video-play-overlay i {
  font-size: 48px;
  opacity: 0.9;
}

.video-play-text {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  opacity: 0.9;
}

/* 视频播放覆盖层背景 */
.video-thumbnail::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 0;
  transition: background 0.3s ease;
}

.video-thumbnail:hover::after {
  background: rgba(0, 0, 0, 0.2);
}

/* ============================================================
   解锁条件提示
   ============================================================ */
.unlock-tip {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-highlight);
  border-radius: 6px;
  font-size: 12px;
  margin-top: var(--spacing-sm);
}

.unlock-label {
  color: var(--color-primary);
  font-weight: 500;
}

.unlock-text {
  color: var(--color-text-secondary);
}

/* ============================================================
   翻牌控制按钮（预留功能）
   ============================================================ */
.flip-controls {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: var(--border-width-hairline) solid var(--color-border);
}

.flip-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--color-white);
  color: var(--color-text);
}

.flip-all-btn {
  background: var(--color-primary);
  color: var(--color-white);
  border-color: var(--color-primary);
}

.flip-all-btn:hover {
  background: var(--color-primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-small);
}

.flip-next-btn {
  background: var(--color-accent);
  color: var(--color-white);
  border-color: var(--color-accent);
}

.flip-next-btn:hover {
  opacity: 0.9;
  transform: translateY(-2px);
  box-shadow: var(--shadow-small);
}

/* ============================================================
   响应式布局
   ============================================================ */
@media (max-width: 768px) {
  .culture-cards-container {
    padding: var(--spacing-md);
  }

  .grid-mode {
    grid-template-columns: 1fr;
  }

  .card-item {
    padding: var(--spacing-md);
  }

  .flip-controls {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
