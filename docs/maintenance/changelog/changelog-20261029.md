# 变更记录 2026-10-29

> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成；保存位置 `docs/maintenance/changelog/`，命名 `changelog-YYYYMMDD.md`。
>
> 本次变更是 Step One 生字注释悬浮层的完整闭环：先修「悬浮不出注释」，再把行为钉成测试，
> 最后按「所有 span 注释都要 100% 命中」的要求把命中率量到逐词级别，并补上生成侧漏标的两类词条。
>
> **发布事实（2026-10-29 上午复核）**：PR #204 把 `feature-1`（`19492d6`：`adc0108` 修复 + `03df798`
> 测试 + `cced00c` 合并）并入 `main`（合并提交 `850d97b`），6 项检查全绿；`Deploy Frontend to Aliyun OSS`
> （run `40685331968`）成功。生产 `https://www.classicalab.cn/` 的 `index.html` 返回
> `<meta name="build-id" content="850d97b">`，页脚同为「构建 850d97b」；异步产物 `StepView-dFGTMPYv.css`
> 里能看到新的 `.tooltip[data-v-6e1d0d9d]{…max-width:min(320px,100vw - 16px);position:fixed}`，
> `StepView-CXGa8ONp.js` 里能看到 `aria-live` / `data-follow-up` / `tooltipRef` 标记。
> CR-05 / CR-06 的匹配兜底**尚未上线**，等下一次 `main` 窗口。
>
> 时间戳备注：`19492d6` 等提交的 author/committer 时间显示 2026-10-28 晚，是落提交时本机时钟比真实时间慢约 13 小时
> （随后被系统对时纠正）。以 GitHub 服务端时间与本文件段落里的「2026-10-29 复核」为准。

| 变更编号       | 变更类型 | 影响范围                                                                                                                                                                                 | 变更描述                                                                                                                                                                                                                                                       | 测试状态               | 上线状态                       |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------ |
| CR-20261029-01 | fix      | `src/components/WordList.vue`、`src/utils/tooltipPosition.ts`、`src/adapters/wordListAdapter.ts`、`src/utils/adapterUtils.ts`                                                            | 生字注释浮层不显示的两个根因一起修：监听器从 `onMounted` 手动 `addEventListener` 搬到模板 `@mousemove`；节流只吃同步的 `PointerProbe` 快照，不再在 `setTimeout` 里读已失效的 `e.target`。长注释定位抽成纯函数（右下默认 / 放不下翻转 / 四边 clamp）配 CSS 限宽 | 已通过                 | 已上线（`850d97b`）            |
| CR-20261029-02 | test     | `src/components/__tests__/WordList.test.ts`、`src/adapters/__tests__/wordListAdapter.test.ts`、`src/utils/__tests__/adapterUtils.test.ts`、`src/utils/__tests__/tooltipPosition.test.ts` | 浮层行为补成一张拦得住回退的测试网（本轮 4 个文件 18 → 78 例）：加载态→就绪后悬浮必须生效、浮层文本 === `data-def`、节流尾调用不得抛 `TypeError`、空注释不显示、retry 同时重试两份 JSON、`data-follow-up` 仅有值才写                                           | 已通过                 | 已上线（`850d97b`）            |
| CR-20261029-03 | chore    | `feature-1` ← `main` 同步（`19492d6`）、PR #204                                                                                                                                          | 把 `main` 的 #203 合并提交同步进 `feature-1`，满足 `main` 分支保护 `required_status_checks.strict` 的要求；树与 `cced00c` 完全一致，零内容改动                                                                                                                 | 已通过（6 项检查）     | 已上线（`850d97b`）            |
| CR-20261029-04 | docs     | `figma-plugin/docs/step1-word-tooltip-plan.md`                                                                                                                                           | 方案加第十一节（v5）：命中率的两层含义、190/190 逐 span 实测的测法与两个坑（隐藏标签页定时器被钳 1s、视口 0×0 只能验命中不能验几何）                                                                                                                           | 不适用                 | 未上线（等下一次 `main` 窗口） |
| CR-20261029-05 | fix      | `src/utils/adapterUtils.ts`                                                                                                                                                              | 注释匹配改成三级降级：词条原文整串 → 剥括号注音（`鲦（tiáo）鱼`→「鲦鱼」，剥完不足两字的单字音注不标）→ ≥4 汉字短语允许两字之间夹最多 4 个非汉字字符整段命中；排序键由字符串长度改为汉字数                                                                     | 已通过                 | 未上线（等下一次 `main` 窗口） |
| CR-20261029-06 | test     | `src/utils/__tests__/adapterUtils.test.ts`、`src/adapters/__tests__/wordListAdapter.test.ts`                                                                                             | 三级策略逐级验证 + 「每条词条要么已成 span，要么在已登记的『标不了』清单里」双向断言（清单外的漏标、清单内的误标都会红）。span 总数 190 → 194                                                                                                                  | 已通过（全量 194/194） | 未上线（等下一次 `main` 窗口） |
| CR-20261029-07 | docs     | `docs/素材缺失清单.md`、`tasks/nightly-tasks.md`                                                                                                                                         | 素材清单加第十一节：4 条注定成不了 span 的词条（`食(sì)` 与三篇的篇名出处）连同「注音别写进 `word`、出处别放进 word_list」的诉求；台账补 step1 生字注释父功能与两个子功能                                                                                      | 不适用                 | 未上线（等下一次 `main` 窗口） |

## 变更明细

### CR-20261029-01 生字注释浮层的两个根因

- **变更类型**：fix（缺陷修复）
- **分支 / commit**：`feature/step1/word-tooltip` @ `adc0108`；`--no-ff` 并入 `feature-1`（`cced00c`）；PR #204 → `main`（`850d97b`）
- **现象**：线上 `/stepone/{id}` 正文里的 `.annotated-word` 悬浮完全没反应（122 个 span 逐个派发 `mousemove` 复现，全阴）。
- **根因 ①（绑定时序）**：`mousemove` 监听写在 `onMounted` 里，而正文容器 `div.article-content` 在 `v-if / v-else-if / v-else` 的加载分支内——组件挂载时两份 JSON 还在加载中，`contentRef` 恒为 `null`，原来的 `if (contentEl)` 静默跳过绑定，且没有任何 `watch` 补绑。监听留在被替换掉的旧节点上，处理器永不执行；同一个处理器里的 `search_word` 埋点也因此从未上报。改成模板 `@mousemove="onMouseMove"`，Vue 在元素创建时绑定、卸载时解绑，竞态从根上消失。
- **根因 ②（节流读失效事件）**：16ms 节流的 trailing 调用在 `setTimeout` 回调里读 `e.target`，而按 DOM 规范事件派发结束后 `event.target` 被置为 `null`，于是 `TypeError: Cannot read properties of null (reading 'classList')`——浮层既不更新也不收起。改成派发时**同步**抓一份 `PointerProbe`（x / y / isWord / word / def）交给节流器，trailing 只重放快照。
- **顺带的两处产品决策**：`cursor: help` 改回 `pointer`；`follow_up_questions` 只做结构预留（`data-follow-up` 仅非空才写属性），本轮不加追问 UI。

### CR-20261029-02 测试回退网

- **变更类型**：test
- **分支 / commit**：同分支第二个提交 `03df798`
- **要点**：happy-dom 不做布局，`getBoundingClientRect` 恒为 0，所以定位算法必须能注入视口与尺寸——这正是把定位抽成 `src/utils/tooltipPosition.ts` 纯函数的原因；单测里用 1366×768 与 375×667 两种视口对 0–视口全网格取点，断言 `isInsideViewport` 恒真。
- **组件测试的关键夹具**：`useDataLoader` 改成有状态的 `vi.hoisted` mock（`ctrl.wordList` / `ctrl.basicInfo` 两个切片），才能构造「先渲染加载态、再切到就绪态」这条根因路径；`data-testid` 一个都没改名。

### CR-20261029-03 main 同步与 PR #204

- **变更类型**：chore
- **为什么要先同步**：`main` 的分支保护里 `required_status_checks.strict = true`，要求 PR head 必须包含 base head。`07bf5be`（#203 的合并提交）不在 `feature-1` 的历史里，所以先做一次「只同步、不改内容」的合并 `19492d6`；它的树与 `cced00c` 逐字节相同（`b872244`），`git merge-tree` 复核过无冲突。
- **落提交的方式**：工作区是共享的且带着另一条会话的 103 个未提交改动，全程没有 `checkout` / `stash`；`github.com:443` 不通，所以提交经 Git Data API 落库，服务端返回的 commit sha 与本地 `commit-tree` 完全一致（`19492d651a13cfe656228f3e008b2d34fd318730`），算作一次字节级自检。

### CR-20261029-05 注释匹配的三级兜底

- **变更类型**：fix（生成侧漏标）
- **分支 / commit**：`feature/step1/annotation-matching` @ `5aad28b`（`src/utils/adapterUtils.ts` + 两份测试）
- **触发点**：线上量到 190/190 全命中之后，把 `public/data/word_list/WEN_xx.json` 逐条对着正文点，发现另有 9 条词条从未变成 span——悬浮层再稳也命中不到不存在的高亮点。两类成因：词条把拼音写进了 `word`（`鲦（tiáo）鱼` / `槽枥(lì)` / `外见(xiàn)` / `食(sì)`），长短语被标点或空格断开（`乃丹书帛曰陈胜王` 正文实为 `乃丹书帛曰"陈胜王"`）。
- **怎么保证不改坏**：一级命中就到此为止，一级就是原来的整串替换，所以现有标注产出的 HTML 逐字节不变。另外在临时测试里把改造前的算法原样重写一遍，对 4 篇真实课文把 span 的 `(文本, data-def)` 做成多重集合求差，确认只有「新增」没有「丢失」，验完即删该临时文件。
- **一处「变少」是修正不是回归**：WEN_01 的「陈」span 由 18 个变 17 个，少的那个在「陈胜王」内部，原先挂「古地名，今河南淮阳」属错标，现在整段归长短语。
- **故意不做**：`食(sì)` 剥完只剩单字，正文里 5 个「食」只有部分是 sì 读法，全量标注就是错标；篇名类（`马说` / `岳阳楼记` / `史记`）的释义是「选自《……》」，词形不在 `original_text` 里，不该由前端硬造悬停点。4 条一起登记进 `docs/素材缺失清单.md` 第十一节，并写了对应的双向断言。

### CR-20261029-04 / 07 文档

- `figma-plugin/docs/step1-word-tooltip-plan.md` 加第十一节（v5），含逐 span 实测的测法与坑：内嵌浏览器 surface 未 attach 时 `innerWidth/innerHeight` 为 0 且**隐藏标签页的 `setTimeout` 被钳到 1 秒**，因此改成「同步 spin 到 ≥45ms 后派发 `mousemove`（走 leading edge）+ 连续 `await Promise.resolve()` 冲刷 Vue」，全程不碰定时器；`MouseEvent` 必须 `bubbles: true` 才到得了容器上的监听器。几何（浮层实际位置 / 换行）在 0×0 视口下验不了，仍由 `tooltipPosition.test.ts` 的视口遍历断言兜住。
- `tasks/nightly-tasks.md` 补「Step One 生字注释悬浮层 (step1-word-tooltip)」父功能与两个子功能，并把分支 / commit / PR / 部署链记全。

## 本机校验（本轮起本机可以跑前端测试）

便携 Node 20.18.0（`nodejs.org/dist` 下载 + `tar` 解包）+ 仓库现成 `node_modules`（新工作树用 junction 指回去）：

- `vitest run` 全量 **194/194 通过**（含 `ClassPicker.test.ts` 27 例——上一轮记的「本机 happy-dom 与 CI 不一致」这次没有复现）
- `vue-tsc --build`：0 错误
- `eslint`（只跑改动文件，不带 `--fix`）：0 错误；`prettier --check` 通过（两份测试文件 `--write` 后复跑仍绿）
- CI：PR #204 的 6 项检查（`secret-scan` / `pipeline-test` / `figma-plugin-check` / `quality-check` / `backend-check` / `circular-check`）全绿后才合入
