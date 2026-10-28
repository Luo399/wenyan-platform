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
              @change="onClassChange"
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
   * 两个调用点（AdminConsoleView / TeacherRegisterView）都只监听
   * `@update:full-access` 而**不**绑这个 prop，所以组件必须自己记住状态；
   * 绑了则按 v-model:fullAccess 语义双向同步。
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
/**
 * 全年级权限的唯一事实源。
 *
 * 这里不能用「props.fullAccess 是不是 undefined」来判断父组件有没有接管：
 * Vue 对 Boolean prop 做隐式转换，父组件不传时 props.fullAccess 是 false
 * 而不是 undefined（见 runtime-dom 的 resolvePropValue：absent && !hasDefault
 * → false），所以旧写法 `props.fullAccess ?? innerFullAccess` 永远读到 false，
 * 勾了「全年级权限」也不会收起具体班级选择区，`if (props.fullAccess === undefined)`
 * 分支同样是死代码。改成内部状态为准，prop 只在变化时同步进来。
 */
const innerFullAccess = ref(props.fullAccess === true)

// ===== 派生 =====
/**
 * 当前是否处于"全年级权限"状态。
 * 与 classCodes 解耦：fullAccess=true 时父组件应清空 classCodes，
 * 但组件本身不强制两者等价。
 */
const isFullAccess = computed<boolean>({
  get: () => innerFullAccess.value,
  set: (v: boolean) => {
    innerFullAccess.value = v
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
    // 父组件绑了这个 prop 时以它为准（未绑定时 val 恒为 false，watcher 不会触发）
    innerFullAccess.value = val === true
    // 外部强制打开全权限时清空 classCodes
    if (val === true) {
      innerClassCodes.value = []
      selectedGrades.value = []
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

/**
 * 年级 chip 只是"展开这一级的班级列表"的过滤器，勾选后应当留在页面上；
 * 它什么时候自动取消勾选：该年级下的班级已经被清空的时候。
 *
 * 只允许在班级数量**减少**的路径上调用。放进 emitChange() 里会出事：
 * 勾年级 chip 时 v-model 先把年级加进 selectedGrades，紧接着的 emitChange
 * 用「已选班级」（此时还是空）反推，把刚勾上的年级立刻抹掉，班级行永远出不来。
 */
function pruneGradesToSelection() {
  const gSet = new Set(innerClassCodes.value.map((c) => c.slice(0, 4)))
  selectedGrades.value = selectedGrades.value.filter((g) => gSet.has(g))
}

/** 同步内部选择到父组件 */
function emitChange() {
  emit('update:modelValue', [...innerClassCodes.value])
  // 仅当 classCodes 非空时，强制 fullAccess=false（因为有具体班级选中了）
  if (innerClassCodes.value.length > 0) {
    innerFullAccess.value = false
    emit('update:fullAccess', false)
  }
}

/** 班级 chip 勾选 / 取消 */
function onClassChange() {
  pruneGradesToSelection()
  emitChange()
}

/** 手动输入添加班级编码 */
function addManual() {
  // trim 是有意的：从表格里复制编码常带首尾空格
  const code = manualCode.value.trim()
  if (!/^\d{6}$/.test(code)) return
  if (!innerClassCodes.value.includes(code)) innerClassCodes.value.push(code)
  manualCode.value = ''
  emitChange()
}

/** 移除一个已选班级 */
function removeClass(code: string) {
  innerClassCodes.value = innerClassCodes.value.filter((c) => c !== code)
  pruneGradesToSelection()
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
