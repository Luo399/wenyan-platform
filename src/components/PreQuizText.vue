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
    console.error('PreQuizText 数据加载失败:', e)
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
}

.pre-quiz-container {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.pre-quiz-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(59, 130, 246, 0.2);
}

.pre-quiz-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
}

.pre-quiz-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.pre-quiz-content {
  margin-bottom: 20px;
}

.pre-quiz-text-content {
  font-size: 16px;
  line-height: 1.8;
  color: #475569;
  margin: 0;
  text-align: justify;
}

.pre-quiz-footer {
  display: flex;
  justify-content: flex-end;
}

.pre-quiz-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.pre-quiz-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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
  gap: 12px;
  color: #667eea;
}

.loading-spinner i {
  font-size: 32px;
}

.loading-spinner span {
  font-size: 14px;
}

.pre-quiz-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 24px;
  background: #fef2f2;
  border-radius: 16px;
  border: 1px solid #fecaca;
}

.error-icon {
  width: 50px;
  height: 50px;
  background: #ef4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  margin-bottom: 16px;
}

.error-message {
  color: #dc2626;
  font-size: 14px;
  margin: 0 0 16px 0;
  text-align: center;
}

.error-retry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.error-retry:hover {
  background: #dc2626;
}
</style>
