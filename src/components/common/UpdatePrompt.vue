<template>
  <div
    class="update-prompt"
    :class="{ 'is-hidden': !visible }"
    role="status"
    aria-live="polite"
  >
    <template v-if="prompt">
      <p class="update-prompt-text">{{ message }}</p>
      <div class="update-prompt-actions">
        <button
          type="button"
          class="update-prompt-btn is-primary"
          data-testid="update-refresh"
          @click="handleRefresh"
        >
          刷新页面
        </button>
        <button
          type="button"
          class="update-prompt-btn"
          data-testid="update-dismiss"
          @click="handleDismiss"
        >
          稍后再说
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 发布新鲜度阶段 4 的提示条。三条刻意的设计，改动前请先读：
 * 1. 绝不自动刷新：这里只有按钮，用户点「刷新页面」才会走 requestManualRefresh()。
 *    学生可能正在答题，页面自己刷掉就是丢数据。
 * 2. 根节点常驻、内容 v-if：根级 v-if 在开发模式下会渲染成注释节点，组件就变成 fragment，
 *    $el 拿到的不是这个 div（同理，模板里也不能留根级注释，阶段 1 的 BuildStamp 就在单测踩过）。
 *    所以「隐藏」用 .is-hidden 控制 display，不动根节点。
 * 3. 位置固定、不遮挡操作：它是一条横幅，不做模态，答题中途也不会被拦住。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CHUNK_RELOAD_FAILED_EVENT,
  type ChunkRecoveryHint,
} from '@/utils/chunkRecovery'
import {
  NEW_VERSION_EVENT,
  clearRecoveryHint,
  describeRecoveryHint,
  dismissVersion,
  isRecoveryHintFresh,
  readRecoveryHint,
  requestManualRefresh,
  type VersionFingerprint,
} from '@/utils/buildVersion'

/** 提示的两种来源：探测到新版本（可等）／懒加载 chunk 已经失败（该刷了） */
type PromptEntry =
  | { kind: 'new-version'; fingerprint: VersionFingerprint }
  | { kind: 'recovery'; hint: ChunkRecoveryHint }

const prompt = ref<PromptEntry | null>(null)

const visible = computed(() => prompt.value !== null)

const message = computed(() => {
  const entry = prompt.value
  if (!entry) return ''
  if (entry.kind === 'recovery') return describeRecoveryHint(entry.hint)

  const { fingerprint } = entry
  const stamp = fingerprint.kind === 'build-id' ? `（构建 ${fingerprint.value}）` : ''
  return `发现新版本${stamp}。当前页面还能正常用，方便的时候点「刷新页面」就是最新版。`
})

function onNewVersion(event: Event) {
  const detail = (event as CustomEvent<VersionFingerprint>).detail
  if (!detail || typeof detail.kind !== 'string' || typeof detail.value !== 'string') return
  // 已经出过加载失败时，那条更要紧，不让它被「有新版本」盖掉
  if (prompt.value?.kind === 'recovery') return
  prompt.value = { kind: 'new-version', fingerprint: detail }
}

function onRecoveryFailed(event: Event) {
  const detail = (event as CustomEvent<ChunkRecoveryHint>).detail
  if (detail && typeof detail.reason === 'string') {
    prompt.value = { kind: 'recovery', hint: detail }
    return
  }
  // 事件 detail 丢了也别彻底没提示：阶段 3 同时写了 sessionStorage
  const stored = readRecoveryHint()
  if (stored) prompt.value = { kind: 'recovery', hint: stored }
}

function handleRefresh() {
  // 只有用户点击才走到这里；本组件不存在任何自动调用路径
  requestManualRefresh()
}

function handleDismiss() {
  const entry = prompt.value
  if (!entry) return
  if (entry.kind === 'new-version') {
    dismissVersion(entry.fingerprint)
  } else {
    clearRecoveryHint()
  }
  prompt.value = null
}

onMounted(() => {
  window.addEventListener(NEW_VERSION_EVENT, onNewVersion)
  window.addEventListener(CHUNK_RELOAD_FAILED_EVENT, onRecoveryFailed)

  // 挂载前阶段 3 已经放弃过重载的话，事件是听不到的，这里补一次
  const stored = readRecoveryHint()
  if (stored && isRecoveryHintFresh(stored, Date.now())) {
    prompt.value = { kind: 'recovery', hint: stored }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener(NEW_VERSION_EVENT, onNewVersion)
  window.removeEventListener(CHUNK_RELOAD_FAILED_EVENT, onRecoveryFailed)
})
</script>

<style scoped>
.update-prompt {
  position: fixed;
  left: 50%;
  bottom: 48px;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  width: min(92vw, 560px);
  padding: var(--spacing-md) var(--spacing-lg);
  /* 提示条底色：设计 token 里的半透明深色，与 AutoPlayPrompt 同一族 */
  background: rgba(0, 0, 0, 0.8);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  /* 衬线字体走全局设计 token */
  font-family: var(--font-family-serif);
  color: var(--color-white);
}

.is-hidden {
  display: none;
}

.update-prompt-text {
  margin: 0;
  flex: 1 1 auto;
  font-size: var(--font-size-body, 14px);
  line-height: 1.6;
  text-align: left;
}

.update-prompt-actions {
  display: flex;
  flex: 0 0 auto;
  gap: var(--spacing-sm);
}

.update-prompt-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  /* 按钮圆角走站内统一的胶囊约定 */
  border-radius: var(--radius-button);
  background: transparent;
  color: var(--color-white);
  font-family: inherit;
  font-size: var(--font-size-body);
  cursor: pointer;
}

.update-prompt-btn.is-primary {
  /* 朱红主色按钮，跟站内其它主按钮一致 */
  background: var(--color-primary);
  border-color: var(--color-primary);
}
</style>
