# 08 - 前端第二轮审查（C01-C11 完成后）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## 背景

C01-C11 完成后对前端代码进行第二轮审查，发现以下新问题。问题按"严重程度 + 影响范围"分级：

| 级别 | 含义 |
|------|------|
| **P0** | 功能 bug / 数据损坏 / 安全漏洞，必须立即修复 |
| **P1** | 影响用户体验或可访问性，上线前修复 |
| **P2** | 代码质量 / 类型安全 / 性能，迭代中改善 |
| **P3** | 优化建议 / 风格统一 |

## C01-C11 落地确认

| 编号 | 状态 | 验证证据 |
|------|------|---------|
| C01 | ✅ | `src/views/RuleVideoView.vue` 存在；`src/views/RuleView*.vue` 已删除 |
| C02 | ✅ | `StudentTable.vue` / `AnswerTable.vue` / `StudentFormModal.vue` / `DeleteConfirmModal.vue` / `AnswerDetailModal.vue` 全部存在 |
| C03 | ✅ | `grep "console\.(log\|error\|warn)" src/` 仅命中 `mock/setup.ts`、`AudioSegmentPlayer.md`、`utils/debug.ts` 三个豁免文件 |
| C04 | ✅ | `MultiRoleReading.vue` 内无 `fetch(` 调用，仅注释提及 |
| C05 | ✅ | `utils/localStorage.ts` 存在；`AdaptQuiz.vue` / `Level1Quiz.vue` 通过 `appendQuizRecord` 封装 |
| C06 | ✅ | `grep "router\.push" src/` 仅命中 `useNavigation.ts` 与 `PoetryMenu.vue`（豁免） |
| C07 | ✅ | `QuizOptions.vue` / `QuizQuestion.vue` 存在；原 `Options.vue` / `Question.vue` 已删除 |
| C08 | ✅ | `QuizOptions.vue` / `VideoPlayer.vue` / `MultiRoleReadingItem.vue` / `QuizCard.vue` 均使用 `withDefaults` |
| C09 | ✅ | `StepOneView.vue` 无 `useStudentInfo` / `submitAnswers` / `ProcessedMultiRoleData` / `Level1QuizItem` / `isAudioLoaded` / `currentSegment` 残留 |
| C10 | ✅ | `wenUtils.ts` 包含 `getAllPoems` / `poemMap`；`PoetryMenu.vue` / `BlockDemoView.vue` 通过 `getAllPoems()` 读取 |
| C11 | ✅ | `Repeatbgm.vue` 已重命名为 `RepeatBgm.vue` |

---

## R01. AdaptQuiz 在异步函数内调用 useDataLoader（P0）

- **优先级**: P0
- **状态**: [x] 已完成
- **文件**: `src/components/AdaptQuiz.vue`（第 191 行）
- **问题描述**: `loadData()` 是 async 函数，内部调用 `useDataLoader<...>(() => url)`。这违反 Composition API 规则——composable 必须在 `setup` 顶层同步执行，否则 `onScopeDispose` / `onUnmounted` 注册失败，且响应式作用域丢失，可能导致：
  1. 组件卸载时 `abortController.abort()` 不触发，请求泄漏
  2. `watch(urlGetter, ...)` 在异步上下文中注册，可能错过首次 URL 变化
  3. Vue devtools 警告："onUnmounted is called when there is no active component instance"
- **根因**: C04 修复 `MultiRoleReading.vue` 时改用 `useDataLoader` 顶层调用，但 `AdaptQuiz.vue` 未同步改造，仍用手写 `Promise<void>` + `setTimeout` + `watch` 包装 useDataLoader，重复造轮子且违反规范
- **修复方案**:
  1. 将 `useDataLoader<...>(() => url, { autoLoad: false, ... })` 调用移到 `setup` 顶层
  2. 通过 `watch(() => [props.textId, props.level, props.questionNumber], loadData)` 监听 props 变化
  3. 删除手写的 `Promise<void>` + `setTimeout` + 双 `watch` 等待逻辑（useDataLoader 自带 timeout、retry、loading/error/data 响应式状态）
  4. `loadData` 改为调用 `loader.load()` 或 `loader.retry()`，根据返回的 `loading` / `error` / `data` 状态推进
  5. `adaptLevel*Quiz` 适配器调用改为 `computed` 监听 `loader.data`
- **验证方式**:
  1. `npm run dev` 控制台无 "onUnmounted is called when there is no active component instance" 警告
  2. `npm run test` 全部通过
  3. AdaptQuiz 页面在加载/错误/重试/切换 level 行为正常
- **分支建议**: `refactor/round2-01-adaptquiz-dataloader`
- **依赖**: C04（已完成）

## R02. StudentLogin 与 LoginModal 学号规则矛盾（P0）

- **优先级**: P0
- **状态**: [x] 已完成
- **文件**:
  - `src/components/StudentLogin.vue`（第 12, 18, 45 行：`maxlength="4"`、`/^\d{4}$/`）
  - `src/components/LoginModal.vue`（第 64-66 行：测试账号 `1 | 2 | 3 | 4 | 5`、格式说明"数字（如：1、2024001）"）
  - `src/stores/student.ts`（第 25, 59 行：`isLoggedIn = studentId.length === 4`、`/^\d{4}$/`）
- **问题描述**: 两个登录入口对学号格式要求不一致：
  - `StudentLogin`（HomeView 使用）：强制 4 位数字，maxlength=4
  - `LoginModal`（全局守卫触发）：允许任意长度数字，测试账号 1-5 显然不是 4 位
  - `studentStore.isLoggedIn` 用 `length === 4` 判断，与 LoginModal 矛盾
  - 通过 LoginModal 登录"1" → studentStore 设置成功但 `isLoggedIn === false` → 路由守卫仍判定未登录 → 死循环
- **根因**: 早期 HomeView 用 StudentLogin 强制 4 位，后增加 LoginModal 支持任意学号但未同步修改 studentStore 的判断逻辑
- **修复方案**:
  1. `studentStore.isLoggedIn` 改为 `studentId.value.length > 0`，移除 4 位硬编码
  2. `restoreFromStorage` 改为 `/^\d+$/`（至少 1 位数字），允许 1-2024001 等格式
  3. `StudentLogin.vue` 移除 `maxlength="4"`，正则改为 `/^\d+$/`
  4. `StudentLogin.vue` 文案"学号为4位数字"改为"请输入学号数字"
  5. 若需保留最小长度校验，统一为 `>= 1` 位数字
- **验证方式**:
  1. 通过 LoginModal 登录"1" → `studentStore.isLoggedIn === true`
  2. 通过 StudentLogin 登录"2024001" → 成功
  3. `npm run test` 通过（同步修正 student store 单测）
- **分支建议**: `bugfix/round2-02-studentid-format`
- **依赖**: 无

## R03. router.beforeEach 守卫逻辑缺陷（P0）

- **优先级**: P0
- **状态**: [x] 已完成
- **文件**: `src/router/guards.ts`（第 35-42 行）
- **问题描述**: 需要登录但未登录时，守卫仅设置 `to.meta.showLoginModal = true` 然后 `next()` 放行。这意味着：
  1. 用户可直接访问 `/stepone/1`、`/answer-query` 等鉴权页面（虽然 UI 弹登录窗，但页面内容已渲染）
  2. 鉴权页面内的 API 调用会因未登录失败，但不阻止渲染
  3. `next()` 后路由已变更，登录成功后无法回到原目标页（缺少 redirect 参数）
- **修复方案**:
  1. 未登录时 `next({ name: 'home', query: { redirect: to.fullPath } })`
  2. 登录成功后 `router.replace(route.query.redirect || '/')`
  3. 添加 `authStore.isTokenExpired()` 检查，token 过期时自动 logout 并触发登录流程
  4. 在 `route.d.ts` 中声明 `RouteMeta` 类型扩展（`requiresAuth`、`showLoginModal`、`public`）
- **验证方式**:
  1. 未登录访问 `/stepone/1` → 重定向到 `/` 且 URL 带 `?redirect=/stepone/1`
  2. 登录成功后自动跳回 `/stepone/1`
  3. token 过期后访问鉴权页 → 自动登出 + 重定向
- **分支建议**: `bugfix/round2-03-auth-guard`
- **依赖**: 02-routing-auth.md

## R04. AnswerQueryView 大量 any 类型（P1）

- **优先级**: P1
- **状态**: [x] 已完成
- **文件**: `src/views/AnswerQueryView.vue`（第 302, 320, 425, 509, 545, 551, 655-668 行）
- **问题描述**: 多处使用 `any` 类型：
  - `allData = ref<any[]>([])`（第 302 行）
  - `selectedAnswers = ref<any[]>([])`（第 320 行）
  - `students.forEach((student: any) => ...)`（第 425 行）
  - `filtered = allData.value.filter((student: any) => ...)`（第 509 行）
  - `viewWenStudentDetail(student: any)` / `viewStudentWenDetail(record: any)`（第 545, 551 行）
  - `exportData` 中 `forEach((row: any) => ...)`（第 655-668 行）
  - 这导致 TypeScript 类型检查失效，后续维护成本高
- **修复方案**:
  1. 定义 `WenIdAnswerRecord`、`StudentIdAnswerRecord` 接口（来自后端 `/api/answers/wen/:id` 和 `/api/answers/student/:id` 响应）
  2. `allData` 改为联合类型 `ref<Array<StudentInfo | WenIdAnswerRecord | StudentIdAnswerRecord>>([])`
  3. 各 `forEach` / `filter` 回调参数显式标注类型
  4. `exportData` 中根据 `activeTab` 分支明确类型
- **验证方式**:
  1. `npm run type-check` 通过
  2. `grep -n ": any" src/views/AnswerQueryView.vue` 无命中
- **分支建议**: `refactor/round2-04-answerquery-types`
- **依赖**: 无

## R05. AnswerQueryView handleSearch 破坏原始数据（P1）

- **优先级**: P1
- **状态**: [x] 已完成
- **文件**: `src/views/AnswerQueryView.vue`（第 500-520 行）
- **问题描述**: `handleSearch` 直接 `allData.value = filtered`，破坏原始数据。一旦搜索后清空关键词，会调用 `loadAllStudents()` 重新请求后端，而不是恢复本地过滤前的状态。这导致：
  1. 搜索后清空关键词 → 触发不必要的网络请求
  2. 网络失败时数据丢失（无法恢复）
  3. 分页 total 错误重置
- **修复方案**:
  1. 引入 `originalData = ref<...[]>([])` 保存后端返回的完整列表
  2. `fetchData` 同时写入 `originalData` 和 `allData`
  3. `handleSearch` 改为 `allData.value = originalData.value.filter(...)`，不修改 `originalData`
  4. 清空搜索关键词时直接 `allData.value = originalData.value`，无需网络请求
- **验证方式**:
  1. 搜索"张三" → 列表过滤；清空搜索框 → 列表恢复，无网络请求
  2. 搜索后切换 tab 再切回 → 数据完整
- **分支建议**: `bugfix/round2-05-search-data-preserve`
- **依赖**: R04

## R06. AnswerQueryView loadAllStudents 在 setup 末尾调用（P1）

- **优先级**: P1
- **状态**: [x] 已完成
- **文件**: `src/views/AnswerQueryView.vue`（第 679 行）
- **问题描述**: `loadAllStudents()` 直接写在 `<script setup>` 末尾，不在 `onMounted` 中。虽然 Vue 3 setup 同步执行时能工作，但：
  1. 违反"副作用在生命周期钩子中执行"的最佳实践
  2. SSR 场景下会在服务端执行网络请求（本项目暂不涉及但应预防）
  3. 若 setup 抛错，请求已发出无法取消
- **修复方案**:
  ```ts
  import { onMounted } from 'vue'
  onMounted(() => {
    loadAllStudents()
  })
  ```
- **验证方式**: 页面首次加载行为不变，单测通过
- **分支建议**: `refactor/round2-06-onmounted`
- **依赖**: 无

## R07. AnswerQueryView 大量 :deep() 样式穿透（P2）

- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `src/views/AnswerQueryView.vue`（第 903-1533 行，约 60 处 `:deep()`）
- **问题描述**: 主容器用 `<style scoped>` 但通过 `:deep(.form-group)` / `:deep(.modal-overlay)` / `:deep(.data-table)` 等大量穿透样式到子组件。这违反 scoped 样式隔离原则：
  1. 子组件样式被父组件隐性控制，子组件无法独立复用
  2. 60+ 处 `:deep()` 等同于全局样式，scoped 失去意义
  3. 子组件重命名 class 时父组件样式静默失效
- **修复方案**:
  1. 将共享样式（`.form-group` / `.form-input` / `.modal-overlay` / `.data-table` / `.action-btn` 等）提取到 `src/assets/styles/components.css` 全局样式表
  2. 子组件 `<style scoped>` 内只保留自身独有样式
  3. 主容器删除 `:deep()`，仅保留容器自身布局样式
  4. 设计 token 通过 CSS 变量继承，无需穿透
- **验证方式**:
  1. `grep -c ":deep" src/views/AnswerQueryView.vue` < 5（仅保留必要的特殊穿透）
  2. 视觉效果完全一致
  3. 子组件在别处复用时样式正常
- **分支建议**: `refactor/round2-07-shared-styles`
- **依赖**: 无

## R08. AnswerQueryView exportData CSV 注入风险（P1）

- **优先级**: P1
- **状态**: [x] 已完成
- **文件**: `src/views/AnswerQueryView.vue`（第 646-677 行）
- **问题描述**: `exportData` 直接拼接字段到 CSV，未 escape。若学生姓名/学号包含 `=`、`+`、`-`、`@` 等开头字符（如 `=CMD()`），Excel 打开时会执行公式，存在 CSV 公式注入风险。同时字段含逗号或换行符会破坏列结构。
- **修复方案**:
  ```ts
  function escapeCsvField(value: unknown): string {
    const str = String(value ?? '')
    // 含逗号、引号、换行符的字段用双引号包裹，内部双引号转义
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    // 防公式注入：=、+、-、@ 开头的字段前加单引号
    if (/^[=+\-@]/.test(str)) {
      return `'${str}`
    }
    return str
  }
  ```
  替换所有 `${row.field}` 为 `${escapeCsvField(row.field)}`
- **验证方式**:
  1. 输入学生姓名 `=CMD()` → CSV 中变为 `'=CMD()`，Excel 不执行公式
  2. 输入姓名含逗号 `张,三` → CSV 字段正确引号包裹
- **分支建议**: `security/round2-08-csv-injection`
- **依赖**: 无

## R09. AnswerQueryView toast setTimeout 未清理（P2）

- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `src/views/AnswerQueryView.vue`（第 343-350 行）
- **问题描述**: `showToast` 内 `setTimeout(() => { toast.show = false }, 3000)` 未保存 timer id，组件卸载时无法取消。若用户快速触发多次 toast，会叠加多个定时器；组件卸载后定时器仍执行，可能修改已销毁组件的状态（Vue 会警告）。
- **修复方案**:
  ```ts
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    if (toastTimer) clearTimeout(toastTimer)
    toast.message = message
    toast.type = type
    toast.show = true
    toastTimer = setTimeout(() => {
      toast.show = false
      toastTimer = null
    }, 3000)
  }
  onUnmounted(() => {
    if (toastTimer) clearTimeout(toastTimer)
  })
  ```
- **验证方式**: 快速点击多次"新增学生" → toast 不闪烁；卸载组件无 Vue 警告
- **分支建议**: `refactor/round2-09-toast-timer`
- **依赖**: 无

## R10. AnswerQueryView availableClasses 硬编码 [9]（P2）

- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `src/views/AnswerQueryView.vue`（第 328 行 `const availableClasses = ref<number[]>([9])`）
- **问题描述**: 班级列表硬编码为 `[9]`，新增班级需改代码。应从后端 `/api/students/classes` 或学生数据中动态提取。
- **修复方案**:
  1. `loadAllStudents` 返回数据后用 `Array.from(new Set(students.map(s => s.class))).sort()` 提取班级
  2. 或新增后端接口 `GET /api/students/classes` 返回班级列表
- **验证方式**: 添加 9 班和 10 班学生后，下拉框自动显示两个选项
- **分支建议**: `refactor/round2-10-dynamic-classes`
- **依赖**: 无

## R11. Level1Quiz onMounted 空函数（P2）

- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `src/components/Level1Quiz.vue`（第 371 行 `onMounted(() => {})`）
- **问题描述**: 空生命周期钩子是 dead code，可能是调试遗留。
- **修复方案**: 删除 `onMounted(() => {})` 及对应 import（若未在其他地方使用）
- **验证方式**: `grep "onMounted" src/components/Level1Quiz.vue` 无命中；测试通过
- **分支建议**: `refactor/round2-11-dead-onmounted`
- **依赖**: 无

## R12. Level1Quiz 难度标签硬编码颜色（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/components/Level1Quiz.vue`（第 417-430, 473-481, 506-514, 529-535 行）
- **问题描述**: `.difficulty-tag.L1` 用 `#dcfce7` / `#166534`，`.option-btn.correct` 用 `#f0fdf4` / `#22c55e`，`.correct-icon` 用 `#22c55e` 等硬编码颜色，未使用设计 token。这导致：
  1. 主题切换失效（如 dark mode）
  2. 与项目其他组件配色风格不统一
- **修复方案**:
  1. 在 `design-tokens.css` 新增 `--color-success` / `--color-success-bg` / `--color-success-light` 等语义色 token
  2. `.difficulty-tag.L1/L2/L3` / `.option-btn.correct` / `.correct-icon` 改用 token
  3. 同步 `AdaptQuiz.vue` / `ScenQuiz.vue` 等其他 quiz 组件的硬编码颜色
- **验证方式**: `grep "#[0-9a-fA-F]\{3,6\}" src/components/Level1Quiz.vue` 仅命中注释
- **分支建议**: `refactor/round2-12-semantic-colors`
- **依赖**: 无

## R13. Level1Quiz correct_answer 类型混乱（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/components/Level1Quiz.vue`（第 108, 192, 249 行）
- **问题描述**: interface 声明 `correct_answer: number`，但代码中：
  - 第 192 行 `parseInt(String(quiz.correct_answer), 10)` 兼容字符串
  - 第 249 行 `String(userAnswer) === String(correctAnswer)` 当字符串比较
  - 表明实际数据中 `correct_answer` 可能是 string 或 number，interface 类型与实际不符
- **修复方案**:
  1. interface 改为 `correct_answer: number | string`
  2. 提供 `normalizeCorrectAnswer(value): number` 工具函数统一转换
  3. `getCorrectIndex` 用 `normalizeCorrectAnswer` 替代 `parseInt(String(...))`
  4. `saveToLocal` 中 `String(userAnswer) === String(correctAnswer)` 改为 `Number(userAnswer) === Number(correctAnswer)`
- **验证方式**: `npm run type-check` 通过；后端返回 string/number 两种格式均能正确判定对错
- **分支建议**: `refactor/round2-13-correct-answer-type`
- **依赖**: 无

## R14. Level1Quiz 函数名与 import 别名冲突（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/Level1Quiz.vue`（第 93, 217 行）
- **问题描述**: 第 93 行 `import { submitAnswers as submitAnswersApi }`，第 217 行本地函数 `function submitAnswers()`。两者同名易混淆，阅读时需反复确认是本地函数还是 API。
- **修复方案**: 本地函数改名为 `handleSubmit` 或 `onSubmitClick`
- **验证方式**: 代码可读性提升，测试通过
- **分支建议**: `refactor/round2-14-rename-submit`
- **依赖**: 无

## R15. DetailView 大量硬编码颜色和间距（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/views/DetailView.vue`（第 107, 109-115, 119, 124, 129 行）
- **问题描述**: 使用 `#6b7280`、`#d1d5db`、`#fff` 等硬编码颜色，`3rem`、`1rem`、`1.25rem`、`1.5rem`、`2` 等硬编码间距，未使用 `var(--color-text-secondary)` / `var(--spacing-md)` 等设计 token。
- **修复方案**: 全部替换为设计 token：
  - `#6b7280` → `var(--color-text-secondary)`
  - `#d1d5db` → `var(--color-placeholder)`
  - `#fff` → `var(--color-white)`
  - `3rem` → `var(--spacing-2xl)`
  - `1rem` → `var(--spacing-md)`
  - `1.25rem` → `var(--spacing-lg)`
  - `1.5rem` → `var(--spacing-lg)`
  - `2` (line-height) → 保留或定义 `--line-height-loose`
- **验证方式**: `grep "#[0-9a-fA-F]\{3,6\}" src/views/DetailView.vue` 无命中（除注释）
- **分支建议**: `refactor/round2-15-detailview-tokens`
- **依赖**: 无

## R16. DetailView answers 预留字段未使用（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/DetailView.vue`（第 48, 57-59 行）
- **问题描述**: `const answers = ref<...>({})` 仅在 `handleAnswerChange` 中被赋值，从未被读取或提交到后端。这是 dead state。
- **修复方案**:
  - 选项 A：若未来要接入答题提交，添加 TODO 注释并保留
  - 选项 B（推荐）：删除 `answers` ref 和 `handleAnswerChange` 函数，模板移除 `@answer-change` 绑定
- **验证方式**: 页面功能不变
- **分支建议**: `refactor/round2-16-detailview-dead-state`
- **依赖**: 无

## R17. DetailView article.content.split 空字符串问题（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/DetailView.vue`（第 76 行）
- **问题描述**: `article.content.split('\n')` 当 content 为空字符串时返回 `['']`，渲染一个空段落 `<p></p>`。同时连续换行符会产生多个空段落。
- **修复方案**:
  ```ts
  const paragraphs = computed(() => {
    if (!article.value.content) return []
    return article.value.content.split('\n').filter(line => line.trim() !== '')
  })
  ```
  模板改为 `v-for="(para, idx) in paragraphs"`
- **验证方式**: 空内容时不渲染段落；连续换行只产生一个分隔
- **分支建议**: `bugfix/round2-17-empty-paragraphs`
- **依赖**: 无

## R18. useDataLoader LRU 实现性能问题（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/composables/useDataLoader.ts`（第 23, 40-46 行）
- **问题描述**: `cacheAccessOrder` 用 `Array` + `indexOf` + `splice` 实现 LRU，每次访问 O(n)。对 100 条缓存，每次读取最坏 100 次比较。
- **修复方案**: 用 `Map` 的插入顺序特性实现 O(1) LRU：
  ```ts
  const cacheMap = new Map<string, CacheEntry>()
  function getCachedData<T>(key: string, ttl: number): T | null {
    const entry = cacheMap.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > ttl) {
      cacheMap.delete(key)
      return null
    }
    // 删除并重新插入，使其成为最新访问
    cacheMap.delete(key)
    cacheMap.set(key, entry)
    return entry.data as T
  }
  function setCachedData<T>(key: string, data: T): void {
    if (cacheMap.size >= MAX_CACHE_SIZE) {
      // Map 的 keys().next().value 是最旧的（插入顺序）
      const oldestKey = cacheMap.keys().next().value
      if (oldestKey) cacheMap.delete(oldestKey)
    }
    cacheMap.set(key, { data, timestamp: Date.now() })
  }
  ```
  删除 `cacheAccessOrder` 数组
- **验证方式**: `npm run test` 通过；性能基准（100 条缓存 10000 次访问）耗时显著降低
- **分支建议**: `refactor/round2-18-lru-map`
- **依赖**: 无

## R19. useDataLoader AbortError 语义错误（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/composables/useDataLoader.ts`（第 274-281 行）
- **问题描述**: 所有 `AbortError` 一律视为超时 (`isTimeout.value = true`)，但实际上 `AbortController.abort()` 也会触发 AbortError，包括：
  1. 组件卸载时 `onUnmounted` 触发的 abort
  2. URL 变化时取消旧请求的 abort
  3. 用户主动取消
  这些情况不应显示"请求超时"
- **修复方案**:
  ```ts
  // 引入 abort reason 区分超时和主动取消
  const TIMEOUT_REASON = 'request-timeout'
  // 超时时
  timeoutId = setTimeout(() => {
    abortController?.abort(TIMEOUT_REASON)
  }, timeout)
  // catch 中
  if (err instanceof DOMException && err.name === 'AbortError') {
    if (abortController?.signal.reason === TIMEOUT_REASON) {
      isTimeout.value = true
      error.value = '请求超时'
    } else {
      // 主动取消，不设置 error
      debugLog('[useDataLoader] 请求被主动取消')
      loading.value = false
      return
    }
  }
  ```
- **验证方式**: 切换 wenId 时旧请求被取消但不显示"请求超时"提示
- **分支建议**: `bugfix/round2-19-abort-reason`
- **依赖**: 无

## R20. useDataLoader retryAttempts 成功后未重置（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/composables/useDataLoader.ts`（第 262-296 行）
- **问题描述**: `load` 成功路径（第 262 行 `debugLog('✅ 请求完成')`）没有 `retryAttempts = 0`，导致下次失败后重试次数从上次累积值开始。例如：
  1. 第一次请求失败 → retryAttempts=1 → 重试成功
  2. 第二次请求失败 → retryAttempts=2 → 已达上限不重试（应有一次重试机会）
- **修复方案**: 在第 265 行 `loading.value = false` 前添加 `retryAttempts = 0`
- **验证方式**: 单测覆盖"失败-重试成功-再失败-应重试"场景
- **分支建议**: `bugfix/round2-20-reset-retry`
- **依赖**: 无

## R21. useDataLoader 诊断日志 emoji 污染（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/composables/useDataLoader.ts`（第 178, 183, 194, 215, 219, 228, 236, 239, 246, 250, 263, 277, 280, 287 行）
- **问题描述**: 大量带 emoji 的诊断日志（🔍📦⏰🌐📡📊📝✅❌🔄），虽然通过 `debugLog` 在生产构建剥离，但：
  1. 开发环境控制台噪音过大
  2. emoji 在某些终端/日志收集系统显示乱码
  3. 与项目其他文件 `[ComponentName]` 前缀风格不一致
- **修复方案**:
  1. 删除 `diagLog` 函数和所有调用
  2. 保留关键路径的 `debugLog('[useDataLoader] xxx', ...)`，移除 emoji
  3. 详细诊断改为 `import.meta.env.DEV && console.debug(...)` 或通过 vite 配置控制
- **验证方式**: 控制台日志清爽，关键路径仍可观测
- **分支建议**: `refactor/round2-21-clean-logs`
- **依赖**: 无

## R22. WordList mousemove 缺少 throttle（P1）

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/components/WordList.vue`（第 124-151, 157 行）
- **问题描述**: `handleMouseMove` 在 `mousemove` 事件中执行 `classList.contains` + `getAttribute` + `window.innerWidth` 计算，未 throttle。鼠标快速移动时每秒触发数十次，低端设备可能卡顿。
- **修复方案**:
  ```ts
  import { throttle } from 'lodash-es' // 或手写 throttle
  const throttledMouseMove = throttle(handleMouseMove, 16) // ~60fps
  onMounted(() => {
    contentEl?.addEventListener('mousemove', throttledMouseMove)
  })
  onUnmounted(() => {
    throttledMouseMove.cancel()
    contentEl?.removeEventListener('mousemove', throttledMouseMove)
  })
  ```
- **验证方式**: 快速移动鼠标时 CPU 占用降低；tooltip 仍跟随（60fps 足够流畅）
- **分支建议**: `refactor/round2-22-mousemove-throttle`
- **依赖**: 无

## R23. WordList tooltip 硬编码尺寸（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/WordList.vue`（第 132-133 行 `tooltipWidth = 200`、`tooltipHeight = 60`）
- **问题描述**: 魔法数字，与实际 tooltip CSS 宽高耦合，修改 CSS 时需同步改 JS。
- **修复方案**:
  1. 用 `ref` 引用 tooltip 元素，`getBoundingClientRect()` 获取真实尺寸
  2. 或定义为常量 `const TOOLTIP_WIDTH = 200` 并加注释说明与 CSS 关系
- **验证方式**: tooltip 边界检测正常
- **分支建议**: `refactor/round2-23-tooltip-size`
- **依赖**: R22

## R24. RepeatBgm 多余 computed 包装（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/common/RepeatBgm.vue`（第 79-96 行）
- **问题描述**: 四个 computed（`currentBgmFile` / `isPlaying` / `currentVolume` / `isMuted`）都只是直接返回 store 状态，无任何转换。这是无意义的包装。
- **修复方案**:
  ```ts
  import { storeToRefs } from 'pinia'
  const { currentBgmFile, isPlaying, volume: currentVolume, isMuted } = storeToRefs(bgmStore)
  ```
  删除四个 computed
- **验证方式**: 功能不变，代码减少 ~20 行
- **分支建议**: `refactor/round2-24-repeatbgm-storeToRefs`
- **依赖**: 无

## R25. RepeatBgm handleAudioEnded 死代码（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/common/RepeatBgm.vue`（第 27, 181-184 行）
- **问题描述**: `<audio loop>` 元素永不触发 `ended` 事件，`@ended="handleAudioEnded"` 和 `handleAudioEnded` 函数是死代码。
- **修复方案**: 删除 `@ended` 绑定和 `handleAudioEnded` 函数
- **验证方式**: 功能不变
- **分支建议**: `refactor/round2-25-repeatbgm-dead-code`
- **依赖**: R24

## R26. RepeatBgm onMounted 空函数（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/common/RepeatBgm.vue`（第 207-209 行 `onMounted(() => { debugLog(...) })`）
- **问题描述**: 仅输出 debugLog，无实际副作用，是调试残留。
- **修复方案**: 删除 `onMounted` 钩子和对应 import（若 `onUnmounted` 仍使用则保留 import）
- **验证方式**: 功能不变
- **分支建议**: `refactor/round2-26-repeatbgm-dead-onmounted`
- **依赖**: R25

## R27. RepeatBgm 缺少 a11y（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/components/common/RepeatBgm.vue`（第 48-55 行 volume-slider）
- **问题描述**: `<input type="range">` 没有 `aria-label`，屏幕阅读器无法识别用途。播放/暂停按钮虽有 `title` 但缺少 `aria-label` 和 `aria-pressed`。
- **修复方案**:
  ```html
  <input type="range" aria-label="背景音乐音量" ... />
  <button :aria-label="isPlaying ? '暂停背景音乐' : '播放背景音乐'" :aria-pressed="isPlaying" ...>
  <button :aria-label="isMuted ? '取消静音' : '静音'" :aria-pressed="isMuted" ...>
  ```
- **验证方式**: 屏幕阅读器（NVDA/VoiceOver）能正确朗读控件用途
- **分支建议**: `a11y/round2-27-repeatbgm-aria`
- **依赖**: 无

## R28. LoginModal 大量硬编码字体大小（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/components/LoginModal.vue`（第 271, 283, 286, 290, 306, 312, 317, 323, 354, 359, 363, 399, 404, 410, 419, 423, 472, 477, 485 行）
- **问题描述**: 大量 `1.25rem`、`1rem`、`0.875rem`、`0.75rem`、`0.625rem` 等硬编码字号，未使用 `var(--font-size-*)` token。与项目其他组件风格不一致。
- **修复方案**:
  - `1.5rem` → `var(--font-size-subheading)`
  - `1.25rem` → `var(--font-size-body-lg)`
  - `1rem` → `var(--font-size-body)`
  - `0.875rem` → `var(--font-size-small)`
  - `0.75rem` → `var(--font-size-xs)`（若 token 不存在则新增）
  - `0.625rem` → `var(--font-size-caption)`（若 token 不存在则新增）
- **验证方式**: `grep "[0-9]rem" src/components/LoginModal.vue` 无命中
- **分支建议**: `refactor/round2-28-loginmodal-tokens`
- **依赖**: 无

## R29. LoginModal !important 滥用（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/LoginModal.vue`（第 477, 478, 483, 484, 485 行）
- **问题描述**: `.test-accounts` 和 `.format-hint` 用 `!important` 覆盖父级 `<p>` 样式，是样式优先级失控的表现。
- **修复方案**:
  1. 提高选择器特异性：`.test-account-hint .test-accounts` 替代 `.test-accounts !important`
  2. 或重构 HTML 结构，避免父子样式冲突
- **验证方式**: 视觉效果一致，`grep "!important" src/components/LoginModal.vue` 无命中
- **分支建议**: `refactor/round2-29-loginmodal-important`
- **依赖**: R28

## R30. LoginModal handleStudentIdInput 缺少防抖（P1）

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/components/LoginModal.vue`（第 140-149 行）
- **问题描述**: `@input` 事件每次按键都触发 `queryStudentName`（异步 API 调用）。输入"2024001"会触发 7 次后端请求，浪费带宽且可能产生竞态（后输入的请求先返回）。
- **修复方案**:
  ```ts
  import { debounce } from 'lodash-es' // 或手写 debounce
  const debouncedQuery = debounce(async (id: string) => {
    if (id.trim().length >= 1) {
      studentName.value = await queryStudentName(id)
    } else {
      studentName.value = ''
    }
  }, 300)
  async function handleStudentIdInput(): Promise<void> {
    clearValidation()
    debouncedQuery(studentId.value)
  }
  onUnmounted(() => debouncedQuery.cancel())
  ```
  同时处理竞态：用 `AbortController` 或请求序号比较丢弃过期响应
- **验证方式**: 快速输入"2024001"仅触发 1 次请求（停止输入 300ms 后）
- **分支建议**: `refactor/round2-30-loginmodal-debounce`
- **依赖**: 无

## R31. LoginModal 测试账号硬编码（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/LoginModal.vue`（第 63-67 行）
- **问题描述**: 测试账号 `1 | 2 | 3 | 4 | 5` 硬编码在组件内，生产环境也会显示。应通过环境变量控制：
- **修复方案**:
  ```ts
  const testAccounts = import.meta.env.VITE_TEST_ACCOUNTS?.split(',').map(s => s.trim()) ?? []
  const showTestHint = import.meta.env.DEV && testAccounts.length > 0
  ```
  模板 `v-if="showTestHint"`
- **验证方式**: 生产构建无测试账号提示；开发环境显示配置的账号
- **分支建议**: `refactor/round2-31-test-accounts-env`
- **依赖**: 无

## R32. LoginModal focus trap 缺失（P1）

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/components/LoginModal.vue`
- **问题描述**: modal 打开后 Tab 键可能跳出 modal 到背景元素，违反 WAI-ARIA modal 对话框规范。虽有 ESC 关闭，但 focus trap 是 modal 的核心 a11y 要求。
- **修复方案**:
  1. 引入 `@vueuse/core` 的 `useFocusTrap` 或手写 focus trap
  2. modal 打开时 focus 第一个可聚焦元素（学号 input）
  3. Tab 在 modal 内循环（最后一个 focusable → 第一个）
  4. Shift+Tab 反向循环
- **验证方式**: Tab 键不会跳出 modal；modal 关闭后 focus 回到触发按钮
- **分支建议**: `a11y/round2-32-loginmodal-focus-trap`
- **依赖**: 无

## R33. LoginModal watch 错误状态未重置（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/LoginModal.vue`（第 113-120 行）
- **问题描述**: `watch(authStore.error, ...)` 只设置 `hasError.value = true`，从不设置为 false。用户看到错误后再次输入时，`hasError` 仍为 true，UI 错误样式残留。虽然 `clearValidation` 在 input 时调用，但 watch 触发的 hasError 不会被 clearValidation 清除（因为 clearValidation 在 watch 触发前调用，watch 又会设回 true）。
- **修复方案**:
  ```ts
  watch(() => authStore.error, (newError) => {
    hasError.value = !!newError  // 有错误时 true，无错误时 false
  })
  ```
- **验证方式**: 登录失败后输入新学号 → 错误样式消失
- **分支建议**: `bugfix/round2-33-loginmodal-error-reset`
- **依赖**: 无

## R34. auth.ts 直接调用 localStorage（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/stores/auth.ts`（第 52, 53, 107, 108, 146, 180, 181, 208 行）
- **问题描述**: C05 创建了 `utils/localStorage.ts` 封装 quiz records，但 auth.ts 仍直接调用 `localStorage.getItem/setItem/removeItem` 8 处，违反"学生身份必须走 useStudentStore"精神。同样问题存在于 `student.ts`。
- **修复方案**:
  1. 在 `utils/localStorage.ts` 新增 `getAuthData()` / `setAuthData(token, user)` / `clearAuthData()` 封装
  2. `auth.ts` 改用封装函数
  3. 同步封装 `getStudentId()` / `setStudentId()` / `clearStudentId()` 用于 `student.ts`
- **验证方式**: `grep "localStorage\." src/stores/auth.ts src/stores/student.ts` 无命中
- **分支建议**: `refactor/round2-34-auth-storage-encapsulate`
- **依赖**: C05（已完成）

## R35. auth.ts isTokenExpired 手写 JWT 解码（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/stores/auth.ts`（第 159-172 行）
- **问题描述**: 手写 `atob` + `JSON.parse` 解码 JWT payload，无错误处理（payload 格式异常时 catch 返回 true，但 base64 解码可能抛错未捕获）。
- **修复方案**:
  - 选项 A：引入 `jwt-decode` 库（~2KB），`import { jwtDecode } from 'jwt-decode'`
  - 选项 B：保持手写但用 try/catch 包裹 `atob` + 检查 `payload.exp` 存在
- **验证方式**: 损坏 token 不抛错；过期 token 正确识别
- **分支建议**: `refactor/round2-35-jwt-decode`
- **依赖**: 无

## R36. auth.ts response.data! 非空断言（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/stores/auth.ts`（第 91, 145 行）
- **问题描述**: `response.data!` 使用非空断言，若后端返回 `success: true` 但 `data` 为 null，会触发运行时错误而非友好提示。
- **修复方案**:
  ```ts
  const result = response.data
  if (!result?.token) {
    throw new Error('登录响应缺少 token')
  }
  token.value = result.token
  ```
- **验证方式**: 后端返回异常响应时显示友好错误而非崩溃
- **分支建议**: `refactor/round2-36-auth-null-check`
- **依赖**: 无

## R37. router/index.ts /detail/:id 缺少 requiresAuth（P1）

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/router/index.ts`（第 68-72 行）
- **问题描述**: `/detail/:id` 路由未标记 `meta: { requiresAuth: true }`，但 DetailView 是学生答题页面，应登录后访问。
- **修复方案**:
  ```ts
  {
    path: '/detail/:id',
    name: 'detail',
    component: DetailView,
    meta: { requiresAuth: true },
  },
  ```
- **验证方式**: 未登录访问 `/detail/1` → 重定向到首页（依赖 R03 修复）
- **分支建议**: `bugfix/round2-37-detail-requires-auth`
- **依赖**: R03

## R38. router/guards useAuthGuard 解构丢失 this 上下文（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/router/guards.ts`（第 53-63 行）
- **问题描述**: `useAuthGuard` 返回 `{ login: authStore.login, logout: authStore.logout }`，直接解构 store 方法会丢失 `this` 上下文（虽然 pinia setup store 用 composition API 不依赖 this，但仍是反模式）。
- **修复方案**:
  ```ts
  export function useAuthGuard() {
    const authStore = useAuthStore()
    return {
      isLoggedIn: authStore.isLoggedIn,
      user: authStore.user,
      error: authStore.error,
      hasError: computed(() => authStore.error !== null),
      login: (id: string, name?: string) => authStore.login(id, name),
      logout: () => authStore.logout(),
    }
  }
  ```
- **验证方式**: 调用 `login` / `logout` 行为正常
- **分支建议**: `refactor/round2-38-auth-guard-context`
- **依赖**: 无

## R39. BaseLoader/BaseError/BaseEmpty 缺少 a11y（P1）

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**:
  - `src/components/common/BaseLoader.vue`
  - `src/components/common/BaseError.vue`
  - `src/components/common/BaseEmpty.vue`
- **问题描述**: 三个基础状态组件无 ARIA 属性：
  - `BaseLoader` 无 `role="status" aria-live="polite"`，屏幕阅读器不会播报加载状态
  - `BaseError` 无 `role="alert"`，错误不会即时通知
  - `BaseEmpty` 无 `role="status"`
- **修复方案**:
  ```html
  <!-- BaseLoader -->
  <div class="base-loader" role="status" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <span>{{ loadingText }}</span>
  </div>
  <!-- BaseError -->
  <div class="base-error" role="alert" aria-live="assertive">
  <!-- BaseEmpty -->
  <div class="base-empty" role="status" aria-live="polite">
  ```
  spinner 加 `aria-hidden="true"`（装饰性元素）
- **验证方式**: 屏幕阅读器在加载/错误/空状态时正确播报
- **分支建议**: `a11y/round2-39-base-components-aria`
- **依赖**: 无

## R40. BlockDemoView addQuizTitle 使用 any 类型（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/BlockDemoView.vue`（第 178 行 `function addQuizTitle(block: any, index: number)`）
- **问题描述**: 参数 `block` 为 `any`，丢失类型检查。应使用 `Block` 类型。
- **修复方案**:
  ```ts
  import type { Block } from '@/types/pageConfig'
  function addQuizTitle(block: Block, index: number): Block {
    // ...
  }
  ```
- **验证方式**: `npm run type-check` 通过
- **分支建议**: `refactor/round2-40-blockdemo-types`
- **依赖**: 无

## R41. PoetryMenu 缺少 a11y（P1）

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/components/PoetryMenu.vue`
- **问题描述**: 菜单完全无 a11y 支持：
  1. 仅 `@mouseenter` / `@mouseleave` 触发，键盘用户无法展开
  2. `<li @click>` 不是 button，键盘不可聚焦、不可触发
  3. 无 `aria-haspopup` / `aria-expanded` / `role="menu"` / `role="menuitem"`
  4. 无 ESC 关闭
- **修复方案**:
  ```html
  <button
    class="menu-trigger"
    aria-haspopup="menu"
    :aria-expanded="showDropdown"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click="toggleDropdown"
    @keydown.enter="toggleDropdown"
  >
    📖 诗题选集
  </button>
  <ul
    class="dropdown"
    v-show="showDropdown"
    role="menu"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @keydown.esc="showDropdown = false"
  >
    <li
      v-for="poem in poemList"
      :key="poem.wenId"
      role="menuitem"
      tabindex="0"
      @click="goToRules(poem.wenId)"
      @keydown.enter="goToRules(poem.wenId)"
    >
      {{ poem.title }}
    </li>
  </ul>
  ```
- **验证方式**: 仅用键盘能完成菜单展开、选择、关闭
- **分支建议**: `a11y/round2-41-poetrymenu-keyboard`
- **依赖**: 无

## R42. PoetryMenu hideTimer 类型不准确（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/PoetryMenu.vue`（第 30 行 `let hideTimer: number | null = null`）
- **问题描述**: 浏览器环境下 `setTimeout` 返回 `number`，但 TypeScript DOM lib 默认推断为 `number`。使用 `ReturnType<typeof setTimeout>` 更稳健，跨环境兼容。
- **修复方案**:
  ```ts
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  ```
- **验证方式**: type-check 通过
- **分支建议**: `refactor/round2-42-timer-type`
- **依赖**: 无

## R43. PoetryMenu width 硬编码 16.666%（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/components/PoetryMenu.vue`（第 75 行 `width: 16.666%`）、`src/views/HomeView.vue`（第 42 行 `margin-left: 16.666%`）
- **问题描述**: 菜单宽度与主内容 margin-left 都硬编码 16.666%（六分之一），修改时需同步两处。
- **修复方案**:
  1. 在 `design-tokens.css` 定义 `--sidebar-width: 16.666%`（或 `--sidebar-width: 200px` 固定宽度更合理）
  2. 两处改用 `var(--sidebar-width)`
- **验证方式**: 修改 token 后两处同步变化
- **分支建议**: `refactor/round2-43-sidebar-token`
- **依赖**: 无

## R44. StudentFormModal 缺少 a11y（P1）

- **优先级**: P1
- **状态**: [ ] 未开始
- **文件**: `src/components/StudentFormModal.vue`
- **问题描述**: modal 无 `role="dialog"` / `aria-modal="true"` / `aria-labelledby`，关闭按钮 × 无 `aria-label`，错误提示无 `aria-describedby` 关联到 input。
- **修复方案**:
  ```html
  <div
    class="modal-overlay"
    @click.self="$emit('close')"
  >
    <div
      class="modal-content student-form-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div class="modal-header">
        <h3 id="modal-title">{{ isEditMode ? '编辑学生信息' : '新增学生' }}</h3>
        <button class="close-btn" @click="$emit('close')" aria-label="关闭">×</button>
      </div>
      <!-- input 关联错误提示 -->
      <input
        id="studentIdInput"
        :aria-describedby="errors.studentId ? 'studentId-error' : undefined"
        :aria-invalid="!!errors.studentId"
        ...
      />
      <span v-if="errors.studentId" id="studentId-error" class="error-text">{{ errors.studentId }}</span>
    </div>
  </div>
  ```
- **验证方式**: 屏幕阅读器正确朗读 modal 标题、错误信息
- **分支建议**: `a11y/round2-44-studentformmodal-aria`
- **依赖**: R32（focus trap 应统一实现）

## R45. AnswerQueryView 学生详情 modal 同样缺 a11y（P2）

- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `src/views/AnswerQueryView.vue`（第 221-246 行学生详情 modal）
- **问题描述**: 与 R44 相同，学生详情 modal 缺少 `role="dialog"` / `aria-modal` / `aria-labelledby`，关闭按钮 × 无 `aria-label`。
- **修复方案**: 同 R44，加 ARIA 属性
- **验证方式**: 同 R44
- **分支建议**: `a11y/round2-45-answerquery-modal-aria`
- **依赖**: R44

## R46. AnswerQueryView modal-overlay 重复样式（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/AnswerQueryView.vue`（第 221, 1262-1274 行）
- **问题描述**: 主容器内有一份 `.modal-overlay` 样式（第 221 行学生详情 modal），同时 `:deep(.modal-overlay)` 穿透样式（第 1262 行）覆盖子组件的 modal。两份样式定义易冲突。
- **修复方案**: 与 R07 一并处理，提取共享 modal 样式到全局 CSS
- **验证方式**: 视觉一致
- **分支建议**: `refactor/round2-46-modal-style-dedup`
- **依赖**: R07

## R47. AnswerQueryView 分页硬编码 pageSize=10（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/AnswerQueryView.vue`（第 457, 459 行）
- **问题描述**: `pageSize: 10` 硬编码，无法调整。每页条数应可配置或从用户偏好读取。
- **修复方案**:
  ```ts
  const PAGE_SIZE = 10 // 顶部常量
  // 或
  const pageSize = ref(10) // 允许用户切换
  ```
- **验证方式**: 修改常量后分页行为同步
- **分支建议**: `refactor/round2-47-pagesize-constant`
- **依赖**: 无

## R48. BlockDemoView 大量硬编码尺寸（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/BlockDemoView.vue`（第 273, 285, 293, 308, 355, 394, 400, 402, 433, 434, 440 行）
- **问题描述**: `300px`、`2rem`、`1.5rem`、`0.75rem`、`0.25rem`、`64px` 等硬编码尺寸，未用设计 token。
- **修复方案**: 替换为 `var(--spacing-*)` token
- **验证方式**: `grep "[0-9]px\|[0-9]rem" src/views/BlockDemoView.vue` 无命中（除注释）
- **分支建议**: `refactor/round2-48-blockdemo-tokens`
- **依赖**: 无

## R49. StepTwoView 直接调用 useRouter（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/StepTwoView.vue`（第 78 行 `import { useRouter } from 'vue-router'`）
- **问题描述**: 项目规则要求"useNavigation 是唯一跳转入口"，但 StepTwoView 直接 `useRouter()`。需确认是否违反规则（若用于 `router.replace` 等非跳转场景可豁免，但应注释说明）。
- **修复方案**: 检查使用场景，若为跳转则改用 `useNavigation`，若为 `router.replace` / `router.go` 等保留并加注释
- **验证方式**: `grep "useRouter" src/views/` 仅在必要场景命中
- **分支建议**: `refactor/round2-49-steptwo-router`
- **依赖**: 无

## R50. AnswerQueryView import 来源不一致（P3）

- **优先级**: P3
- **状态**: [ ] 未开始
- **文件**: `src/views/AnswerQueryView.vue`（第 281 行 `import { createStudent, updateStudent, deleteStudent, type StudentInfo } from '@/utils/studentApi'`）
- **问题描述**: 学生 CRUD API 从 `@/utils/studentApi` 导入，但项目其他地方从 `@/services/studentService` 导入（如早期 AnswerQueryView 拆分前的代码）。两个文件可能存在重复定义。
- **修复方案**:
  1. 核查 `utils/studentApi.ts` 与 `services/studentService.ts` 是否重复
  2. 统一到 `services/studentService.ts`（services 层负责业务 API）
  3. 删除冗余文件
- **验证方式**: `grep "from.*studentApi\|from.*studentService" src/` 统一从 services 导入
- **分支建议**: `refactor/round2-50-student-api-consolidate`
- **依赖**: 无

---

## 优先级汇总与执行建议

### P0（必须立即修复，阻断功能）
- R01 AdaptQuiz 异步调用 useDataLoader
- R02 StudentLogin 与 LoginModal 学号规则矛盾
- R03 router.beforeEach 守卫逻辑缺陷

### P1（上线前修复）
- R04 AnswerQueryView any 类型
- R05 AnswerQueryView handleSearch 破坏数据
- R06 AnswerQueryView loadAllStudents 应在 onMounted
- R08 AnswerQueryView CSV 注入风险
- R22 WordList mousemove throttle
- R30 LoginModal 输入防抖
- R32 LoginModal focus trap
- R37 /detail/:id 缺 requiresAuth
- R39 Base 组件 a11y
- R41 PoetryMenu a11y
- R44 StudentFormModal a11y

### P2（迭代改善）
- R07 AnswerQueryView :deep 滥用
- R09 AnswerQueryView toast timer
- R10 AnswerQueryView 班级硬编码
- R11 Level1Quiz 空 onMounted
- R12 Level1Quiz 硬编码颜色
- R13 Level1Quiz correct_answer 类型
- R15 DetailView 硬编码 token
- R18 useDataLoader LRU 性能
- R19 useDataLoader AbortError 语义
- R27 RepeatBgm a11y
- R28 LoginModal 硬编码字号
- R34 auth.ts localStorage 封装
- R45 AnswerQueryView modal a11y

### P3（优化建议）
- R14, R16, R17, R20, R21, R23, R24, R25, R26, R29, R31, R33, R35, R36, R38, R40, R42, R43, R46, R47, R48, R49, R50

### 执行顺序建议

**第一批（P0 修复，阻断）**: R02 → R03 → R01（R02 修复学号规则后 R03 守卫才能正确工作）

**第二批（P1 安全 + a11y）**: R08, R22, R30, R32 → R39, R41, R44（a11y 集中处理）→ R04, R05, R06, R37

**第三批（P2 质量改善）**: R07, R09-R13, R15, R18, R19, R27, R28, R34, R45

**第四批（P3 优化）**: 按需处理
