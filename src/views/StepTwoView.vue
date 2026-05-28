<!--
  StepTwoView.vue - 数据驱动的页面组件

  通过PageConfig配置动态渲染不同类型的Block组件
  支持：dialog、quiz、wordlist、multi-role-reading等多种块类型

  布局说明：
  - 页面标题
  - 动态BlockRenderer区域
  - 底部导航按钮
-->
<template>
  <div class="steptwo-view">
    <!-- 页面标题 -->
    <header class="page-header" v-if="pageConfig?.title">
      <h1 class="page-title">{{ pageConfig.title }}</h1>
    </header>

    <!-- 加载状态 -->
    <div class="loading-state" v-if="loading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载页面内容...</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div class="error-state" v-else-if="error">
      <div class="error-content">
        <div class="error-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <p class="error-message">{{ error }}</p>
        <button class="retry-button" @click="retry">
          <i class="fas fa-redo"></i>
          重新加载
        </button>
      </div>
    </div>

    <!-- 页面内容 -->
    <template v-else-if="pageConfig">
      <div class="blocks-container">
        <BlockRenderer
          v-for="(block, index) in pageConfig.blocks"
          :key="`${block.type}-${index}`"
          :block="block"
        />
      </div>
    </template>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <div class="empty-content">
        <div class="empty-icon">
          <i class="fas fa-inbox"></i>
        </div>
        <p class="empty-message">暂无内容</p>
      </div>
    </div>

    <!-- 底部导航按钮 -->
    <BackContinue
      v-if="showNavigation"
      back-text="返回"
      continue-text="继续"
      @back="handleGoPrev"
      @continue="handleGoNext"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BlockRenderer from '@/components/BlockRenderer.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useDataLoader } from '@/composables/useDataLoader'
import type { PageConfig } from '@/types/pageConfig'

const route = useRoute()
const router = useRouter()

// 篇目ID（路由参数）
const poemId = computed(() => route.params.id as string)

// 将路由参数转换为wenId格式
const wenId = computed(() => {
  const id = poemId.value
  if (!id) return 'WEN_01'
  if (id.startsWith('WEN_')) return id
  const num = parseInt(id, 10)
  if (isNaN(num)) return 'WEN_01'
  return `WEN_${num.toString().padStart(2, '0')}`
})

// 页面配置URL
const pageUrl = computed(() => `/data/pages/${wenId.value}.json`)

// 使用数据加载器获取页面配置
const { data: pageConfig, loading, error, retry } = useDataLoader<PageConfig>(() => pageUrl.value)

// 是否显示导航按钮
const showNavigation = computed(() => !loading.value && !error.value && pageConfig.value)

// 使用导航composable
const { goNext, goPrev } = useNavigation('steptwo', poemId.value)

// 导航函数包装
function handleGoNext() {
  goNext(router)
}

function handleGoPrev() {
  goPrev(router)
}

// 监听wenId变化，重新加载
watch(wenId, () => {
  // useDataLoader会自动响应pageUrl的变化
})

onMounted(() => {
  console.log('[StepTwoView] 页面加载:', wenId.value)
})
</script>

<style scoped>
.steptwo-view {
  padding: 1rem;
  max-width: 1000px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

/* 页面标题 */
.page-header {
  margin-bottom: 1.5rem;
  text-align: center;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #667eea;
}

.loading-spinner i {
  font-size: 2rem;
}

.loading-spinner span {
  font-size: 0.875rem;
}

/* 错误状态 */
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: #fef2f2;
  border-radius: 1rem;
  border: 1px solid #fecaca;
}

.error-icon {
  font-size: 2rem;
  color: #ef4444;
}

.error-message {
  margin: 0;
  color: #dc2626;
  font-size: 0.875rem;
  text-align: center;
}

.retry-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-button:hover {
  background: #dc2626;
}

/* 页面内容 */
.blocks-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: #f9fafb;
  border-radius: 1rem;
}

.empty-icon {
  width: 64px;
  height: 64px;
  background: #e5e7eb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #9ca3af;
}

.empty-message {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .steptwo-view {
    padding: 0.75rem;
  }
  
  .page-title {
    font-size: 1.25rem;
  }
}
</style>
