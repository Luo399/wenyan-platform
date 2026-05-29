# 2-数据与编码规范

## 1. 文件编码规范

### 1.1 统一编码标准

| 文件类型 | 编码格式 | BOM | 说明 |
|---------|---------|-----|------|
| .json | UTF-8 without BOM | 不允许 | JSON标准要求，`WordList`/`MultiRoleReading`组件依赖 |
| .js/.ts/.vue | UTF-8 | 可选 | 统一UTF-8 |
| .csv | UTF-8 with BOM | 建议 | Excel兼容，用于导入题目数据 |
| .md | UTF-8 | 可选 | 项目文档 |

### 1.2 强制检查清单

- 新建文件时确认编码为 UTF-8（编辑器右下角显示）
- Excel导出CSV/JSON时选择UTF-8编码
- Vite配置确保静态资源响应头包含 `charset=utf-8`
- 项目根目录必须有 `.editorconfig` 文件

### 1.3 .editorconfig 模板（项目根目录）

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

## 2. Vite 服务器配置

### 2.1 JSON响应头配置（`vite.config.ts`）

```typescript
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    fs: { strict: false }
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      next()
    })
  }
})
```

## 3. 前端数据请求规范

### 3.1 显式UTF-8解码（`WordList.vue`实现方式）

```typescript
// src/components/WordList.vue - loadData函数
const wordListBuffer = await wordListResponse.arrayBuffer()
const wordListText = new TextDecoder('utf-8').decode(wordListBuffer)
const wordListData: WordItem[] = JSON.parse(wordListText)

const basicInfoBuffer = await basicInfoResponse.arrayBuffer()
const basicInfoText = new TextDecoder('utf-8').decode(basicInfoBuffer)
const basicInfoData: TextBasicInfo = JSON.parse(basicInfoText)
```

### 3.2 带超时的请求封装

```typescript
// 可添加到 src/utils/api.ts
async function fetchJsonWithTimeout(url: string, timeout = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const buffer = await response.arrayBuffer()
    return JSON.parse(new TextDecoder('utf-8').decode(buffer))
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      console.error(`[API] ⏰ 请求超时: ${url}`)
      throw new Error('请求超时')
    }
    throw err
  }
}
```

## 4. JSON文件生成规范

### 4.1 禁止手动拼接

❌ 错误：
```typescript
// 禁止！可能导致编码问题
const json = '{"word": "' + word + '", "meaning": "' + meaning + '"}'
```

✅ 正确（`generate-wordlist.cjs`采用方式）：
```typescript
const data = {
  text_id: 'WEN_01',
  word: word,
  basic_meaning: meaning,
  synonym_analysis: '',
  follow_up_questions: []
}
const json = JSON.stringify(data, null, 2)
fs.writeFileSync('public/data/word_list/WEN_01.json', json, { encoding: 'utf-8' })
```

### 4.2 Excel导出规范

**输入文件**: `开发需求填写.dbt.xlsx`  
**输出目录**: `public/data/`

| 工作表名 | 输出文件名 | 对应组件 |
|---------|-----------|---------|
| WordList | `word_list/WEN_xx.json` | `WordList.vue` |
| MultiRoleReading | `multi_role_reading/WEN_xx.json` | `MultiRoleReading.vue` |
| TextBasicInfo | `text_basic_info/WEN_xx.json` | `WordList.vue` |

### 4.3 数据结构定义

**WordItem（字词项）** - `public/data/word_list/WEN_xx.json`：
```typescript
interface WordItem {
  text_id: string           // 课文ID，如 "WEN_01"
  word: string              // 字词内容，如 "阳城"
  basic_meaning: string     // 基本释义，如 "在今河南登封东南"
  synonym_analysis?: string // 近义辨析
  follow_up_questions?: string[] // 追问问题
}
```

**TextBasicInfo（课文基础信息）** - `public/data/text_basic_info/WEN_xx.json`：
```typescript
interface TextBasicInfo {
  text_id: string           // 课文ID
  title: string             // 课文标题，如 "陈涉世家"
  author: string            // 作者，如 "司马迁"
  dynasty: string           // 朝代，如 "汉"
  original_text: string     // 原文内容
  illustration?: string     // 插图路径
  bgm?: string              // 背景音乐路径
}
```

**MultiRoleData（多角色朗读数据）** - `public/data/multi_role_reading/WEN_xx.json`：
```typescript
interface MultiRoleSegment {
  sentence_index: number    // 段落序号
  time_range: string        // 时间范围，如 "00:00-00:16"
  role_name: string         // 角色名称，如 "旁白📖"
  dialogue: string          // 朗读文本
}

interface MultiRoleData {
  text_id: string           // 课文ID
  audio_file: string        // 音频文件名，如 "WEN_01_multi_role.mp3"
  segments: MultiRoleSegment[]
}
```

## 5. 组件加载状态规范

### 5.1 四态处理（`WordList.vue`示例）

```vue
<template>
  <div class="word-list-container">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <i class="fas fa-exclamation-circle"></i>
      <p>{{ error }}</p>
      <button @click="loadData" class="retry-btn">重试</button>
    </div>

    <!-- 空数据状态 -->
    <div v-else-if="!wordList.length && !basicInfo" class="empty-state">
      <p>暂无数据</p>
    </div>

    <!-- 正常渲染 -->
    <div v-else class="content-wrapper">
      <h1 class="article-title">{{ articleTitle }}</h1>
      <div class="article-content" v-html="sanitizedContent"></div>
    </div>
  </div>
</template>
```

### 5.2 超时与重试（`WordList.vue`实现）

```typescript
// src/components/WordList.vue - loadData函数
const timeoutMs = 10000
const timeoutTimer = setTimeout(() => {
  console.log(`[WordList] ⏰ 警告：请求耗时已超过 ${timeoutMs}ms`)
}, timeoutMs)

try {
  // 请求逻辑...
  clearTimeout(timeoutTimer)
} catch (err) {
  clearTimeout(timeoutTimer)
  // 错误处理...
}
```

## 6. 常见问题速查

| 现象 | 原因 | 检查项 | 解决方法 |
|-----|------|-------|---------|
| 页面一直加载/转圈 | JSON解析失败 | 控制台报错、文件编码和格式 | 使用 `TextDecoder('utf-8')` 显式解码 |
| 中文乱码 | 编码不匹配 | 响应头是否包含 `charset=utf-8` | 检查 `vite.config.ts` 配置 |
| `Expected ',' or '}'` | JSON语法错误 | JSON文件内容 | 使用 `JSON.stringify` 生成，检查特殊字符 |
| 刷新无反应 | 错误被吞掉 | catch块是否调用 `loading.value = false` | 确保finally块重置loading状态 |
| Excel导出后无法加载 | 导出编码错误 | 文件编码是否为UTF-8 | 导出时选择UTF-8编码 |

## 7. 数据验证工具函数

```typescript
// 可添加到 src/utils/wenUtils.ts

/**
 * 验证 WordItem 数据格式
 */
export function validateWordItem(item: unknown): item is WordItem {
  if (!item || typeof item !== 'object') return false
  const i = item as WordItem
  return !!(i.text_id && i.word && i.basic_meaning)
}

/**
 * 验证 TextBasicInfo 数据格式
 */
export function validateTextBasicInfo(data: unknown): data is TextBasicInfo {
  if (!data || typeof data !== 'object') return false
  const d = data as TextBasicInfo
  return !!(d.text_id && d.title && d.original_text)
}

/**
 * 验证 MultiRoleData 数据格式
 */
export function validateMultiRoleData(data: unknown): data is MultiRoleData {
  if (!data || typeof data !== 'object') return false
  const d = data as MultiRoleData
  if (!d.text_id || !d.audio_file || !Array.isArray(d.segments)) return false
  
  for (const seg of d.segments) {
    if (typeof seg.sentence_index !== 'number' || !seg.time_range || !seg.role_name || !seg.dialogue) {
      return false
    }
  }
  return true
}
```

## 8. 数据适配层规范

### 8.1 定位

数据适配层位于 `useDataLoader`（数据获取）和业务组件（数据消费）之间，负责将原始 JSON 数据转换为组件直接可用的格式。所有复杂的处理逻辑（排序、过滤、拼接 HTML、计算派生字段等）都必须在适配层完成，**组件只接收最终数据并渲染**。

### 8.2 目录结构

```
src/
├── data/                  # 原始 JSON 数据（已有）
├── adapters/              # 数据适配层（新增）
│   ├── wordListAdapter.ts # 字词数据转换
│   ├── readingAdapter.ts  # 朗读数据转换
│   └── ...                # 其他适配器
├── composables/
│   └── useDataLoader.ts   # 可集成适配器调用
└── components/
    └── WordList.vue       # 组件只渲染最终数据
```

### 8.3 适配器编写规范

每个适配器文件导出一个纯函数，接收原始 JSON 数据，返回处理后的数据对象，**不包含任何响应式副作用**。

```typescript
// src/adapters/wordListAdapter.ts
export interface RawWordItem {
  id: string
  word: string
  meaning: string
  annotation: string
}

export interface ProcessedWordItem extends RawWordItem {
  annotationHtml: string    // 预生成的 HTML
  pinyin?: string           // 派生字段
  isFrequent?: boolean      // 派生字段
}

export function adaptWordList(rawData: RawWordItem[]): ProcessedWordItem[] {
  return rawData.map(item => ({
    ...item,
    annotationHtml: buildAnnotationHtml(item.annotation),
    pinyin: extractPinyin(item.word),
    isFrequent: checkFrequency(item.id)
  }))
}

// 内部纯函数，无副作用
function buildAnnotationHtml(annotation: string): string {
  // 生成 HTML 的逻辑
}
function extractPinyin(word: string): string {
  // 提取拼音的逻辑
}
function checkFrequency(id: string): boolean {
  // 检查常用度的逻辑
}
```

### 8.4 在 `useDataLoader` 中集成适配器

可以通过 `transform` 参数让适配器在数据加载成功后立即执行，确保组件收到的数据已经是加工好的。

```typescript
// src/composables/useDataLoader.ts
import { adaptWordList } from '@/adapters/wordListAdapter'

export function useDataLoader<T>(url: string, options?: {
  timeout?: number
  transform?: (raw: any) => T
}) {
  // ... 原有逻辑
  const rawData = JSON.parse(text)
  data.value = options?.transform ? options.transform(rawData) : rawData
  // ...
}
```

组件中的调用：

```typescript
const { data, loading, error } = useDataLoader<ProcessedWordItem[]>(
  '/data/WordList.json',
  { transform: adaptWordList }
)
// data 已经是处理好的 ProcessedWordItem[]，组件直接使用
```

### 8.5 收益

- **根除响应式循环**：组件内不再有复杂的数据加工 `computed`，全部变成直接取值。
- **可测试性**：纯函数适配器可单独编写单元测试。
- **复用性**：同一份原始数据可通过不同适配器服务于不同组件。
- **AI 友好**：指令可明确为"在 `adapters/` 下新建一个适配器，实现数据转换"，不会让 AI 在组件内写出危险代码。

### 8.6 迁移策略

1. 在 `src/adapters/` 下为每个需要加工数据的组件创建适配器。
2. 将原有组件中的复杂 `computed` 逻辑逐个迁移到适配器中，并重构为纯函数。
3. 修改组件的数据加载调用，传入 `transform` 参数。
4. 删除组件内残留的数据处理逻辑，使其变为"展示型组件"。

---

**文档版本**: 1.2  
**更新日期**: 2026-05-27  
**适用项目**: wenyan-platform