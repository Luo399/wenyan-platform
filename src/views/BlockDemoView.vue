<!--
  BlockDemoView.vue - Block渲染测试页面

  用于测试BlockRenderer组件是否能正确渲染不同类型的Block
-->
<template>
  <div class="block-demo">
    <!-- 页面标题 -->
    <header class="demo-header">
      <h1 class="demo-title">Block 渲染测试</h1>
      <p class="demo-subtitle">验证 BlockRenderer 组件渲染 dialogue 和 quiz 类型</p>
    </header>

    <!-- 页面选择器 -->
    <div class="page-selector">
      <label class="selector-label">选择页面：</label>
      <select v-model="selectedPage" class="selector-input" @change="handlePageChange">
        <option value="WEN_01">WEN_01 - 陈涉世家</option>
        <option value="WEN_04">WEN_04 - 庄子</option>
        <option value="WEN_02">WEN_02</option>
      </select>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-if="loading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载页面配置...</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div class="error-state" v-else-if="error">
      <div class="error-content">
        <div class="error-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <p class="error-message">{{ error }}</p>
        <button class="retry-button" @click="loadPage">
          <i class="fas fa-redo"></i>
          重新加载
        </button>
      </div>
    </div>

    <!-- 页面内容 -->
    <template v-else-if="pageConfig">
      <!-- 配置信息 -->
      <div class="config-info">
        <h2 class="config-title">页面配置信息</h2>
        <p class="config-id">Page ID: {{ pageConfig.pageId }}</p>
        <p class="config-count">Blocks 数量: {{ pageConfig.blocks.length }}</p>
      </div>

      <!-- Blocks 列表 -->
      <div class="blocks-section">
        <h2 class="section-title">
          Blocks 渲染区域 (已提交: {{ submittedCount }}/{{ quizIndices.length }})
        </h2>
        <div class="blocks-list">
          <div v-for="(block, index) in visibleBlocks" :key="index" class="block-wrapper">
            <div class="block-label">
              <span class="block-index">Block {{ index + 1 }}</span>
              <span class="block-type" :class="`type-${block.type}`">{{ block.type }}</span>
            </div>
            <!-- 为quiz类型添加动态标题 -->
            <BlockRenderer
              v-if="block.type === 'quiz'"
              :block="addQuizTitle(block, index)"
              @quiz-submitted="handleQuizSubmitted"
            />
            <BlockRenderer v-else :block="block" />
          </div>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <div class="empty-content">
        <div class="empty-icon">
          <i class="fas fa-inbox"></i>
        </div>
        <p class="empty-message">未找到页面配置</p>
      </div>
    </div>

    <!-- 导航按钮 -->
    <div class="demo-nav">
      <button class="nav-button back-btn" @click="goBack">
        <i class="fas fa-arrow-left"></i>
        返回首页
      </button>
      <button class="nav-button refresh-btn" @click="loadPage">
        <i class="fas fa-sync-alt"></i>
        刷新
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BlockRenderer from '@/components/BlockRenderer.vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { useNavigation } from '@/composables/useNavigation'
import type { PageConfig } from '@/types/pageConfig'
import { debugLog } from '@/utils/debug'

// 非顺序页面（block-demo）不传 currentRouteName，仅使用 goHome
const { goHome } = useNavigation()

// 选中的页面ID
const selectedPage = ref('WEN_01')

// 页面配置URL
const pageUrl = computed(() => `/data/pages_level2_dialog_quiz/${selectedPage.value}.json`)

// 加载页面配置
const { data: pageConfig, loading, error, retry } = useDataLoader<PageConfig>(() => pageUrl.value)

// 已提交的题目数量
const submittedCount = ref(0)

// 找出所有 quiz 的索引
const quizIndices = computed(() => {
  if (!pageConfig.value) return []
  return pageConfig.value.blocks.reduce<number[]>((arr, block, idx) => {
    if (block.type === 'quiz') arr.push(idx)
    return arr
  }, [])
})

// 当前应显示的 blocks 范围
const visibleBlocks = computed(() => {
  if (!pageConfig.value) return []
  const blocks = pageConfig.value.blocks
  // 没有题目则全部显示
  if (quizIndices.value.length === 0) return blocks

  const lastIdx = quizIndices.value[submittedCount.value]
  // 如果所有题目都已提交，显示全部
  if (lastIdx === undefined) return blocks
  // 显示从 0 到下一个 quiz 之间的所有内容（包含该 quiz）
  return blocks.slice(0, lastIdx + 1)
})

// 处理题目提交
function handleQuizSubmitted() {
  submittedCount.value++
  debugLog('题目已提交，当前提交数:', submittedCount.value)
}

// 加载页面
function loadPage() {
  // 重置提交计数
  submittedCount.value = 0
  retry()
}

// 页面切换
function handlePageChange() {
  // 切换页面时重置提交计数
  submittedCount.value = 0
  debugLog('切换到页面:', selectedPage.value)
}

// 返回首页
function goBack() {
  goHome()
}

// 为quiz block添加标题
function addQuizTitle(block: any, index: number) {
  // 创建新的block对象，避免修改原始数据
  const newBlock = { ...block }

  // 生成动态标题：基于题目编号或页面信息
  const questionNum = block.data?.question_number
  if (questionNum) {
    newBlock.data = {
      ...block.data,
      title: `第${questionNum}题`,
    }
  } else {
    newBlock.data = {
      ...block.data,
      title: `阅读理解`,
    }
  }

  return newBlock
}

// 组件挂载时加载
onMounted(() => {
  debugLog('[BlockDemoView] 测试页面已加载')
})
</script>

<style scoped>
.block-demo {
  padding: var(--spacing-lg);
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 6rem;
  font-family: var(--font-family-serif);
}

/* 页面标题 */
.demo-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-xl);
  background: var(--color-primary);
  border-radius: var(--radius-card);
  color: var(--color-white);
}

.demo-title {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-heavy);
}

.demo-subtitle {
  margin: 0;
  font-size: var(--font-size-small);
  opacity: 0.9;
}

/* 页面选择器 */
.page-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-md);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
}

.selector-label {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.selector-input {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-md);
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  background: var(--color-white);
}

.selector-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-primary);
}

.loading-spinner i {
  font-size: 2rem;
}

/* 错误状态 */
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  border: var(--border-width-hairline) solid var(--color-placeholder);
}

.error-icon {
  font-size: 2rem;
  color: var(--color-primary);
}

.error-message {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-small);
}

.retry-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-button:hover {
  background: var(--color-primary-hover);
}

/* 配置信息 */
.config-info {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-md);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  border: var(--border-width-hairline) solid var(--color-border);
}

.config-title {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--color-border);
}

.config-id,
.config-count {
  margin: 0.25rem 0;
  font-size: var(--font-size-small);
  color: var(--color-border);
}

/* Blocks区域 */
.blocks-section {
  margin-bottom: var(--spacing-xl);
}

.section-title {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.block-wrapper {
  border: var(--border-width-hairline) solid var(--color-placeholder);
  border-radius: var(--radius-small);
  overflow: hidden;
}

.block-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-highlight);
  border-bottom: var(--border-width-hairline) solid var(--color-placeholder);
}

.block-index {
  font-size: 0.75rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.block-type {
  font-size: 0.75rem;
  font-weight: var(--font-weight-semibold);
  padding: 0.25rem var(--spacing-sm);
  border-radius: 9999px;
}

/* 语义类型标签 - 对话用橄榄绿，测验用暖棕 */
.block-type.type-dialogue {
  background: var(--color-bg-highlight);
  color: var(--color-border);
}

.block-type.type-quiz {
  background: var(--color-bg-highlight);
  color: var(--color-accent);
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.empty-icon {
  width: 64px;
  height: 64px;
  background: var(--color-placeholder);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-secondary);
}

.empty-message {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
}

/* 导航按钮 */
.demo-nav {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.nav-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

/* 返回按钮 - 白底 */
.back-btn {
  background: var(--color-white);
  color: var(--color-text);
}

.back-btn:hover {
  background: var(--color-bg-highlight);
}

/* 刷新按钮 - 朱红底 */
.refresh-btn {
  background: var(--color-primary);
  color: var(--color-white);
}

.refresh-btn:hover {
  background: var(--color-primary-hover);
}

@media (max-width: 768px) {
  .block-demo {
    padding: var(--spacing-md);
  }

  .demo-title {
    font-size: var(--font-size-subheading);
  }

  .page-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .demo-nav {
    flex-direction: column;
  }
}
</style>
