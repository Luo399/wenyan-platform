<template>
  <div class="class-picker">
    <!-- 全年级权限开关 -->
    <label class="full-access-label">
      <input type="checkbox" :checked="modelValue.length === 0" @change="onFullToggle" />
      <span>全年级权限（可查看所有学生答题记录）</span>
    </label>

    <!-- 具体班级选择（非全权限时显示） -->
    <template v-if="modelValue.length > 0">
      <!-- 年级多选 chip -->
      <div class="picker-row">
        <span class="picker-label">年级：</span>
        <div class="chip-row">
          <label
            v-for="g in grades"
            :key="g"
            class="chip-wrap"
          >
            <input
              type="checkbox"
              :value="g"
              v-model="selectedGrades"
              class="chip-input"
              @change="emitChange"
            />
            <span class="chip">{{ g }}级</span>
          </label>
          <span v-if="grades.length === 0" class="empty-hint">暂无年级数据</span>
        </div>
      </div>

      <!-- 班级多选 chip（按所选年级动态） -->
      <div v-if="selectedGrades.length > 0" class="picker-row">
        <span class="picker-label">班级：</span>
        <div class="chip-row">
          <label
            v-for="code in availableCodes"
            :key="code"
            class="chip-wrap"
          >
            <input
              type="checkbox"
              :value="code"
              v-model="innerClassCodes"
              class="chip-input"
              @change="emitChange"
            />
            <span class="chip">{{ code.slice(4) }}班</span>
          </label>
        </div>
      </div>

      <!-- 手动输入 -->
      <div class="picker-row manual-row">
        <span class="picker-label">手动：</span>
        <input
          v-model="manualCode"
          type="text"
          class="manual-input"
          placeholder="6 位编码"
          maxlength="6"
          @keyup.enter="addManual"
        />
        <button type="button" class="add-btn" @click="addManual" :disabled="!manualCode.trim()">添加</button>
      </div>

      <!-- 已选列表 -->
      <div v-if="innerClassCodes.length > 0" class="selected-row">
        <span class="picker-label">已选 {{ innerClassCodes.length }} 个：</span>
        <span class="selected-list">
          <span v-for="code in innerClassCodes" :key="code" class="selected-code">
            {{ code }}
            <button type="button" class="remove-btn" @click="removeClass(code)">×</button>
          </span>
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  /** 当前选中的 class_code 数组（v-model） */
  modelValue: string[]
  /** 是否允许全权限开关（默认 true） */
  allowFullAccess?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'update:fullAccess', value: boolean): void
}>()

const grades = ref<string[]>([])
const gradeMap = ref<Record<string, string[]>>({})
const selectedGrades = ref<string[]>([])
const innerClassCodes = ref<string[]>([...props.modelValue])
const manualCode = ref('')

/** 所选年级对应的所有可选班级 */
const availableCodes = computed(() => {
  const set = new Set<string>()
  for (const g of selectedGrades.value) {
    for (const code of gradeMap.value[g] || []) set.add(code)
  }
  return Array.from(set).sort()
})

// 父组件外部更新时同步
watch(
  () => props.modelValue,
  (val) => { innerClassCodes.value = [...val] },
)

/** 全年级开关 */
function onFullToggle(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    innerClassCodes.value = []
    selectedGrades.value = []
  }
  emitChange()
}

/** 同步选中的 class_codes 回父组件 */
function emitChange() {
  emit('update:modelValue', [...innerClassCodes.value])
  emit('update:fullAccess', innerClassCodes.value.length === 0)
  // 根据当前选择反推选中的年级
  const gSet = new Set(innerClassCodes.value.map((c) => c.slice(0, 4)))
  selectedGrades.value = selectedGrades.value.filter((g) => gSet.has(g))
}

/** 手动输入添加 */
function addManual() {
  const code = manualCode.value.trim()
  if (!/^\d{6}$/.test(code)) return
  if (!innerClassCodes.value.includes(code)) innerClassCodes.value.push(code)
  manualCode.value = ''
  emitChange()
}

/** 移除一个 */
function removeClass(code: string) {
  innerClassCodes.value = innerClassCodes.value.filter((c) => c !== code)
  emitChange()
}

/** 从后端拉年级/班级选项 */
async function fetchOptions(): Promise<void> {
  try {
    const res = await fetch('/api/admin/options/grades-classes')
    if (!res.ok) return
    const json = await res.json()
    grades.value = json.data?.grades || []
    gradeMap.value = json.data?.gradeMap || {}
  } catch { /* 下拉失败不阻塞手动输入 */ }
}

onMounted(fetchOptions)
</script>

<style scoped>
.class-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 0;
}

.full-access-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-highlight, #f5f5f5);
  border-radius: var(--radius-small, 6px);
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
}
.full-access-label input { width: 16px; height: 16px; }

.picker-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.picker-label {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #666);
  min-width: 40px;
  padding-top: 4px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.chip-wrap { position: relative; cursor: pointer; user-select: none; }
.chip-input { position: absolute; opacity: 0; width: 0; height: 0; }
.chip {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 999px;
  font-size: 0.8125rem;
  background: #fff;
  transition: all 0.15s ease;
}
.chip-input:checked + .chip {
  background: var(--color-primary, #4a6cf7);
  border-color: var(--color-primary, #4a6cf7);
  color: #fff;
}
.chip-wrap:hover .chip { border-color: var(--color-primary-hover, #3a5ce5); }

.empty-hint { font-size: 0.75rem; color: var(--color-text-secondary, #999); padding: 4px 0; }

.manual-row { gap: 6px; }
.manual-input {
  flex: 1;
  max-width: 180px;
  font-size: 0.875rem;
  padding: 6px 10px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
}
.add-btn {
  padding: 6px 14px;
  font-size: 0.8125rem;
  background: var(--color-primary, #4a6cf7);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.add-btn:hover:not(:disabled) { background: var(--color-primary-hover, #3a5ce5); }
.add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.selected-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}
.selected-code {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--color-bg-highlight, #eef2ff);
  border-radius: 4px;
  font-size: 0.8125rem;
  color: var(--color-primary, #4a6cf7);
}
.remove-btn {
  background: none;
  border: none;
  color: var(--color-primary, #4a6cf7);
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0 2px;
}
.remove-btn:hover { color: #d33; }
</style>
