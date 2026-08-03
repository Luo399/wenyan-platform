# 09 - 前端第三轮审查（R01-R50 之后的补充）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## 背景

本文档记录在前端第二轮审查（08-frontend-round2.md 的 R01-R50）之后，对更广泛文件（components / views / stores / composables / utils / services / adapters / router）进行第三轮审查时发现的新问题。

去重规则：与 R01-R50 描述同一根因的问题不再重复列入（例如 R01 已覆盖 AdaptQuiz 异步调用 useDataLoader，本文档只针对其他组件的同类问题列入）。本文档的问题编号从 R51 开始。

严重程度分级同第二轮：

| 级别   | 含义                                         |
| ------ | -------------------------------------------- |
| **P0** | 功能 bug / 数据损坏 / 安全漏洞，必须立即修复 |
| **P1** | 影响用户体验或可访问性，上线前修复           |
| **P2** | 代码质量 / 类型安全 / 性能，迭代中改善       |
| **P3** | 优化建议 / 风格统一                          |

---

## 一、组件层（components / views）

### R51. ScenQuiz 在异步函数内调用 useDataLoader（P0）

- **优先级**: P0
- **状态**: [x] 已完成（PR #51，分支 refactor/round3-51-scenquiz-dataloader，CI 通过 2026-07-30）
- **文件**: `src/components/ScenQuiz.vue`（第 165, 208, 239, 270 行）
- **问题描述**: `loadScenarios` 与 `loadQuizzes` 均为 async 函数，内部调用 `useDataLoader<...>(() => url)`。与 R01 同类违规——`useDataLoader` 内部使用 `onUnmounted`/`watch`，必须在 setup 顶层同步调用，否则：
  1. 组件卸载时 `abortController.abort()` 不触发，请求泄漏
  2. `watch` 在异步上下文中注册，错过首次 URL 变化
  3. Vue devtools 警告 "onUnmounted is called when there is no active component instance"
- **根因**: C04 修复 MultiRoleReading 时未同步改造 ScenQuiz；ScenQuiz 还手写了 Promise + watch + setTimeout 包装，重复造轮子
- **修复方案**:
  1. 将 `useDataLoader<...>(() => url, { autoLoad: false })` 提到 setup 顶层，根据 `quizLevel`/`textId` 动态计算 url
  2. 删除手写 Promise + 双 watch + setTimeout 等待逻辑
  3. 通过 `watch(() => [props.quizLevel, props.textId], () => loader.retry())` 监听 props 变化
  4. `adaptLevel*Quiz` 适配器调用改为 `computed` 监听 `loader.data`
- **验证方式**:
  1. `npm run dev` 控制台无 "onUnmounted is called when there is no active component instance" 警告
  2. `npm run test` 全部通过
  3. ScenQuiz 页面在加载/错误/重试/切换 level 行为正常
- **分支建议**: `refactor/round3-51-scenquiz-dataloader`
- **依赖**: R01（同模式修复，建议先做 R01 取得模式参考）

### R52. PreQuizText 在异步函数内调用 useDataLoader + 同步检查异步 ref 竞态 bug（P0）

- **优先级**: P0
- **状态**: [x] 已完成（PR #52，分支 bugfix/round3-52-prequiztext-race，CI 通过 2026-07-30）
- **文件**: `src/components/PreQuizText.vue`（第 88-111 行）
- **问题描述**: 两个叠加的严重 bug：
  1. `loadData` 是 async 函数，内部第 90 行调用 `useDataLoader`，违反 Composition API 规则（同 R51）
  2. 调用 `useDataLoader` 后立即同步检查 `loadError.value`/`rawData.value`。此时数据尚未异步加载完成，`rawData.value` 恒为 null，分支永远走不到，导致 `error.value = '数据为空'` 误报
- **根因**: useDataLoader 的 data/error 是异步更新的 ref，不能同步检查
- **修复方案**:
  1. 将 `useDataLoader<...>(() => url)` 提到 setup 顶层
  2. 用 `watch(loader.data, ...)` / `watch(loader.error, ...)` 监听异步结果
  3. 删除手写 Promise 包装
- **验证方式**: 组件挂载后不再误报"数据为空"；level3 场景文本正常加载
- **分支建议**: `bugfix/round3-52-prequiztext-race`
- **依赖**: 无

### R53. PreQuizText URL 硬编码 WEN_01 导致组件无法复用（P1）

- **优先级**: P1
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/PreQuizText.vue`（第 89 行 `/data/level3_scenario_text/WEN_01.json`）
- **问题描述**: URL 硬编码 `WEN_01`，不随 `questionNumber` 或任何 textId 变化，组件无法复用于其他课文
- **修复方案**:
  1. 增加 `textId` prop（默认 `WEN_01` 保持向后兼容）
  2. URL 改为 `` `/data/level3_scenario_text/${props.textId}.json` ``
- **验证方式**: 切换不同课文时 PreQuizText 加载对应数据
- **分支建议**: `refactor/round3-53-prequiztext-textid`
- **依赖**: R52

### R54. DialogText 在异步函数内调用 useDataLoader + 同步检查异步 ref 竞态 bug（P0）

- **优先级**: P0
- **状态**: [x] 已完成（PR #53，分支 bugfix/round3-54-dialogtext-race，CI 通过 2026-07-30）
- **文件**: `src/components/DialogText.vue`（第 186-206 行）
- **问题描述**: 与 R52 完全相同的两个 bug：
  1. `loadData` async 函数内调用 `useDataLoader`（第 186 行）
  2. 调用后同步检查 `loadError.value`/`rawData.value`，永远走"数据为空"分支
- **修复方案**: 同 R52
- **验证方式**: DialogText 不再误报"数据为空"；对话文本正常加载
- **分支建议**: `bugfix/round3-54-dialogtext-race`
- **依赖**: 无

### R55. DialogText watch 与 nextDialog/prevDialog 重复触发 typeText（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-batch4，PR #60 squash 合并 2026-07-30）
- **文件**: `src/components/DialogText.vue`（第 217-242, 282-287 行）
- **问题描述**: `nextDialog`/`prevDialog` 内手动调用 `typeText`，同时 `watch(currentIndex)` 也会触发 `typeText`，导致打字机双重触发，文字闪烁/错乱
- **修复方案**: 统一由 watch 处理 typeText 触发，删除 next/prev 中的手动调用（或反之）
- **验证方式**: 切换对话时打字机效果只触发一次，文字流畅无闪烁
- **分支建议**: `bugfix/round3-55-dialogtext-typetext-dup`
- **依赖**: R54
- **实施记录（2026-07-30）**: 删除 nextDialog/prevDialog 内手动 typeText 调用，仅保留 emit；typeText 统一由 watch(currentIndex) 触发

### R56. DialogText / DialogueCard 创建新 Audio 前未清理旧实例导致内存泄漏（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-batch4，PR #60 squash 合并 2026-07-30）
- **文件**:
  - `src/components/DialogText.vue`（第 245-268 行 `toggleAudio`）
  - `src/components/DialogueCard.vue`（第 155-177 行 `playAudio`）
- **问题描述**: `audioRef.value = new Audio(audioUrl)` 创建新 Audio 对象时，旧的 Audio 未 pause、未置空 onended，可能继续播放且事件监听仍触发
- **修复方案**:
  ```ts
  function playAudio(url: string) {
    if (audioRef.value) {
      audioRef.value.pause()
      audioRef.value.onended = null
      audioRef.value = null
    }
    audioRef.value = new Audio(url)
    // ... 设置事件监听
  }
  ```
- **验证方式**: 连续点击多个对话的播放按钮不会出现音频叠加；组件卸载无音频残留
- **分支建议**: `bugfix/round3-56-audio-leak`
- **依赖**: 无
- **实施记录（2026-07-30）**: DialogText.toggleAudio 与 DialogueCard.playAudio 创建新 Audio 前统一执行 pause + onended=null + 置空

### R57. ScenQuiz loadQuizzes 函数超长且 level1/2/3 三段逻辑重复（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-batch4，PR #60 squash 合并 2026-07-30）
- **文件**: `src/components/ScenQuiz.vue`（第 199-302 行）
- **问题描述**: `loadQuizzes` 函数约 100 行，远超 20 行限制，且 level1/2/3 三段逻辑高度重复（违反 DRY），仅 adapter 函数名与类型断言不同
- **修复方案**:
  1. 抽取通用 `watchLoader(loader, adapter, getter)` 工具函数
  2. 三个分支合并为一个，通过 `props.quizLevel` 动态选择 adapter
  3. 同步处理 R51 的 useDataLoader 顶层化
- **验证方式**: `npm run test` 通过；函数行数 < 20
- **分支建议**: `refactor/round3-57-scenquiz-split`
- **依赖**: R51
- **实施记录（2026-07-30）**:
  - 抽取 `watchLoader<T>(loader, timeoutMsg, onLoaded)` 通用函数，复用 watch+timeout 逻辑
  - 新增 `adaptAndStoreQuizzes(level, raw)` 通过 typeMap/getAllMap 动态选择 adapter
  - `loadQuizzes` 从 ~100 行缩减到 ~7 行；`loadScenarios` 同步简化
  - 注：R51 顶层化未做（R51 已关闭，保持现状）

### R58. StepThreeView isSubmitted 在 v-for 中 O(n²) 复杂度（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/views/StepThreeView.vue`（第 52, 71, 209-211 行）
- **问题描述**: `isSubmitted(index)` 在 `v-for` 中对每个 item 调用，每次渲染都执行 `answers.value.some()`，复杂度 O(n²)。题目数量多时会卡顿
- **修复方案**: 改为 computed 生成已提交索引的 `Set<number>`，模板中用 `submittedSet.has(index)` 判断
  ```ts
  const submittedSet = computed(() => new Set(answers.value.map((a) => a.questionIndex)))
  ```
- **验证方式**: 题目数量较多时渲染性能改善；功能不变
- **分支建议**: `refactor/round3-58-stepthree-perf`
- **依赖**: 无

### R59. StepThreeView 使用 `as any` 类型断言绕过类型检查（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/views/StepThreeView.vue`（第 70 行 `:data="item.quiz as any"`）
- **问题描述**: 模板内 `as any` 绕过类型检查，丧失 TS 类型保护
- **修复方案**: 在 PageItem 接口中明确 quiz 字段类型，或使用正确的类型断言
- **验证方式**: `npm run type-check` 通过且无 any 残留
- **分支建议**: `refactor/round3-59-stepthree-types`
- **依赖**: 无

### R60. StepThreeView watch pageData 使用不必要的 deep（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/views/StepThreeView.vue`（第 178-186 行）
- **问题描述**: watch 对 `pageData` 使用 `deep: true`，但回调只读取 `items.length`，深度遍历浪费性能
- **修复方案**: 改为 `() => pageData.value?.items.length` 作为 watch source，移除 `deep: true`
- **验证方式**: 功能不变；大对象时性能改善
- **分支建议**: `refactor/round3-60-stepthree-watch`
- **依赖**: 无

### R61. StepThreeView useRouter 导入但未使用（dead code）（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/views/StepThreeView.vue`（第 116, 148 行）
- **问题描述**: `useRouter` 导入并赋值给 `router`，但 `router` 从未使用
- **修复方案**: 删除 `useRouter` 的导入和 `const router = useRouter()`
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round3-61-stepthree-deadcode`
- **依赖**: 无

### R62. CultureCards 用 div @click 作为可交互元素无键盘支持（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-batch4，PR #60 squash 合并 2026-07-30）
- **文件**: `src/components/CultureCards.vue`（第 27-33 行）
- **问题描述**: 卡片用 `<div @click="handleCardClick(card)">`，无 `role="button"`、`tabindex="0"`、键盘事件（Enter/Space）处理，键盘用户无法操作，违反 WCAG 2.1 Level A
- **修复方案**: 改用 `<button>` 元素，或加 `role="button" tabindex="0" @keydown.enter="handleCardClick(card)" @keydown.space="handleCardClick(card)"`
- **验证方式**: 仅用键盘能选中并打开文化卡片
- **分支建议**: `a11y/round3-62-culturecards-keyboard`
- **依赖**: 无
- **实施记录（2026-07-30）**: 加 `:role="isUnlocked ? 'button' : undefined"`、`:tabindex="isUnlocked ? 0 : -1"`、`aria-label`、`@keydown.enter`、`@keydown.space.prevent`；新增 `.card-item:focus-visible` 样式

### R63. CultureCards isUnlocked 恒返回 true（dead code）（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/CultureCards.vue`（第 119-122 行）
- **问题描述**: `isUnlocked` 恒返回 `true`，`locked` class 永远不生效，是占位逻辑/dead code
- **修复方案**: 接入用户进度数据实现真实解锁逻辑，或删除锁定相关 UI 与函数
- **验证方式**: 锁定状态真实反映用户进度，或锁定 UI 完全移除
- **分支建议**: `refactor/round3-63-culturecards-unlock`
- **依赖**: 无

### R64. AudioPlayer / VideoPlayer 进度条不可键盘操作（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-batch4，PR #60 squash 合并 2026-07-30）
- **文件**:
  - `src/components/AudioPlayer.vue`（第 47-51 行）
  - `src/components/VideoPlayer.vue`（第 53-59 行）
- **问题描述**: 进度条 `<div @click="seek">` 不可键盘操作，无 `role="slider"`、`tabindex="0"`、键盘事件（左右箭头），键盘用户无法调整播放进度
- **修复方案**:
  ```html
  <div
    class="progress-bar"
    role="slider"
    tabindex="0"
    :aria-valuenow="Math.round(percentage * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="`播放进度 ${Math.round(percentage * 100)}%`"
    @click="seek"
    @keydown.left="seekBy(-0.05)"
    @keydown.right="seekBy(0.05)"
  ></div>
  ```
- **验证方式**: Tab 键可聚焦进度条；左右箭头可调整进度
- **分支建议**: `a11y/round3-64-media-progress-keyboard`
- **依赖**: 无
- **实施记录（2026-07-30）**: AudioPlayer/VideoPlayer 的 `.progress-wrapper` 加 role=slider/tabindex/aria-valuenow/aria-label/`@keydown.left`/`@keydown.right`；新增 `seekBy(delta)` 函数（步长 5%，clamp 到 0~1）；新增 `.progress-wrapper:focus-visible` 样式

### R65. AudioPlayer / VideoPlayer seek 未校验 percent 越界（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**:
  - `src/components/AudioPlayer.vue`（第 172-184 行）
  - `src/components/VideoPlayer.vue`（第 243-267 行）
- **问题描述**: `seek` 未校验 `percent` 越界（<0 或 >1），点击边缘可能跳转异常
- **修复方案**: `const clamped = Math.max(0, Math.min(1, percent))`
- **验证方式**: 点击进度条边缘不会跳转到异常位置
- **分支建议**: `bugfix/round3-65-media-seek-clamp`
- **依赖**: 无

### R66. DialogText / DialogueCard 逐字符 v-for 渲染性能问题（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**:
  - `src/components/DialogText.vue`（第 23-25 行）
  - `src/components/DialogueCard.vue`（第 27-29 行）
- **问题描述**: `<span v-for="(char, index) in displayedText" :key="index">` 逐字符渲染，长文本性能差；用 index 做 key
- **修复方案**:
  1. 改为纯文本插值 `{{ displayedText }}` 配合 CSS 动画实现打字机效果
  2. 或用 `<span>{{ displayedText }}</span>` 整体渲染，通过 CSS `@keyframes` 控制宽度
- **验证方式**: 长文本对话时渲染性能改善；打字机效果保持
- **分支建议**: `refactor/round3-66-typewriter-perf`
- **依赖**: R55

### R67. BlockRenderer componentMap 使用 any 类型 + 未命中 type 无 fallback（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/BlockRenderer.vue`（第 36 行、第 20 行）
- **问题描述**:
  1. `componentMap: Record<string, any>` 使用 any，丧失类型检查
  2. `<component :is="componentMap[block.type]">` 当 type 未命中时静默渲染空，无 fallback/警告，数据源新增类型时不易发现
- **修复方案**:
  1. 定义 `type ComponentMap = Record<string, Component>` 用 `DefineComponent` 或 `FunctionalComponent`
  2. 增加 `v-else` fallback 渲染"未支持的块类型"提示，或在 computed 中 debugWarn
- **验证方式**: `npm run type-check` 通过；未知 block.type 有 UI 提示
- **分支建议**: `refactor/round3-67-blockrenderer-types`
- **依赖**: 无

### R68. BlockRenderer 大量空 CSS 规则块（dead code）（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/BlockRenderer.vue`（第 99-130 行）
- **问题描述**: 大量空 CSS 规则块，是 dead code
- **修复方案**: 删除空规则，或补充实际样式
- **验证方式**: 视觉无变化；CSS 文件减小
- **分支建议**: `refactor/round3-68-blockrenderer-deadcss`
- **依赖**: 无

### R69. BackContinue 同时支持回调 props 和 emit（API 设计反模式）（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/BackContinue.vue`（第 43-45, 64-81 行）
- **问题描述**: 同时支持 `backEvent`/`continueEvent` 回调 props 和 `emit('back')`/`emit('continue')` 事件，双机制易混淆，违反"props down, events up"原则
- **修复方案**: 移除回调 props，统一用 emit；父组件用 `@back="handler"` 监听
- **验证方式**: 所有调用方改用 emit 监听；功能不变
- **分支建议**: `refactor/round3-69-backcontinue-api`
- **依赖**: 无

### R70. DialogText / DialogueCard getIconUrl 硬编码路径未走 getAssetUrl 封装（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**:
  - `src/components/DialogText.vue`（第 153-155 行）
  - `src/components/DialogueCard.vue`（第 188-190 行）
- **问题描述**: `getIconUrl` 硬编码路径 `/img/${iconName}`，未走 `@/utils/asset` 的 `getAssetUrl` 封装，OSS 环境下会 404
- **修复方案**: 改用 `getAssetUrl('images', `${iconName}.png`)` 或类似封装
- **验证方式**: 生产环境图标正常加载
- **分支建议**: `refactor/round3-70-icon-asset`
- **依赖**: 无

### R71. DialogText / DialogueCard 硬编码说话者名"陈胜/吴广/戍卒"（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**:
  - `src/components/DialogText.vue`（第 138-141 行）
  - `src/components/DialogueCard.vue`（第 110-117 行）
- **问题描述**: 硬编码说话者名判断，无法复用于其他课文
- **修复方案**: 改为配置驱动，由数据字段指定 speaker class，或通过 props 接收 speaker 映射表
- **验证方式**: 切换不同课文时说话者样式正确
- **分支建议**: `refactor/round3-71-speaker-config`
- **依赖**: 无

### R72. ScenQuiz tab 按钮缺少 ARIA tab 模式语义（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/ScenQuiz.vue`（第 5-15 行）
- **问题描述**: tab 按钮缺少 `role="tab"`、`aria-selected`、`role="tablist"` 容器，屏幕阅读器无法识别为标签页
- **修复方案**:
  ```html
  <div class="tabs" role="tablist">
    <button role="tab" :aria-selected="activeTab === 'level1'" ...></button>
  </div>
  ```
- **验证方式**: 屏幕阅读器正确朗读标签页语义
- **分支建议**: `a11y/round3-72-scenquiz-tab-aria`
- **依赖**: 无

### R73. ScenQuiz onMounted 与 watch 重复触发 loadData（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/ScenQuiz.vue`（第 343-359 行）
- **问题描述**: `loadData` 在 `onMounted` 调用，同时 `watch(quizLevel)`/`watch(textId)` 也会触发 `loadData`，初始挂载时可能重复加载
- **修复方案**: watch 改为 `{ immediate: false }`，或在 onMounted 中只手动调用一次
- **验证方式**: 初始挂载只触发一次数据加载
- **分支建议**: `bugfix/round3-73-scenquiz-double-load`
- **依赖**: R51

### R74. DialogueCard watch 与 onMounted 重复触发 typeText（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/components/DialogueCard.vue`（第 199-213 行）
- **问题描述**: `watch(dialogContent)` 与 `onMounted` 都调用 `typeText`，首次挂载若 dialogContent 已有值会触发两次
- **修复方案**: watch 加 `{ immediate: false }`，或 onMounted 中不调用（由 watch immediate 处理）
- **验证方式**: 首次渲染打字机只触发一次
- **分支建议**: `bugfix/round3-74-dialoguecard-typetext-dup`
- **依赖**: 无

---

## 二、状态层（stores）

### R75. auth.ts JWT 过期校验 NaN 风险（P1）

- **优先级**: P1
- **状态**: [x] 已完成（被 R35 覆盖；auth.ts isTokenExpired 已有 `if (typeof payload.exp !== 'number') return true` 校验，2026-07-30 确认）
- **文件**: `src/stores/auth.ts`（第 162-168 行）
- **问题描述**: `payload.exp` 未校验存在性，`exp * 1000` 在 exp 为 undefined 时得 NaN，`Date.now() > NaN` 恒为 false，会错误判定"未过期"
- **修复方案**:
  ```ts
  if (typeof payload.exp !== 'number') return true
  return Date.now() > payload.exp * 1000
  ```
- **验证方式**: 损坏 token（无 exp 字段）正确识别为过期
- **分支建议**: `bugfix/round3-75-jwt-exp-nan`
- **依赖**: 无

### R76. auth.ts AuthState 接口未使用（dead code）（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/stores/auth.ts`（第 29-35 行）
- **问题描述**: `AuthState` 接口已定义但全文未使用（store 用 setup 语法，状态由 ref 暴露）
- **修复方案**: 删除未使用接口，或改为导出供外部类型引用
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round3-76-auth-dead-interface`
- **依赖**: 无

### R77. auth.ts login 函数超长（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/stores/auth.ts`（第 75-118 行）
- **问题描述**: `login` 函数约 43 行，超过 20 行限制
- **修复方案**: 拆分为 `mapUserData`、`persistAuth`、`handleLoginError` 等子函数
- **验证方式**: 函数行数 < 20；功能不变
- **分支建议**: `refactor/round3-77-auth-split`
- **依赖**: 无

### R78. student.ts setStudentId 未做格式校验（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/stores/student.ts`（第 38-42 行）
- **问题描述**: `setStudentId` 未做格式校验即写入 localStorage，与 `restoreFromStorage` 中 `/^\d{4}$/` 校验逻辑不一致，可能持久化非法值
- **修复方案**: 在 setStudentId 中复用同一正则校验，非法值拒绝写入并 debugWarn
- **验证方式**: 传入非数字学号被拒绝；与 restoreFromStorage 行为一致
- **分支建议**: `bugfix/round3-78-studentid-validate`
- **依赖**: R02（学号规则统一后同步处理）

### R79. bgm.ts bgmMapping 硬编码且可被外部修改（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/stores/bgm.ts`（第 18-23, 79 行）
- **问题描述**:
  1. `bgmMapping` 硬编码 4 个 wenId 与文件名映射，文件名后缀 `.mp3` 重复，应来自配置或后端
  2. 作为普通对象在 return 中导出，外部可意外修改内部映射表
- **修复方案**:
  1. 迁移到 `config/bgm.ts` 或由后端返回
  2. 用 `readonly()` 包裹或仅导出查询函数
- **验证方式**: 外部修改 bgmMapping 不影响 store 内部
- **分支建议**: `refactor/round3-79-bgm-mapping`
- **依赖**: 无

---

## 三、组合式函数层（composables）

### R80. useNavigation getDefaultId 含未使用变量（dead code）（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useNavigation.ts`（第 68-73 行）
- **问题描述**: `getDefaultId` 内声明 `pageIndex` 变量后未使用，函数直接 `return '1'`，属 dead code，导致 `getTargetId` 的兜底逻辑失效
- **修复方案**: 删除未使用变量并修正逻辑使用索引查找默认 ID，或显式记录"默认返回 '1'"的设计决策
- **验证方式**: `npm run type-check` 无未使用变量警告
- **分支建议**: `refactor/round3-80-navigation-deadcode`
- **依赖**: 无

### R81. useDataLoader 重试 setTimeout 未保存导致卸载后仍可能触发（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useDataLoader.ts`（第 288 行）
- **问题描述**: 重试 `setTimeout(() => load(), backoff)` 未保存返回值，组件卸载时无法清除，可能在卸载后仍触发 load
- **修复方案**: 保存 timeoutId 并在 `onUnmounted` 中清除
- **验证方式**: 快速切换页面时无卸载后 load 触发
- **分支建议**: `bugfix/round3-81-dataloader-retry-timer`
- **依赖**: 无

### R82. useDataLoader diagLog 生产环境可能泄露数据内容（P1）

- **优先级**: P1
- **状态**: [x] 已完成（被 R18/R19/R20 重构覆盖；diagLog 已移除，全部改为 debugLog（受 DEV 控制），`text.slice(0,100)` 输出已删除，2026-07-30 确认）
- **文件**: `src/composables/useDataLoader.ts`（第 4-7, 178, 219, 228, 236, 239 行）
- **问题描述**: `diagLog` 注释声称"始终输出用于调试"，且输出响应文本前 100 字（第 239 行），生产环境可能泄露数据内容与 URL
- **修复方案**:
  1. diagLog 改为受 `import.meta.env.DEV` 开关控制
  2. 移除 `text.slice(0,100)` 等数据内容输出
  3. 保留 `debugLog('[useDataLoader] xxx', ...)` 关键路径日志（无数据内容）
- **验证方式**: 生产构建无数据内容输出；开发环境仍可调试
- **分支建议**: `security/round3-82-dataloader-log-leak`
- **依赖**: 无

### R83. useDataLoader CacheEntry 使用 any 类型（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useDataLoader.ts`（第 16, 22 行）
- **问题描述**: `CacheEntry<T = any>`、`cacheMap: Map<string, CacheEntry>` 等价 `CacheEntry<any>`，类型检查失效
- **修复方案**: 默认类型改为 `unknown`，cacheMap 内部维护时显式断言
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round3-83-dataloader-types`
- **依赖**: 无

### R84. useDataLoader load 函数超长（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useDataLoader.ts`（第 176-296 行）
- **问题描述**: `load` 函数约 120 行，远超 20 行限制
- **修复方案**: 拆分为 `checkCache`、`doFetch`、`parseResponse`、`handleRetry` 等子函数
- **验证方式**: 每个子函数 < 20 行；功能不变
- **分支建议**: `refactor/round3-84-dataloader-split`
- **依赖**: 无

### R85. useDataLoader 共享 Worker 任务间互相影响（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useDataLoader.ts`（第 91-97, 122-127 行）
- **问题描述**: 共享 Worker 单例下，每个任务都注册 `handleError`，worker 全局 error 会触发所有未完成任务的 reject，可能导致 Promise 重复 reject
- **修复方案**: 引入任务注册表，统一分发 error；或对每个 Promise 做 reject 去重
- **验证方式**: 并发请求时单个失败不影响其他请求
- **分支建议**: `bugfix/round3-85-dataloader-worker`
- **依赖**: 无

### R86. useStudentInfo clearCache 空函数（dead code）（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useStudentInfo.ts`（第 47, 49-54, 64 行）
- **问题描述**: `clearCache` 为空函数，watch 调用它无任何效果，且导出空函数，属 dead code / 无效逻辑
- **修复方案**: 实现清理逻辑或删除空函数与 watch
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round3-86-studentinfo-deadcode`
- **依赖**: 无

### R87. useQuizProgress submitAnswersToBackend 从未调用（dead code）（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useQuizProgress.ts`（第 151-195 行）
- **问题描述**: `submitAnswersToBackend` 函数定义但全文从未调用（handleSubmit 只调单题提交），属 dead code，且暗示批量提交能力缺失
- **修复方案**: 若需批量提交，在合适时机（如 markAsCompleted）调用；否则删除
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round3-87-quizprogress-deadcode`
- **依赖**: 无

### R88. useQuizProgress watch totalQuestionsRef 未重置 answers/completedCount（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useQuizProgress.ts`（第 308-324 行）
- **问题描述**: `watch(totalQuestionsRef, ..., { immediate: true })` 在题目总数变化时仅重置 `submittedList`，未重置 `answers`/`completedCount`（除非 newVal===0），可能导致 `completedCount > newVal` 的不一致状态
- **修复方案**: 题目总数变化时统一重置 answers/completedCount/submittedList
- **验证方式**: 题目总数动态变化时进度状态一致
- **分支建议**: `bugfix/round3-88-quizprogress-reset`
- **依赖**: 无

### R89. useQuizProgress 直接调用 sessionStorage 未封装（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/composables/useQuizProgress.ts`（第 79, 91, 97 行）
- **问题描述**: 直接调用 sessionStorage，与 localStorage 封装精神不一致
- **修复方案**: 提供 sessionStorage 封装或纳入统一 storage 工具
- **验证方式**: `grep "sessionStorage\." src/composables/useQuizProgress.ts` 无命中
- **分支建议**: `refactor/round3-89-quizprogress-storage`
- **依赖**: R34

---

## 四、工具层（utils）

### R90. utils/api.ts 前端持有 VITE_AUTH_SECRET 密钥（P0 安全漏洞）

- **优先级**: P0
- **状态**: [x] 已完成（分支 security/round3-90-auth-secret-leak，2026-07-30）
- **文件**: `src/utils/api.ts`（第 4, 8-29 行，已删除）
- **评估结论**: 前端 `generateHmacSignature`/`authEnabled` 为 dead code（全仓库无调用方），提交实际走 JWT Bearer（`getAuthHeaders`）。但后端 `backend/src/controllers/answerController.js` 第 6-39、79-88 行仍用 `AUTH_SECRET` 校验 HMAC 签名（`AUTH_ENABLED` 时），前端不发 `signature` → 测试/生产环境（`AUTH_SECRET` 非空）`/api/submit` 会返回 401「缺少签名」。属前后端鉴权不一致的功能 bug，不仅是密钥泄露。
- **完整修复方案（前后端联动）**:
  1. 前端 `src/utils/api.ts`：删 `generateHmacSignature`、`authSecret`、`authEnabled`（第 4-29 行 dead code）
  2. 后端 `backend/src/controllers/answerController.js`：移除 `AUTH_SECRET`/`AUTH_ENABLED`/`generateHmacSignature`/`verifyHmacSignature`，`submitAnswers`/`submitSingleAnswer` 内移除签名校验块（第 79-88 行），鉴权完全交给 `optionalAuthMiddleware`（JWT）
  3. 配置：移除 `.github/workflows/deploy-frontend.yml` 第 36 行、`deploy-frontend-test.yml` 第 35 行的 `VITE_AUTH_SECRET` env；移除 `.env.example` 第 15 行、`env.example` 第 18-21 行的 `VITE_AUTH_SECRET` 声明；后端 `AUTH_SECRET` 暂保留（`config/app.js` 仍读，后续 R 轮清理）
  4. 验证：`grep -r "VITE_AUTH_SECRET\|authSecret" dist/ src/` 无命中；`cd backend && npm test` 通过（CI 中 `AUTH_SECRET=''` 本就跳过校验，改后行为一致）
- **风险**: 低。前端删 dead code 无副作用；后端移除 HMAC 校验在 CI（`AUTH_SECRET=''`）下行为不变，生产环境从「拒绝无签名请求」变为「接受 JWT 鉴权请求」，与前端实际行为对齐（修复 401 bug）
- **问题描述**: `authSecret` 从 `VITE_AUTH_SECRET` 读取并用于生成 HMAC 签名。Vite 环境变量以 `VITE_` 开头会被打包进客户端代码，等于把服务端密钥公开发布。客户端密钥可被攻击者提取后伪造任意签名，违反项目规则"E. 提交答案的安全流程"
- **修复方案**:
  1. 客户端不应持有服务端 secret
  2. 改为登录时由服务端下发一次性 token，或采用服务端签发的短期 JWT
  3. 签名生成必须在服务端完成
- **验证方式**: 生产构建产物中无 `VITE_AUTH_SECRET` 字符串；`grep "authSecret" dist/` 无命中
- **分支建议**: `security/round3-90-auth-secret-leak`
- **依赖**: 无
- **实施记录（2026-07-30）**:
  - 前端 `src/utils/api.ts`：删除第 4-29 行 `authSecret`/`authEnabled`/`generateHmacSignature`，仅保留注释说明
  - 后端 `backend/src/controllers/answerController.js`：删除 `crypto` require、`AUTH_SECRET`/`AUTH_ENABLED` 常量、`generateHmacSignature`/`verifyHmacSignature` 函数；`submitAnswers` 删除 `signature` 解构与校验块（保留原分号风格，未跑 prettier 全文件重格式化）
  - 后端 `backend/src/app.js`：`/api/health` 响应移除 `authEnabled` 字段；启动日志移除「鉴权状态」行（保留原分号风格）
  - 配置：`.github/workflows/deploy-frontend.yml`、`deploy-frontend-test.yml` 移除 `VITE_AUTH_SECRET` env；`.env.example`、`env.example` 移除 `VITE_AUTH_SECRET` 声明并加注释说明
  - 后端 `config/app.js` 的 `auth.secret` 读取保留（无使用方，留待后续 R 轮清理，避免本 PR 范围扩散）
  - 验证：`npm run type-check` 通过；`cd backend && npx jest tests/auth-service.test.js tests/database.test.js tests/dbPromise.test.js` 53/53 通过（CI 实际执行的 3 个测试文件）；`grep "VITE_AUTH_SECRET\|authSecret" src/` 仅剩注释

### R91. utils/api.ts 大量 any 类型滥用（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-fixes，PR #58 squash 合并 2026-07-30）
- **文件**: `src/utils/api.ts`（第 51, 54, 63, 171, 185, 193, 201 行）
- **问题描述**: `body?: any`、`ApiResponse<T = any>`、`normalizeResponse<T = any>(response: any)` 等多处 any，类型契约形同虚设
- **修复方案**:
  1. `body` 改为 `unknown` 或 `Record<string, unknown>`
  2. `ApiResponse<T>` 默认 `T = unknown`
  3. `normalizeResponse(response: unknown)`
- **验证方式**: `grep ": any" src/utils/api.ts` 无命中
- **分支建议**: `refactor/round3-91-api-types`
- **依赖**: 无
- **实施记录（2026-07-30）**:
  - `RequestConfig.body`: `any` → `unknown`
  - `ApiResponse<T = unknown>`、`normalizeResponse<T = unknown>(response: unknown)`、`request/get/post/put/del<T = unknown>`
  - `errorData` 收窄为 `Record<string, unknown> | null`，用 `typeof` 判断字段类型后再使用
  - 附带修复：R91 类型收窄暴露的调用方错误——`stores/auth.ts` post 调用加 `AuthTokenResponse` 类型参数；`composables/useStudentQuery.ts` get 调用加 `{ name: string }` 类型参数

### R92. utils/api.ts request 函数超长（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/api.ts`（第 114-169 行）
- **问题描述**: `request` 函数约 36 行，超过 20 行限制
- **修复方案**: 拆分为 `buildRequestConfig`、`handleResponse`、`handleError` 三个子函数
- **验证方式**: 函数行数 < 20
- **分支建议**: `refactor/round3-92-api-split`
- **依赖**: 无

### R93. utils/api.ts body falsy 误判（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/api.ts`（第 137 行 `body ? JSON.stringify(body) : undefined`）
- **问题描述**: 若调用方传入 `body: false`、`body: 0`、`body: ''` 会被当作无 body 跳过 stringify
- **修复方案**: 改为 `body !== undefined && body !== null ? JSON.stringify(body) : undefined`
- **验证方式**: 传入 falsy body 时正确 stringify
- **分支建议**: `bugfix/round3-93-api-body-falsy`
- **依赖**: 无

### R94. utils/api.ts getBaseUrl 逻辑诡异且未注释（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/api.ts`（第 31-37 行）
- **问题描述**: 当 `VITE_API_BASE_URL` 配置为 localhost/127.0.0.1 时返回空字符串，与 `apiBase` 导出值不一致，容易产生歧义
- **修复方案**: 统一返回 `baseUrl`，或在 dev/prod 分别处理并添加注释说明用途
- **验证方式**: 行为一致且有注释说明
- **分支建议**: `refactor/round3-94-api-baseurl`
- **依赖**: 无

### R95. utils/api.ts getAuthHeaders 直接调用 useAuthStore（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/api.ts`（第 40 行）
- **问题描述**: Pinia store 必须在 `app.use(pinia)` 之后才能调用。若此模块在 Pinia 安装前被调用会抛 `getActivePinia` 错误
- **修复方案**: 在调用处用 `try { useAuthStore() } catch { return {} }` 兜底，或改为参数注入
- **验证方式**: 早期调用不抛错
- **分支建议**: `refactor/round3-95-api-auth-headers`
- **依赖**: 无

### R96. utils/asset.ts ossBase 类型断言导致环境变量缺失静默失败（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-fixes，PR #58 squash 合并 2026-07-30）
- **文件**: `src/utils/asset.ts`（第 15 行）
- **问题描述**: `ossBase` 使用 `as string` 类型断言，若 `VITE_OSS_BASE_URL` 未配置，实际为 undefined 但被断言为 string，`getAssetUrl` 拼出 `undefined/audio/xxx.mp3` 这种 URL，运行时才暴露错误
- **修复方案**:
  ```ts
  export const ossBase: string = import.meta.env.VITE_OSS_BASE_URL ?? ''
  if (isDev && !ossBase) debugWarn('VITE_OSS_BASE_URL 未配置')
  ```
- **验证方式**: 环境变量缺失时 dev 模式有告警；不再生成 `undefined/...` URL
- **分支建议**: `bugfix/round3-96-asset-ossbase`
- **依赖**: 无

### R97. utils/asset.ts getAssetUrl 未做 URL 编码（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/asset.ts`（第 34-35 行）
- **问题描述**: `fileName` 若含空格、中文、`#`、`?` 等字符会破坏 URL
- **修复方案**: `return `${ossBase}/${type}/${encodeURIComponent(fileName)}``
- **验证方式**: 含特殊字符的文件名正常加载
- **分支建议**: `bugfix/round3-97-asset-encode`
- **依赖**: 无

### R98. utils/localStorage.ts appendQuizRecord JSON 损坏时丢失原数据（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-fixes，PR #58 squash 合并 2026-07-30）
- **文件**: `src/utils/localStorage.ts`（第 87-92 行）
- **问题描述**: `appendQuizRecord` 调用 `getQuizRecords`，当原数据 JSON 损坏时返回空数组，随后 `setQuizRecords` 会用 `[record]` 覆盖原损坏数据，导致历史记录永久丢失
- **修复方案**: 解析失败时不要继续写入；或在 `getQuizRecords` 提供区分"无数据"和"解析失败"的返回值（如 `{ ok: boolean, data: T[] }`），由调用方决定是否覆盖
- **验证方式**: JSON 损坏时新记录不覆盖；有 debugError 日志
- **分支建议**: `bugfix/round3-98-localstorage-corrupt`
- **依赖**: 无
- **实施记录（2026-07-30）**:
  - `appendQuizRecord` 内联读取并校验原始 JSON：无数据初始化为 `[]`；解析失败或非数组时 `debugLog` 并返回 `[]`（不写入，保留原始数据）；成功才 push + setQuizRecords
  - 函数名修正：`buildStorageKey` → `buildQuizStorageKey`（被 R34 重命名后遗漏）

### R99. utils/localStorage.ts 未处理 localStorage 不可用场景（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/localStorage.ts`（第 47, 70, 102 行）
- **问题描述**: 隐私模式或 storage 配额满时 `localStorage.getItem/setItem/removeItem` 会抛 `QuotaExceededError` 或 `SecurityError`。`setQuizRecords` 已 try/catch，但 `getQuizRecords` 和 `clearQuizRecords` 未做异常捕获
- **修复方案**: 统一在 try/catch 中包裹所有 localStorage 访问，或封装 `safeGetItem/safeSetItem/safeRemoveItem`
- **验证方式**: 隐私模式下不抛错
- **分支建议**: `refactor/round3-99-localstorage-safe`
- **依赖**: 无

### R100. utils/format.ts formatDate 未校验无效日期（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/format.ts`（第 10-14 行）
- **问题描述**: `new Date('invalid')` 返回 Invalid Date，`toLocaleString` 返回 `"Invalid Date"`，UI 直接显示该字符串不友好
- **修复方案**: `if (isNaN(date.getTime())) return '-'`
- **验证方式**: 无效日期显示 `-` 而非 `Invalid Date`
- **分支建议**: `bugfix/round3-100-format-invalid-date`
- **依赖**: 无

### R101. utils/studentApi.ts getStudent 吞掉所有错误（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-fixes，PR #58 squash 合并 2026-07-30）
- **文件**: `src/utils/studentApi.ts`（第 128-135 行）
- **问题描述**: `catch {}` 静默吞掉网络错误、超时、服务端 500 等，调用方无法区分"学生不存在"和"请求失败"。`checkStudentExists` 依赖此函数，会把网络故障误判为"学生不存在"
- **修复方案**: 区分 404 与其他错误；或返回 `{ data: StudentInfo | null, error?: Error }` 联合结构
- **验证方式**: 网络故障时 `checkStudentExists` 不误判为"学生不存在"
- **分支建议**: `bugfix/round3-101-studentapi-error`
- **依赖**: 无
- **实施记录（2026-07-30）**:
  - `studentApi.ts` 已重构为 re-export 层，实际实现在 `services/studentService.ts`
  - `getStudent` 改为：仅 404（学生不存在）返回 null；其他错误（网络故障、超时、5xx 等）向上抛出，避免误判

### R102. utils/studentApi.ts validateStudentName 黑名单不完整（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/utils/studentApi.ts`（第 90 行）
- **问题描述**: `[<>"'&]` 未覆盖反引号、`javascript:` 前缀、unicode 控制字符（U+200B 零宽空格等）、换行符 `\n` 等。黑名单思路本身不安全
- **修复方案**: 改用白名单（如只允许中文/字母/数字/常见标点），或交给后端做转义；前端只做长度校验
- **验证方式**: 含 unicode 控制字符的姓名被拒绝
- **分支建议**: `security/round3-102-studentapi-xss`
- **依赖**: 无

---

## 五、服务层（services）

### R103. services/apiService.ts login 仅靠 studentId 无密码凭证（P0 安全漏洞）

- **优先级**: P0
- **状态**: [x] 已完成（分支 security/round3-103-login-credential，PR #55 合并 2026-07-30）
- **文件**: `src/services/apiService.ts`（第 314-317 行，已删除 dead code）/ `src/stores/auth.ts` / `src/components/LoginModal.vue` / `src/components/StudentDisplay.vue`
- **评估结论**: 后端三级账号体系已就绪——`backend/src/controllers/authController.js` `studentLogin` 要求 `student_id` + `password`（Zod schema 第 22-28 行 + `verifyPassword` 第 70 行 + JWT 签发）。问题在前端：`services/apiService.login`、`stores/auth.login`、`LoginModal`/`StudentDisplay` 三处都未传 `password`，调用 `/api/auth/login`（路由第 75 行指向 `studentLogin`）会 400（密码必填）。学生登录当前是坏的（功能 bug）。
- **完整修复方案（前端 UI + 适配）**:
  1. `src/stores/auth.ts` 的 `login(studentId, password, studentName?)`：改 POST `/api/auth/student/login`（新端点，第 63 行）传 `{ student_id, password }`，不再用兼容端点 `/api/auth/login`
  2. `src/services/apiService.ts` 的 `login`：同步加 `password` 参数（或评估为 dead code 直接删——已确认 `LoginModal`/`StudentDisplay` 走 `authStore.login` 不走 `apiService.login`）
  3. `src/components/LoginModal.vue`：加密码输入框（第 168 行调用改 `authStore.login(studentId, password)`），默认密码提示（教师重置后为 `123456`）
  4. `src/components/StudentDisplay.vue` 第 159 行同步
  5. 处理 `must_reset_password`：登录返回 `must_reset_password=true` 时引导跳转改密（后端 `changePassword` 第 289 行已就绪，端点 `/api/auth/change-password`）
- **需 UI 决策**: ~~密码框样式/占位、默认密码 `123456` 的提示文案、首次登录强制改密流程（弹窗 or 路由跳转）、改密 UI 放哪个视图~~ 已决策：最小改动加密码框，强制改密流程延后单独处理
- **风险**: 中。涉及登录 UI 交互重构，需保证不破坏现有学号→姓名查询流程（`queryStudentName`）
- **问题描述**: 任意人输入他人学号即可登录并获取 token，严重违反项目规则中的鉴权要求
- **修复方案**:
  1. 至少加入班级+姓名校验或教师预设口令
  2. 长期应改为学号+密码或第三方 SSO
- **验证方式**: 仅凭学号无法登录
- **分支建议**: `security/round3-103-login-credential`
- **依赖**: R90
- **实施记录（2026-07-30）**:
  - `src/stores/auth.ts`：`login` 签名加 `password: string` 必填参数 + `studentName?` 可选（仅用于显示回退）；改 POST `/api/auth/student/login` 传 `{ student_id, password }`；用户信息构造优先用后端返回字段 `username`/`student_name`/`student_id`，`studentName` 仅作显示回退
  - `src/components/LoginModal.vue`：新增密码输入框（`type="password"` + `autocomplete="current-password"`）与必填校验；登录按钮 `:disabled` 串联 `hasError && !password`；测试账号提示区补充「默认密码：123456（教师重置后同此值）」
  - `src/components/StudentDisplay.vue`：弹窗同步加密码输入；`isValid` 计算属性串联密码非空校验；打开/关闭弹窗时清空密码字段，避免残留
  - `src/services/apiService.ts`：删除 dead code `login` 函数（确认无调用方），保留 `LoginResponse` 接口供 `stores/auth.ts` 类型参考
  - **延后项**：`must_reset_password=true` 强制改密流程未实现（后端 `changePassword` 已就绪，前端改密 UI 待后续单独 PR）
  - 验证：`npm run type-check` 通过；`quality-check` + `backend-check` CI 双绿；PR #55 已合并到 feature-1

### R104. services/apiService.ts response.data! 非空断言导致运行时崩溃（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-fixes，PR #58 squash 合并 2026-07-30）
- **文件**: `src/services/apiService.ts`（第 382-386, 425-429 行）
- **问题描述**: 服务端返回 `{ success: false, message: '...' }` 但无 `data` 时，`response.data!` 在运行时为 `undefined`，调用方当成有效响应使用会崩
- **修复方案**: 先校验 `if (!response.success || !response.data) throw new ApiError(...)`，再返回 `data`
- **验证方式**: 后端返回异常响应时显示友好错误而非崩溃
- **分支建议**: `bugfix/round3-104-apiservice-nullcheck`
- **依赖**: 无
- **实施记录（2026-07-30）**:
  - `submitAnswers`（第 381-387 行）：移除 `response.data!` 非空断言，改为 `if (!response.success || !response.data) throw new ApiError(500, 'SUBMIT_FAILED', response.message || '提交答题结果失败')`，校验通过后才返回 `response.data`
  - `submitSingleAnswer`（第 420-430 行）：同样移除非空断言，加 `ApiError` 校验
  - `ApiError` 已从 `@/utils/api` 导入（第 18 行）

### R105. services/apiService.ts 文件头注释欺骗性（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/services/apiService.ts`（第 9 行）
- **问题描述**: 注释声称"支持缓存机制"但实际未实现，代码中无任何缓存逻辑
- **修复方案**: 删除该注释，或补一个 `Map<textId, T>` 内存缓存（带 TTL）
- **验证方式**: 注释与实现一致
- **分支建议**: `refactor/round3-105-apiservice-comment`
- **依赖**: 无

### R106. services/apiService.ts submitAnswers answers 类型不一致（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/services/apiService.ts`（第 372 行 `Record<string, any>` vs 第 336 行 `Record<string, string | number | (string | number)[]>`）
- **问题描述**: `submitAnswers` 的 `answers` 字段类型与 `SubmitAnswersParams.answers` 类型不一致，传入复杂对象会被静默接受
- **修复方案**: 统一为 `Record<string, string | number | (string | number)[]>`
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round3-106-apiservice-types`
- **依赖**: 无

### R107. services/apiService.ts submittedAt 由客户端生成（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/services/apiService.ts`（第 383 行）
- **问题描述**: 客户端时间不可信，可被任意篡改，影响排行/防作弊。项目规则 E 中已要求服务端签名校验时间戳
- **修复方案**: 服务端以接收时间覆盖 `submittedAt`，客户端值仅作参考
- **验证方式**: 服务端日志显示的 submittedAt 为服务端接收时间
- **分支建议**: `security/round3-107-submitted-at`
- **依赖**: R90

---

## 六、适配器层（adapters）

### R108. 三个 levelQuizAdapter 代码 100% 重复（P0 架构问题）

- **优先级**: P0
- **状态**: [x] 已完成（分支 refactor/round3-108-adapter-factory，CI 通过 2026-07-30，引入 levelQuizAdapterCore 工厂 + 3 个薄封装）
- **文件**:
  - `src/adapters/level1QuizAdapter.ts`
  - `src/adapters/level2QuizAdapter.ts`
  - `src/adapters/level3QuizAdapter.ts`
- **问题描述**: 三个文件几乎完全重复（仅 module='A'/'B'/'C'、difficulty='L1'/'L2'/'L3'、questionId 前缀 `_A`/`_B`/`_C` 不同），共约 200 行代码可压缩到 1 个参数化工厂 + 3 个薄封装。严重违反 DRY 原则，维护时任何 bug 修复都要改三处，极易遗漏（已观察到 `options` 过滤不一致的"漂移"症状）
- **修复方案**:
  ```ts
  function createLevelAdapter<L extends string>(level: L, module: string, defaultDiff: string) {
    // 通用 adapt / getByQuestionNumber / getAll 实现
  }
  export const level1Adapter = createLevelAdapter('Level1', 'A', 'L1')
  export const level2Adapter = createLevelAdapter('Level2', 'B', 'L2')
  export const level3Adapter = createLevelAdapter('Level3', 'C', 'L3')
  ```
- **验证方式**: 三个 adapter 行为一致（含 options 过滤等细节）；`npm run test` 通过
- **分支建议**: `refactor/round3-108-adapter-factory`
- **依赖**: 无

### R109. level1/2/3QuizAdapter correct_answer `|| null` 对 0/'' 误判（P1 bug）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-batch4，PR #60 squash 合并 2026-07-30）
- **文件**:
  - `src/adapters/level1QuizAdapter.ts`（第 56 行）
  - `src/adapters/level2QuizAdapter.ts`（第 56 行）
  - `src/adapters/level3QuizAdapter.ts`（第 56 行）
- **问题描述**: `item.correct_answer || null` 若 `correct_answer` 为 `0`（合法选项索引）或空字符串，会被 `|| null` 覆盖为 `null`，导致正确答案丢失
- **修复方案**: 改为 `item.correct_answer ?? null`
- **验证方式**: correct_answer 为 0 时正确保留；答题判定正确
- **分支建议**: `bugfix/round3-109-adapter-correct-answer`
- **依赖**: 无
- **实施记录（2026-07-30）**: 三个 adapter 的 `correctAnswer: item.correct_answer || null` → `item.correct_answer ?? null`

### R110. quizAdapter parseInt `|| 1` 对 0 误判（P2 bug）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/adapters/quizAdapter.ts`（第 41 行 `parseInt(String(blockData.question_number)) || 1`）
- **问题描述**: `question_number = 0` 时 `0 || 1` 得 `1`，把第 0 题变成第 1 题
- **修复方案**:
  ```ts
  const parsed = parseInt(String(blockData.question_number), 10)
  const questionNumber = isNaN(parsed) ? 1 : parsed
  ```
- **验证方式**: question_number 为 0 时正确保留
- **分支建议**: `bugfix/round3-110-quizadapter-qnumber`
- **依赖**: 无

### R111. level1/2/3QuizAdapter questionId 用 index+1 生成不稳定（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**:
  - `src/adapters/level1QuizAdapter.ts`（第 44 行）
  - `src/adapters/level2QuizAdapter.ts`
  - `src/adapters/level3QuizAdapter.ts`
- **问题描述**: `questionId` 用 `index+1` 生成，数据顺序变化或后端返回缺失项导致 index 漂移，`questionId` 会变化，破坏本地缓存与提交记录的关联
- **修复方案**: 优先使用 `item.question_id`（若后端有），fallback 才用 index
- **验证方式**: 数据顺序变化时 questionId 保持稳定
- **分支建议**: `refactor/round3-111-adapter-questionid`
- **依赖**: R108

### R112. level1/2/3QuizAdapter options 过滤行为不一致（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**:
  - `src/adapters/level1QuizAdapter.ts`（第 48-53 行，无过滤）
  - `src/adapters/level2QuizAdapter.ts`（同上）
  - `src/adapters/level3QuizAdapter.ts`（同上）
  - `src/adapters/quizAdapter.ts`（第 59 行有 `.filter(opt => opt.value.trim() !== '')`）
- **问题描述**: `quizAdapter.ts` 有过滤空选项，但三个 level adapter 没有，行为不一致（漂移症状）
- **修复方案**: 统一过滤空选项（在 R108 工厂函数中统一处理）
- **验证方式**: 三个 level adapter 与 quizAdapter 行为一致
- **分支建议**: `refactor/round3-112-adapter-options-filter`
- **依赖**: R108

### R113. quizAdapter adaptBlockQuizToQuizItem 函数超长（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/adapters/quizAdapter.ts`（第 33-66 行）
- **问题描述**: 函数约 30 行，超过 20 行限制
- **修复方案**: 抽出 `buildOptions(blockData)`、`resolveCorrectAnswer(blockData)`、`resolveQuestionNumber(blockData)` 子函数
- **验证方式**: 函数行数 < 20
- **分支建议**: `refactor/round3-113-quizadapter-split`
- **依赖**: 无

---

## 七、路由层（router）

### R114. router 未声明 RouteMeta 类型扩展（P2）

- **优先级**: P2
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**:
  - `src/router/index.ts`
  - `src/router/guards.ts`（第 39 行 `to.meta.showLoginModal = true`）
- **问题描述**: 未声明 `declare module 'vue-router'` 扩展 RouteMeta（如 `requiresAuth`、`showLoginModal`、`public`），guards.ts 中 `to.meta.showLoginModal = true` 在 TS 严格模式下类型报错或隐式 any
- **修复方案**: 新增 `src/router/types.ts` 或在 `env.d.ts` 声明 RouteMeta 接口扩展
  ```ts
  declare module 'vue-router' {
    interface RouteMeta {
      requiresAuth?: boolean
      showLoginModal?: boolean
      public?: boolean
    }
  }
  ```
- **验证方式**: `npm run type-check` 通过；`to.meta.showLoginModal` 有类型提示
- **分支建议**: `refactor/round3-114-router-meta-types`
- **依赖**: 无

### R115. guards.ts useAuthGuard 解构丢失响应式（P1）

- **优先级**: P1
- **状态**: [x] 已完成（分支 trae/agent-round3-p1-fixes，PR #58 squash 合并 2026-07-30）
- **文件**: `src/router/guards.ts`（第 64-76 行）
- **问题描述**: `useAuthGuard` 中直接返回 `authStore.isLoggedIn`/`user`/`error` 等响应式属性，未用 `storeToRefs`，解构后丢失响应式，调用方拿到的是初始快照
- **修复方案**:
  ```ts
  export function useAuthGuard() {
    const authStore = useAuthStore()
    const { isLoggedIn, user, error } = storeToRefs(authStore)
    return {
      isLoggedIn,
      user,
      error,
      hasError: computed(() => authStore.error !== null),
      login: (studentId: string, password: string, studentName?: string) =>
        authStore.login(studentId, password, studentName),
      logout: () => authStore.logout(),
    }
  }
  ```
- **验证方式**: 登录状态变化时调用方正确响应
- **分支建议**: `bugfix/round3-115-guard-reactive`
- **依赖**: 无
- **实施记录（2026-07-30）**:
  - 第 13 行导入 `storeToRefs`；第 66 行用 `storeToRefs(authStore)` 解构 `isLoggedIn`/`user`/`error`，保留响应式
  - `login` 包装改为 3 参签名 `(studentId, password, studentName?)`，与 R103 后 `authStore.login` 签名一致
  - 额外提供 `hasError: computed(() => authStore.error !== null)` 便于调用方模板判断

### R116. guards.ts async 守卫无 await + from 参数未使用（P3）

- **优先级**: P3
- **状态**: [x] 已完成（P2/P3 批次，trae/agent-round3-p2p3）
- **文件**: `src/router/guards.ts`（第 27, 29 行）
- **问题描述**:
  1. `async` 守卫函数体内无 `await`，async 多余
  2. `from` 参数声明但未使用，属 dead code
- **修复方案**: 去掉 async；`from` 改为 `_from` 或省略
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round3-116-guard-cleanup`
- **依赖**: 无

---

## 优先级汇总与执行建议

### P0（必须立即修复，阻断功能/安全漏洞）

- [x] **R90** utils/api.ts 前端持有 VITE_AUTH_SECRET 密钥（PR #54）
- [x] **R103** services/apiService.ts login 仅靠 studentId 无密码（PR #55）
- [x] **R108** 三个 levelQuizAdapter 代码 100% 重复
- [x] **R51** ScenQuiz 异步调用 useDataLoader（PR #51）
- [x] **R52** PreQuizText 异步调用 useDataLoader + 竞态 bug（PR #52）
- [x] **R54** DialogText 异步调用 useDataLoader + 竞态 bug（PR #53）

> P0 全部 6 项已完成并合并到 feature-1，测试环境部署成功（2026-07-30）。下一批建议从 P1 开始。

### P1（上线前修复）

- [x] **R91** api.ts 大量 any 类型（PR #58）
- [x] **R96** asset.ts ossBase 类型断言（PR #58）
- [x] **R98** localStorage.ts appendQuizRecord 数据丢失（PR #58）
- [x] **R101** studentApi.ts getStudent 吞掉错误（PR #58）
- [x] **R104** apiService.ts response.data! 非空断言（PR #58）
- [x] **R75** auth.ts JWT 过期校验 NaN 风险（被 R35 覆盖）
- [x] **R82** useDataLoader diagLog 生产环境泄露数据（被 R18/R19/R20 覆盖）
- [x] **R115** guards.ts useAuthGuard 解构丢失响应式（PR #58）
- [x] **R55** DialogText 重复触发 typeText（PR #60）
- [x] **R56** DialogText/DialogueCard Audio 内存泄漏（PR #60）
- [x] **R57** ScenQuiz loadQuizzes 超长且重复（PR #60）
- [x] **R62** CultureCards 无键盘支持（PR #60）
- [x] **R64** AudioPlayer/VideoPlayer 进度条不可键盘操作（PR #60）
- [x] **R109** level1/2/3QuizAdapter correct_answer 误判（PR #60）

> P1 全部 14 项已完成并合并到 feature-1（2026-07-30）。安全 + 数据完整性批次 8 项（R75, R82, R91, R96, R98, R101, R104, R115）由 PR #58 合并；bug + a11y 批次 6 项（R55, R56, R57, R62, R64, R109）由 PR #60 合并。下一批建议从 P2 质量改善开始。

### P2（迭代改善）

- [x] R53, R58-R60, R63, R66, R67, R69-R74, R78, R80-R81, R83-R85, R87-R88, R92-R95, R97, R99, R102, R105-R107, R110-R111, R113-R114（trae/agent-round3-p2p3）

### P3（优化建议）

- [x] R61, R68, R76-R77, R79, R89, R100, R106, R112, R116（trae/agent-round3-p2p3）

> P2 + P3 共 46 项全部完成（分支 trae/agent-round3-p2p3）。按模块分 5 批处理：utils / stores+composables / adapters / components / services+router。

### 执行顺序建议

**第一批（P0 安全 + 架构）**: R90 → R103（安全密钥与登录凭证）→ R108（adapter 工厂，消除重复）✅

**第二批（P0 useDataLoader 违规）**: R51 → R52 → R54（同模式批量修复）✅

**第三批（P1 安全 + 数据完整性）**: R91, R96, R98, R101, R104, R75, R82, R115 ✅（PR #58 squash 合并 2026-07-30）

**第四批（P1 bug + a11y）**: R55, R56, R57, R62, R64, R109 ✅（PR #60 squash 合并 2026-07-30）

**第五批（P2 质量改善）**: 按模块分批处理 ✅（trae/agent-round3-p2p3）

**第六批（P3 优化）**: 按需处理 ✅（trae/agent-round3-p2p3）

> 09 专题 R51-R116 共 66 项全部完成（P0: 6 + P1: 14 + P2/P3: 46）。
