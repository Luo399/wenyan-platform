
# 组件开发规范

## 1. 命名规则

| 类别 | 规则 | 示例 |
|:---|:---|:---|
| 文件与组件名 | PascalCase | `WordList.vue` |
| Props | camelCase | `wenId`, `autoLoad` |
| Events | kebab-case | `@load-success` |
| 布尔状态 | `is`/`has`/`show` 前缀 | `isPlaying`, `showTooltip` |
| 数据状态 | 名词复数 | `wordList`, `segments` |

## 2. Props 定义

```typescript
interface Props {
  wenId: string
  autoLoad?: boolean
  dataUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoLoad: true,
  dataUrl: '/data/default.json'
})
```

## 3. Events 定义

```typescript
const emit = defineEmits<{
  (e: 'load-success', data: unknown): void
  (e: 'load-error', error: string): void
  (e: 'retry'): void
}>()
```

## 4. 数据来源判定

| 数据来源 | 加载方式 | 示例组件 |
|:---|:---|:---|
| 组件自行 fetch JSON | `useDataLoader` | WordList, MultiRoleReading |
| 父组件 props 传入 | 直接使用 props | Question, Options |
| 全局 store 获取 | 直接调用 store | StudentDisplay |
| 用户交互/表单 | 组件内部 state | StudentLogin |
| 媒体元素原生事件 | `onLoadedData` 等 | VideoPlayer |

组件通过 `fetch` 获取 JSON 数据时，必须使用 `useDataLoader`，不允许在组件内直接调用 `fetch` 或 `axios`。

## 5. 状态处理模板

```vue
<template>
  <BaseLoader v-if="loading" />
  <BaseTimeout v-else-if="isTimeout" @retry="retry" />
  <BaseError v-else-if="error" :error="error" @retry="retry" />
  <BaseEmpty v-else-if="!data?.length" />
  <div v-else>
    <!-- 正常渲染 -->
  </div>
</template>
```

## 6. useDataLoader 调用

```typescript
import { useDataLoader } from '@/composables/useDataLoader'

const url = computed(() => `/data/${props.wenId}.json`)

const { data, loading, error, isTimeout, retry } = useDataLoader(url, {
  timeout: 10000,
  retryCount: 1,
  cacheEnabled: true
})
```

## 7. 组件隔离规则

### 7.1 耦合类型与防范

| 耦合类型 | 表现 | 防范 |
|:---|:---|:---|
| 公共逻辑修改 | 修改组件 A 时改动全局 `fetch` 封装，导致组件 B 异常 | `useDataLoader` 为唯一数据加载入口，该文件锁定 |
| 全局状态污染 | 组件 A 的 `loading`/`error` 写入 Pinia store，组件 B 误读 | 组件本地状态使用 `ref`/`reactive`，不放入全局 store |
| 全局样式冲突 | 组件 A 未使用 `scoped`，类名污染组件 B | 所有业务组件样式使用 `<style scoped>` |

### 7.2 强制约束

- 修改范围限定当前组件的 `.vue` 文件，禁止修改 `composables/`、`config/`、`vite.config.js`、`router/`、`store/` 等公共目录
- 样式必须使用 `<style scoped>`
- 组件本地状态 `loading`、`error`、`data` 定义在组件自身
- 修改完成后验证音频、对话、导航等其他功能正常

### 7.3 任务约束语

每次 AI 修改组件时，附加以下约束：

> 只允许修改 `src/components/xxx/xxx.vue` 文件。数据加载必须使用 `useDataLoader`。样式必须加 `scoped`。禁止修改任何公共文件。修改后确保其他组件功能不受影响。

## 8. 生命周期与资源清理

```typescript
onMounted(() => {
  if (props.autoLoad) loadData()
})

onUnmounted(() => {
  abortController?.abort()
  audioRef.value?.pause()
  audioRef.value?.src = ''
  clearTimeout(timer)
})
```

## 9. 异步操作模式

```typescript
async function loadData() {
  loading.value = true
  error.value = null

  try {
    const response = await fetch(url, { signal: abortController.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(buffer)
    data.value = JSON.parse(text)
  } catch (err) {
    if (err.name === 'AbortError') {
      isTimeout.value = true
      return
    }
    error.value = err.message
  } finally {
    loading.value = false
  }
}
```

## 10. 组件注释模板

```vue
<!--
  ComponentName.vue - 功能描述
  Props:
    wenId: string - 课文ID
    autoLoad?: boolean - 是否自动加载，默认 true
  Events:
    load-success: 数据加载成功
    load-error: 数据加载失败
  使用:
    <ComponentName wen-id="WEN_01" @load-success="handler" />
-->
```

## 11. 新增组件检查清单

- [ ] PascalCase 命名，`<style scoped>`
- [ ] 数据来源按第 4 节判定，需 fetch 时使用 `useDataLoader`
- [ ] 实现四态处理：loading、error、timeout、empty
- [ ] 生命周期清理：abort、pause、clearTimeout
- [ ] 未修改公共文件
- [ ] 顶部包含组件注释

---

**原则：每个组件为独立单元，数据加载统一入口，样式和状态严格隔离。任何公共逻辑的修改需获得明确许可。**