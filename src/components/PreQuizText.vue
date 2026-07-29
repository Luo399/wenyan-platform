<template>
  <div class="pre-quiz-text">
    <div class="pre-quiz-container" v-if="hasContent">
      <div class="pre-quiz-header">
        <div class="pre-quiz-icon">
          <i class="fas fa-book-open"></i>
        </div>
        <h3 class="pre-quiz-title">{{ title }}</h3>
      </div>

      <div class="pre-quiz-content">
        <p class="pre-quiz-text-content">{{ scenarioText }}</p>
      </div>

      <div class="pre-quiz-footer" v-if="showFooter">
        <button class="pre-quiz-button" @click="handleContinue" :disabled="isLoading">
          <i class="fas fa-arrow-right"></i>
          {{ buttonText }}
        </button>
      </div>
    </div>

    <div class="pre-quiz-loading" v-else-if="isLoading">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载中...</span>
      </div>
    </div>

    <div class="pre-quiz-error" v-else-if="error">
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
import { ref, computed, onMounted } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { adaptScenarioText, getScenarioTextByQuestion } from '@/adapters/scenarioAdapter'
import type { ProcessedScenarioText, RawScenarioText } from '@/adapters/scenarioAdapter'
import { debugError } from '@/utils/debug'

interface Props {
  questionNumber?: number
  title?: string
  buttonText?: string
  showFooter?: boolean
  autoLoad?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  questionNumber: 1,
  title: '情景导入',
  buttonText: '开始答题',
  showFooter: true,
  autoLoad: true,
})

const emit = defineEmits<{
  (e: 'continue'): void
  (e: 'loaded', data: ProcessedScenarioText): void
  (e: 'error', error: string): void
}>()

// 状态
const isLoading = ref(false)
const error = ref<string | null>(null)
const scenarioText = ref('')
const processedData = ref<ProcessedScenarioText[]>([])

// 计算属性
const hasContent = computed(() => scenarioText.value && !error.value && !isLoading.value)

// 加载数据
async function loadData() {
  if (!props.autoLoad) return

  isLoading.value = true
  error.value = null

  try {
    const url = `/data/level3_scenario_text/WEN_01.json`
    const { data: rawData, error: loadError } = useDataLoader<RawScenarioText[]>(() => url)

    if (loadError.value) {
      throw new Error(`数据加载失败: ${loadError.value}`)
    }

    if (rawData.value) {
      processedData.value = adaptScenarioText(rawData.value)

      const scenario = getScenarioTextByQuestion(processedData.value, props.questionNumber)

      if (scenario) {
        scenarioText.value = scenario.scenarioText
        emit('loaded', scenario)
      } else {
        error.value = `未找到题目编号 ${props.questionNumber} 的情景文本`
        emit('error', error.value)
      }
    } else {
      error.value = '数据为空'
      emit('error', error.value)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '数据处理失败'
    emit('error', error.value)
    debugError('PreQuizText 数据加载失败:', e)
  } finally {
    isLoading.value = false
  }
}

// 处理继续
function handleContinue() {
  emit('continue')
}

// 重试加载
function handleRetry() {
  loadData()
}

// 组件挂载时加载数据
onMounted(() => {
  loadData()
})

// 暴露方法供外部调用
defineExpose({
  reload: loadData,
  scenarioText,
})
</script>

<style scoped>
.pre-quiz-text {
  width: 100%;
  min-height: 200px;
  font-family: var(--font-family-serif);
}

/* 情景导入容器：30px 圆角 + 设计 token 阴影 */
.pre-quiz-container {
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-card);
}

.pre-quiz-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: var(--border-width-thin) solid var(--color-border);
}

.pre-quiz-icon {
  width: 40px;
  height: 40px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: var(--font-size-body-lg);
}

.pre-quiz-title {
  margin: 0;
  font-size: var(--font-size-body-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.pre-quiz-content {
  margin-bottom: var(--spacing-lg);
}

.pre-quiz-text-content {
  font-size: var(--font-size-body);
  line-height: 1.8;
  color: var(--color-text);
  margin: 0;
  text-align: justify;
}

.pre-quiz-footer {
  display: flex;
  justify-content: flex-end;
}

/* 按钮：朱红底色 + 橄榄绿边框 + 50px 圆角 */
.pre-quiz-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.3s ease;
}

.pre-quiz-button:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-small);
}

.pre-quiz-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pre-quiz-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-primary);
}

.loading-spinner i {
  font-size: var(--font-size-heading);
}

.loading-spinner span {
  font-size: var(--font-size-small);
}

/* 错误态：语义色红色 */
.pre-quiz-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: var(--spacing-xl);
  background: #fef2f2;
  border-radius: var(--radius-card);
  border: var(--border-width-hairline) solid #fecaca;
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
  font-size: var(--font-size-subheading);
  margin-bottom: var(--spacing-md);
}

.error-message {
  color: var(--color-primary-hover);
  font-size: var(--font-size-small);
  margin: 0 0 var(--spacing-md) 0;
  text-align: center;
}

.error-retry {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-button);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: background 0.3s ease;
}

.error-retry:hover {
  background: var(--color-primary-hover);
}
</style>
