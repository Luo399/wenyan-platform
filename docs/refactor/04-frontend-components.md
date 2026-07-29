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
- **状态**: [x] 已完成（refactor/component-07）
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
- **实际变更**:
  - `git mv` 重命名：`src/components/Options.vue` → `src/components/QuizOptions.vue`，`src/components/Question.vue` → `src/components/QuizQuestion.vue`
  - `src/components/QuizOptions.vue`：删除第 1 行 `<!-- eslint-disable vue/multi-word-component-names -->`，其余内容不变
  - `src/components/QuizQuestion.vue`：删除第 1 行 eslint-disable；import 改为 `import QuizOptions, { type Option, type OptionsType } from './QuizOptions.vue'`；模板 `<Options>` → `<QuizOptions>`
  - `src/views/DetailView.vue`：import 改为 `import QuizQuestion, { type QuestionData } from '../components/QuizQuestion.vue'`；模板 `<Question>` → `<QuizQuestion>`
  - 新增 `tests/components/QuizOptions.spec.ts`：覆盖基础渲染（radio/checkbox 类、disabled 类）、radio 交互（事件、selected 类、单选切换）、checkbox 交互（多选累积、取消选中）、v-model 双向绑定（radio/checkbox 同步、空值、非数组降级）、disabled 拦截事件，共 13 个用例
  - 新增 `tests/components/QuizQuestion.spec.ts`：覆盖渲染（序号、题型标签、选项数量、徽章/答案区域隐藏、按钮文字）、未登录与空答案拦截、提交成功路径（单选选对/选错、多选全对/漏选、提交中按钮禁用与 spinner）、提交失败路径（ApiError 回显、非 ApiError 回显"提交失败"）、事件发射（update:modelValue/answer-change 携带 questionId）、正确答案格式化（单选字符串、多选顿号连接），共 14 个用例
  - 验证：`grep` 确认 `src/` 内无 `eslint-disable vue/multi-word-component-names` 残留于 Options/Question 系列文件；无 `from '...Options.vue'` / `from '...Question.vue'` 旧路径引用

## C08. 7 个组件缺少 withDefaults

- **优先级**: P2
- **状态**: [x] 已完成（refactor/component-08）
- **文件**（C07 已将 Options.vue/Question.vue 重命名为 QuizOptions.vue/QuizQuestion.vue，下文沿用新名）:
  - `src/components/QuizOptions.vue`（第 34-39 行 defineProps）
  - `src/components/QuizQuestion.vue`（第 63-66 行 defineProps）
  - `src/components/AudioPlayer.vue`（第 75-80 行 defineProps）
  - `src/components/VideoPlayer.vue`（第 77-89 行 defineProps）
  - `src/components/LoginModal.vue`（第 81-85 行 defineProps）
  - `src/components/MultiRoleReadingItem.vue`（第 39-44 行 defineProps）
  - `src/components/QuizCard.vue`（第 103-108 行 defineProps）
- **问题描述**: `defineProps<{...}>()` 未使用 `withDefaults`，可选 props 无默认值。原审计列出 7 个组件，但逐文件复核后发现实际只有 4 个需要改动，2 个无需改动，1 个不适用（详见设计决策）
- **修复方案**:

  #### 设计决策

  **0. 复核结论（重要）**

  逐文件审查 7 个组件的 props 定义后，按"是否有可选 prop、默认值是否可静态确定"分类：

  | 文件 | 必填 props | 可选 props | 是否改动 | 原因 |
  |------|-----------|-----------|---------|------|
  | `QuizOptions.vue` | options, type | modelValue?, disabled? | ✅ 改 | disabled 给 false；modelValue 依赖 type 不给默认值 |
  | `QuizQuestion.vue` | question | modelValue? | ❌ 不改 | 唯一可选 prop modelValue 依赖 question.type，无法给静态默认值；加空 withDefaults 是无意义噪音 |
  | `AudioPlayer.vue` | src | （无） | ❌ 不改 | 无可选 props，加 withDefaults 无意义 |
  | `VideoPlayer.vue` | src | poster? | ✅ 改 | poster 给 `''` |
  | `LoginModal.vue` | visible | （无） | ❌ 不改 | 无可选 props |
  | `MultiRoleReadingItem.vue` | segment, isActive | （无） | ✅ 改 | isActive 语义应为可选，改 `isActive?: boolean` + 默认 false |
  | `QuizCard.vue` | data, submitted | （无） | ✅ 改 | submitted 语义应为可选，改 `submitted?: boolean` + 默认 false |

  实际改动：**4 个文件**（QuizOptions / VideoPlayer / MultiRoleReadingItem / QuizCard）。
  未改动：**3 个文件**（QuizQuestion / AudioPlayer / LoginModal），在设计说明中标注原因，避免后续重复审计。

  **1. ESLint 规则复核**

  项目 `eslint.config.ts` 使用 `pluginVue.configs['flat/essential']`，**不包含** `vue/require-default-prop` 规则（该规则属于 recommended 级别）。因此本次重构不是 ESLint 强制要求，动机是：
  - 类型安全：可选 props 在组件内访问时为 `T | undefined`，加默认值可收窄类型
  - 调用方简化：父组件不必显式传 `:disabled="false"`
  - 语义对齐：`isActive`/`submitted` 这类"状态标志"语义上应有默认 false

  **2. modelValue 默认值策略（关键）**

  `QuizOptions` 和 `QuizQuestion` 的 `modelValue` 默认值依赖另一 prop（`type` / `question.type`）：
  - radio 模式默认 `''`
  - checkbox 模式默认 `[]`

  `withDefaults` 不支持基于其他 props 计算默认值（只能给静态字面量）。Vue 官方明确推荐：**当默认值依赖其他 props 时，保持 `modelValue?: T`（不给 withDefaults 默认值），在 `getInitialValue()` 等运行时函数中兜底**。两个组件已有 `getInitialValue()` 实现（`props.modelValue ?? ''` / `Array.isArray(props.modelValue) ? [...] : []`），运行时兜底正确。

  因此 `modelValue` 不进入 withDefaults 默认值表，这是有意为之，不是遗漏。

  **3. 各文件改动细节**

  ##### 3.1 `src/components/QuizOptions.vue`（第 34-39 行）

  ```ts
  // 修改前
  const props = defineProps<{
    options: Option[]
    type: OptionsType
    modelValue?: string | number | (string | number)[]
    disabled?: boolean
  }>()

  // 修改后
  const props = withDefaults(
    defineProps<{
      options: Option[]
      type: OptionsType
      modelValue?: string | number | (string | number)[]
      disabled?: boolean
    }>(),
    {
      disabled: false,
      // modelValue 不给默认值：依赖 type（radio→'' / checkbox→[]），由 getInitialValue() 运行时兜底
    },
  )
  ```

  ##### 3.2 `src/components/VideoPlayer.vue`（第 77-89 行）

  ```ts
  // 修改前
  const props = defineProps<{
    src: string
    poster?: string
  }>()

  // 修改后
  const props = withDefaults(
    defineProps<{
      src: string
      poster?: string
    }>(),
    {
      poster: '', // 空字符串：:poster="''" 时浏览器不显示封面，与原 undefined 行为一致
    },
  )
  ```

  ##### 3.3 `src/components/MultiRoleReadingItem.vue`（第 39-44 行）

  ```ts
  // 修改前
  interface Props {
    segment: MultiRoleSegment
    isActive: boolean
  }
  const props = defineProps<Props>()

  // 修改后
  interface Props {
    segment: MultiRoleSegment
    isActive?: boolean // 由必填改为可选，语义"是否高亮当前段落"，默认不高亮
  }
  const props = withDefaults(defineProps<Props>(), {
    isActive: false,
  })
  ```

  ##### 3.4 `src/components/QuizCard.vue`（第 103-108 行）

  ```ts
  // 修改前
  const props = defineProps<{
    /** 题目数据 */
    data: QuizCardData
    /** 提交状态 */
    submitted: boolean
  }>()

  // 修改后
  const props = withDefaults(
    defineProps<{
      /** 题目数据 */
      data: QuizCardData
      /** 提交状态（默认未提交） */
      submitted?: boolean
    }>(),
    {
      submitted: false,
    },
  )
  ```

  #### 实施步骤

  1. **修改 4 个文件**（按上述 3.1–3.4 改动）
     - 注意：`MultiRoleReadingItem.vue` 与 `QuizCard.vue` 的 props 从"必填"改为"可选"，调用方（父组件）无需改动（不传等价于传 false，与原"必须显式传 false"行为等价）
  2. **更新单测**（如有断言依赖 props 必填性）
     - `tests/components/QuizOptions.spec.ts`：现有用例均显式传 disabled，新增 1 个用例验证"不传 disabled 时默认 false"（点击选项可触发 toggle）
     - `tests/components/VideoPlayer.spec.ts`：新增 1 个用例验证"不传 poster 时 `<video>` 元素 poster 属性为空字符串"
     - `tests/components/QuizCard.spec.ts`：新增 1 个用例验证"不传 submitted 时默认 false（提交按钮可见、选项可点击）"
     - `MultiRoleReadingItem` 暂无单测，不新增（保持现状，避免本次范围蔓延）
  3. **运行验证**
     - `npm run type-check`：确认可选 props 改动未破坏类型推断
     - `npm run lint`：确认无新告警
     - `npm run test`：确认新增用例通过且原有用例不回归

  #### 兼容性评估

  - **QuizOptions**：`disabled` 默认值 `false` 与原"未传时 undefined（falsy）"行为等价；`toggleOption` 中 `if (props.disabled) return` 对 false/undefined 行为一致
  - **VideoPlayer**：`poster: ''` 与原 `poster: undefined` 在模板 `:poster="poster"` 渲染一致（空字符串与 undefined 都不显示封面）
  - **MultiRoleReadingItem**：`isActive` 改可选后，父组件 `MultiRoleReading.vue` 现有调用 `<MultiRoleReadingItem :is-active="..." />` 仍可工作；不传时默认 false（不高亮），符合语义
  - **QuizCard**：`submitted` 改可选后，父组件现有调用 `<QuizCard :submitted="..." />` 仍可工作；不传时默认 false（未提交态），符合语义
  - **未改动文件**：QuizQuestion / AudioPlayer / LoginModal 行为完全不变

  - **类型推断变化**：`isActive`/`submitted` 从必填变可选，父组件 TSX/模板中若依赖"必填"类型推断的场景极少（Vue 模板不强制类型检查 prop 必填性），CI type-check 会捕获任何潜在问题

- **验证方式**:
  1. `grep -rn "defineProps<{" src/components/QuizOptions.vue src/components/VideoPlayer.vue src/components/MultiRoleReadingItem.vue src/components/QuizCard.vue` 无命中（均已改为 withDefaults 包装）
  2. `npm run type-check` 通过
  3. `npm run lint` 通过
  4. `npm run test` 全部通过（含新增 3 个默认值验证用例）
  5. 手动验证（生产部署后）：
     - 选项组件可正常点击切换（默认非禁用）
     - 视频组件无 poster 时正常播放
     - 多角色朗读段落默认不高亮，当前播放段落高亮
     - 测验卡片默认未提交态，提交按钮可见
- **分支建议**:
  - 设计：`refactor/component-08-design`
  - 实施：`refactor/component-08`
- **依赖**: C07（已完成，Options/Question 已重命名为 QuizOptions/QuizQuestion）
- **风险评估**:
  - 风险点：`isActive`/`submitted` 从必填改为可选，可能影响父组件类型推断
  - 缓解：Vue 模板对 prop 必填性不强制；CI type-check 捕获 TS 类型问题；两个 prop 默认值 false 与原"必传 false"语义等价
  - 风险点：`modelValue` 不给 withDefaults 默认值，可能被误认为遗漏
  - 缓解：在设计文档与本文件注释中明确说明"依赖其他 prop，运行时兜底"，并附 Vue 官方推荐链接
  - 风险点：原审计列 7 个文件，实际只改 4 个，可能被质疑"未完成"
  - 缓解：本设计逐文件说明不改原因，审计口径从"7 个待改"修正为"4 个改 + 3 个不适用"
- **实际变更**:
  - `src/components/QuizOptions.vue`：`defineProps<{...}>()` 改为 `withDefaults(defineProps<{...}>(), { disabled: false })`，modelValue 保持可选无默认值（依赖 type，由 getInitialValue() 运行时兜底）
  - `src/components/VideoPlayer.vue`：`defineProps<{...}>()` 改为 `withDefaults(defineProps<{...}>(), { poster: '' })`
  - `src/components/MultiRoleReadingItem.vue`：`isActive: boolean` 改为 `isActive?: boolean`，`defineProps<Props>()` 改为 `withDefaults(defineProps<Props>(), { isActive: false })`
  - `src/components/QuizCard.vue`：`submitted: boolean` 改为 `submitted?: boolean`，`defineProps<{...}>()` 改为 `withDefaults(defineProps<{...}>(), { submitted: false })`
  - `tests/components/QuizOptions.spec.ts`：新增"默认值验证"测试组，1 个用例验证不传 disabled 时默认 false（选项无 disabled 类、点击可触发事件）
  - `tests/components/VideoPlayer.spec.ts`：新增"默认值验证"测试组，1 个用例验证不传 poster 时 video 元素 poster 属性为空字符串
  - `tests/components/QuizCard.spec.ts`：新增"默认值验证"测试组，1 个用例验证不传 submitted 时默认 false（提交按钮可见、选项未锁定、解析区域隐藏）
  - 未改动：`QuizQuestion.vue` / `AudioPlayer.vue` / `LoginModal.vue`（无可改的 optional props，详见设计决策）

## C09. StepOneView 大量未使用导入与 dead code

- **优先级**: P2
- **状态**: [x] 已完成（refactor/component-09）
- **文件**: `src/views/StepOneView.vue`（第 46-63, 81-82 行）
- **问题描述**:
  1. 第 46-48 行 3 个 import 未使用（`useStudentInfo`、`submitAnswers`、`ProcessedMultiRoleData`）
  2. 第 51-63 行 `interface Level1QuizItem` 定义但未使用
  3. 第 81-82 行 `isAudioLoaded`、`currentSegment` 两个 ref 仅赋值从未读取（dead state）
- **修复方案**:

  #### 设计决策

  **1. 未使用 import 清理**
  - `useStudentInfo`、`submitAnswers`、`ProcessedMultiRoleData` 三个 import 在文件内无任何引用，直接删除
  - 复核：`useStudentInfo` 在其他 view（如 `StepThreeView`）有使用，本文件纯属遗留；`submitAnswers` 同理；`ProcessedMultiRoleData` 类型在 `handleAudioLoadSuccess` 签名中被 `MultiRoleData` 取代（后者从 `MultiRoleReading.vue` 直接导出，类型更精确）

  **2. 未使用 interface 清理**
  - `Level1QuizItem` 接口字段（`text_id`、`question_number`、`option_a`...）与当前页面无关，本页面已无 Level1Quiz 组件（早期版本曾集成，后拆分到 `DetailView`），接口属历史遗留
  - 直接删除整个 interface 定义

  **3. dead state 清理 + 事件处理函数调整**
  - `isAudioLoaded`（ref(false)）：仅在 `handleAudioLoadSuccess` 中被赋值为 `true`，全文件无读取
  - `currentSegment`（ref<number | null>(null)）：仅在 `handleSegmentChange` 中被赋值，全文件无读取
  - 处理策略：
    - `handleAudioLoadSuccess`：保留 `debugLog` 输出（调试观测用，生产构建自动剥离），删除 `isAudioLoaded.value = true` 死赋值
    - `handleSegmentChange`：函数体仅为 `currentSegment.value = index` 死赋值，无其他副作用；将函数体改为 `debugLog` 输出段落索引，保留事件监听以维持可观测性（与 `handleAudioLoadSuccess` 行为一致），避免变更模板事件绑定
  - **不删除 `@segment-change` 事件绑定**的理由：保持模板与组件契约一致，未来若需在父组件响应段落变化（如同步滚动条、高亮列表项）无需重新接线；同时与 `@load-success` / `@load-error` 处理风格统一（均通过 debugLog 观测）

  **4. 过期测试同步修正**
  - 现有 `tests/views/StepOneView.spec.ts` 存在历史遗留断言，期望 `.quiz-section` 与 `Level1Quiz` 组件存在，但当前 `StepOneView.vue` 早已移除测验区块（拆分至 `DetailView`），测试与实现不一致
  - 本次同步修正：
    - 移除对 `.quiz-section` 的断言
    - 移除对 `Level1Quiz` 组件的断言与 stub
    - 保留基础渲染、`.annotated-section` / `.audio-section` 结构断言
    - 新增对 `BackContinue` 导航组件的渲染断言
    - 新增对 `MultiRoleReading` 事件透传（`wenId`、`auto-load`）的 props 断言
    - 新增对 `useNavigation`（goNext/goPrev）的集成测试（mock 验证）

  #### 实施步骤

  1. **修改 `src/views/StepOneView.vue`**
     - 删除第 46-48 行 3 个未使用 import
     - 删除第 52-64 行 `interface Level1QuizItem` 定义
     - 删除第 82-83 行 `isAudioLoaded`、`currentSegment` ref 定义
     - `handleAudioLoadSuccess` 函数体改为仅 `debugLog`（删除 `isAudioLoaded.value = true`）
     - `handleSegmentChange` 函数体改为 `debugLog` 输出段落索引（删除 `currentSegment.value = index`）

  2. **修改 `tests/views/StepOneView.spec.ts`**
     - 移除 `Level1Quiz` / `VideoPlayer` stub（当前组件未使用）
     - 移除"课后小测三个区块"测试中的 `.quiz-section` 断言
     - 移除"Level1Quiz 透传 wenId"测试组（组件不存在）
     - 新增"BackContinue 导航"测试组：验证组件渲染、goNext/goPrev 触发
     - 新增"MultiRoleReading props 透传"测试组：验证 `wenId`、`auto-load` props
     - 新增"事件处理"测试组：验证 `load-success` / `load-error` / `segment-change` 事件触发 debugLog（通过 mock debug 模块）

  3. **运行验证**
     - `npm run type-check`：确认无未使用警告
     - `npm run lint`：确认无新告警
     - `npm run test`：确认所有测试通过

  #### 兼容性评估

  - 模板对外契约不变：`<MultiRoleReading>` 的 props（`wen-id`、`auto-load`）与 emits（`load-success`、`load-error`、`segment-change`）绑定全部保留
  - 路由参数 `poemId` → `wenId` 计算逻辑不变
  - `useNavigation('stepone', poemId)` 调用不变
  - 删除的 import / interface / ref 均为文件内部局部，无外部引用
  - 测试修正后与实际组件结构对齐，消除历史遗留的"测试通过但断言失效"假象

- **验证方式**:
  1. `grep -rn "useStudentInfo\|submitAnswers\|ProcessedMultiRoleData\|Level1QuizItem\|isAudioLoaded\|currentSegment" src/views/StepOneView.vue` 无命中
  2. `npm run type-check` 通过
  3. `npm run lint` 通过
  4. `npm run test` 全部通过（含修正后的 StepOneView 测试）
- **分支建议**: `refactor/component-09`
- **依赖**: 无
- **风险评估**:
  - 风险点：移除 `@segment-change` 监听会改变 MultiRoleReading 行为
  - 缓解：**不移除** `@segment-change` 绑定，仅将 handler 改为 debugLog，行为等价（事件原本只写 dead state）
  - 风险点：测试修正范围超出 C09 描述的"删除 dead code"
  - 缓解：现有测试已与实现脱节（期望不存在的 `.quiz-section`），属"修改指定文件时发现的相关过期测试"，同步修正避免后续误判
- **实际变更**:
  - `src/views/StepOneView.vue`：删除 3 个未使用 import、`Level1QuizItem` interface、2 个 dead ref；`handleAudioLoadSuccess` 改为仅 debugLog；`handleSegmentChange` 改为 debugLog 输出段落索引
  - `tests/views/StepOneView.spec.ts`：移除过期 `.quiz-section` / `Level1Quiz` 断言与 stub；新增 BackContinue 渲染、MultiRoleReading props 透传、事件处理（mock debug 验证 debugLog 调用）测试组

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

## C11. Repeatbgm.vue 单词组件名（C07 延伸）

- **优先级**: P2
- **状态**: [x] 已完成（refactor/component-07-extend）
- **文件**:
  - `src/components/common/Repeatbgm.vue`（317 行，第 1 行 eslint-disable 绕过）
- **问题描述**: C07 重构 Options.vue / Question.vue 时发现 `src/components/common/Repeatbgm.vue` 也通过 `<!-- eslint-disable vue/multi-word-component-names -->` 绕过校验。文件名 `Repeatbgm` 将 `Bgm` 全小写，eslint 视为单词命名，违反"组件名 >= 2 个单词（PascalCase）"规则。该组件无任何外部引用（grep `RepeatBgm` / `Repeatbgm` / `common/Repeatbgm` 在 `src/` 下仅命中组件自身），属"僵尸组件"，但仍需整改以保持代码库一致性。
- **修复方案**:

  #### 设计决策

  **1. 命名选择**
  - `Repeatbgm.vue` → `RepeatBgm.vue`：修正为标准 PascalCase（`Repeat` + `Bgm` 两个单词首字母大写）
  - 保留原语义（"重复播放 BGM"），仅修正大小写，最小改动
  - 与 `common/` 目录下其他组件命名风格一致（`AutoPlayPrompt.vue` / `BaseLoader.vue` / `SectionDivider.vue` 均为多词 PascalCase）
  - `Bgm` 作为术语已被项目接受（`bgmStore` / `currentBgmFile` / `bgmMapping`）

  **2. 重命名策略**
  - 使用 `git mv` 重命名，保留 git 历史可追溯
  - 移除文件首行 `<!-- eslint-disable vue/multi-word-component-names -->`
  - 同步更新文件内所有 `[Repeatbgm]` 日志前缀为 `[RepeatBgm]`（共 8 处），保持日志一致性
  - 更新文件顶部注释中的文件名（`Repeatbgm.vue -` → `RepeatBgm.vue -`）
  - 组件对外 API（`bgmStore` 集成、audio 元素事件、retry 方法）完全不变

  **3. 影响范围分析**
  - 无任何 `.vue` / `.ts` 文件引用此组件（已 grep 验证）
  - 无需更新其他文件的 import / 模板标签
  - 无单元测试覆盖该组件（本次同步补齐）

  #### 实施步骤

  1. **重命名文件**
     ```bash
     git mv src/components/common/Repeatbgm.vue src/components/common/RepeatBgm.vue
     ```

  2. **修改 `src/components/common/RepeatBgm.vue`**
     - 删除第 1 行 `<!-- eslint-disable vue/multi-word-component-names -->`
     - 第 3 行注释 `Repeatbgm.vue -` → `RepeatBgm.vue -`
     - 全局替换 `[Repeatbgm]` → `[RepeatBgm]`（8 处 debugLog / debugWarn / debugError 日志前缀）

  3. **新增单元测试 `tests/components/RepeatBgm.spec.ts`**
     - mock 依赖：`vue-router`（useRoute）、`@/utils/asset`（getAssetUrl）、`@/utils/wenUtils`（getWenId）、`@/utils/debug`（debugLog/debugError/debugWarn）
     - 使用真实 pinia + 真实 `useBgmStore`，避免 mock 复杂的响应式状态
     - 覆盖点：
       - 基础渲染：加载状态、错误状态、正常状态（含 audio 元素、播放按钮、音量滑块）
       - 播放/暂停按钮点击触发 `bgmStore.togglePlay`
       - 静音按钮点击触发 `bgmStore.toggleMute`
       - 音量滑块 input 事件触发 `bgmStore.setVolume`
       - retry 按钮点击清除 error 状态
       - 路由变化触发 `bgmStore.setActiveWenId`
       - store 播放状态变化触发 `audio.play` / `audio.pause`
       - store 音量变化触发 `audio.volume` 更新
       - store 静音状态变化触发 `audio.muted` 更新
       - onUnmounted 时 pause + 清空 src
     - 目标：语句覆盖 ≥ 80%

  #### 兼容性评估

  - 组件对外 API 完全不变（无 props / emits，仅通过 bgmStore 集成）
  - 无外部引用方，零影响
  - 现有测试套件无相关用例，无需修改

- **验证方式**:
  1. `grep -r "eslint-disable vue/multi-word-component-names" src/` 无命中
  2. `grep -r "Repeatbgm" src/` 无命中（仅 `RepeatBgm`）
  3. `npm run type-check` 通过
  4. `npm run lint` 通过
  5. `npm run test` 全部通过（含新增 RepeatBgm 单测）
- **分支建议**: `refactor/component-07-extend`
- **依赖**: C07（已完成）
- **风险评估**:
  - 风险点：组件无外部引用，可能已是废弃代码
  - 缓解：本次仅重命名 + 补测试，不删除组件；若后续确认废弃可单独清理
  - 风险点：测试 mock 较多（4 个模块），维护成本较高
  - 缓解：使用真实 pinia + bgmStore，减少状态 mock；debug 工具 mock 仅隔离日志噪音
- **实际变更**:
  - `git mv` 重命名：`src/components/common/Repeatbgm.vue` → `src/components/common/RepeatBgm.vue`
  - `src/components/common/RepeatBgm.vue`：删除 eslint-disable 注释；顶部注释文件名改为 `RepeatBgm.vue`；8 处 `[Repeatbgm]` 日志前缀改为 `[RepeatBgm]`
  - 新增 `tests/components/RepeatBgm.spec.ts`：覆盖渲染（加载/错误/正常三种状态）、播放暂停按钮、静音按钮、音量滑块、retry、路由变化触发 setActiveWenId、store 播放/音量/静音状态变化触发 audio 元素相应行为、onUnmounted 清理，共 12 个用例
  - 验证：`grep` 确认 `src/` 内无 `eslint-disable vue/multi-word-component-names` 残留；无 `Repeatbgm` 旧命名残留
