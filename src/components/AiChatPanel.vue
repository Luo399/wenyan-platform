<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAiChat } from '@/composables/useAiChat'
import type { ArticleInfo, AiQuota } from '@/composables/useAiChat'

interface Props {
  wenId: string
  article: ArticleInfo
}

const props = defineProps<Props>()

const authStore = useAuthStore()
const isLoggedIn = computed(() => authStore.isLoggedIn)

// —— composable 调用：把 props 包成 computed Ref ——
const wenIdRef = computed(() => props.wenId)
const articleRef = computed(() => props.article)

const { state, messages, quota, errorMessage, sendMessage, refreshQuota } = useAiChat({
  wenId: wenIdRef,
  article: articleRef,
})

// —— 输入框与自动滚动 ——
const input = ref('')
const messagesEl = ref<HTMLElement | null>(null)

const MAX_INPUT_LENGTH = 2000
const inputOverLimit = computed(() => input.value.trim().length > MAX_INPUT_LENGTH)

/** 配额显示（角标） */
const quotaBadge = computed(() => formatQuota(quota.value))

function formatQuota(q: AiQuota | null): string {
  if (!q || !q.daily) return ''
  return `今日 ${q.daily.used}/${q.daily.limit}`
}

/** 发送按钮是否可点击 */
const canSend = computed(() => {
  if (state.value === 'loading') return false
  const trimmed = input.value.trim()
  if (!trimmed) return false
  if (trimmed.length > MAX_INPUT_LENGTH) return false
  return true
})

async function handleSend() {
  if (!canSend.value) return
  const text = input.value
  input.value = ''
  await sendMessage(text)
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesEl.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

// enter 发送，shift+enter 换行
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void handleSend()
  }
}

// 新消息或 loading 变化时滚动到底部
watch(messages, scrollToBottom)

// 挂载时若已登录则尝试刷新配额
refreshQuota()
</script>

<template>
  <section class="ai-chat-panel" aria-label="AI 文言文讲解">
    <!-- 未登录态：面板置灰 + 占位 -->
    <div v-if="!isLoggedIn" class="panel-disabled">
      <div class="disabled-placeholder">
        <p class="disabled-title">登录后可使用 AI 讲解文言文</p>
        <p class="disabled-hint">请先登录账号以启用 AI 对话功能</p>
      </div>
    </div>

    <!-- 已登录态 -->
    <template v-else>
      <header class="panel-header">
        <span class="panel-title">AI 讲解《{{ article.title }}》</span>
        <span v-if="quotaBadge" class="panel-quota" aria-label="今日配额">{{ quotaBadge }}</span>
      </header>

      <!-- 错误 banner -->
      <div v-if="state === 'error' && errorMessage" class="error-banner" role="alert">
        {{ errorMessage }}
      </div>

      <!-- 消息区 -->
      <div ref="messagesEl" class="messages-area">
        <!-- 空态：引导 -->
        <div v-if="messages.length === 0" class="messages-empty">
          <p>你可以提问关于这篇文言文的任何问题，例如：</p>
          <ul>
            <li>这句话是什么意思？</li>
            <li>请分析一下作者的情感</li>
            <li>帮我背诵并解释重点字词</li>
          </ul>
        </div>

        <div
          v-for="(msg, idx) in messages"
          :key="msg.timestamp + '-' + idx"
          class="message-row"
          :class="msg.role === 'user' ? 'is-user' : 'is-assistant'"
        >
          <div class="message-bubble">
            <!-- 基础换行显示：用 white-space: pre-wrap 配合模板 -->
            <p
              v-for="(line, li) in msg.content.split('\n')"
              :key="li"
              class="message-line"
            >
              {{ line || ' ' }}
            </p>
          </div>
        </div>

        <!-- loading 中占位 -->
        <div v-if="state === 'loading'" class="message-row is-assistant">
          <div class="message-bubble loading-bubble">
            <span class="spinner" aria-hidden="true"></span>
            <span>思考中…</span>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <textarea
          v-model="input"
          class="chat-input"
          :class="{ 'is-over-limit': inputOverLimit }"
          rows="1"
          placeholder="输入你的问题，Enter 发送 / Shift+Enter 换行"
          @keydown="handleKeydown"
        ></textarea>

        <div class="input-footer">
          <span
            class="char-count"
            :class="{ 'is-warn': inputOverLimit }"
          >
            {{ input.trim().length }} / {{ MAX_INPUT_LENGTH }}
          </span>

          <button
            type="button"
            class="send-btn"
            :disabled="!canSend"
            @click="handleSend"
          >
            <span v-if="state === 'loading'" class="btn-spinner" aria-hidden="true"></span>
            <span>{{ state === 'loading' ? '发送中…' : '发送' }}</span>
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* —— 容器 —— */
.ai-chat-panel {
  margin-top: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  background: var(--color-white);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* —— 未登录置灰 —— */
.panel-disabled {
  padding: var(--spacing-xl);
  background: var(--color-bg-highlight);
  opacity: 0.75;
}
.disabled-placeholder {
  text-align: center;
  color: var(--color-text-secondary);
}
.disabled-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}
.disabled-hint {
  font-size: var(--font-size-small);
}

/* —— 头部 —— */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-highlight);
  border-bottom: var(--border-width-hairline) solid var(--color-border);
}
.panel-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}
.panel-quota {
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
}

/* —— 错误 banner —— */
.error-banner {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-small);
  border-bottom: var(--border-width-hairline) solid var(--color-danger);
}

/* —— 消息区 —— */
.messages-area {
  flex: 1 1 auto;
  max-height: 32rem;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  background: var(--color-white);
}

.messages-empty {
  padding: var(--spacing-lg) var(--spacing-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.8;
}
.messages-empty p {
  margin-bottom: var(--spacing-sm);
}
.messages-empty ul {
  padding-left: var(--spacing-lg);
}

.message-row {
  display: flex;
}
.message-row.is-user {
  justify-content: flex-end;
}
.message-row.is-assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 80%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-small);
  font-size: var(--font-size-body);
  line-height: 1.6;
  word-break: break-word;
}
.message-bubble.is-user,
.message-row.is-user .message-bubble {
  background: var(--color-primary);
  color: var(--color-white);
  border-top-right-radius: 0;
}
.message-row.is-assistant .message-bubble {
  background: var(--color-white);
  color: var(--color-text);
  border: var(--border-width-hairline) solid var(--color-border);
  border-top-left-radius: 0;
}

.message-line {
  margin: 0;
}

/* loading 气泡 */
.loading-bubble {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}
.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: var(--border-width-hairline) solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* —— 输入区 —— */
.input-area {
  border-top: var(--border-width-hairline) solid var(--color-border);
  padding: var(--spacing-md);
  background: var(--color-white);
}
.chat-input {
  width: 100%;
  min-height: 2.5rem;
  max-height: 6rem; /* 约 3 行 */
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  background: var(--color-white);
  resize: none;
  outline: none;
  line-height: 1.5;
  transition:
    border-color 0.2s ease;
}
.chat-input:focus {
  border-color: var(--color-primary);
}
.chat-input.is-over-limit {
  border-color: var(--color-danger);
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-sm);
}
.char-count {
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
}
.char-count.is-warn {
  color: var(--color-danger);
}

.send-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-hairline) solid var(--color-primary);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}
.send-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  border: var(--border-width-hairline) solid var(--color-white);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
