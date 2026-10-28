# Step One 生字注释悬浮层方案

> 状态：v3 · 已落地（分支 `feature/step1/word-tooltip`）· 日期：2026-10-28
> 适用页面：`https://www.classicalab.cn/stepone/{id}`（StepView → WordList 组件）
> 说明：本文档写在 figma-plugin/docs 里随管线留档，落地代码在前端仓库 `src/components/WordList.vue`。
> **v2 更正**：v1 的核心判断（「展示层没实现，需要新写浮层」）是错的，浮层代码一直存在。v1 的两条实测证据站不住，v2 全部重做，原文保留在文末「附：v1 的错误与错在哪」。
> **v3 补充**：落地时发现第二个隐藏 bug（节流的 trailing 调用读已失效的 `e.target`），并把定位算法抽成可单测的纯函数，见 §3.4 与 §九。

## 一、结论先行

**注释浮层早就实现了，但它的事件监听器从来没绑上去过。**

`WordList.vue` 里有完整的 tooltip：模板有 `<div v-if="showTooltip" class="tooltip" role="tooltip">`，样式有 `.tooltip { position: fixed; ... }`，逻辑有 `handleMouseMove()` 读 `data-def` 并定位。问题在最底下这一句：

```js
// src/components/WordList.vue:272（线上 StepView-DmWKMyHo.js 反混淆后一致）
onMounted(async () => {
  const contentEl = contentRef.value
  if (contentEl) {
    contentEl.addEventListener('mousemove', throttledMouseMove)   // ← 挂载时 contentRef 是 null
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

| 课文 | 词条数 | `basic_meaning` 最长 | `follow_up_questions` 非空条数 |
|------|-------|--------------------|------------------------------|
| WEN_01 | 83 | 84 字（发闾左適戍渔阳） | 0 |
| WEN_02 | 17 | 53 字 | 0 |
| WEN_03 | 50 | **174 字**（岳阳楼出处注） | 0 |
| WEN_04 | 5 | 23 字 | 0 |

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
interface PointerProbe { x: number; y: number; isWord: boolean; word: string; def: string | null }
function probeFromEvent(e: MouseEvent): PointerProbe { /* 同步读 target/clientX/clientY */ }
function onMouseMove(e: MouseEvent) { throttledMouseMove(probeFromEvent(e)) }
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
- [ ] 悬停「发闾左適戍渔阳」→ 84 字注释在 320px 内换行显示，不横向溢出。
- [ ] WEN_03 里 174 字那条 → 限宽换行、四边 clamp、首帧不冲出版口。
- [ ] 页面最末段靠近下沿的词 → 浮层翻到光标上方，不压住「返回 / 继续」按钮。
- [ ] Network/Payload：`/api/track` 出现 `search_word` 事件，`properties.word` 为所悬停词，同一 session 不重复上报。
- [ ] 光标样式为 pointer，不再是问号。
- [ ] 122 个词逐个抽查 `data-def` 与 JSON `basic_meaning` 一致（脚本比对）。
- [ ] `follow_up_questions` 为空时 span 上**没有** `data-follow-up`；用单测塞一条非空数据 → 属性出现且被正确转义。
- [ ] `npm run type-check` + `npm run lint` + `npx vitest run src/` 全绿；新增 2 个单测（WordList 挂载后 mousemove 出浮层 / adapterUtils 的 data-follow-up 条件写入）。
- [ ] 详情页（`/detail/{id}`）行为不变——本轮不给它加注释。

## 七、工时

| 项 | 估时 |
|----|------|
| 3.1 根因修复（模板绑定 + 清理生命周期） | 15 分钟 |
| 3.2 长注释定位与样式 | 30 分钟 |
| §五 追问字段结构预留 + 单测 | 30 分钟 |
| 自测（WEN_01/WEN_03、埋点、lint/test） | 0.5 天 |
| 插件 / 后端 / 资源同步 | 0 |
| （可选）§四 单例浮层升级 | 1 天 |

## 八、遗留的产品问题（不在本轮）

1. 详情页要不要也显示生字注释？现在完全没有，若要则复用 `buildContentHtmlWithAnnotations`，但详情页同时有 AI 讲解面板，注释密度得先定。
2. WEN_05~08 的 `word_list` JSON 还没建，那 4 篇上线后是「整篇无高亮」，与本 bug 无关。

## 九、落地记录（v3 · 2026-10-28）

分支 `feature/step1/word-tooltip`（基线 `origin/feature-1`），改动文件：

| 文件 | 内容 |
|------|------|
| `src/components/WordList.vue` | 模板 `@mousemove` 绑定（删掉 `onMounted` 手动绑定与 `contentRef`）、`PointerProbe` 快照（§3.4）、`cursor: pointer`、`.tooltip` 限宽换行、`correctWithRealSize` 首帧校正；`throttle` 泛型签名 `any[]` → `never[]` |
| `src/utils/tooltipPosition.ts` | **新增**：`computeTooltipPosition` / `isInsideViewport` / `TOOLTIP_OFFSET` / `VIEWPORT_EDGE_GAP` 抽成无 DOM 依赖的纯函数，可单测 |
| `src/utils/adapterUtils.ts` | `WordAnnotation.followUpQuestions?` + `buildFollowUpAttribute`（空即不写属性） |
| `src/adapters/wordListAdapter.ts` | 透传 `w.follow_up_questions` |
| `src/utils/__tests__/adapterUtils.test.ts` | **新增** 7 例：基本形态、属性转义、`data-follow-up` 条件写入与过滤、174 字长注释不改结构 |
| `src/utils/__tests__/tooltipPosition.test.ts` | **新增** 7 例：默认右下、右翻左、下翻上、左上 clamp、1366×768 与 375×667 下光标扫过整页的视口包含性遍历、浮层高于视口的极端用例 |
| `src/components/__tests__/WordList.test.ts` | **新增** 4 例：注释词渲染、悬停出浮层且内容等于 `data-def`（根因回归）、`search_word` 上报一次、移出后收起（这条逼出了 §3.4） |
| `figma-plugin/docs/step1-word-tooltip-plan.md` | 本文档 |

与 §三 设计稿的差异只有一处：定位算法从 SFC 内部提到了 `src/utils/tooltipPosition.ts`，因为它需要被单测覆盖，而 happy-dom 不做布局、`getBoundingClientRect` 恒为 0，留在组件里就只能靠浏览器肉眼验。

验证环境与方法：本机 PATH 上没有 node/npm，本次下载了便携 Node v22.14.0 到 `%TEMP%\qodernode\`（在仓库外），并从 registry 取 happy-dom 15.7.4 解到 `node_modules/happy-dom`（`--no-save` 等效做法，`package.json` 与 `package-lock.json` 未改动；顺带发现 lock 里本来就没有 happy-dom 条目）。

- `vitest run` 我的 3 个测试文件：**18/18 通过**，无 unhandled error。
- `vue-tsc --build`：以上文件 **0 类型错误**。仓库整体还有 10 条 error，全部落在别人未提交或不在本分支的文件里（`src/components/charts/*`、`src/services/teacherDashboardService.ts`、`src/services/apiService.ts`、以及 `vitest.config.ts` 的 `provider: 'c8'`）。
- `eslint`（只跑我的文件，不带 `--fix`）：**0 error**。
- 全量 `vitest run` 有 2 个文件失败：`ClassPicker.test.ts`（9 例）与 `src/config/__tests__/poemAssets.test.ts`。前者相关文件在 `origin/feature-1` 与当前 HEAD 之间**零差异**，属基线红；后者是另一条会话尚未提交的新文件，不在本分支。两者都与本次改动无关。

未验证项（不要当成已通过）：

1. **浏览器线上实测没做**。会话登录态丢失，`/stepone/3` 跳到了 `/student-login?redirect=/stepone/3`，本轮没有为验证而去登录生产账号。长注释盒子的高度（174 字 ≈ 240px）是按 320px 限宽、约 21 字/行、行高 1.7 估算的，只作为定位算法的输入尺寸用在边界用例里，**不是排版断言**；84 字 ≈ 117px 那一档与 v1 在真页面注入原型实测过的数值一致，可以当校准点。上线后请按 §六 清单人工过一遍，重点是 WEN_03 那条。
2. `search_word` 埋点恢复只由单测证明（断言 `/api/track` 请求体），生产端有没有落库需另查。
3. 追问区是纯结构预留，`data-follow-up` 目前没有任何消费者，这是有意的。

## 附：v1 的错误与错在哪

留这段是为了别照抄 v1 的结论，也提醒后面的实测别再犯同样的探测错误。

1. **「CSSOM 里没有任何 tooltip 规则」——错。** 实际有一条 `.tooltip[data-v-ff123bb7]`。当时按 `.annotated-word` 关键词过滤规则，漏掉了同组件的 tooltip 规则。
2. **「派发 hover 事件后 body 子节点数不变 → 没绑逻辑」——探测方式无效。** 浮层不是 Teleport，是渲染在组件内部的 `.content-wrapper` 里，本来就不会增加 `body` 的直接子节点。另外 `new MouseEvent('mousemove')` 默认 `bubbles: false`，不冒泡到容器上的监听器，即使绑上了也不会触发。v2 改成 `bubbles: true` + 全量 `[class*="tooltip"]` 查询，才得到可信的阴性结果。
3. **「同一套注释在 StepView 和 DetailView 都有，只修一处会漏」——错。** DetailView 渲染纯文本，没有 `.annotated-word`。
4. **「不是扫描问题，是展示层没实现」——前半句对，后半句错。** 展示层实现了，是绑定的时序问题。
5. v1 注入原型（84 字 → 320×117）验证过的位置与尺寸本身仍然有效，只是结论从「要新写浮层」变成「长注释要限宽 clamp」。
