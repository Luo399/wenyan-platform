# TypeScript 数据适配器使用文档

## 概述

本文档介绍如何使用新创建的数据适配器和 API 服务，从后端获取数据替代原有的本地 JSON 文件读取方式。

## 文件结构

```
src/
├── services/
│   └── apiService.ts          # API 服务封装
├── adapters/
│   └── databaseAdapter.ts     # 数据库数据适配器
└── utils/
    └── api.ts                 # 基础 API 请求工具
```

## 快速开始

### 1. 获取文本基础信息

```typescript
import { getTextBasicInfo } from '@/services/apiService'
import { adaptTextBasicInfoFromApi } from '@/adapters/databaseAdapter'

async function loadTextInfo(textId: string) {
  const response = await getTextBasicInfo(textId)
  if (response.success) {
    const processed = adaptTextBasicInfoFromApi(response.data!)
    console.log('处理后的数据:', processed)
  }
}
```

### 2. 获取字词注释和文本信息

```typescript
import { getTextBasicInfo, getWordList } from '@/services/apiService'
import { adaptWordListPairFromApi } from '@/adapters/databaseAdapter'

async function loadWordList(textId: string) {
  // 并行请求以提高性能
  const [basicInfoRes, wordListRes] = await Promise.all([
    getTextBasicInfo(textId),
    getWordList(textId),
  ])

  if (basicInfoRes.success && wordListRes.success) {
    const result = adaptWordListPairFromApi(
      basicInfoRes.data!,
      wordListRes.data!
    )
    return result
  }
}
```

### 3. 获取多角色朗读数据

```typescript
import { getMultiRoleReading } from '@/services/apiService'
import { adaptMultiRoleReadingFromApi } from '@/adapters/databaseAdapter'

async function loadReadingData(textId: string) {
  const response = await getMultiRoleReading(textId)
  if (response.success) {
    return adaptMultiRoleReadingFromApi(response.data!)
  }
}
```

### 4. 获取测验数据

```typescript
import { getLevel1Quiz, getLevel2Quiz, getLevel3AdaptiveQuiz } from '@/services/apiService'
import { adaptQuizFromApi } from '@/adapters/databaseAdapter'

async function loadQuizData(textId: string) {
  const response = await getLevel1Quiz(textId)
  if (response.success) {
    return adaptQuizFromApi(response.data!)
  }
}
```

## API 服务函数列表

### 文本相关

| 函数名 | 说明 | 返回类型 |
|--------|------|----------|
| `getTextBasicInfo(textId)` | 获取文本基础信息 | `Promise<ApiResponse<TextBasicInfo>>` |
| `getWordList(textId)` | 获取字词注释 | `Promise<ApiResponse<WordItem[]>>` |
| `getMultiRoleReading(textId)` | 获取多角色朗读数据 | `Promise<ApiResponse<MultiRoleReadingData>>` |
| `getTextList(page, pageSize)` | 获取文本列表 | `Promise<ApiResponse<{ total, texts }>>` |
| `getTextBatch(textIds)` | 批量获取文本数据 | `Promise<ApiResponse<Array<{ text_id, basic_info, word_list }>>>` |

### 测验相关

| 函数名 | 说明 | 返回类型 |
|--------|------|----------|
| `getLevel1Quiz(textId)` | 获取一级测验数据 | `Promise<ApiResponse<Level1QuizData>>` |
| `getLevel2Dialog(textId)` | 获取二级对话数据 | `Promise<ApiResponse<Level2DialogData>>` |
| `getLevel2Quiz(textId)` | 获取二级测验数据 | `Promise<ApiResponse<Level2QuizData>>` |
| `getLevel3ScenarioText(textId)` | 获取三级情景文本 | `Promise<ApiResponse<Level3ScenarioText>>` |
| `getLevel3AdaptiveQuiz(textId)` | 获取三级自适应测验 | `Promise<ApiResponse<Level3AdaptiveQuiz>>` |

## 适配器函数列表

| 函数名 | 说明 |
|--------|------|
| `adaptTextBasicInfoFromApi(rawData)` | 适配文本基础信息 |
| `adaptWordListFromApi(rawData)` | 适配字词列表 |
| `adaptMultiRoleReadingFromApi(rawData)` | 适配多角色朗读数据 |
| `adaptQuizFromApi(rawData)` | 适配测验数据 |
| `adaptWordListPairFromApi(rawBasicInfo, rawWordList)` | 批量适配文本和字词数据 |

## 集成到 useDataLoader

### 示例：创建带适配器的数据加载 Hook

```typescript
import { useCallback, useState, useEffect } from 'react'
import { getTextBasicInfo, getWordList } from '@/services/apiService'
import { adaptWordListPairFromApi } from '@/adapters/databaseAdapter'

interface UseDatabaseLoaderResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  retry: () => void
}

export function useDatabaseWordList(textId: string) {
  const [state, setState] = useState<UseDatabaseLoaderResult<any>>({
    data: null,
    loading: true,
    error: null,
  })

  const loadData = useCallback(async () => {
    setState({ data: null, loading: true, error: null })
    try {
      const [basicInfoRes, wordListRes] = await Promise.all([
        getTextBasicInfo(textId),
        getWordList(textId),
      ])

      if (basicInfoRes.success && wordListRes.success) {
        const processed = adaptWordListPairFromApi(
          basicInfoRes.data!,
          wordListRes.data!
        )
        setState({ data: processed, loading: false, error: null })
      } else {
        setState({
          data: null,
          loading: false,
          error: basicInfoRes.message || wordListRes.message || '数据加载失败',
        })
      }
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : '未知错误',
      })
    }
  }, [textId])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    ...state,
    retry: loadData,
  }
}
```

## 错误处理

### 处理 API 错误

```typescript
try {
  const response = await getTextBasicInfo('WEN_01')
  if (response.success) {
    // 处理成功响应
    const data = response.data!
  } else {
    // 处理业务错误
    console.error(response.message)
  }
} catch (err) {
  // 处理网络或系统错误
  console.error('请求失败:', err)
}
```

### 404 处理

```typescript
import { getLocalData } from '@/services/apiService'

async function loadWithFallback(textId: string) {
  try {
    const response = await getTextBasicInfo(textId)
    if (response.success) {
      return adaptTextBasicInfoFromApi(response.data!)
    }
  } catch (err) {
    // 降级使用本地 JSON 文件
    console.warn('使用本地数据:', err)
    const localData = await getLocalData('basic-info', textId)
    return adaptTextBasicInfoFromApi(localData)
  }
}
```

## 类型定义

所有类型都可以从 `@/services/apiService` 导入：

```typescript
import type {
  TextBasicInfo,
  WordItem,
  MultiRoleReadingData,
  Level1QuizData,
  Level2DialogData,
  Level2QuizData,
  Level3ScenarioText,
  Level3AdaptiveQuiz,
} from '@/services/apiService'
```

## 后端 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/texts/:textId/basic-info` | GET | 获取文本基础信息 |
| `/api/texts/:textId/word-list` | GET | 获取字词注释 |
| `/api/texts/:textId/multi-role-reading` | GET | 获取多角色朗读数据 |
| `/api/texts/:textId/level1-quiz` | GET | 获取一级测验数据 |
| `/api/texts/:textId/level2-dialog` | GET | 获取二级对话数据 |
| `/api/texts/:textId/level2-quiz` | GET | 获取二级测验数据 |
| `/api/texts/:textId/level3-scenario-text` | GET | 获取三级情景文本 |
| `/api/texts/:textId/level3-adaptive-quiz` | GET | 获取三级自适应测验 |
| `/api/texts` | GET | 获取文本列表 |
| `/api/texts/batch` | POST | 批量获取文本数据 |

## 迁移指南

### 从本地 JSON 迁移到 API

**迁移前：**
```typescript
async function loadData() {
  const [basicInfo, wordList] = await Promise.all([
    fetch('/data/text_basic_info/WEN_01.json').then(r => r.json()),
    fetch('/data/word_list/WEN_01.json').then(r => r.json()),
  ])
}
```

**迁移后：**
```typescript
import { getTextBasicInfo, getWordList } from '@/services/apiService'
import { adaptWordListPairFromApi } from '@/adapters/databaseAdapter'

async function loadData() {
  const [basicInfoRes, wordListRes] = await Promise.all([
    getTextBasicInfo('WEN_01'),
    getWordList('WEN_01'),
  ])
  if (basicInfoRes.success && wordListRes.success) {
    const processed = adaptWordListPairFromApi(
      basicInfoRes.data!,
      wordListRes.data!
    )
  }
}
```

## 最佳实践

1. **并行请求**：使用 `Promise.all` 同时请求多个相关数据
2. **错误处理**：始终处理 API 响应的 success 状态
3. **降级方案**：考虑提供本地 JSON 文件作为备选数据源
4. **类型安全**：充分利用 TypeScript 类型检查
5. **缓存策略**：考虑使用状态管理库缓存已加载的数据
