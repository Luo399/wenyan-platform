<template>
  <div class="dialog-text">
    <!-- 对话容器 -->
    <div class="dialog-container" v-if="hasContent">
      <!-- 当前对话展示区 -->
      <div class="dialog-current">
        <div class="dialog-bubble" :class="currentDialogClass">
          <div class="dialog-avatar" v-if="currentDialog?.iconDialog">
            <img
              :src="getIconUrl(currentDialog.iconDialog)"
              :alt="getSpeakerName()"
              class="avatar-image"
              @error="handleImageError"
            />
          </div>
          <div class="dialog-avatar" v-else>
            <i class="fas fa-user-circle"></i>
          </div>

          <div class="dialog-content">
            <div class="dialog-speaker">{{ getSpeakerName() }}</div>
            <div class="dialog-text-content">
              <span v-for="(char, index) in displayedText" :key="index" class="dialog-char">{{
                char
              }}</span>
            </div>
          </div>

          <div class="dialog-actions">
            <button
              class="dialog-action-btn play-btn"
              v-if="currentDialog?.audioFile"
              @click="toggleAudio"
            >
              <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 对话进度指示 -->
      <div class="dialog-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="progress-text">{{ currentIndex + 1 }} / {{ totalDialogs }}</span>
      </div>

      <!-- 控制按钮 -->
      <div class="dialog-controls">
        <button class="control-btn prev-btn" :disabled="currentIndex === 0" @click="prevDialog">
          <i class="fas fa-chevron-left"></i>
          上一句
        </button>

        <button
          class="control-btn next-btn"
          :disabled="currentIndex >= totalDialogs - 1"
          @click="nextDialog"
        >
          下一句
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="dialog-loading" v-else-if="isLoading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载对话中...</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div class="dialog-error" v-else-if="error">
      <div class="error-icon">
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <p class="error-message">{{ error }}</p>
      <button class="error-retry" @click="handleRetry">
        <i class="fas fa-refresh"></i>
        重新加载
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { adaptDialogData, getAllDialogs } from '@/adapters/dialogAdapter'
import type { ProcessedDialogItem, RawDialogItem } from '@/adapters/dialogAdapter'
import { getAssetUrl } from '@/utils/asset'
import { debugWarn } from '@/utils/debug'

interface Props {
  textId?: string
  autoLoad?: boolean
  autoPlay?: boolean
  typewriterSpeed?: number
}

const props = withDefaults(defineProps<Props>(), {
  textId: 'WEN_01',
  autoLoad: true,
  autoPlay: false,
  typewriterSpeed: 50,
})

const emit = defineEmits<{
  (e: 'dialogChange', dialog: ProcessedDialogItem, index: number): void
  (e: 'complete'): void
  (e: 'loaded', data: ProcessedDialogItem[]): void
  (e: 'error', error: string): void
}>()

// R54 修复：useDataLoader 必须在 setup 顶层同步调用。
// 之前 loadData() async 函数内调用 useDataLoader，导致：
//   1) onUnmounted 在无 active component instance 时注册，卸载时 abort 不触发
//   2) 调用后立即同步检查 loadError.value/rawData.value，但数据尚未异步加载完成，
//      rawData.value 恒为 null，分支永远走不到，反而误报「数据为空」
// 现在改为 setup 顶层声明 loader，通过 computed/watch 响应异步结果。
const loader = useDataLoader<RawDialogItem[]>(() => `/data/level2_dialog/${props.textId}.json`, {
  autoLoad: false,
  timeout: 30000,
  retryCount: 1,
})

// 状态
const currentIndex = ref(0)
const displayedText = ref('')
const isPlaying = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)
let typewriterTimer: ReturnType<typeof setTimeout> | null = null

// 计算属性
const dialogs = computed<ProcessedDialogItem[]>(() => {
  const raw = loader.data.value
  return raw ? getAllDialogs(adaptDialogData(raw)) : []
})

const isLoading = computed(() => loader.loading.value)
const error = computed<string | null>(() => {
  if (loader.error.value) return `数据加载失败: ${loader.error.value}`
  // 仅在非加载状态且数据已到达时判定「未找到对话数据」，避免加载中误报
  if (loader.data.value !== null && !loader.loading.value && dialogs.value.length === 0) {
    return '未找到对话数据'
  }
  return null
})

const hasContent = computed(() => dialogs.value.length > 0 && !error.value && !isLoading.value)
const currentDialog = computed(() => dialogs.value[currentIndex.value])
const totalDialogs = computed(() => dialogs.value.length)
const progressPercent = computed(() =>
  totalDialogs.value > 0 ? ((currentIndex.value + 1) / totalDialogs.value) * 100 : 0,
)

const currentDialogClass = computed(() => {
  const speaker = getSpeakerName()
  if (speaker.includes('陈胜')) return 'speaker-chen'
  if (speaker.includes('吴广')) return 'speaker-wu'
  if (speaker.includes('戍卒')) return 'speaker-soldier'
  return ''
})

// 获取说话者名称
function getSpeakerName(): string {
  const dialog = currentDialog.value
  if (!dialog?.dialogText) return '未知'
  const match = dialog.dialogText.match(/^(.*?)\s*[：:]/)
  return match ? (match[1] as string) : '未知'
}

// 获取图标URL
function getIconUrl(iconName: string): string {
  return `/img/${iconName}`
}

// 打字机效果
function typeText(text: string) {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer)
  }

  displayedText.value = ''
  let index = 0

  function type() {
    if (index < text.length) {
      displayedText.value += text[index]
      index++
      typewriterTimer = setTimeout(type, props.typewriterSpeed)
    }
  }

  type()
}

// 数据首次加载成功时：重置到首句、启动打字机、emit loaded
// （匹配原 loadData 完成时手动 typeText + emit loaded 一次的行为）
watch(
  dialogs,
  (list) => {
    if (list.length > 0 && list[0]) {
      currentIndex.value = 0
      typeText(list[0].dialogText)
      emit('loaded', list)
    }
  },
  { once: true },
)

// loader 出错时向上冒泡 error 事件
watch(error, (err) => {
  if (err) emit('error', err)
})

// 触发加载
async function loadData() {
  if (!props.autoLoad) return
  await loader.load()
}

// 切换到上一个对话
function prevDialog() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    const dialog = dialogs.value[currentIndex.value]
    if (dialog) {
      typeText(dialog.dialogText)
      emit('dialogChange', dialog, currentIndex.value)
    }
  }
}

// 切换到下一个对话
function nextDialog() {
  if (currentIndex.value < dialogs.value.length - 1) {
    currentIndex.value++
    const dialog = dialogs.value[currentIndex.value]
    if (dialog) {
      typeText(dialog.dialogText)
      emit('dialogChange', dialog, currentIndex.value)

      if (currentIndex.value === dialogs.value.length - 1) {
        emit('complete')
      }
    }
  }
}

// 切换音频播放
function toggleAudio() {
  const dialog = currentDialog.value
  if (!dialog?.audioFile) return

  if (isPlaying.value) {
    audioRef.value?.pause()
    isPlaying.value = false
  } else {
    const audioUrl = getAssetUrl('audio', `${dialog.audioFile}.mp3`)
    audioRef.value = new Audio(audioUrl)
    audioRef.value.onended = () => {
      isPlaying.value = false
    }
    audioRef.value
      .play()
      .then(() => {
        isPlaying.value = true
      })
      .catch((err) => {
        debugWarn('音频播放失败:', err)
        isPlaying.value = false
      })
  }
}

// 处理图片加载错误
function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
}

// 重试加载
function handleRetry() {
  loadData()
}

// 监听当前对话变化
watch(currentIndex, () => {
  const dialog = currentDialog.value
  if (dialog) {
    typeText(dialog.dialogText)
  }
})

// 组件挂载时加载数据
onMounted(() => {
  loadData()
})

// 组件卸载时清理
onUnmounted(() => {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer)
  }
  audioRef.value?.pause()
})

// 暴露方法供外部调用
defineExpose({
  reload: loadData,
  nextDialog,
  prevDialog,
  goToDialog: (index: number) => {
    if (index >= 0 && index < dialogs.value.length) {
      currentIndex.value = index
    }
  },
  currentIndex,
  totalDialogs,
})
</script>

<style scoped>
.dialog-text {
  width: 100%;
  min-height: 300px;
}

.dialog-container {
  background: var(--color-white);
  border-radius: var(--radius-card);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-card);
}

.dialog-current {
  min-height: 180px;
  margin-bottom: 20px;
}

.dialog-bubble {
  display: flex;
  gap: var(--spacing-md);
  padding: 20px;
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  border-left: 4px solid var(--color-primary);
}

.dialog-bubble.speaker-chen {
  border-left-color: var(--color-primary);
  background: var(--color-bg-highlight);
}

.dialog-bubble.speaker-wu {
  border-left-color: var(--color-primary);
  background: var(--color-bg-highlight);
}

.dialog-bubble.speaker-soldier {
  border-left-color: var(--color-border);
  background: var(--color-bg-highlight);
}

.dialog-avatar {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: 24px;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dialog-content {
  flex: 1;
  min-width: 0;
}

.dialog-speaker {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}

.dialog-text-content {
  font-size: 16px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  min-height: 60px;
}

.dialog-char {
  display: inline;
}

.dialog-actions {
  flex-shrink: 0;
}

.dialog-action-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.play-btn {
  background: var(--color-primary);
  color: var(--color-white);
}

.play-btn:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-small);
}

.dialog-progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: 20px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--color-placeholder);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 50px;
  text-align: right;
}

.dialog-controls {
  display: flex;
  justify-content: space-between;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--radius-button);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.prev-btn {
  background: var(--color-bg-highlight);
  color: var(--color-text-secondary);
}

.prev-btn:hover:not(:disabled) {
  background: var(--color-placeholder);
}

.next-btn {
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
}

.next-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-small);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-primary);
}

.loading-spinner i {
  font-size: 32px;
}

.loading-spinner span {
  font-size: 14px;
}

.dialog-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  border: var(--border-width-hairline) solid var(--color-primary);
}

.error-icon {
  width: 50px;
  height: 50px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: 24px;
  margin-bottom: var(--spacing-md);
}

.error-message {
  color: var(--color-primary);
  font-size: 14px;
  margin: 0 0 var(--spacing-md) 0;
  text-align: center;
}

.error-retry {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 10px 20px;
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.error-retry:hover {
  background: var(--color-primary-hover);
}
</style>
