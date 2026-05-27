# wenyan-platform 项目技术文档

## 1. 项目概述

本项目是一个文言文学习平台，采用 Vue 3 + TypeScript + Vite 技术栈开发，主要面向学生和教师，提供文言文阅读、学习和测验功能。

## 2. 项目结构

```
wenyan-platform/
├── public/                 # 静态资源
│   ├── data/              # JSON数据文件
│   │   ├── word_list/     # 字词列表数据
│   │   ├── text_basic_info/ # 课文基础信息
│   │   └── multi_role_reading/ # 多角色朗读数据
│   ├── audio/             # 音频文件
│   └── video/             # 视频文件
├── src/                   # 源代码
│   ├── components/        # 可复用组件
│   │   ├── WordList.vue   # 字词注释组件
│   │   ├── MultiRoleReading.vue # 多角色朗读组件
│   │   ├── VideoPlayer.vue # 视频播放器组件
│   │   ├── ErrorDisplay.vue # 错误展示组件
│   │   └── BackContinue.vue # 返回/继续按钮组件
│   ├── views/             # 页面视图
│   │   ├── HomeView.vue   # 首页
│   │   ├── RuleView.vue   # 规则页（背景视频）
│   │   ├── RuleView1.vue  # 规则页1
│   │   ├── RuleView2.vue  # 规则页2
│   │   ├── RuleView3.vue  # 规则页3
│   │   ├── StepOneView.vue # StepOne页面（核心学习页）
│   │   └── DetailView.vue # 详情页
│   ├── utils/             # 工具函数
│   │   ├── wenUtils.ts    # 文言文工具函数
│   │   └── perfMonitor.ts # 性能监控工具
│   ├── composables/       # 组合式函数
│   │   └── useNavigation.ts # 导航逻辑
│   ├── router/            # 路由配置
│   ├── types/             # 类型定义
│   └── App.vue            # 根组件
├── commands/              # 命令工具
│   ├── debug.js           # 调试命令
│   └── index.js           # 命令管理器
└── tests/                 # 测试文件
```

## 3. 核心组件说明

### 3.1 WordList 组件

**功能**：展示课文中的字词注释，支持点击查看详细释义

**关键属性**：
- `wenId`: 课文ID（如 WEN_01）
- `wordListBaseUrl`: 字词列表数据路径
- `basicInfoBaseUrl`: 课文基础信息路径

**数据加载流程**：
1. 组件挂载时触发 `loadData()`
2. 并行请求 `word_list` 和 `text_basic_info` JSON
3. 解析数据并渲染 `contentHtml`（带注释的原文）

**常见问题排查**：
- 如果加载失败，检查控制台日志
- 确认 JSON 文件路径正确
- 验证 JSON 格式是否有效（无未转义引号）

### 3.2 MultiRoleReading 组件

**功能**：多角色朗读播放器，支持音频播放、进度控制、段落高亮

**关键状态**：
- `multiRoleData`: 朗读数据（角色、文本、时间戳）
- `currentSegmentIndex`: 当前播放段落索引
- `isPlaying`: 播放状态
- `currentTime`: 当前播放时间

**播放逻辑**：
1. 加载多角色朗读 JSON 数据
2. 设置音频源（按需加载，非预加载）
3. 通过 timeupdate 事件更新进度
4. 根据时间戳匹配当前段落并高亮

### 3.3 VideoPlayer 组件

**功能**：视频播放器，支持自动播放、循环播放、错误处理

**关键属性**：
- `src`: 视频路径
- `autoPlay`: 是否自动播放
- `loop`: 是否循环播放
- `requireComplete`: 是否检测播放完成

**错误处理**：
- 监听 error 事件显示错误提示
- 监听 abort 事件处理请求中断（正常页面导航）
- 提供重试按钮

### 3.4 ErrorDisplay 组件

**功能**：统一错误展示组件，支持多种资源类型

**支持的资源类型**：
- video: 视频资源
- mp3: 音频资源
- img: 图片资源
- json: 数据资源

**错误信息结构**：
- 资源类型图标和颜色区分
- 组件名称和资源路径
- 错误原因和解决方案
- 重试按钮和详情展开

## 4. 数据模型

### 4.1 WordItem（字词项）

```typescript
interface WordItem {
  text_id: string        // 课文ID
  word: string           // 字词内容
  basic_meaning: string  // 基本释义
  synonym_analysis?: string // 近义辨析
  follow_up_questions?: string[] // 追问问题
}
```

### 4.2 TextBasicInfo（课文基础信息）

```typescript
interface TextBasicInfo {
  text_id: string        // 课文ID
  title: string          // 课文标题
  author: string         // 作者
  dynasty: string        // 朝代
  original_text: string  // 原文内容
  background?: string    // 背景介绍
}
```

### 4.3 MultiRoleItem（多角色朗读项）

```typescript
interface MultiRoleItem {
  id: string             // 段落ID
  speaker: string        // 角色名称
  text: string           // 朗读文本
  start: number          // 开始时间（毫秒）
  end: number            // 结束时间（毫秒）
}
```

## 5. 路由结构

| 路由路径 | 页面组件 | 功能说明 |
|---------|---------|---------|
| `/` | HomeView | 首页，选择课文 |
| `/rule/:id` | RuleView | 规则页（背景视频） |
| `/rule1/:id` | RuleView1 | 规则页1 |
| `/rule2/:id` | RuleView2 | 规则页2 |
| `/rule3/:id` | RuleView3 | 规则页3 |
| `/stepone/:id` | StepOneView | 核心学习页 |
| `/detail/:id` | DetailView | 详情页 |

## 6. 导航流程

```
HomeView → RuleView → RuleView1 → RuleView2 → RuleView3 → StepOneView → DetailView
                                                           ↓ (返回)
                                                     RuleView
```

## 7. 性能优化策略

### 7.1 数据加载优化
- 使用 `Promise.all` 并行加载多个 JSON
- 实现数据缓存机制（dataCache）
- 音频按需加载（点击播放时才加载）

### 7.2 错误处理
- 添加超时检测（5秒）
- 统一错误展示组件
- 自动重试机制

### 7.3 资源管理
- 视频设置 `preload="metadata"` 减少初始加载
- 组件卸载时清理事件监听器和资源
- 使用 AbortController 取消未完成的请求

## 8. 调试工具

### 8.1 debug 命令

**使用方式**：
```bash
node -e "require('./commands').runCommand('/debug WordList loadData')"
```

**支持的组件**：
- WordList: loadData, contentHtml, setup, onMounted
- MultiRoleReading: loadData, setupAudio, togglePlay, seekTo
- VideoPlayer: setupVideo, play, pause, handleError
- ErrorDisplay: setup, render
- BackContinue: handleBack, handleContinue

**功能**：在指定函数中添加控制台输出，帮助定位问题

### 8.2 性能监控

在 `utils/perfMonitor.ts` 中实现，自动检测函数执行时间，超过5秒输出警告。

## 9. 常见问题排查

### 9.1 StepOne页面加载失败

**可能原因**：
1. JSON 文件格式错误（未转义引号）
2. 数据请求超时
3. 组件 loading 状态未正确设置

**排查步骤**：
1. 查看控制台日志（搜索 `[WordList]`）
2. 检查 Network 面板确认请求状态
3. 验证 JSON 文件格式（使用 `JSON.parse`）

### 9.2 视频播放失败

**可能原因**：
1. 视频文件不存在
2. 视频格式不支持
3. 请求被中止（页面导航）

**排查步骤**：
1. 查看错误提示（ErrorDisplay 组件）
2. 确认视频路径正确
3. 检查浏览器兼容性

### 9.3 音频加载慢

**可能原因**：
1. 音频文件过大
2. 网络请求慢
3. 预加载策略问题

**解决方案**：
1. 压缩音频文件
2. 实现分片加载
3. 使用按需加载策略

## 10. 开发环境

### 10.1 启动命令

```bash
# 启动后端服务
cd backend && node server.js

# 启动前端开发服务器
npm run dev
```

### 10.2 测试命令

```bash
# 运行测试
npm test

# 生成覆盖率报告
npm run test:coverage

# 可视化测试界面
npm run test:ui
```

### 10.3 构建命令

```bash
# 生产构建
npm run build

# 预览构建结果
npm run preview
```

## 11. 分支管理

| 分支名称 | 用途 |
|---------|------|
| main | 主分支，稳定版本 |
| feature-1 | 功能开发分支 |
| wordlist | 字词列表模块 |
| 实现stepone页面 | StepOne页面开发 |

## 12. 版本历史

### v1.0.0
- 基础项目结构搭建
- 核心组件实现
- 数据加载和渲染

### v1.1.0
- 性能监控工具
- 统一错误展示组件
- 视频自动播放功能

### v1.2.0
- 调试命令系统
- 测试套件完善
- JSON数据格式修复

---

**文档版本**: 1.2.0  
**更新日期**: 2026-05-25  
**作者**: AI Assistant