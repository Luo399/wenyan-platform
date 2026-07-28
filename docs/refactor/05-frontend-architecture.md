# 05 - 前端架构与类型（P1-P2）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## A01. useAnswerSubmitter 绕过 apiService 直接调用 post
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/composables/useAnswerSubmitter.ts`（第 410 行 `post('/api/submit', ...)`）
- **问题描述**: 项目规则明确"提交答案必须走 utils/api.ts 的 submitAnswers"，实际被 `useAnswerSubmitter` 直接调用 `post` 绕开。与 `apiService.submitAnswers` 两套提交逻辑并存，载荷字段不一致
- **修复方案**: `useAnswerSubmitter.submitAnswers` 改为调用 `apiService.submitAnswers`，统一 API 入口
- **验证方式**: `grep "post.*api/submit" src/composables/` 无命中
- **分支建议**: `refactor/architecture-01`
- **依赖**: 无

## A02. Level1/2/3 三套 quiz adapter 完全一致
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/adapters/level1QuizAdapter.ts`（1-71 行）
  - `src/adapters/level2QuizAdapter.ts`（1-71 行）
  - `src/adapters/level3QuizAdapter.ts`（1-71 行）
- **问题描述**: 三个文件结构、字段、过滤逻辑完全相同，仅 `module`（`'A'`/`'B'`/`'C'`）、`questionId` 前缀（`_A`/`_B`/`_C`）、`difficulty`（`'L1'`/`'L2'`/`'L3'`）不同
- **修复方案**: 抽出泛型工厂 `createLevelQuizAdapter(module, prefix, defaultDifficulty)`
- **验证方式**: 三个文件合并为一个；adapter 测试全部通过
- **分支建议**: `refactor/architecture-02`
- **依赖**: 无

## A03. buildContentHtmlWithAnnotations 三处重复实现
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/adapters/databaseAdapter.ts`（第 273-297 行）
  - `src/adapters/wordListAdapter.ts`（第 86-107 行）
  - `src/utils/adapterUtils.ts`（第 89-116 行）
- **问题描述**: 三个文件中函数体几乎完全一致（`replace` -> 循环词汇 -> 处理换行），`databaseAdapter.ts` 第 15 行已 import 但第 226 行又重新定义同名局部函数
- **修复方案**: 统一到 `adapterUtils.ts`，删除其余两处
- **验证方式**: `grep "buildContentHtml" src/adapters/` 只命中 import 语句
- **分支建议**: `refactor/architecture-03`
- **依赖**: 无

## A04. parseTimeRange / timeToSeconds 多处重复定义
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/utils/adapterUtils.ts`（第 56-67 行 `parseTimeRange`、第 31-48 行 `timeToSeconds`）
  - `src/adapters/multiPoleAdapter.ts`（第 126-144 行 `parseTimeRange`、第 151-163 行 `timeToSeconds`）
  - `src/adapters/databaseAdapter.ts`（第 226-235 行重复定义 `parseTimeRange`）
- **问题描述**: 时间解析函数重复定义 3 处，行为基本相同但返回类型不一致（元组 vs 对象）
- **修复方案**: 统一到 `utils/timeUtils.ts`，全部 import 引用
- **验证方式**: `grep "parseTimeRange\|timeToSeconds" src/` 只命中 `timeUtils.ts` 定义和 import
- **分支建议**: `refactor/architecture-04`
- **依赖**: 无

## A05. StudentInfo 接口三处定义字段不同
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/composables/useStudentInfo.ts`（第 4-9 行，字段 `id`/`name`）
  - `src/composables/useStudentQuery.ts`（第 4-7 行，字段 `studentId`/`username`）
  - `src/utils/studentApi.ts`（第 10-15 行，字段 `student_id`/`name`）
- **问题描述**: 三处定义同名接口但字段命名风格不同（驼峰/下划线/混合），应集中到 `types/` 目录
- **修复方案**:
  1. 创建 `src/types/student.ts`，定义统一的 `StudentInfo` 接口
  2. 所有文件 import 统一类型
  3. 在 API 层做字段映射
- **验证方式**: `grep "interface StudentInfo" src/` 只命中 `types/student.ts`
- **分支建议**: `refactor/architecture-05`
- **依赖**: 无

## A06. perfMonitor.ts 和 studentApi.ts 整个文件是死代码
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/utils/perfMonitor.ts`（全项目无 import）
  - `src/utils/studentApi.ts`（全项目无 import）
- **问题描述**: 两个文件的所有导出从未被任何地方 import，是完全的死代码
- **修复方案**: 确认无外部依赖后直接删除
- **验证方式**: `npm run build` 成功，无 missing module 报错
- **分支建议**: `refactor/architecture-06`
- **依赖**: 无

## A07. useDataLoader.load() 函数 120 行过长
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/composables/useDataLoader.ts`（第 176-296 行）
- **问题描述**: 单函数承担 URL 校验、缓存查询、AbortController、超时、fetch、解码、Worker 解析、缓存写入、重试、错误处理等多重职责
- **修复方案**: 拆分为 `validateUrl`、`checkCache`、`fetchWithTimeout`、`parseResponse`、`writeCache`、`handleRetry` 等子函数
- **验证方式**: 每个子函数 < 30 行；数据加载功能不变
- **分支建议**: `refactor/architecture-07`
- **依赖**: 无

## A08. useDataLoader 缓存与 Worker 资源管理缺陷
- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/composables/useDataLoader.ts`
- **问题描述**:
  1. 第 283-290 行重试 `setTimeout` 未在 `onUnmounted` 中 `clearTimeout`，组件卸载后触发"幽灵请求"
  2. 第 86-97 行模块级 `jsonParserWorker` 若 error 后未 terminate/重建，后续解析全失败
  3. 第 102 行 `parseJsonWithWorker` 失败时无 fallback 到主线程 `JSON.parse`
  4. 第 51-65 行 `getCachedData` 返回 `T | null`，无法区分"未命中"与"缓存了 falsy 值"
- **修复方案**:
  1. 存储 retryTimeoutId，在 onUnmounted 中 clearTimeout
  2. Worker error 后 terminate 并重建
  3. Worker 失败时 fallback 到 `JSON.parse`
  4. 缓存用 `Sentinel` 对象区分未命中
- **验证方式**: 组件卸载后无网络请求；Worker error 后后续解析正常
- **分支建议**: `refactor/architecture-08`
- **依赖**: A07

## A09. auth.ts 与 student.ts 状态源不唯一
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**:
  - `src/stores/auth.ts`（用 `token && user` 判定登录，第 44 行）
  - `src/stores/student.ts`（用 `studentId.length === 4` 判定登录，第 25 行）
- **问题描述**: 两个 store 都管理"学生登录态"，`authStore.user.studentId` 与 `studentStore.studentId` 并存，状态源不唯一
- **修复方案**:
  1. `student.ts` 仅作为 `authStore.user.studentId` 的薄封装
  2. 或合并为一个 store
  3. 统一登录判定逻辑
- **验证方式**: 登录/登出时两个 store 状态一致
- **分支建议**: `refactor/architecture-09`
- **依赖**: 无

## A10. api.ts 大量 any 类型滥用
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/utils/api.ts`（第 50, 54, 63, 114, 171, 185, 187, 193, 201 行）
- **问题描述**: 多处 `<T = any>` 默认泛型、`body?: any`、`normalizeResponse<T = any>(response: any)` 双重 any
- **修复方案**: 全部 `<T = any>` 改为 `<T = unknown>`，`body?: any` 改为 `BodyInit | Record<string, unknown> | unknown`
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/architecture-10`
- **依赖**: 无

## A11. composables 缺少 AbortController 与 onUnmounted 清理
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**:
  - `src/composables/useStudentQuery.ts`（无 onUnmounted，fetch 未取消）
  - `src/composables/useAnswerSubmitter.ts`（无 onUnmounted，post 未取消）
  - `src/composables/usePlaybackControl.ts`（无 onUnmounted，play Promise 未处理）
- **问题描述**: 组件卸载时异步请求仍在进行，回调更新已卸载组件的 ref
- **修复方案**: 每个 composable 添加 `AbortController` + `onUnmounted(() => controller.abort())`
- **验证方式**: 组件卸载后无 ref 更新警告
- **分支建议**: `refactor/architecture-11`
- **依赖**: 无

## A12. 硬编码 URL / 魔法数字散落各处
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: 多个文件
- **问题描述**:
  - URL 散落：`useAnswerSubmitter.ts`(410) `/api/submit`、`useStudentQuery.ts`(34) `/api/students/${id}`、`auth.ts`(80,137) `/api/auth/login`
  - 魔法数字：`useDataLoader.ts`(159) `10000`、`api.ts`(118) `30000`、`student.ts`(25) `4`、`bgm.ts`(12) `20`
  - 路径硬编码：`MultiRoleReading.vue`(158-160) `/audio/`、`/data/multi_role_reading/`
- **修复方案**:
  1. 创建 `src/constants/apiEndpoints.ts` 集中管理 URL
  2. 创建 `src/constants/config.ts` 集中管理超时、缓存 TTL、学号长度等
  3. 路径改用 `VITE_OSS_BASE_URL` 拼接
- **验证方式**: `grep "/api/" src/composables/ src/stores/` 无命中（全部走常量）
- **分支建议**: `refactor/architecture-12`
- **依赖**: A01
