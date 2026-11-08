# Step One 生字注释悬浮层方案

> 状态：v4 · 测试补齐（分支 `feature/step1/word-tooltip`）· 日期：2026-10-28
> 适用页面：`https://www.classicalab.cn/stepone/{id}`（StepView → WordList 组件）
> 说明：本文档写在 figma-plugin/docs 里随管线留档，落地代码在前端仓库 `src/components/WordList.vue`。
> **v2 更正**：v1 的核心判断（「展示层没实现，需要新写浮层」）是错的，浮层代码一直存在。v1 的两条实测证据站不住，v2 全部重做，原文保留在文末「附：v1 的错误与错在哪」。
> **v3 补充**：落地时发现第二个隐藏 bug（节流的 trailing 调用读已失效的 `e.target`），并把定位算法抽成可单测的纯函数，见 §3.4 与 §九。
> **v4 补充**：单测从 18 例补到 78 例（含真实数据契约与变异验证），并修正三处从数据里读出来的事实错误，见 §十。

## 一、结论先行

**注释浮层早就实现了，但它的事件监听器从来没绑上去过。**

`WordList.vue` 里有完整的 tooltip：模板有 `<div v-if="showTooltip" class="tooltip" role="tooltip">`，样式有 `.tooltip { position: fixed; ... }`，逻辑有 `handleMouseMove()` 读 `data-def` 并定位。问题在最底下这一句：

```js
// src/components/WordList.vue:272（线上 StepView-DmWKMyHo.js 反混淆后一致）
onMounted(async () => {
  const contentEl = contentRef.value
  if (contentEl) {
    contentEl.addEventListener('mousemove', throttledMouseMove) // ← 挂载时 contentRef 是 null
  }
  await nextTick()
})
```

而渲染正文的那个 `<div ref="contentRef" class="article-content">` 在 `v-else` 分支里——组件挂载的那一刻 `loading` 为 true，正文节点还不存在，`contentRef.value === null`，`if` 静默跳过，而且**没有任何 watch 或数据就绪回调补绑**。两份 JSON 拉回来之后节点才出现，此时再也没有人给它绑监听。

后果：`mousemove` 处理器永不执行 → `showTooltip` 恒为 false → `v-if` 的浮层节点永不生成 → 学生看到的只有 `cursor: help` 那个问号指针。

**连带损失**：`search_word` 字词查询埋点写在同一个 `handleMouseMove` 里（WordList.vue:208-239），所以 step1 的 `search_word` 事件在生产环境一次都没上报过。修完浮层，埋点自动恢复。

**改动范围**：只改 `WordList.vue`（约 25 行）+ 追问字段预留（约 8 行，见 §五）。**不动插件、不动后端、不重新同步任何资源、不新增组件文件。**

## 二、现状事实（2026-10-28 于线上 `/stepone/1` 实测）

数据侧（通的）：

| 课文   | 词条数 | `basic_meaning` 最长        | `follow_up_questions` 非空条数 |
| ------ | ------ | --------------------------- | ------------------------------ |
| WEN_01 | 83     | 84 字（发闾左適戍渔阳）     | 0                              |
| WEN_02 | 17     | 53 字                       | 0                              |
| WEN_03 | 50     | **174 字**（岳阳楼出处注）¹ | 0                              |
| WEN_04 | 5      | 23 字                       | 0                              |

¹ 这条 174 字是**数据里的最长**，不是**页面上的最长**：它的词形是「岳阳楼记」，不在 `original_text` 里，适配器匹配不到 ⇒ 页面上永远出不来。页面实际最长的是 WEN_01 那 84 字，详见 §十·事实修正。

- `/data/word_list/WEN_01.json` → 200，字段固定 `text_id` / `word` / `basic_meaning` / `follow_up_questions`；WEN_05~08 为 404（尚未创建）。
- 页面上 `.article-content .annotated-word` 共 **122 个**，逐个 `data-def` 有正确内容（本次抽查「燕雀安知鸿鹄之志哉」→ 44 字注释）。

渲染侧（关键三条，全部可复现）：

1. **线上 CSSOM 里确实有 tooltip 样式**——`document.styleSheets` 全量遍历命中
   `.tooltip[data-v-ff123bb7] { background: var(--color-primary); color: var(--color-white); ... }`
   与 `.article-content[data-v-ff123bb7] .annotated-word { ... cursor: help !important }` 同哈希。
   → scoped 哈希相同，证明线上跑的就是这个 `WordList.vue`，浮层样式和模板都在包里。
2. **派发合法事件后浮层仍不出现**：对 `.annotated-word` 派发 `new MouseEvent('mousemove', { bubbles: true, clientX, clientY })`（必须 bubbles，因为监听绑在父级 `.article-content` 上），等 150ms 后全量查 `[class*="tooltip"], [role="tooltip"]` → **0 个节点**。
3. **线上 chunk 源码印证**：`StepView-DmWKMyHo.js` 里能搜到
   `let z=N(L,Fe); return g(async()=>{let e=s.value; e&&e.addEventListener('mousemove',z), await m()}), l(()=>{...z.cancel()})`
   —— `onMounted` 里就一次 `s.value &&` 守卫，`watch` 补绑不存在。

其他：无第三方 UI 库（window 上无 ElementPlus/Tippy）；祖先链 `overflow` 全 `visible`、无 `transform`/`filter`，浮层不会被裁剪；已加载样式表无 `max-width` 媒体查询，桌面优先；正文 `font-size: clamp(1rem, 2.2vw, 1.5rem)`（实测 18.28px / 行高 32.9px）。

**DetailView 不在范围内**：`src/views/DetailView.vue:96-100` 渲染的是 `<p>{{ para }}</p>` 纯文本，压根没走 `buildContentHtmlWithAnnotations`，页面上没有 `.annotated-word`，也就没有可悬浮的注释。v1 说「同一套注释在两个视图都有，只修一处会漏」——错，详情页从来就没有注释。要不要给详情页也上注释是产品决定，见 §六。

## 三、修复方案

### 3.1 根治：把监听器从生命周期里搬到模板上

```vue
<div
  ref="contentRef"
  class="article-content"
  v-html="adaptedData.basicInfo.contentHtml"
  @mousemove="throttledMouseMove"
></div>
```

Vue 在元素创建时绑定、卸载时自动解绑，`v-if/v-else` 什么时候出现都能绑上，竞态从根上消失。同时删掉 `onMounted` 整块（`await nextTick()` 本来也是空转）和 `onUnmounted` 里的 `removeEventListener`，只保留 `throttledMouseMove.cancel()` 清 trailing timer。

顺带把手写 DOM 监听换成模板绑定后，容器上不再有游离监听器，词条数不影响监听器数量（仍是 1 个委托在容器上）。

### 3.2 长注释（84 / 174 字）打磨

现有 `.tooltip` 有两个真实问题，v1 关于「CSS 伪元素撑破容器」的担忧不成立，但「长注释体验」确实要处理：

- `position: fixed` + 只设 `left` + **无 `max-width`** → 收缩适配宽度按「视口宽 - left」计算，174 字会摊成一条接近整屏宽的朱红底块，压掉整个正文。
- 首次显示没有真实尺寸，回退到 `TOOLTIP_ESTIMATED_WIDTH/HEIGHT = 200×60` 做翻转判断 → 长注释首帧会溢出视口，靠下一次 mousemove 才纠正。

改法（原地，不引新组件）：

```css
.tooltip {
  max-width: min(320px, calc(100vw - 16px));
  overflow-wrap: break-word;
  white-space: normal;
  text-align: left;
}
```

`handleMouseMove` 里把定位算路抽成 `computePosition(mx, my, { width, height })`：右下越界翻到左上，四边各留 8px clamp；显示后 `await nextTick()` 用 `tooltipRef` 真实 rect 再校正一次，消掉首帧抖动。`pointer-events: none` 保留（不抢鼠标），所以长注释靠跟随光标即可读完，不需要钉住——**v1 设计的点击钉住 / Esc / 40vh 滚动这一整套，在修好绑定之后不是必需的**，留作后续可选升级（§四）。

### 3.3 已定的两个决策

- `cursor: help` → **`cursor: pointer`**（用户 2026-10-28 确认「改」）。那个问号指针会继续误导人，改掉。
- `follow_up_questions` → **本轮只做结构预留，不做 UI**（用户确认「先做结构预留」），预留方式见 §五。

### 3.4 落地时发现的第二个 bug：节流的 trailing 调用拿到的是失效事件

绑上去之后才发现，原来的 `handleMouseMove(e: MouseEvent)` 也不能直接交给节流器：

```js
// throttle 的 trailing 分支（WordList.vue）
timer = setTimeout(() => { ...; if (lastArgs) fn.apply(this, lastArgs) }, remaining)
```

`mousemove` 在 16ms 内的第二次事件不会立即执行，而是把**同一个 MouseEvent 对象**存进 `lastArgs`，等定时器回调再执行。而按 DOM 规范，`dispatchEvent` 结束后会清空事件的 `target`——所以 trailing 那次 `e.target` 是 `null`，`target.classList.contains(...)` 直接抛
`TypeError: Cannot read properties of null (reading 'classList')`。

后果是：鼠标停在词上不动、或在 16ms 窗口内快速划过，浮层既不更新也不收起，控制台报错。生产环境因为根因 3.1（监听器压根没绑）从没跑到这段代码，所以这个 bug 一直被掩盖。

**修法**：在事件派发的同步阶段抓一个纯数据快照，再交给节流器。

```ts
interface PointerProbe {
  x: number
  y: number
  isWord: boolean
  word: string
  def: string | null
}
function probeFromEvent(e: MouseEvent): PointerProbe {
  /* 同步读 target/clientX/clientY */
}
function onMouseMove(e: MouseEvent) {
  throttledMouseMove(probeFromEvent(e))
}
```

`handleMouseMove(probe: PointerProbe)` 只碰纯数据，trailing 延迟执行也安全。模板绑 `@mousemove="onMouseMove"`。
这一条是单测「鼠标移到正文空白处 → 浮层收起」逼出来的：那个用例等 40ms 让 trailing 落地，直接把 `null` 的 `classList` 崩了出来。

## 四、可选升级：单例浮层 + 事件委托（v1 的 C 方案，本轮不做）

如果后续要求「鼠标移进浮层里滚动 174 字注释」「点开后能钉住对照原文读」，再上这套；它和 §三 不冲突，是在 §三 之上的增强，不是替代。约 120 行：`src/components/common/WordTooltip.vue`（`<Teleport to="body">`，`max-height: 40vh` 滚动）+ `src/composables/useWordTooltip.ts`（120ms 显示延迟、80ms 隐藏延迟、下翻上、左右 clamp、点击钉住、Esc/外点收起、触屏 tap）。

事件委托可行性已实测：对 `.article-content` 用 `addEventListener('pointerenter', fn, true)`（capture）能收到子节点上派发的 `pointerenter`（该事件不冒泡，靠捕获阶段穿透）；`pointerover` 冒泡、`mouseover` capture 同样各命中 1 次。选 capture 版，因为它不会在词与词之间的文本节点上反复触发。

## 五、追问区结构预留（本轮交付的一部分）

原则：**数据结构走通，DOM 和 UI 零变化**。当前 4 篇课文 `follow_up_questions` 全是空数组，所以预留必须是「空即不写」，不能给 122 个 span 各挂一个空属性。

1. `src/utils/adapterUtils.ts`：注释入参类型扩为
   `Array<{ word: string; meaning: string; followUpQuestions?: string[] }>`（可选字段，`databaseAdapter` 现有调用零影响）。
2. `src/adapters/wordListAdapter.ts`：`annotations` 里带上 `followUpQuestions: w.follow_up_questions ?? []`。
3. 生成 span 时仅在非空时追加属性：
   `<span class="annotated-word" data-def="…" data-follow-up="${escapeHtml(JSON.stringify(list))}">`
   → 今天输出与线上**逐字节相同**；将来美术/后端填了数据，DOM 自动带上，无需再改渲染层。
4. `WordList.vue` 的 `handleMouseMove` 里留一条注释标明追问 UI 的接入点（读 `target.dataset.followUp`），本轮不加无人消费的 ref——按仓库 R16 的原则，不留 dead state。

## 六、验收清单

- [ ] 悬停任意生词（如「阳夏」）→ 出现朱红底浮层，内容与 `data-def` 一致；DevTools 里 `.article-content` 上能看到 `mousemove` 监听器（**这是根因项，必须先过**）。
- [ ] 悬停「发闾左適戍渔阳」→ 84 字注释在 320px 内换行显示，不横向溢出（**这是页面上实际能渲染出来的最长注释**，见 §十·事实修正）。
- [ ] 数据里 174 字那条（WEN_03 的「岳阳楼记」）词形不在原文中，页面上出不来；若后续素材把它的词形补进原文，需重验限宽换行与四边 clamp。
- [ ] 页面最末段靠近下沿的词 → 浮层翻到光标上方，不压住「返回 / 继续」按钮。
- [ ] Network/Payload：`/api/track` 出现 `search_word` 事件，`properties.word` 为所悬停词，同一 session 不重复上报。
- [ ] 光标样式为 pointer，不再是问号。
- [ ] 122 个词逐个抽查 `data-def` 与 JSON `basic_meaning` 一致 —— 已由 §十 的真实数据契约单测覆盖，线上只抽查几个即可。
- [ ] `follow_up_questions` 为空时 span 上**没有** `data-follow-up`；用单测塞一条非空数据 → 属性出现且被正确转义。
- [ ] `npm run type-check` + `npm run lint` + `npx vitest run src/` 全绿；单测覆盖见 §十（本轮从 18 例扩到 78 例）。
- [ ] 详情页（`/detail/{id}`）行为不变——本轮不给它加注释。

## 七、工时

| 项                                      | 估时    |
| --------------------------------------- | ------- |
| 3.1 根因修复（模板绑定 + 清理生命周期） | 15 分钟 |
| 3.2 长注释定位与样式                    | 30 分钟 |
| §五 追问字段结构预留 + 单测             | 30 分钟 |
| 自测（WEN_01/WEN_03、埋点、lint/test）  | 0.5 天  |
| 插件 / 后端 / 资源同步                  | 0       |
| （可选）§四 单例浮层升级                | 1 天    |

## 八、遗留的产品问题（不在本轮）

1. 详情页要不要也显示生字注释？现在完全没有，若要则复用 `buildContentHtmlWithAnnotations`，但详情页同时有 AI 讲解面板，注释密度得先定。
2. WEN_05~08 的 `word_list` JSON 还没建，那 4 篇上线后是「整篇无高亮」，与本 bug 无关。

## 九、落地记录（v3 · 2026-10-28）

> 下面这张表与「验证结果」记录的是 v3 那一版（18 例）。v4 把测试补到 78 例并修正了几处事实错误，见 §十；两处冲突以 §十 为准。

分支 `feature/step1/word-tooltip`（基线 `origin/feature-1`），改动文件：

| 文件                                           | 内容                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/WordList.vue`                  | 模板 `@mousemove` 绑定（删掉 `onMounted` 手动绑定与 `contentRef`）、`PointerProbe` 快照（§3.4）、`cursor: pointer`、`.tooltip` 限宽换行、`correctWithRealSize` 首帧校正；`throttle` 泛型签名 `any[]` → `never[]` |
| `src/utils/tooltipPosition.ts`                 | **新增**：`computeTooltipPosition` / `isInsideViewport` / `TOOLTIP_OFFSET` / `VIEWPORT_EDGE_GAP` 抽成无 DOM 依赖的纯函数，可单测                                                                                 |
| `src/utils/adapterUtils.ts`                    | `WordAnnotation.followUpQuestions?` + `buildFollowUpAttribute`（空即不写属性）                                                                                                                                   |
| `src/adapters/wordListAdapter.ts`              | 透传 `w.follow_up_questions`                                                                                                                                                                                     |
| `src/utils/__tests__/adapterUtils.test.ts`     | **新增** 7 例：基本形态、属性转义、`data-follow-up` 条件写入与过滤、174 字长注释不改结构                                                                                                                         |
| `src/utils/__tests__/tooltipPosition.test.ts`  | **新增** 7 例：默认右下、右翻左、下翻上、左上 clamp、1366×768 与 375×667 下光标扫过整页的视口包含性遍历、浮层高于视口的极端用例                                                                                  |
| `src/components/__tests__/WordList.test.ts`    | **新增** 4 例：注释词渲染、悬停出浮层且内容等于 `data-def`（根因回归）、`search_word` 上报一次、移出后收起（这条逼出了 §3.4）                                                                                    |
| `figma-plugin/docs/step1-word-tooltip-plan.md` | 本文档                                                                                                                                                                                                           |

与 §三 设计稿的差异只有一处：定位算法从 SFC 内部提到了 `src/utils/tooltipPosition.ts`，因为它需要被单测覆盖，而 happy-dom 不做布局、`getBoundingClientRect` 恒为 0，留在组件里就只能靠浏览器肉眼验。

验证环境与方法：本机 PATH 上没有 node/npm，本次下载了便携 Node v22.14.0 到 `%TEMP%\qodernode\`（在仓库外），并从 registry 取 happy-dom 15.7.4 解到 `node_modules/happy-dom`（`--no-save` 等效做法，`package.json` 与 `package-lock.json` 未改动；顺带发现 lock 里本来就没有 happy-dom 条目）。

- `vitest run` 我的 3 个测试文件：**18/18 通过**，无 unhandled error。
- `vue-tsc --build`：以上文件 **0 类型错误**。仓库整体还有 10 条 error，全部落在别人未提交或不在本分支的文件里（`src/components/charts/*`、`src/services/teacherDashboardService.ts`、`src/services/apiService.ts`、以及 `vitest.config.ts` 的 `provider: 'c8'`）。
- `eslint`（只跑我的文件，不带 `--fix`）：**0 error**。
- 全量 `vitest run` 有 2 个文件失败：`ClassPicker.test.ts`（9 例）与 `src/config/__tests__/poemAssets.test.ts`。前者相关文件在 `origin/feature-1` 与当前 HEAD 之间**零差异**，属基线红；后者是另一条会话尚未提交的新文件，不在本分支。两者都与本次改动无关。

未验证项（不要当成已通过）：

1. **浏览器线上实测没做**。会话登录态丢失，`/stepone/3` 跳到了 `/student-login?redirect=/stepone/3`，本轮没有为验证而去登录生产账号。测试里 320×240 那一档是按「320px 限宽、约 21 字/行、行高 1.7」推演的**上界输入**，只用来验定位算法的视口性质，**不是排版断言**；84 字 ≈ 117px 那一档与 v1 在真页面注入原型实测过的数值一致，可以当校准点。上线后请按 §六 清单人工过一遍，重点是 WEN_01 那条 84 字。
2. `search_word` 埋点恢复只由单测证明（断言 `/api/track` 请求体），生产端有没有落库需另查。
3. 追问区是纯结构预留，`data-follow-up` 目前没有任何消费者，这是有意的。

## 十、测试补齐（v4 · 2026-10-28，同一分支的第二个提交）

§九 那三个测试文件只覆盖了「根因回归」和「属性条件写入」，本轮把它补成一套能拦住回退的网：18 例 → 78 例，新增一个适配器测试文件。

| 文件                                             | 例数        | 覆盖点                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/__tests__/WordList.test.ts`      | 4 → **25**  | 三态渲染（loading / error+点「重试」拉起两个数据源 / 空态）、两份数据都到齐才出正文、**数据到达后**才创建的正文节点照样能触发浮层（根因主用例）、释义为空的条目被适配器丢掉所以不存在"点了没反应"的生词、`role`/`aria-live`、事件不冒泡不触发、空白处收起、**节流窗口内连发 24 次事件**（§3.4 的回归锁）、交替悬停切内容、估算定位 + 实测校正（`getBoundingClientRect` 打桩后翻到左上）、卸载不抛错、埋点字段齐全 / 同词只报一次 / 换词再报 / 上报失败不影响浮层 / 非生词不报、样式契约三条 |
| `src/adapters/__tests__/wordListAdapter.test.ts` | **新增 24** | 过滤缺字段、词长降序、长词吃掉短词、`basicInfo` 透传、每次命中一个 span、弯引号↔直引号匹配、`removeSlashes`+`wrapParagraphs` 由适配器固定开启、`data-follow-up` 条件写入、无注释时退化为纯转义；**真实数据契约**：读 `public/data/word_list` + `text_basic_info` 里成对的 `WEN_xx.json`，断言条目齐字段、每个 span 的 `data-def` 非空且不含裸引号/尖括号、解码后逐字等于某条原始释义、原文里独立出现的词都有 span、不残留 `__ANNOTATION_` 占位符、`data-follow-up` 条数与数据一致           |
| `src/utils/__tests__/adapterUtils.test.ts`       | 7 → **22**  | 上面之外补：长短词叠加顺序、content 空、annotations 为 null/undefined/[]、`removeSlashes` 只吃半角 `/`、`\n`/`\n\n` 只在显式开启时转换、三选项叠加的最终 HTML 逐字节断言、词形与释义同时带标签的 XSS、幂等；以及 `escapeHtml`/`escapeRegex`/`normalizeQuotes`/`getSafe` 四个基础函数的边界（非字符串入参、falsy 既有值不回退默认值）                                                                                                                                                        |
| `src/utils/__tests__/tooltipPosition.test.ts`    | 7           | 未增删用例，只把 320×240 那一档的来源说明改准（见下面的事实修正）                                                                                                                                                                                                                                                                                                                                                                                                                           |

样式那两条是**源码级断言**（读 `WordList.vue` 的 `<style>` 块正则匹配）：scoped CSS 在单测里不会真的应用到 DOM，但 `cursor: help → pointer` 和 `.tooltip` 限宽换行是这轮的两个产品决策，不该被无声改回去。

### 事实修正（写测试时读真实数据发现的）

1. **174 字那条注释在页面上渲染不出来。** 它挂在 WEN_03 的「岳阳楼记」词条上，而 `original_text` 里没有「岳阳楼记」这个词形 ⇒ 适配器根本匹配不到。页面上实际最长的是 WEN_01「发闾左適戍渔阳」84 字、WEN_03「滕子京谪守巴陵郡」78 字。定位与限宽照做（84 字已足够长），但 §六 里那条"WEN_03 174 字人工验"删掉。
2. WEN_03 的「其必曰 "先天下之忧而忧，后天下之乐而乐" 乎」也没命中：词形里带空格，原文不带。属素材侧，不是渲染侧。
3. 真实 `original_text` 用的是**半角** `/` 作句读分隔符，`removeSlashes` 关掉就会丢 span（变异验证时观察到 4 个词受影响），所以适配器那两个选项不是可选装饰。
4. 各篇渲染出的 span 数：WEN_01 **122**、WEN_02 14、WEN_03 49、WEN_04 5。WEN_01 的 122 与 §二 线上实测的 122 个 `.annotated-word` 对上，算是代码与线上的一次交叉验证。
5. `normalizeQuotes` 的 JSDoc 把 `『』` 写成映射到 `"`，实现是映射到 `'`。本轮只改注释对齐实现，**行为未动**。

### 这套测试确实拦得住回退

- 把 `src/components/WordList.vue` 换回修复前的 blob（`onMounted` 手动绑定 + 直接把 `MouseEvent` 交给节流器）跑测试：**6 例失败**，并复现 `TypeError: Cannot read properties of null (reading 'classList')` —— 正是 §3.4 那条。
- 把适配器里的 `removeSlashes: true` 和 `followUpQuestions` 透传改掉：**4 例失败**（含一条真实数据契约）。
- 两次改完都按 blob 原样还原，`git hash-object` 校验一致。

### 校验结果

- `vitest run` 我的 4 个文件：**78/78 通过**，无 unhandled error。
- `vue-tsc --build`：我的文件 **0 类型错误**；仓库其余 10 条仍在别人的文件里（`charts/*`、`services/*`、`vitest.config.ts` 的 `provider: 'c8'`），与本轮无关。
- `eslint`（仅我的文件，不带 `--fix`）：**0 error**；`prettier --check` 通过。
- `oxlint` 报 `adapterUtils.ts` 里 `debugWarn` 导入未使用 —— 基线既有（`51da712^` 就在），不属本轮，留给下一次顺手清。
- 全量 `vitest run` 本地 164 例里 9 例失败，全在 `ClassPicker.test.ts`，原因是本机 happy-dom 版本与 CI 不一致（CI 上该文件是绿的），与本轮无关。

### 仍未覆盖（不要当成已通过）

1. 真实浏览器布局：happy-dom 不做布局，`getBoundingClientRect` 全是 0，浮层的宽高、`max-width` 实际生效与否只能靠源码断言 + 线上肉眼看。
2. `.tooltip` 的 `position: fixed` 坐标写进 `style` 属性这一层验了，但滚动容器、缩放、页面缩放比下的表现没验。
3. `search_word` 是否落库、追问区有没有消费者（本来就没有）、WEN_05~08 无数据。
4. "卸载时不抛错"那条只是把生命周期契约钉住，`cancel()` 缺失时它没有独立的失败信号——真正兜住 §3.4 的是那条 24 连发用例。

## 十一、命中率的两层含义与逐 span 实测（v5 · 2026-10-29）

PR #204 已把 v3/v4 的修复送上 `main`（`850d97b`，`Deploy Frontend to Aliyun OSS` 成功，线上 `meta[name=build-id]` 与页脚都是 `850d97b`，`StepView` 产物里能看到 `max-width:min(320px,100vw - 16px);position:fixed` 与 `aria-live` / `data-follow-up` 标记）。这一节回答的是「**所有 span 注释都要 100% 命中**」这句话——它其实有两层，第一层做到了，第二层是生成侧的问题。

### 11.1 第一层：已经成 span 的词，悬浮必须出注释 —— 190/190

线上 4 篇课文逐个验过，不是抽查：

| 课文         | `.annotated-word` 数 | 悬浮命中且文本 === `data-def` | 移到非词节点即收起 |
| ------------ | -------------------- | ----------------------------- | ------------------ |
| `/stepone/1` | 122                  | 122                           | 抽查 6 次全对      |
| `/stepone/2` | 14                   | 14                            | —                  |
| `/stepone/3` | 49                   | 49                            | 抽查 2 次全对      |
| `/stepone/4` | 5                    | 5                             | —                  |
| 合计         | **190**              | **190（100%）**               | ✅                 |

测法记清楚，免得下次误判成 bug：内嵌浏览器 surface 未 attach，`window.innerWidth/innerHeight` 全是 0，且**隐藏标签页里 `setTimeout` 被钳到 1 秒**——第一版脚本用 `await sleep(45)` 逐个等，15 秒只跑到第 15 个词，超时后还留下一个假阴性（第 7 个词「怅恨」读到的是上一个词的浮层，因为那一拍走的是节流的 trailing 分支，而 trailing 的定时器正被钳着）。改成**同步 spin 到 ≥45ms 再派发 `mousemove`（走 leading edge，处理器同步写完状态）+ 连续 6 个 `await Promise.resolve()` 让 Vue 冲刷**，全程不碰定时器，一遍跑完 122 个词。`MouseEvent` 必须带 `bubbles: true`（监听在容器上），和第十节那条 24 连发用例同一个道理。

没能同时验的是**几何**：视口 0×0 时布局退化，`getBoundingClientRect` 拿不到真实宽高，浮层的实际位置/换行只能靠 `tooltipPosition.test.ts` 的视口遍历断言 + 上线后肉眼看。线上现存最长注释 84 字（WEN_01），在单测覆盖的 `LONG_NOTE_84` 之内。

### 11.2 第二层：有注释却压根没生成 span —— 9 条，5 补 4 记

100% 命中只保证「能悬停的都悬得起来」。把 `public/data/word_list/WEN_xx.json` 逐条对着正文点，另有 9 条词条从未变成 span，鼠标再准也命中不了，分三类：

- **括号注音**（`鲦（tiáo）鱼`、`槽枥(lì)`、`外见(xiàn)`、`食(sì)`）：词条里写死了拼音，正文里没有那对括号；
- **标点/空格断开**（`乃丹书帛曰陈胜王` 正文实为 `乃丹书帛曰"陈胜王"`；`其必曰 "先天下之忧而忧，后天下之乐而乐" 乎`）：字序对得上，中间夹着引号逗号空格；
- **篇名类出处**（`马说`、`岳阳楼记`、`史记`）：释义其实是「选自《……》」，`word` 是篇名，正文 `original_text` 里没这个词形。

已定的处理（用户拍板「只做安全的一半」）：`buildContentHtmlWithAnnotations` 改成逐级降级的三级匹配——① 词条原文整串（历史行为，命中即止，所以现有 HTML 逐字节不变）；② 剥掉括号注音后再匹配，span 用正文里的写法，`data-def` 仍是整条释义；③ 汉字数 ≥4 的长短语允许两个字之间夹最多 4 个非汉字字符整段命中。排序键同时从字符串长度改成汉字数（带注音的词条原始长度虚高，按汉字数排才是正文里的实际占比，长语整段优先于其中的短词）。

**故意不做的两件事**：`食(sì)` 剥完只剩单字，正文里 5 个「食」只有部分是 sì 读法，全标就是错标；篇名类不该由前端硬造悬停点。这 4 条已登记到 `docs/素材缺失清单.md` 第十一节，并写了双向断言（清单外的漏标会红，清单里的条目被误标也会红）。

结果：span 总数 190 → 194（新出 鲦鱼 / 槽枥 / 外见 / 两段长短语）。有一处「变少」是修正不是回归——WEN_01 的「陈」从 18 个 span 变 17 个，少的那个在「陈胜王」内部，原先挂着「古地名，今河南淮阳」本就是错标，现在整段归长短语。

### 11.3 新旧算法逐 span 对照的做法

改匹配规则最怕「顺手改坏了本来对的标注」。做法是在临时测试里把**改造前的算法原样重写一遍**（排序键 + 整串替换 + 占位符回填，约 15 行），对 4 篇真实课文同时跑新旧两版，把 span 的 `(文本, data-def)` 做成多重集合求差：要求 `removed` 恒为空、`added` 逐条肉眼过。本轮验证完即删掉该临时文件，但它值得下次复用——比「断言条数等于某个魔数」结实得多，素材继续补也不会脆。

## 附：v1 的错误与错在哪

留这段是为了别照抄 v1 的结论，也提醒后面的实测别再犯同样的探测错误。

1. **「CSSOM 里没有任何 tooltip 规则」——错。** 实际有一条 `.tooltip[data-v-ff123bb7]`。当时按 `.annotated-word` 关键词过滤规则，漏掉了同组件的 tooltip 规则。
2. **「派发 hover 事件后 body 子节点数不变 → 没绑逻辑」——探测方式无效。** 浮层不是 Teleport，是渲染在组件内部的 `.content-wrapper` 里，本来就不会增加 `body` 的直接子节点。另外 `new MouseEvent('mousemove')` 默认 `bubbles: false`，不冒泡到容器上的监听器，即使绑上了也不会触发。v2 改成 `bubbles: true` + 全量 `[class*="tooltip"]` 查询，才得到可信的阴性结果。
3. **「同一套注释在 StepView 和 DetailView 都有，只修一处会漏」——错。** DetailView 渲染纯文本，没有 `.annotated-word`。
4. **「不是扫描问题，是展示层没实现」——前半句对，后半句错。** 展示层实现了，是绑定的时序问题。
5. v1 注入原型（84 字 → 320×117）验证过的位置与尺寸本身仍然有效，只是结论从「要新写浮层」变成「长注释要限宽 clamp」。
