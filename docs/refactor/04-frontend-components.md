# 04 - 前端组件质量（P1）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## C01. RuleView/RuleView1/2/3 四文件 99% 重复

- **优先级**: P1
- **状态**: [x] 已完成
- **文件**:
  - `src/views/RuleView.vue`（1-80 行）
  - `src/views/RuleView1.vue`（1-80 行）
  - `src/views/RuleView2.vue`（1-80 行）
  - `src/views/RuleView3.vue`（1-80 行）
- **问题描述**: 四个文件仅三处差异：标题文字、视频后缀（`_rule_bg.mp4` / `_rule_1.mp4` 等）、导航 key（`rules` / `rule1` 等）。模板、样式、script 主体完全一致
- **修复方案**: 合并为单一 `RuleVideoView.vue`，通过 `videoKey` props（`'bg' | '1' | '2' | '3'`）+ `navKey` props 参数化差异点。路由配置中 4 条路由指向同一组件传不同 props
- **验证方式**: 4 个规则页面功能正常，代码量从 320 行降到约 90 行
- **分支建议**: `refactor/component-01`
- **依赖**: 无
- **实际变更**:
  - 新增 `src/views/RuleVideoView.vue`（97 行）
  - 删除 `src/views/RuleView.vue` / `RuleView1.vue` / `RuleView2.vue` / `RuleView3.vue`
  - 更新 `src/router/index.ts`：4 条路由指向 RuleVideoView，传不同 props
  - 删除 `tests/views/RuleView.spec.ts` / `tests/views/RuleViews.spec.ts`
  - 新增 `tests/views/RuleVideoView.spec.ts`：覆盖 4 种 props 配置的渲染、结构、子组件测试

## C02. AnswerQueryView.vue 1810 行需拆分为子组件

- **优先级**: P1
- **状态**: [x] 已完成（refactor/component-02）
- **文件**: `src/views/AnswerQueryView.vue`（重构前 1584 行，含模板+script+style）
- **问题描述**: 模板 + script + style 全部塞在单文件，含 4 种弹窗、3 种表格、CRUD 逻辑、分页、导出。严重违反"代码超过 20 行需拆分"规则
- **修复方案**: 已拆分为：
  - `AnswerQueryView.vue`（主容器 + 状态管理 + 页面级样式）
  - `StudentTable.vue`（学生列表表格，约 45 行）
  - `AnswerTable.vue`（答题记录表格，wenId / studentId 双模式，约 65 行）
  - `StudentFormModal.vue`（学生编辑弹窗，含表单校验，约 140 行）
  - `DeleteConfirmModal.vue`（删除确认弹窗，约 55 行）
  - `AnswerDetailModal.vue`（答题详情弹窗，约 75 行）
  - `utils/format.ts`（共享 `formatDate` / `formatAnswer` 工具）
- **样式策略**: 主容器 `<style scoped>` 保留，子组件相关选择器用 `:deep()` 穿透，避免样式重复与全局污染
- **验证方式**: 答题查询页面所有功能不变；每个子文件 < 300 行；type-check 通过；单元测试已同步更新
- **分支建议**: `refactor/component-02`
- **依赖**: 无

## C03. 生产代码残留 59 处 console.log

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**（按数量排序）:
  - `src/components/MultiRoleReading.vue`（10 处：264, 276, 295, 298, 316, 339, 396, 442, 462, 525）
  - `src/views/StepThreeView.vue`（8 处：182, 202, 231, 245, 260, 264, 269, 275）
  - `src/components/Level1Quiz.vue`（9 处：280, 302, 304, 314, 319, 345, 361, 363, 364）
  - `src/components/AdaptQuiz.vue`（8 处：260, 333, 350, 360, 374, 393, 395, 396）
  - `src/views/StepTwoView.vue`（6 处：120, 137, 201, 208, 225, 230）
  - `src/views/BlockDemoView.vue`（3 处：149, 163, 195）
  - `src/components/ScenQuiz.vue`（4 处：156, 308, 312, 335）
  - `src/views/StepOneView.vue`（2 处：88, 93）
  - `src/components/DialogText.vue`（2 处：209, 263）
  - 其余 7 个文件各 1 处
- **问题描述**: 违反项目规则"禁止生产构建保留 console.log"。`console.error`/`console.warn` 在合理错误路径下可保留少量，`console.log` 必须清理
- **修复方案**:
  1. 所有 `console.log` 替换为 `debugLog`（生产构建自动剥离）
  2. 必要的 `console.error` 改用 `debugError`
  3. 纯调试日志直接删除
- **验证方式**: `grep -r "console\.log" src/` 无命中；生产构建 bundle 中无 log 输出
- **分支建议**: `refactor/component-03`
- **依赖**: 无

## C04. MultiRoleReading.vue 直接 fetch 违反分层规则

- **优先级**: P1
- **状态**: [x] 已完成（refactor/component-04）
- **文件**: `src/components/MultiRoleReading.vue`（重构前第 294-307 行）
- **问题描述**: 直接 `fetch(url, { signal: abortController.value.signal })` 拉取 `/data/multi_role_reading/{wenId}.json`，违反"组件不得直接 fetch('/data/...')"规则。其他 quiz 组件已正确使用 `useDataLoader`
- **修复方案**: 改用 `useDataLoader` 加载数据
- **验证方式**: 组件内无 `fetch` 调用；数据加载功能正常
- **分支建议**: `refactor/component-04`
- **依赖**: 无
- **实际变更**:
  - `src/components/MultiRoleReading.vue`：
    - 移除：`abortController`、`dataCache`、手动 `fetch`、手动 `setTimeout` 超时、手动缓存检查逻辑
    - 替换为：`useDataLoader<MultiRoleData>(() => dataUrl.value, {...})`，复用模块级 LRU 缓存、指数退避重试、Worker JSON 解析
    - 模板：用 `BaseLoader`/`BaseError`/`BaseEmpty`/`BaseTimeout` 替换内联 `.loading-state`/`.error-state` div
    - 保留：所有 emits、`defineExpose` 方法签名、音频播放逻辑、`validateMultiRoleData` 校验、`parseTime`/`formatTime`/`parseTimeRange` 工具
    - 新增：`formatErrorMessage` 将 useDataLoader 内部错误（"HTTP 404"/"请提供有效的URL"）映射为面向用户的中文提示，保留原 404 友好提示语义
    - `loadData` 委托给 `useDataLoader.retry()`（重置重试计数器 + 重新加载）
    - `watch(loading, { immediate: true })` 统一发射 `load-start` 事件（覆盖 autoLoad / 手动 load / wenId 变化三种场景）
  - `tests/components/MultiRoleReading.spec.ts`：
    - 新增 `vi.mock('@/composables/useDataLoader')`（参考 Level1Quiz.spec.ts 模式，避免 jsdom 环境 Worker 实例化问题）
    - 保留 `readingAdapter` 适配器测试（纯函数测试，不依赖 useDataLoader）
    - 新增测试：props 透传（autoLoad/timeout/cacheEnabled）、四种状态渲染（BaseLoader/BaseTimeout/BaseEmpty/BaseError）、事件发射（load-start/load-success/load-error）、404 错误格式化、空 URL 错误格式化、transform 校验、loadData 委托 retry、分层规则验证（组件不直接 fetch）

## C05. AdaptQuiz/Level1Quiz 直接读写 localStorage

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/components/AdaptQuiz.vue`（第 329, 331 行）
  - `src/components/Level1Quiz.vue`（第 276, 278 行）
- **问题描述**: 直接 `localStorage.getItem`/`setItem` 保存答题记录，违反"学生身份必须走 useStudentStore"精神，答题记录缓存也应封装到 utils 层
- **修复方案**: 抽离 `utils/localStorage.ts`，提供类型安全的 `getQuizRecords`/`setQuizRecords` 封装
- **验证方式**: 组件内无直接 `localStorage` 调用
- **分支建议**: `refactor/component-05`
- **依赖**: 无

## C06. BlockDemoView 直接 router.push 违反导航规则

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/views/BlockDemoView.vue`（第 168 行 `router.push('/')`）
  - `src/views/NotFoundView.vue`（第 24 行 `router.push('/')`）
- **问题描述**: 违反"useNavigation 是唯一跳转入口"规则（PoetryMenu 除外）
- **修复方案**: 改用 `useNavigation().goHome()` 或对应导航方法
- **验证方式**: 组件内无 `router.push` 调用（PoetryMenu 除外）
- **分支建议**: `refactor/component-06`
- **依赖**: 02-routing-auth.md R01

## C07. Options.vue / Question.vue 单词组件名

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**:
  - `src/components/Options.vue`（第 1 行 eslint-disable 绕过）
  - `src/components/Question.vue`（第 1 行 eslint-disable 绕过）
- **问题描述**: 项目规则要求组件名 >= 2 个单词，这两个用 eslint-disable 绕过属历史债务
- **修复方案**:
  1. 重命名 `Options.vue` -> `QuizOptions.vue`
  2. 重命名 `Question.vue` -> `QuizQuestion.vue`
  3. 全局更新所有 import 引用
  4. 移除 eslint-disable 注释
- **验证方式**: 无 eslint-disable；所有引用更新
- **分支建议**: `refactor/component-07`
- **依赖**: 无

## C08. 7 个组件缺少 withDefaults

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**:
  - `src/components/Options.vue`（第 35-40 行）
  - `src/components/Question.vue`（第 64-67 行）
  - `src/components/AudioPlayer.vue`（第 74 行）
  - `src/components/VideoPlayer.vue`（第 76 行）
  - `src/components/LoginModal.vue`（第 84 行）
  - `src/components/MultiRoleReadingItem.vue`（第 44 行）
  - `src/components/QuizCard.vue`（第 103 行）
- **问题描述**: `defineProps<{...}>()` 未使用 `withDefaults`，可选 props 无默认值
- **修复方案**: 改为 `withDefaults(defineProps<Props>(), { ... })`
- **验证方式**: TypeScript 类型检查通过
- **分支建议**: `refactor/component-08`
- **依赖**: 无

## C09. StepOneView 大量未使用导入与 dead code

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/views/StepOneView.vue`（第 46-63, 81-82 行）
- **问题描述**:
  1. 第 46-48 行 3 个 import 未使用（`useStudentInfo`、`submitAnswers`、`ProcessedMultiRoleData`）
  2. 第 51-63 行 `interface Level1QuizItem` 定义但未使用
  3. 第 81-82 行 `isAudioLoaded`、`currentSegment` 两个 ref 仅赋值从未读取（dead state）
- **修复方案**: 删除未使用的 import、interface 和 dead state
- **验证方式**: `npm run type-check` 无未使用警告
- **分支建议**: `refactor/component-09`
- **依赖**: 无

## C10. PoetryMenu / BlockDemoView 诗文列表硬编码

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**:
  - `src/components/PoetryMenu.vue`（第 39-44 行 `poemList` 硬编码 4 篇）
  - `src/views/BlockDemoView.vue`（第 18-21 行 `<option>` 硬编码）
- **问题描述**: 与 `wenUtils.ts` 的 `poemMap` 重复维护，篇目扩展时需同步多处，违反 DRY
- **修复方案**: 统一从 `wenUtils.poemMap` 读取
- **验证方式**: 新增课文只需修改 `wenUtils.ts` 一处
- **分支建议**: `refactor/component-10`
- **依赖**: 无
