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
- **状态**: [x] 已完成（refactor/component-05）
- **文件**:
  - `src/components/AdaptQuiz.vue`（原第 329, 331 行）
  - `src/components/Level1Quiz.vue`（原第 276, 278 行）
- **问题描述**: 直接 `localStorage.getItem`/`setItem` 保存答题记录，违反"学生身份必须走 useStudentStore"精神，答题记录缓存也应封装到 utils 层
- **修复方案**: 抽离 `utils/localStorage.ts`，提供类型安全的 `getQuizRecords`/`setQuizRecords` 封装
- **验证方式**: 组件内无直接 `localStorage` 调用
- **分支建议**: `refactor/component-05`
- **依赖**: 无
- **实际变更**:
  - 新增 `src/utils/localStorage.ts`：泛型封装 `getQuizRecords<T>` / `setQuizRecords<T>` / `appendQuizRecord<T>` / `clearQuizRecords`，统一 key 命名 `quiz_records_<studentId>`，JSON.parse 失败时容错返回 `[]`，解析结果非数组时降级为 `[]`
  - 修改 `src/components/AdaptQuiz.vue`：`saveToLocal` 中手写读改写替换为 `appendQuizRecord(studentId, record)`，并保留原 `debugLog` 输出语义
  - 修改 `src/components/Level1Quiz.vue`：`saveToLocal` 中手写读改写替换为 `appendQuizRecord(studentId, report)`，并保留原 `debugLog` 输出语义
  - 新增 `tests/utils/localStorage.spec.ts`：覆盖空读取、JSON 解析失败容错、非数组降级、追加单条、覆盖式写入、连续追加顺序、不同 studentId 隔离、key 命名规范等 21 个测试用例
  - 分层规则验证：`src/components/AdaptQuiz.vue` 和 `src/components/Level1Quiz.vue` 内除 import 与注释外不再出现 `localStorage` 直接调用

## C06. BlockDemoView 直接 router.push 违反导航规则

- **优先级**: P1
- **状态**: [ ] 未开始（设计方案已就绪）
- **文件**:
  - `src/views/BlockDemoView.vue`（第 168 行 `router.push('/')`）
  - `src/views/NotFoundView.vue`（第 24 行 `router.push('/')`）
  - `src/composables/useNavigation.ts`（第 71 行 `goPrev` 内部也直接 `router.push('/')`，同源问题）
- **问题描述**: 违反"useNavigation 是唯一跳转入口"规则（PoetryMenu 除外）。三个独立位置直接调用 `router.push('/')`：
  1. `BlockDemoView.goBack()` — 测试页返回首页
  2. `NotFoundView.goBack()` — 404 页返回首页
  3. `useNavigation.goPrev()` — 已是第一页时回退到首页
     后者尤其隐蔽：导航 composable 自身绕过 `pageSequence` 配置硬编码路径，未来若首页路径变化（如加 prefix）会三处同时失效。
- **修复方案**:

  #### 设计决策

  现有 `useNavigation(currentRouteName, currentId?)` 强制要求 `currentRouteName` 必须是 `pageSequence` 中已注册的 `RouteName`。但 `BlockDemoView`（路由名 `block-demo`）和 `NotFoundView`（路由名 `not-found`）属于"非顺序页面"，不应进入 `pageSequence`，因此无法直接复用现有签名。

  采用方案：**将 `currentRouteName` 改为可选参数 + 新增 `goHome()` 方法**
  - 优点：单一 composable，API 表面不膨胀；`goHome()` 内部走 `pageSequence` 配置（单一事实源），不硬编码 `'/'`
  - `goNext`/`goPrev`/`goTo`/`currentIndex`/`hasNext`/`hasPrev` 在 `currentRouteName` 为空时返回早退 + `debugWarn`，不会对非顺序页面产生副作用
  - `goPrev` 内部不再 `router.push('/')`，改为调用 `goHome()`，消除 composable 自身的违规

  #### 实施步骤
  1. **修改 `src/composables/useNavigation.ts`**
     - 签名改为 `useNavigation(currentRouteName?: RouteName, currentId?: string)`
     - 新增 `goHome()` 方法：从 `pageSequence` 查找 `name === 'home'` 的配置，调用 `router.push(homePage.getPath())`；找不到时 `debugError` 兜底
     - `getTargetId` 内部把 `currentRouteName || 'home'` 作为 transformId 的入参，避免 undefined 透传
     - `goNext`/`goPrev` 在 `currentRouteName` 为空时 `debugWarn` 后 return
     - `goPrev` 中"没有上一页"分支改为调用 `goHome()`（替代 `router.push('/')`）
     - `currentIndex`/`hasNext`/`hasPrev` 计算属性在 `currentRouteName` 为空时返回 `-1`/`false`/`false`
     - 返回对象新增 `goHome`
  2. **修改 `src/views/BlockDemoView.vue`**
     - 移除 `import { useRouter } from 'vue-router'` 与 `const router = useRouter()`
     - 新增 `import { useNavigation } from '@/composables/useNavigation'`
     - `const { goHome } = useNavigation()`
     - `goBack()` 函数体改为 `goHome()`
  3. **修改 `src/views/NotFoundView.vue`**
     - 同上：移除 `useRouter`，引入 `useNavigation`，`goBack()` 改为调用 `goHome()`

  #### 兼容性评估
  - 现有调用方（如 `RuleVideoView`、`StepOneView` 等）传入了 `currentRouteName`，行为完全不变
  - `goPrev` 的"无上一页回首页"行为保留，只是路径来源从硬编码改为配置驱动
  - `useNavigation` 的 TypeScript 类型签名向后兼容（可选参数不破坏已有调用）

- **验证方式**:
  1. `grep -r "router\.push" src/views/ src/components/ src/composables/` 仅在 `useNavigation.ts` 与 `PoetryMenu.vue`（豁免）中命中
  2. `npm run type-check` 通过
  3. `npm run lint` 通过
  4. 单元测试覆盖：
     - `tests/composables/useNavigation.spec.ts` 新增：`goHome` 调用 `router.push('/')`、`goHome` 不依赖 `currentRouteName`、`goPrev` 在第一页时调用 `goHome`、`goNext`/`goPrev` 在无 `currentRouteName` 时仅 warn 不跳转
     - 新增 `tests/views/BlockDemoView.spec.ts`：`goBack` 触发后 `router.push` 被调用一次且参数为 `'/'`（通过 mock useNavigation 验证）
     - 新增 `tests/views/NotFoundView.spec.ts`：同上
  5. 手动验证：访问 `/block-demo` 点击"返回首页"跳转到 `/`；访问 `/not-exist` 点击"返回首页"跳转到 `/`
- **分支建议**: `refactor/component-06`
- **依赖**: 02-routing-auth.md R01（路由配置稳定后再统一改导航入口）
- **风险评估**:
  - 风险点：`useNavigation` 签名变更可能影响其他调用方
  - 缓解：可选参数向后兼容；CI type-check 会捕获所有类型不匹配
  - 风险点：`goPrev` 行为变化（路径来源改为配置）
  - 缓解：`pageSequence` 中 `home.getPath()` 返回 `'/'`，与原硬编码一致，行为等价

## C07. Options.vue / Question.vue 单词组件名

- **优先级**: P2
- **状态**: [ ] 未开始（设计方案已就绪）
- **文件**:
  - `src/components/Options.vue`（153 行，第 1 行 eslint-disable 绕过）
  - `src/components/Question.vue`（321 行，第 1 行 eslint-disable 绕过）
  - `src/views/DetailView.vue`（第 4 行 import Question）
- **问题描述**: 项目规则要求组件名 >= 2 个单词（PascalCase），单文件组件禁止以单词命名。这两个文件通过 `<!-- eslint-disable vue/multi-word-component-names -->` 绕过校验，属于历史债务。`Options.vue` 内部被 `Question.vue` 引用，`Question.vue` 又被 `DetailView.vue` 引用，形成 `Options → Question → DetailView` 三层引用链，重命名时需同步更新。
- **修复方案**:

  #### 设计决策

  **1. 命名选择**
  - `Options.vue` → `QuizOptions.vue`：保留 `Quiz` 前缀表明归属答题场景，与 `QuizCard.vue` / `Level1Quiz.vue` / `AdaptQuiz.vue` / `ScenQuiz.vue` 命名风格一致
  - `Question.vue` → `QuizQuestion.vue`：同上，避免与未来可能出现的"问题反馈"等单义词冲突

  **2. 重命名策略**
  - 使用 `git mv` 重命名，保留 git 历史可追溯（`git log --follow` 可继续查看）
  - 显式更新所有 import 路径与符号名（项目未使用 `unplugin-vue-components` 自动导入，所有组件均为显式 import，重命名安全）
  - 同步更新模板中的 PascalCase 标签（`<Options>` → `<QuizOptions>`、`<Question>` → `<QuizQuestion>`）
  - 移除文件首行的 `<!-- eslint-disable vue/multi-word-component-names -->` 注释

  **3. 影响范围分析**

  | 引用方 | 被引用文件 | 引用形式 | 改动内容 |
  |-------|-----------|---------|---------|
  | `src/components/Question.vue` | `Options.vue` | `import Options, { type Option, type OptionsType } from './Options.vue'` + 模板 `<Options>` | import 路径 + 符号名 + 模板标签 |
  | `src/views/DetailView.vue` | `Question.vue` | `import Question, { type QuestionData } from '../components/Question.vue'` + 模板 `<Question>` | import 路径 + 符号名 + 模板标签 |

  - 无其他 `.vue` / `.ts` 文件引用这两个组件
  - `docs/testing/TEST_REPORT.md` 与 `docs/前端代码审查报告-组件层.md` 中的组件名仅作文档说明，不参与编译，可在重构完成后另行更新
  - 无直接单元测试覆盖这两个组件（现有 `Level1Quiz.spec.ts` / `AdaptQuiz.spec.ts` 走 quiz 组件的 `.option-btn` 类名断言，不依赖 `Options.vue`/`Question.vue` 的符号名）

  #### 实施步骤

  1. **重命名文件**
     ```bash
     git mv src/components/Options.vue src/components/QuizOptions.vue
     git mv src/components/Question.vue src/components/QuizQuestion.vue
     ```

  2. **修改 `src/components/QuizOptions.vue`**
     - 删除第 1 行 `<!-- eslint-disable vue/multi-word-component-names -->`
     - 其余 script / template / style 不变（无自引用）

  3. **修改 `src/components/QuizQuestion.vue`**
     - 删除第 1 行 `<!-- eslint-disable vue/multi-word-component-names -->`
     - 修改 import（第 47 行）：
       ```ts
       // 修改前
       import Options, { type Option, type OptionsType } from './Options.vue'
       // 修改后
       import QuizOptions, { type Option, type OptionsType } from './QuizOptions.vue'
       ```
     - 修改模板（第 12 行）`<Options ... />` → `<QuizOptions ... />`

  4. **修改 `src/views/DetailView.vue`**
     - 修改 import（第 4 行）：
       ```ts
       // 修改前
       import Question, { type QuestionData } from '../components/Question.vue'
       // 修改后
       import QuizQuestion, { type QuestionData } from '../components/QuizQuestion.vue'
       ```
     - 修改模板（第 86 行）`<Question :question="question" ... />` → `<QuizQuestion :question="question" ... />`

  5. **新增单元测试 `tests/components/QuizOptions.spec.ts`**
     - 覆盖点：
       - radio 模式：点击选项后 `update:modelValue` 与 `change` 事件携带单值
       - checkbox 模式：点击多选项后事件携带数组，再次点击取消
       - `v-model` 双向绑定：外部 `modelValue` 变化时内部 `selectedValue` 同步
       - `disabled` 状态：点击不触发事件
       - `isSelected` 在 radio/checkbox 两种模式下的判定
     - 目标：语句覆盖 ≥ 90%

  6. **新增单元测试 `tests/components/QuizQuestion.spec.ts`**
     - 覆盖点：
       - 渲染：题目序号、题型标签（单选/多选）、题干文字、选项数量
       - 提交答案成功路径：mock `submitAnswers` resolve，`isSubmitted` 变 true，`isCorrect` 正确判定
       - 提交答案失败路径：mock `submitAnswers` reject `ApiError`，`submitError` 显示错误信息
       - 未登录拦截：`isLoggedIn` 为 false 时点击提交显示"请先登录"
       - 空答案拦截：未选择答案时点击提交显示"请先选择答案"
       - 提交后正确答案展示：`isSubmitted && !isCorrect` 时渲染 `.correct-answer`
     - 目标：语句覆盖 ≥ 85%

  #### 兼容性评估

  - 组件对外 API（`props`、`emits`、导出的 `Option` / `OptionsType` / `QuestionData` 类型）完全不变
  - `DetailView.vue` 中导入的 `QuestionData` 类型本身定义不变，仅 import 路径更新
  - 现有 `Level1Quiz.spec.ts` / `AdaptQuiz.spec.ts` / `quiz-full-flow.spec.ts` 通过 `.option-btn` / `.quiz-item` 类名断言，不依赖被重命名的符号，无需修改
  - Vue SFC 编译器对 `<QuizOptions>` / `<QuizQuestion>` 这类多词标签名原生支持，无需额外配置

- **验证方式**:
  1. `grep -r "eslint-disable vue/multi-word-component-names" src/` 无命中
  2. `grep -rn "from.*['\"]\(\.\./\|\./\|@/\)*components/Options\.vue['\"]" src/` 无命中
  3. `grep -rn "from.*['\"]\(\.\./\|\./\|@/\)*components/Question\.vue['\"]" src/` 无命中
  4. `npm run type-check` 通过
  5. `npm run lint` 通过
  6. `npm run test` 全部通过（含新增的 QuizOptions / QuizQuestion 单测）
  7. 手动验证：访问 DetailView 路由，答题 → 提交 → 显示对错流程正常
- **分支建议**:
  - 设计：`refactor/component-07-design`
  - 实施：`refactor/component-07`
- **依赖**: 无
- **风险评估**:
  - 风险点：git mv 后 `git log` 默认不追溯重命名前的历史
  - 缓解：使用 `git log --follow src/components/QuizOptions.vue` 可继续查看；git 自动跟踪内容相似度 ≥ 50% 的重命名
  - 风险点：测试覆盖率不足（当前两个组件无单测）
  - 缓解：本次重构同步补齐 `QuizOptions.spec.ts` / `QuizQuestion.spec.ts`，将覆盖率从 0% 提升到 ≥ 85%
  - 风险点：符号名 `Options` 在 `Question.vue` 内部多处使用（template + 无 script 直接引用），漏改可能导致编译错误
  - 缓解：CI `type-check` 会立即捕获未定义符号；实施时使用 IDE 全局替换 + 编译验证双重保障

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
