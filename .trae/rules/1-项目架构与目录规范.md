# 1-项目架构与目录规范

## 1. 技术栈概览

### 1.1 前端技术栈

| 分类 | 技术 | 版本 | 用途 |
|-----|------|-----|-----|
| 框架 | Vue | 3.5+ | 前端框架 |
| 语言 | TypeScript | 6.0+ | 类型安全 |
| 构建工具 | Vite | 8.0+ | 开发构建 |
| 状态管理 | Pinia | 3.0+ | 全局状态（`useStudentStore`） |
| 路由 | Vue Router | 5.0+ | 页面路由 |
| 测试 | Vitest | 2.1+ | 单元测试 |
| 代码规范 | ESLint + OXLint | - | 代码检查 |

### 1.2 后端技术栈

| 分类 | 技术 | 版本 | 用途 |
|-----|------|-----|-----|
| 框架 | Express | 4.18+ | 后端服务 |
| 数据库 | SQLite | 5.1+ | 数据存储（`answers.db`） |
| ORM | sqlite3 | - | 数据库操作 |

## 2. 目录结构

```
wenyan-platform/
├── public/                 # 静态资源（编译后保留）
│   ├── audio/              # 音频文件
│   │   ├── WEN_01_bgm_guzheng.mp3
│   │   ├── WEN_01_multi_role.mp3
│   │   └── WEN_01_multi_dialog1.mp3
│   ├── video/              # 视频文件
│   │   ├── WEN_01_card_uprising.mp4
│   │   └── WEN_01_rule_1.mp4
│   ├── img/                # 图片资源
│   │   ├── WEN_01_illus_1.png
│   │   └── WEN_01_icon_dialog1.png
│   └── data/               # JSON数据文件
│       ├── word_list/      # 字词注释数据（WordList组件使用）
│       │   └── WEN_01.json
│       ├── text_basic_info/# 课文基础信息
│       │   └── WEN_01.json
│       └── multi_role_reading/ # 多角色朗读数据（MultiRoleReading组件使用）
│           └── WEN_01.json
├── src/                    # 源代码
│   ├── components/         # 可复用组件
│   │   ├── WordList.vue           # 字词注释组件
│   │   ├── MultiRoleReading.vue   # 多角色朗读播放器
│   │   ├── MultiRoleReadingItem.vue # 段落项组件
│   │   ├── VideoPlayer.vue        # 视频播放器
│   │   ├── ErrorDisplay.vue       # 统一错误展示
│   │   ├── BackContinue.vue       # 返回/继续导航
│   │   ├── PoetryMenu.vue         # 篇目菜单
│   │   ├── StudentLogin.vue       # 学生登录
│   │   └── StudentDisplay.vue     # 学生信息展示
│   ├── views/              # 页面视图
│   │   ├── HomeView.vue           # 首页
│   │   ├── RuleView.vue           # 规则页（背景视频）
│   │   ├── RuleView1.vue          # 规则页1
│   │   ├── RuleView2.vue          # 规则页2
│   │   ├── RuleView3.vue          # 规则页3
│   │   ├── StepOneView.vue        # 核心学习页
│   │   └── DetailView.vue         # 详情页
│   ├── composables/        # 组合式函数
│   │   └── useNavigation.ts       # 统一导航逻辑
│   ├── stores/             # Pinia状态管理
│   │   └── student.ts             # 学生信息Store
│   ├── router/             # 路由配置
│   │   └── index.ts               # 路由定义
│   ├── config/             # 配置文件
│   │   └── navigation.ts          # 导航配置
│   ├── utils/              # 工具函数
│   │   ├── api.ts                 # API请求封装
│   │   ├── asset.ts               # 资源路径工具
│   │   ├── perfMonitor.ts         # 性能监控工具
│   │   └── wenUtils.ts            # 文言文工具函数
│   ├── App.vue             # 根组件
│   └── main.ts             # 入口文件
├── backend/                # 后端服务
│   ├── server.js           # Express服务器入口
│   ├── database/           # SQLite数据库
│   │   └── answers.db
│   ├── package.json
│   └── .env
├── tests/                  # 测试套件
│   ├── components/         # 组件测试
│   │   ├── WordList.spec.ts
│   │   ├── VideoPlayer.spec.ts
│   │   └── MultiRoleReading.spec.ts
│   ├── views/              # 页面测试
│   │   ├── HomeView.spec.ts
│   │   └── StepOneView.spec.ts
│   └── composables/        # 组合式函数测试
│       └── useNavigation.spec.ts
├── docs/                   # 技术文档（本目录）
└── package.json            # 项目配置
```

## 3. 目录职责说明

### 3.1 public/data/ - 数据文件

| 子目录 | 组件关联 | 数据结构 |
|-------|---------|---------|
| `word_list/` | `WordList.vue` | `[{ text_id, word, basic_meaning, synonym_analysis, follow_up_questions }]` |
| `text_basic_info/` | `WordList.vue` | `{ text_id, title, author, dynasty, original_text, illustration, bgm }` |
| `multi_role_reading/` | `MultiRoleReading.vue` | `{ text_id, audio_file, segments: [{ sentence_index, time_range, role_name, dialogue }] }` |

### 3.2 src/components/ - 核心组件职责

| 组件 | 职责 | 关键Props | 输出事件 |
|-----|------|---------|---------|
| `WordList` | 展示课文字词注释 | `wenId`, `autoLoad` | 无 |
| `MultiRoleReading` | 多角色朗读播放器 | `wenId`, `autoLoad`, `cacheEnabled` | `load-success`, `load-error`, `segment-change` |
| `VideoPlayer` | 视频播放器 | `src`, `autoPlay`, `loop`, `requireComplete` | `error`, `complete` |
| `ErrorDisplay` | 统一错误展示 | `error`, `source`, `resourceType`, `resourcePath` | `retry` |
| `BackContinue` | 返回/继续导航 | `backText`, `continueText` | `back`, `continue` |
| `PoetryMenu` | 左侧篇目菜单 | 无 | `select` |
| `StudentLogin` | 学号输入登录 | 无 | `login` |

### 3.3 src/utils/ - 工具函数职责

| 文件 | 职责 | 核心方法 |
|-----|------|---------|
| `api.ts` | API请求封装 | `submitAnswers()` |
| `asset.ts` | 资源路径处理 | `getAssetUrl(type, fileName)` |
| `perfMonitor.ts` | 性能监控 | `createPerfMonitor()`, `perfMonitor.start()` |
| `wenUtils.ts` | 文言文工具 | `getWenId(id)`, `getPoemTitle(poemId)` |

### 3.4 src/composables/ - 组合式函数

| 文件 | 职责 | 导出方法 |
|-----|------|---------|
| `useNavigation.ts` | 页面导航逻辑 | `goNext()`, `goPrev()`, `goTo()`, `hasNext`, `hasPrev` |

### 3.5 src/stores/ - 状态管理

| 文件 | 状态 | 方法 |
|-----|------|-----|
| `student.ts` | `studentId`, `isLoggedIn`, `displayId` | `setStudentId()`, `clearStudentId()`, `restoreFromStorage()` |

## 4. 分层设计

### 4.1 架构层次

```
┌─────────────────────────────────────┐
│          视图层 (Views)             │
│   HomeView / StepOneView / RuleView │
│   使用: useNavigation, studentStore │
├─────────────────────────────────────┤
│          组件层 (Components)        │
│   WordList / MultiRoleReading       │
│   使用: perfMonitor, wenUtils       │
├─────────────────────────────────────┤
│        组合式层 (Composables)       │
│   useNavigation                    │
│   使用: vue-router, navigation.ts   │
├─────────────────────────────────────┤
│         状态层 (Stores)             │
│   studentStore                      │
│   使用: Pinia, localStorage         │
├─────────────────────────────────────┤
│          工具层 (Utils)             │
│   api / asset / perfMonitor / wenUtils │
├─────────────────────────────────────┤
│          数据层 (public/data)       │
│   JSON文件 / 静态资源              │
└─────────────────────────────────────┘
```

### 4.2 层间通信规则

1. **视图层 → 组件层**: 通过 props 传递数据（如 `StepOneView` → `WordList` 的 `wenId`）
2. **视图层 → 组合式层**: 调用 composables（如 `StepOneView` 使用 `useNavigation`）
3. **视图层 → 状态层**: 通过 `storeToRefs` 订阅状态（如 `HomeView` 使用 `studentStore.isLoggedIn`）
4. **组件层 → 工具层**: 调用工具函数（如 `WordList` 使用 `perfMonitor.start()`）

## 5. 路由结构

### 5.1 路由定义（`src/router/index.ts`）

```typescript
export const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/rules/:id', name: 'rules', component: RuleView },
  { path: '/rule1/:id', name: 'rule1', component: RuleView1 },
  { path: '/rule2/:id', name: 'rule2', component: RuleView2 },
  { path: '/rule3/:id', name: 'rule3', component: RuleView3 },
  { path: '/stepone/:id', name: 'stepone', component: StepOneView },
  { path: '/detail/:id', name: 'detail', component: DetailView },
]
```

### 5.2 页面顺序（`src/config/navigation.ts`）

```typescript
export const pageSequence = [
  { name: 'home', getPath: () => '/' },
  { name: 'rules', getPath: (id: string) => `/rules/${id}` },
  { name: 'rule1', getPath: (id: string) => `/rule1/${id}` },
  { name: 'rule2', getPath: (id: string) => `/rule2/${id}` },
  { name: 'rule3', getPath: (id: string) => `/rule3/${id}` },
  { name: 'stepone', getPath: (id: string) => `/stepone/${id}` },
  { name: 'detail', getPath: (id: string) => `/detail/${id}` },
]
```

## 6. 核心组件使用示例

### 6.1 StepOneView 使用组件组合

```vue
<!-- src/views/StepOneView.vue -->
<template>
  <div class="stepone-view">
    <!-- 字词注释 -->
    <WordList :wen-id="wenId" />
    
    <!-- 多角色朗读 -->
    <MultiRoleReading
      :wen-id="wenId"
      :auto-load="true"
      @load-success="handleAudioLoad"
      @load-error="handleAudioError"
    />
    
    <!-- 导航按钮 -->
    <BackContinue
      back-text="返回规则"
      continue-text="继续学习"
      @back="goPrev"
      @continue="goNext"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import WordList from '@/components/WordList.vue'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { getWenId } from '@/utils/wenUtils'

const route = useRoute()
const poemId = route.params.id as string
const wenId = computed(() => getWenId(poemId))
const { goNext, goPrev } = useNavigation('stepone', poemId)
</script>
```

### 6.2 useNavigation 使用示例

```typescript
// src/views/RuleView.vue
import { useNavigation } from '@/composables/useNavigation'

const { goNext, goPrev, hasNext, hasPrev } = useNavigation('rules', poemId)

// 跳转到下一页
goNext()  // 从 rules -> rule1

// 跳转到上一页（首页）
goPrev()  // 从 rules -> home
```

---

**文档版本**: 1.1  
**更新日期**: 2026-05-26  
**适用项目**: wenyan-platform