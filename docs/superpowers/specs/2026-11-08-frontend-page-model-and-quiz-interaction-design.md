# 前端页面模型 + 答题交互抽取 — 设计文档

- 日期：2026-11-08
- 状态：待审阅
- 归属：文言文预习平台（wenyan-platform）
- 关联代码：`src/config/pageRegistry.ts`、`src/views/StepTwoView.vue`、`src/views/StepThreeView.vue`、`src/composables/useQuizProgress.ts`、`src/adapters/`、`src/components/QuizCard.vue`、`src/components/AdaptQuiz.vue`
- 关联文档：`docs/refactor/10-figma-page-registry-design.md`

## 1. 背景与目标

### 1.1 现状事实（审查结论，均可在代码中复核）

| 事实 | 证据 |
|---|---|
| 页面数据（`pages_level2_dialog_quiz` / `pages_level3_adaptive_quiz`）由 Excel + Python 产出，不来自 Figma 插件 | `data-pipeline/python/transformers/__init__.py` 的 `OUTPUT_DIR_MAP` |
| Figma 插件只产出扁平 `{字段名: 文本}`，无法生成 `blocks/items` | `figma-plugin/core.ts` 的 `scanTextFrame` |
| 两个页面视图直读 `/data/...`，无适配器、无版本戳 | `src/views/StepTwoView.vue`、`src/views/StepThreeView.vue` |
| 答案存在三套表示：字母、0 基索引、字符串索引 | `backend/data/level1_quiz/WEN_01.json`（`"C"` + `correct_index: 2`）、`backend/data/pages_level2_dialog_quiz/WEN_01.json`（`"B"`）、`backend/data/pages_level3_adaptive_quiz/WEN_01.json`（`1`） |
| 一级题正确答案经 `parseInt("C") → NaN → 0` | `src/components/Level1Quiz.vue` 的 `normalizeCorrectAnswer` |
| 判分依赖客户端传入 `correctAnswer` | `backend/src/services/answerService.js`、`backend/src/controllers/answerController.js` |
| 逐题提交失败被吞掉，进度仍推进并写完成记录 | `src/composables/useQuizProgress.ts` |
| 两页各写一套「加载 / 错误 / 空态 / 进度 / 完成 / 提交 / 埋点」 | `StepTwoView.vue`、`StepThreeView.vue` |
| 未解锁内容用 `v-if` 或 CSS 隐藏，显隐逻辑写在页面里 | `src/components/BlockRenderer.vue`、`StepThreeView.vue` |

**范围约束（已与需求方确认）：**
- 本次只改前端：新增清洗层与交互层，不动后端、Python 管线、Figma 插件。
- 答题交互与展示口径由甲方反复调整，必须做到「改文案 / 改策略不动组件」。

### 1.2 目标

1. **唯一清洗入口**：原始 JSON 只在 `pageAdapter` 转换一次，组件不接触原始字段。
2. **渲染与动作解耦**：渲染器只有 props + 事件；状态机与副作用在 composable。
3. **口径可改**：文案、显示策略、解锁规则集中在 `config/quizInteraction.ts`。
4. **预渲染**：内容先全部挂载，显隐由策略计算后视觉应用，不用 `v-if` 销毁组件。
5. **新增 Figma 页面零代码**：`pageRegistry` 注册一条 + 渲染模式已存在即可工作。

### 1.3 非目标

- 不修后端判分与鉴权（单独排期）。
- 不修 Python 转换器的 `options[0]` 错位（adapter 侧做防御，根因另修）。
- 不引入 XState 等状态机库（手写 reducer）。
- 不重构 `AnswerQueryView` / `ResourceUploadTool` 等后台页面。

## 2. 设计

### 2.1 分层

```
OSS 原始 JSON（Figma / Excel 产物）
        │  adapters/pageAdapter.ts   ← 唯一清洗入口（纯函数）
        ▼
PageModel（blocks | quizList，QuizModel 已归一化）
        │  views/FigmaPageView.vue   ← 取 meta、加载、选渲染器、组装 session
        ▼
components/figma/BlocksRenderer.vue | QuizListRenderer.vue
        │  只读 snapshot + 策略；只 emit('select' | 'submit' | 'retry')
        ▼
composables/useQuizSession.ts（状态机） + composables/useQuizEffects.ts（提交/埋点/持久化）
```

依赖方向单向：`config → adapter → session → renderer`。任何一层不得反向 import。

### 2.2 数据契约

```ts
/** 归一化后的选项 */
export interface QuizOptionModel {
  key: string   // 'A' | 'B' | 'C' | 'D'
  text: string
  index: number // 0 基
}

/** 归一化后的单题（组件只读此结构） */
export interface QuizModel {
  id: string                  // 统一 questionId：数据源 id 优先，缺失用 `${wenId}_q${n}`
  wenId: string
  module: string
  type: 'radio' | 'checkbox'
  stem: string
  options: QuizOptionModel[]
  answerKeys: string[]        // 单选长度 1
  answerIndexes: number[]     // 单选长度 1
  /** 原始数据的答案表示：提交时按同一表示回传，保证与后端 JSON 严格比较对齐 */
  answerFormat: 'letter' | 'index'
  /** 被丢弃的前置选项数（options[0] 与题干相同时为 1） */
  optionOffset: number
  explanation: string
  difficulty?: string
  audioFile?: string | null
  invalid?: boolean           // 缺正确答案 / 选项不足 → true，不静默当 0
}

export type BlockModel =
  | { type: 'dialogue'; data: DialogueBlockModel }
  | { type: 'quiz'; data: QuizModel }
  | { type: 'wordlist'; data: { wenId: string } }
  | { type: 'multi-role-reading'; data: { wenId: string } }
  | { type: 'video'; data: { src: string; poster?: string } }

export type PageModel =
  | { kind: 'blocks'; pageId: string; title?: string; blocks: BlockModel[] }
  | { kind: 'quizList'; pageId: string; items: { scenario?: string; quiz: QuizModel }[] }
```

**归一化规则（唯一事实源，写在 `pageAdapter`）：**

| 原始输入 | 归一化结果 |
|---|---|
| `correct_answer: 'B'` | `answerKeys: ['B']`、`answerIndexes: [1]` |
| `correct_answer: 1` | `answerKeys: ['B']`、`answerIndexes: [1]` |
| `correct_answer: '1'` | `answerKeys: ['B']`、`answerIndexes: [1]` |
| `correct_index: 2`（无 `correct_answer`） | `answerKeys: ['C']`、`answerIndexes: [2]` |
| 多选数组 `[0, 2]` | `answerKeys: ['A','C']`、`answerIndexes: [0, 2]` |
| 缺失 / 越界 / 无法解析 | `invalid: true`，`answerKeys/indexes` 为空数组 |
| `options[0]` 与 `question_text` 完全相同（Python 遗留错位） | 丢弃该选项并整体索引前移，保持 `answerIndexes` 同步 |

**兼容策略**：`PageModel` 不引入 `schemaVersion` 强校验；字段缺失一律走默认值与 `invalid` 标记，保证旧数据不炸。新增字段只允许追加。

### 2.3 组件边界

| 文件 | 唯一职责 | 禁止 |
|---|---|---|
| `src/adapters/pageAdapter.ts` | 原始 JSON → `PageModel`；答案归一；questionId 统一；脏数据防御 | 不 import Vue、不发请求、不读环境变量 |
| `src/views/FigmaPageView.vue` | 从 `pageRegistry` 取 meta、`useDataLoader`（带版本戳）、按 `renderMode` 选渲染器、创建 session | 不写题目 UI、不判分、不埋点 |
| `src/components/figma/BlocksRenderer.vue` | 按 `block.type` 映射组件、应用显隐 | 不发请求、不判分、不推进度 |
| `src/components/figma/QuizListRenderer.vue` | 逐题渲染、进度条、完成态、情景文本 | 不判分、不提交 |
| `src/components/figma/QuizCard.vue` | 单题纯展示：题目、选项、解析、提交按钮 | 不持有 `submitted` 布尔、不比较答案 |
| `src/components/figma/QuizProgressBar.vue` | 进度展示 | 不计算进度（由 session 提供） |
| `src/composables/useQuizSession.ts` | 状态机 + 快照 + `dispatch` | 不 fetch、不 localStorage、不埋点、不 import 组件 |
| `src/composables/useQuizEffects.ts` | 提交、完成记录、埋点、失败重试 | 不碰 DOM、不持有渲染状态 |
| `src/config/quizInteraction.ts` | 文案 + 显示策略 + 解锁规则 | 不含逻辑 |

补充：`quiz-list` 页面在全部答完后，由 `FigmaPageView` 追加渲染 `CultureCards`（保持重构前 StepThree 行为），文化卡片点击埋点仍留在视图层。

`StepTwoView.vue` / `StepThreeView.vue` 在本期保留为薄壳（路由兼容），内部只渲染 `FigmaPageView` 并传入 `pageKey`；二期可直接删除。保留是为了让现有 `tests/views/*.spec.ts` 继续有效。

### 2.4 交互配置（口径集中处）

```ts
// src/config/quizInteraction.ts
export interface QuizInteractionConfig {
  texts: {
    submit: string
    next: string
    retry: string
    completed: string
    completedStats: (correct: number, total: number) => string
    invalidQuestion: string
    submitFailed: string
  }
  display: {
    showDifficulty: boolean
    showExplanation: 'never' | 'after-submit' | 'always'
    showScenario: 'first-item' | 'every-item' | 'none'
    allowReview: boolean          // true：已解锁旧题保持展开；false：只展开当前题（旧题收起但不卸载）
    revealMode: 'visual'          // 预渲染 + 视觉隐藏（本期唯一取值）
    showQuizNumber: boolean
  }
  advancePolicy: 'on-submit' | 'on-correct' | 'manual'
}
```

- 改文案 → 只改 `texts`。
- 改体验（是否显示解析/难度/题号/情景）→ 只改 `display`。
- 改闯关规则 → 只改 `advancePolicy`。
- 渲染器与 session 只读该配置，不出现散落的字符串与 `if (isStepThree)` 分支。

### 2.5 状态机

```
idle → loading → answering(unlockedIndex) → submitting → submitted → completed
                          ↑                      │
                          └──── submit-failed ───┘
```

快照（只读）：

```ts
export interface QuizSnapshot {
  status: 'idle' | 'loading' | 'answering' | 'submitting' | 'submitted' | 'completed'
  unlockedIndex: number                    // 已解锁到第几题（含）
  selections: Record<string, string[]>     // quizId → 当前选择（含未提交草稿）
  answers: Record<string, string[]>        // quizId → 已成功提交的选择
  results: Record<string, boolean>         // quizId → 是否正确（由 correct 判定函数给出）
  error: string | null
}
```

事件：`LOADED` / `SELECT` / `SUBMIT` / `SUBMIT_SUCCESS` / `SUBMIT_FAILURE` / `RESET` / `COMPLETE`。

规则：
- `advancePolicy: 'on-submit'` → `SUBMIT_SUCCESS` 后 `unlockedIndex++`。
- `advancePolicy: 'on-correct'` → `results[quizId] === true` 才解锁。
- `SUBMIT_FAILURE` → `status: 'answering'`，`error` 可读，**不推进、不写完成记录**。
- 切篇目（`wenId` 变化）→ `RESET`，并切换完成记录的 key（key 由 `wenId` 计算，不在 setup 时快照）。

正确性判定：`isCorrect(quiz, selectedKeys)` 由 `pageAdapter` 导出的纯函数完成，`answerKeys` 与选中 key 集合比较；渲染器不参与判定。

### 2.6 渲染与显隐

- 所有块/题一律先挂载（`v-for` 全量渲染）。
- 显隐由 session 计算：`isRevealed(index) => index <= unlockedIndex`。
- 渲染器用 `v-show` + `aria-hidden="true"` 应用；`display.allowReview=false` 时只展开当前题，已解锁旧题收起但仍保留在 DOM。
- 未解锁题的 `explanation` 在 `QuizCard` 内按 `display.showExplanation` 与 `isRevealed` 共同决定是否渲染文本节点。
- 防作弊不做前端承诺：前端隐藏仅保证体验，真实防作弊由后端负责（本期不改后端）。

### 2.7 错误处理

| 场景 | 行为 |
|---|---|
| 数据加载失败 | `PageScaffold` 错误态 + 重试，页面不出现半渲染内容 |
| JSON 结构不合法（缺 `blocks` / `items`） | adapter 返回空 `PageModel`，`PageScaffold` 空态，不抛到控制台 |
| 单题 `invalid` | 该题显示「题目配置异常」，不可提交；完成度分母按「非 invalid 题数」计算，`completed` 判定同样只看非 invalid 题 |
| 提交失败（401/网络/5xx） | `SUBMIT_FAILURE`：保留作答、显示 `texts.submitFailed`、允许重试；不推进、不写完成记录 |
| 未登录 | 允许本地作答与展示判定，但 `useQuizEffects` 跳过提交并在快照 `error` 标记；不写后端记录 |
| 版本戳获取失败 | 回退无戳 URL（现有行为），不阻塞加载 |

### 2.8 测试

| 层 | 用例 |
|---|---|
| `tests/adapters/pageAdapter.spec.ts` | 字母 / 数字 / 字符串数字 / `correct_index` / 多选 / 缺失 / 越界 / `options[0]` 与题干相同，共 8 类输入 → 同构 `QuizModel` |
| `tests/composables/useQuizSession.spec.ts` | 三种 `advancePolicy` 的推进；失败回滚；`on-correct` 答错不解锁；切篇目重置；`invalid` 题不计完成 |
| `tests/components/QuizCard.spec.ts` | 只发 `select`/`submit` 事件、不自行判分；`showExplanation` 三档 |
| `tests/components/QuizListRenderer.spec.ts` | 全量挂载 + `v-show`；`isRevealed` 边界；完成态 |
| `tests/components/BlocksRenderer.spec.ts` | 块类型映射；显隐；未知类型降级 |
| `tests/views/StepTwoView.spec.ts`、`StepThreeView.spec.ts` | 保持现有断言语义通过 |

## 3. 迁移步骤（每步可独立回滚）

1. 新增 `config/quizInteraction.ts`、`adapters/pageAdapter.ts`、`composables/useQuizSession.ts`、`composables/useQuizEffects.ts`（零引用，纯增量）。
2. 补 `pageAdapter` 与 `useQuizSession` 单测，先保证新层自洽。
3. `StepThreeView` 改为 `FigmaPageView` + `QuizListRenderer`（结构最简单，先验证）。
4. `StepTwoView` 改为 `FigmaPageView` + `BlocksRenderer`。
5. 删除 `StepTwoView` 的 `isQuizBlockVisible` / `quizBlockIndices` / `deep watch`，删除两页重复样式与仅打日志的空回调。
6. 统一数据入口：两页 URL 改走 `getDataUrlWithVersion`（与 `DetailView`/`WordList` 对齐）。
7. 全量跑 `npm run type-check`、`npm run lint`、`npm run test`，现有视图测试转绿。

## 4. 验收标准

- `src/` 内不再存在硬编码 `/data/${...}` 的页面数据请求（`DialogText` / `PreQuizText` / `AdaptQuiz` 的遗留声明在后续批次处理，本期只保证两个 Step 页面）。
- 任一渲染器文件内不出现 `fetch`、`localStorage`、`apiService`、`useAuthStore`。
- `useQuizSession` 内不出现 `fetch`、`localStorage`、`useTracking`、组件 import。
- 修改 `quizInteraction.texts` 任一文案，无需改动任何 `.vue`。
- 未解锁内容在 DOM 中存在但 `v-show` 隐藏；切换解锁位不触发组件 `unmount`（用测试断言实例数不变）。
- 现有 `tests/views/StepTwoView.spec.ts`、`StepThreeView.spec.ts` 全绿。

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| 两页合并后 URL/埋点参数漂移 | `FigmaPageView` 的 `pageKey`、`wenId` 全部来自路由与 `pageRegistry`；埋点仍在视图层调用，不进入 session |
| 甲方改口导致配置膨胀 | `quizInteraction` 只允许「文案 / 显示 / 解锁」三类字段；新增诉求先判断能否归入现有三类 |
| 旧测试依赖内部实现 | 测试断言只针对对外行为（渲染结果、事件、快照字段），不断言内部方法名 |
| `options[0]` 错位数据仍存在 | adapter 做防御性丢弃并记 `invalid` 归零风险；根因在 Python 侧另开单 |
| 前端隐藏不等于防作弊 | 在文档与验收中明确；如需强约束，后续在 adapter 未解锁时不携带 `explanation` |
