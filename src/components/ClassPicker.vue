<template>
  <div class="class-picker" data-testid="class-picker">
    <!-- 全年级权限开关 -->
    <label class="full-access-label" data-testid="full-access-label">
      <input
        type="checkbox"
        :checked="isFullAccess"
        @change="onFullToggle"
        data-testid="full-access-checkbox"
      />
      <span>全年级权限（可查看所有学生答题记录）</span>
    </label>

    <!-- 具体班级选择（非全权限时显示） -->
    <div v-if="!isFullAccess" data-testid="specific-picker">
      <!-- 年级多选 chip -->
      <div class="picker-row" data-testid="grade-row">
        <span class="picker-label">年级：</span>
        <div class="chip-row">
          <label
            v-for="g in grades"
            :key="g"
            class="chip-wrap"
            :data-testid="`grade-${g}`"
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
      <div v-if="selectedGrades.length > 0" class="picker-row" data-testid="class-row">
        <span class="picker-label">班级：</span>
        <div class="chip-row">
          <label
            v-for="code in availableCodes"
            :key="code"
            class="chip-wrap"
            :data-testid="`class-${code}`"
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
      <div class="picker-row manual-row" data-testid="manual-row">
        <span class="picker-label">手动：</span>
        <input
          v-model="manualCode"
          type="text"
          class="manual-input"
          placeholder="6 位编码"
          maxlength="6"
          data-testid="manual-input"
          @keyup.enter="addManual"
        />
        <button
          type="button"
          class="add-btn"
          :disabled="!manualCode.trim()"
          data-testid="add-btn"
          @click="addManual"
        >添加</button>
      </div>

      <!-- 已选列表 -->
      <div v-if="innerClassCodes.length > 0" class="selected-row" data-testid="selected-row">
        <span class="picker-label">已选 {{ innerClassCodes.length }} 个：</span>
        <span class="selected-list">
          <span
            v-for="code in innerClassCodes"
            :key="code"
            class="selected-code"
            :data-testid="`selected-${code}`"
          >
            {{ code }}
            <button
              type="button"
              class="remove-btn"
              aria-label="移除"
              :data-testid="`remove-${code}`"
              @click="removeClass(code)"
            >×</button>
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { fetchGradesAndClasses, type ClassOptions } from '@/services/classOptions'

export interface ClassPickerProps {
  /** 当前选中的 class_code 数组（v-model） */
  modelValue?: string[]
  /**
   * 可选：父组件传入的全年级权限状态。
   * 不传时组件内部自管 fullAccess（内部状态 + emit 通知父组件）。
   * 传了则双向同步（v-model:fullAccess 语义）。
   */
  fullAccess?: boolean
  /**
   * 直接传入年级/班级选项 —— 有值时跳过 fetch（测试友好、SSR 友好）
   * 不传则在 onMounted 从后端拉取
   */
  options?: ClassOptions
}

const props = withDefaults(defineProps<ClassPickerProps>(), {
  modelValue: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'update:fullAccess', value: boolean): void
}>()

// ===== 选项数据源（优先用 props.options，否则在 onMounted fetch）=====
const grades = ref<string[]>(props.options?.grades ?? [])
const gradeMap = ref<Record<string, string[]>>(props.options?.gradeMap ?? {})

// ===== 本地状态 =====
const innerClassCodes = ref<string[]>([...props.modelValue])
const selectedGrades = ref<string[]>([])
const manualCode = ref('')
/** 内部 fullAccess 状态（仅当 props.fullAccess 未传时使用） */
const innerFullAccess = ref(false)

// ===== 派生 =====
/**
 * 当前是否处于"全年级权限"状态。
 * 优先使用父组件传入的 props.fullAccess；未传时用内部状态。
 * 与 classCodes 解耦：fullAccess=true 时父组件应清空 classCodes，
 * 但组件本身不强制两者等价。
 */
const isFullAccess = computed({
  get: () => props.fullAccess ?? innerFullAccess.value,
  set: (v: boolean) => {
    if (props.fullAccess === undefined) {
      innerFullAccess.value = v
    }
    emit('update:fullAccess', v)
    // 打开全权限时清空已选班级（同步 modelValue）；关闭时保持 classCodes 原样
    if (v) {
      innerClassCodes.value = []
      selectedGrades.value = []
      emit('update:modelValue', [])
    }
  },
})

/** 所选年级对应的所有可选班级（去重排序） */
const availableCodes = computed(() => {
  const set = new Set<string>()
  for (const g of selectedGrades.value) {
    for (const code of gradeMap.value[g] || []) set.add(code)
  }
  return Array.from(set).sort()
})

// ===== 同步 =====
watch(
  () => props.modelValue,
  (val) => { innerClassCodes.value = [...val] },
)
watch(
  () => props.fullAccess,
  (val) => {
    if (val !== undefined) {
      innerFullAccess.value = val
      // 外部强制打开全权限时清空 classCodes
      if (val) {
        innerClassCodes.value = []
        selectedGrades.value = []
      }
    }
  },
)
watch(
  () => props.options,
  (val) => {
    if (val) {
      grades.value = val.grades
      gradeMap.value = val.gradeMap
    }
  },
)

// ===== 事件处理 =====
/** 全年级开关切换 */
function onFullToggle(e: Event) {
  isFullAccess.value = (e.target as HTMLInputElement).checked
}

/** 同步内部选择到父组件（v-model + fullAccess 保持不变） */
function emitChange() {
  emit('update:modelValue', [...innerClassCodes.value])
  // 仅当 classCodes 非空时，强制 fullAccess=false（因为有具体班级选中了）
  if (innerClassCodes.value.length > 0) {
    if (props.fullAccess === undefined) {
      innerFullAccess.value = false
    }
    emit('update:fullAccess', false)
  }
  // 根据当前选中的班级反推保留有效的年级（避免已选的年级在移除对应班级后残留）
  const gSet = new Set(innerClassCodes.value.map((c) => c.slice(0, 4)))
  selectedGrades.value = selectedGrades.value.filter((g) => gSet.has(g))
}

/** 手动输入添加班级编码 */
function addManual() {
  const code = manualCode.value.trim()
  if (!/^\d{6}$/.test(code)) return
  if (!innerClassCodes.value.includes(code)) innerClassCodes.value.push(code)
  manualCode.value = ''
  emitChange()
}

/** 移除一个已选班级 */
function removeClass(code: string) {
  innerClassCodes.value = innerClassCodes.value.filter((c) => c !== code)
  emitChange()
}

// ===== 初始化：仅当 props.options 未传时才去 fetch =====
onMounted(async () => {
  if (props.options) return
  try {
    const data = await fetchGradesAndClasses()
    grades.value = data.grades
    gradeMap.value = data.gradeMap
  } catch {
    // 下拉失败不阻塞手动输入
  }
})
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
