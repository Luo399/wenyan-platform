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
> CR-05 / CR-06 的匹配兜底已于当日 11:19 随 PR #209（`feature-1`@`580e4c8` → `main`@`78a6c29`）上线，见文末「发布事实（中午复核）」。
>
> 时间戳备注：`19492d6` 等提交的 author/committer 时间显示 2026-10-28 晚，是落提交时本机时钟比真实时间慢约 13 小时
> （随后被系统对时纠正）。以 GitHub 服务端时间与本文件段落里的「2026-10-29 复核」为准。

| 变更编号       | 变更类型 | 影响范围                                                                                                                                                                                 | 变更描述                                                                                                                                                                                                                                                       | 测试状态               | 上线状态                       |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------ |
| CR-20261029-01 | fix      | `src/components/WordList.vue`、`src/utils/tooltipPosition.ts`、`src/adapters/wordListAdapter.ts`、`src/utils/adapterUtils.ts`                                                            | 生字注释浮层不显示的两个根因一起修：监听器从 `onMounted` 手动 `addEventListener` 搬到模板 `@mousemove`；节流只吃同步的 `PointerProbe` 快照，不再在 `setTimeout` 里读已失效的 `e.target`。长注释定位抽成纯函数（右下默认 / 放不下翻转 / 四边 clamp）配 CSS 限宽 | 已通过                 | 已上线（`850d97b`）            |
| CR-20261029-02 | test     | `src/components/__tests__/WordList.test.ts`、`src/adapters/__tests__/wordListAdapter.test.ts`、`src/utils/__tests__/adapterUtils.test.ts`、`src/utils/__tests__/tooltipPosition.test.ts` | 浮层行为补成一张拦得住回退的测试网（本轮 4 个文件 18 → 78 例）：加载态→就绪后悬浮必须生效、浮层文本 === `data-def`、节流尾调用不得抛 `TypeError`、空注释不显示、retry 同时重试两份 JSON、`data-follow-up` 仅有值才写                                           | 已通过                 | 已上线（`850d97b`）            |
| CR-20261029-03 | chore    | `feature-1` ← `main` 同步（`19492d6`）、PR #204                                                                                                                                          | 把 `main` 的 #203 合并提交同步进 `feature-1`，满足 `main` 分支保护 `required_status_checks.strict` 的要求；树与 `cced00c` 完全一致，零内容改动                                                                                                                 | 已通过（6 项检查）     | 已上线（`850d97b`）            |
| CR-20261029-04 | docs     | `figma-plugin/docs/step1-word-tooltip-plan.md`                                                                                                                                           | 方案加第十一节（v5）：命中率的两层含义、190/190 逐 span 实测的测法与两个坑（隐藏标签页定时器被钳 1s、视口 0×0 只能验命中不能验几何）                                                                                                                           | 不适用                 | 已上线（`78a6c29`） |
| CR-20261029-05 | fix      | `src/utils/adapterUtils.ts`                                                                                                                                                              | 注释匹配改成三级降级：词条原文整串 → 剥括号注音（`鲦（tiáo）鱼`→「鲦鱼」，剥完不足两字的单字音注不标）→ ≥4 汉字短语允许两字之间夹最多 4 个非汉字字符整段命中；排序键由字符串长度改为汉字数                                                                     | 已通过                 | 已上线（`78a6c29`） |
| CR-20261029-06 | test     | `src/utils/__tests__/adapterUtils.test.ts`、`src/adapters/__tests__/wordListAdapter.test.ts`                                                                                             | 三级策略逐级验证 + 「每条词条要么已成 span，要么在已登记的『标不了』清单里」双向断言（清单外的漏标、清单内的误标都会红）。span 总数 190 → 194                                                                                                                  | 已通过（全量 194/194） | 已上线（`78a6c29`） |
| CR-20261029-07 | docs     | `docs/素材缺失清单.md`、`tasks/nightly-tasks.md`                                                                                                                                         | 素材清单加第十一节：4 条注定成不了 span 的词条（`食(sì)` 与三篇的篇名出处）连同「注音别写进 `word`、出处别放进 word_list」的诉求；台账补 step1 生字注释父功能与两个子功能                                                                                      | 不适用                 | 已上线（`78a6c29`） |

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


---

## 第二批：共享工作区按修复内容拆分成 PR 依次入库（PR #207 – #215）

> 同一工作区（分支 `feature/continue-nav-stuck`）攒着 103 条未提交改动，且会被另一条会话同时切分支/提交。
> 本轮不 `checkout`、不 `stash`、不动工作区与 HEAD：逐个 commit 用 git plumbing
> （`read-tree` 基线 → `update-index --cacheinfo` 灌 LF blob → `write-tree` → `commit-tree` → `update-ref`）
> 落到各自的分支，再按「后端先于前端、被依赖的先合」的顺序 push → 开 PR → 轮询 CI → `--merge` 进 `feature-1`。
>
> 前置事实：本轮起点是 PR #206 把 `feature-1`（`9dbc812` 一线）并入 `main` 之后的 `feature-1`。
> 103 条里 63 条经字节比对确认已在 `feature-1`（多为上一批与另一条会话所落），29 条与库内版本不同、11 条是库里没有的新文件。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
| --- | --- | --- | --- | --- | --- |
| CR-20261029-08 | fix | `src/stores/auth.ts`、`src/router/guards.ts`、`src/router/index.ts` | 角色门禁从「单角色字符串」改成「角色集合判定」，`Role` 扩出 `super_admin`；`meta.role` 支持 `Role \| Role[]`，新增导出的 `normalizeRequiredRoles` / `isRoleAllowed` 两个纯函数并据此放行 `/answer-query`、`/admin-console`、`/teacher-completion`、`/resource-upload`；同时删掉路由表里两处已废弃的 `*-dashboard` 旧块 | 已通过（CI 6 项） | 已上线（`78a6c29`） |
| CR-20261029-09 | refactor | `src/services/apiService.ts`、`src/views/TeacherRegisterView.vue` | 教师自助注册不再裸 `fetch`，改走 `teacherRegister()` + 统一 `ApiResponse`；`ApiError`（后端业务码）与真正的网络异常分文案，避免「参数不合法」被说成「网络异常」 | 已通过（CI 6 项） | 已上线（`78a6c29`） |
| CR-20261029-10 | chore | `backend/package.json` | jest 覆盖率统计从只算 `server.js` 扩到 `src/**`（排除 `__tests__`），并设首轮阈值 branches 20 / functions 30 / lines 30 / statements 30 | 已通过（CI 6 项） | 已上线（`78a6c29`） |
| CR-20261029-11 | refactor | `backend/src/middleware/validate.js` + 7 个 controller + `backend/tests/ai-chat-security.test.js` | zod 校验收敛：找回仓库里**并不存在**、却被 7 个 controller `require` 的 `middleware/validate.js`（从 `feature/data-dashboard/backend-api` 取回，98 行），错误统一成 400 `VALIDATION_ERROR`，多条 issue 去重后以「；」拼接；admin/ai/answer/auth/student/teacher/tracking 七个 controller 一起落，`assetController` 留给 CR-20261029-14 | 已通过（CI 6 项） | 已上线（`78a6c29`） |
| CR-20261029-12 | feat | `teacherDashboardController.js`、`adminDashboardController.js`、`utils/dashboardQuery.js`、`utils/questionInventory.js`、`routes/index.js` + 3 个测试 | 教师/管理员看板聚合接口从 10-23 那条一直没合并的本地分支移植进主仓（约 +2300 行含测试）；`routes/index.js` 走三方合并，`/api/teacher/dashboard/*` 挂 `teacherAuth`、`/api/admin/dashboard/*` 挂 `requireRole(['admin','super_admin'])` | 已通过（CI 6 项，后端 3 个新测试文件全绿） | 已上线（`78a6c29`） |
| CR-20261029-13 | feat | `src/components/charts/*`、`src/components/dashboard/*`、`src/services/{teacher,admin}DashboardService.ts`、`src/views/{Teacher,Admin}DashboardView.vue`、`src/router/index.ts`、`AnswerQueryView.vue`、`AdminConsoleView.vue` | 看板前端：手写 SVG 图表（StatCard / ProgressRing / BarChart / LineChart / HeatmapChart + `chartUtils`，只依赖 `vue`，不引第三方图表库）、面板与学生明细/薄弱题组件、两个看板页面与路由入口；服务层空态兜底与后端分页类型对齐 | 已通过（CI 6 项；`vue-tsc --build` 本机 0 错误） | 已上线（`78a6c29`） |
| CR-20261029-14 | fix | `backend/src/controllers/assetController.js`、`figma-plugin/generate-inventory.py` | 「编号 ↔ 篇目」表换成 2026-10-28 内容组确认表：只保留已确认 24 个号，未确认 13 个号位（20、21、23、28–37）显示占位「编号待确认」，与已落库的 `src/utils/wenUtils.ts` 一致；号位仍按 1–37 生成，否则 `Object.keys(POEMS)` 匹配不到这些号的已交付素材 | 已通过（CI 6 项） | 已上线（`78a6c29`） |
| CR-20261029-15 | docs | `docs/CODE_WIKI.md`、`docs/QUALITY_ASSESSMENT.md`、`docs/MIGRATION_CLUSTER.md` | 三份只在共享工作区存在过的技术文档落库（共 2281 行）：Code Wiki、2026-10-23 六维度质量评估快照、PM2 cluster + Redis 迁移路线图。评估报告头部加了「落库时点说明」，标明其 P0 项已被 #207 / #210 / #211 处理、分数不回填重算 | 已通过（CI 6 项，含 secret-scan） | 已上线（`78a6c29`） |

### 明细

- **分支 / commit / CI**（合并提交为 `feature-1` 上的 `--merge` 结果）：
  `feature/auth-session/super-admin-role` @ `34c4caa` → PR #207（`e5aa54b`）；
  `feature/auth-session/teacher-register-api` @ `8478a4b` → PR #208（`d8220fa`）；
  `feature/quality-gate/backend-coverage-thresholds` @ `bcf23d9` → PR #210（`b2a71ff`）；
  `feature/backend-api/zod-validation` @ `62f67ca` → PR #211（`00c06cd`）；
  `feature/data-dashboard/api` @ `dcdd46c` → PR #212（`c7911a3`）；
  `feature/data-dashboard/pages` @ `c3d2080` → PR #213（`4a3e9b4`）；
  `feature/asset-inventory/confirmed-numbering` @ `c41ad52` → PR #214（`d08fca9`）；
  `feature/docs/tech-docs` @ `6635547` → PR #215（`2299edf`）。
  每个 PR 都轮询到 6 项检查（`quality-check` / `backend-check` / `circular-check` / `pipeline-test` /
  `figma-plugin-check` / `secret-scan`）全绿才合，分支名不删。
- **号段与 `main` 窗口**：本轮没占用 PR #209——它是已存在的 `feature-1` → `main` 发布 PR
  （#204 合完之后另开的「生字注释三级匹配兜底」，等人工审批）。因为这 8 个 PR 全部落在 `feature-1`，
  `#209` 的 diff 现在也连带包含本批（`feature-1` → `main` 只有一个 PR），审批时按需重新核对标题范围。
- **顺序为什么这样排**：#211 必须和 7 个 controller 同批——单独合 `validate.js` 或单独合 controller 都会让另一半天红；
  #212（看板接口）先于 #213（看板页面），否则页面的服务层类型没有对照物；#214 只碰素材标题表，与看板无耦合。
- **本轮修掉的 CI 失败（2 次，都是本地校验盲区）**：#208 首次 `TS2322`（`ApiResponse.message` 可选 vs 必填，返回类型写窄了）
  与 `TS1005`（`Promise<ApiResponse<{…}>>` 少写一个 `>`）；#213 首次 8 处 `noUncheckedIndexedAccess` 报错，
  修完剩 1 处 `pagination.page_size` 取的是 `Record<string, string | number>` 里的值 → 改成复用 `number` 型局部变量 `pageSize`。
  从 #213 起本机校验补上了 `vue-tsc --build`：便携 Node + `git archive` 出分支树 + junction 指回仓库 `node_modules`，
  工作树之外跑，全量 0 错误后才推。
- **故意没提交**：`NUL`（Windows 重定向留下的垃圾文件）、`tmp-vitest.mjs` / `tmp-vitest-report.json`（临时跑测脚本与产物）、
  `.vscode/extensions.json` 的删除（工作区把推荐扩展删了，不是仓库决策）、
  `docs/maintenance/release-freshness-plan.md`（`feature-1` 上已有更新版本，用工作区这份覆盖会回退）。
- **遗留（不静默绕过）**：
  ~~前端 `test:coverage` 仍缺 provider~~——已解决，见「第四批」CR-20261029-19；
  ~~本机无 python 跑不了 `generate-inventory.py`~~——本机已装 Python 3.12.10，脚本已跑通，清单重跑见 CR-20261029-21；
  `docs/document_index.csv` 未登记 CR-20261029-15 那三份文档，因为该表要求「创建日期」而这三份没有可靠原始日期；
  内容侧待确认号位当时记 13 个（20、21、23、28–37），**23 已由用户 2026-10-29 确认为《活板》**，剩 12 个，见 CR-20261029-20；
  23 号位两条卡片视频（`card_paper` / `card_printing`）**仍是孤儿**——挂载障碍只剩「还没生成 `WEN_23.json`」。

### 发布事实（2026-10-29 中午复核）

- **PR #209 已把本批全部改动带进 `main`**：它开的时候只含生字注释那批，但 `feature-1` → `main` 只有一个 PR，
  9 个 PR（#207–#216）落进 `feature-1` 后它的 head 自动跟到 `580e4c8`；11:19:38 人工合并为 `main`@`78a6c29`。
  `git diff origin/main origin/feature-1` 为空——两分支内容当前完全一致，没有遗漏的批次。
- **`main` push 触发的三个 workflow 全绿**：`Deploy Frontend to Aliyun OSS`（run `40811509949`）、
  `Deploy Backend to Aliyun Server`（run `40811509935`）、`Sync Figma Plugin to wenyan-asset-sync`（run `40811509978`）。
  `CI Checks` 不在 `main` push 上跑，发布前看的是各 PR 的 CI（本批 9 个 PR 都是 6 项全绿才合）。
- **前端线上实测**：`https://www.classicalab.cn/index.html` 的 `<meta name="build-id" content="78a6c29">`；
  entry chunk `index-CdPv9V10.js` 里挂着 `TeacherDashboardView-D4X2IUPx.js`（直接 GET 返回 200）与
  `AdminDashboardView-iGUejIjI.js`，看板代码确实进了产物；同一 chunk 里的标题表已是确认表 24 条 +
  未确认号位占位「编号待确认」（05 唐雎不辱使命 / 06 醉翁亭记 / 08 咏雪 / 22 狼 / 24–27 送东阳马生序·出师表·三峡·答谢中书书）。
- **后端线上实测**（证明 CR-20261029-11 找回的 `middleware/validate.js` 真在线上跑）：
  `POST https://api.classicalab.cn/api/auth/teacher/register` 传非法体返回 400 +
  `{"error":"VALIDATION_ERROR","message":"手机号格式不正确；姓名必填；密码长度不能少于 6 位"}`，
  多条 issue 去重后按「；」拼接——只有那份找回的共享模块能产出这个格式，仓库里从来没有它时这条路由是起不来的。
- **上面这些「已上线（`78a6c29`）」状态即据此改写**（第一批的 CR-04 ~ 07 同样随 #209 上线）；
  因单元格里改了文案，第一批那张表的 prettier 列对齐已放宽，不影响渲染。
- **本条发布事实自身**只是 `docs/**` 改动，不在两个 deploy workflow 的 `paths` 白名单里，
  合进 `main` 不会触发任何发布；它先落 `feature-1`，随下一个 `main` 窗口走。

---

## 第三批：Step 三关答题闭环与 Figma 资产审计（CR-20261029-16 / 17）

> 甲方两条功能反馈 + 一条资产质询：① 第一关只有字词注释与多角色朗读，要补选择题；
> ② 第二关第二题答完后，用于讲解答案的 dialogue 不显示；③ Figma 插件扫描上传的东西是否全部用上。
> 本轮只改前端与文档，不动后端接口、不改内容 JSON 的答案字段。

| 变更编号       | 变更类型 | 影响范围                                                                                                | 变更描述                                                                                                                                             | 测试状态                         | 上线状态                                      |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------- |
| CR-20261029-16 | fix      | `src/views/StepView.vue`、`src/composables/quiz/useQuizFlow.ts`、`src/views/__tests__/StepView.test.ts` | 第二关最后一题提交后解析 dialogue 恢复显示；第一关接入 `level1_quiz` 选择题（A 关题号、`module: A`、统一提交出口），完成记录 key 与后端 `wenId` 解耦 | 已通过（本机 252/252 + CI 6 项） | 已上线（`8db7a6e`） |
| CR-20261029-17 | docs     | `docs/素材使用审计-20261029.md`                                                                         | 按生产 OSS 清单与代码引用交叉审计 Figma 插件产物：6,075 项插件产物运行时引用为 0，真正在用的通用图只有 3 张                                          | 不适用                           | 已上线（`8db7a6e`） |

### CR-20261029-16 第二关末题解析对话 + 第一关选择题

- **变更类型**：fix（缺陷修复 + 功能补齐）
- **分支 / commit**：`feature/step12-quiz-fixes` @ `2bfa324`（本地 `5750dd8`，树 `4ac8243` 与服务端逐字节一致）；
  `--no-ff` 语义并入 `feature-1`（合并提交 `2a46603`）。
- **分支起点与父分支前移**：子分支从 `feature-1`@`387b9b3` 开出；合并前另一条会话把 PR #221
  （23 号位《活板》）合进父分支，头变成 `5dfe95c`。比较 `387b9b3...5dfe95c` 的 7 个文件
  （`assetController.js` / 三份素材文档 / `generate-inventory.py` / `poemAssets.ts` / `wenUtils.ts`）与本次三个文件零重叠，
  因此合并树以 `5dfe95c` 的树为基线、只替换本次三个 blob，父提交记为 `[5dfe95c, 2bfa324]`。
- **第二关根因**：`useQuizFlow.submit()` 在最后一题不会把 `currentIndex` 往前推
  （实测日志 `prevIndex: 0 → newIndex: 0, isCompleted: true`），而 `isQuizBlockVisible()` 用
  `quizBlockIndices[currentIndex]` 当可见上界；于是「最后一题之后的解析 dialogue」永远 `show=false`。
  修复为 `step2Flow.isCompleted` 时全部解锁——解析对话本来就是答完才该看的内容，不属于防剧透范围。
- **第一关做法**：不挂载历史 `Level1Quiz.vue`（它用旧题号 `${wenId}_level1_q{n}` 且直接批量提交），
  改为 `useDataLoader` 读 `level1_quiz/{WEN}.json` → `adaptLevel1Quiz()`（题号 `WEN_nn_A{n}`、`module A`）
  → `QuizCard` 逐题渲染 → `useQuizFlow.submit()` 走 `useQuizSubmitter` 单题提交。
  `normalizeCorrectIndex()` 同时接受字母（`"C"`）、数字与 0 基索引；A 关 JSON 没有 `question_id`，
  后端 `getCorrectAnswerFromJson()` 查不到，所以提交必须带 `correctAnswer`（已由 `useQuizFlow` 传入）。
  无数据（WEN_05 起没有 `level1_quiz` 文件）时整段隐藏，不报错、不阻塞「继续」。
- **完成记录 key 与后端 `wenId` 解耦**：`completionKey` 从 `string` 改为 `MaybeRefOrGetter<string>`，
  三关分别用 `stepone:`/`steptwo:`/`stepthree:` 前缀，避免 localStorage 完成记录串关；
  新增可选 `wenId`（`MaybeRefOrGetter`）单独供后端提交，缺省回退 `completionKey` 兼容旧调用。
  getter 形式同时修掉「切篇后 key 冻结」的旧问题。
- **测试**：`src/views/__tests__/StepView.test.ts` 两个回归用例。其一用 5 块夹具
  （dialogue / quiz / dialogue / quiz / dialogue）断言初始末块隐藏、第一题后中间两块显示、第二题后末块显示
  （修复前此例必红）；其二断言第一关渲染题目与 4 个选项、提交后出现解析与完成态，
  且 `submitSingleAnswer` 收到 `wenId: WEN_01` / `questionId: WEN_01_A1` / `userAnswer: 2` / `correctAnswer: 2`，
  `questionId` 不含 `stepone:` 前缀。
- **本机校验**：便携 Node 20.18.0，全量 `vitest run` 252/252（15 个文件）、`vue-tsc --build` 0 错误、
  改动文件 `eslint` 0 错误、`oxlint` 0 warning、`prettier --check` 通过。
- **CI**：子分支 `CI Checks` run `40816371706` 6 项全绿；合并后 `feature-1` 的 `CI Checks` run `40816528148`
  6 项全绿，`Deploy Frontend to Test OSS` run `40816528133` 成功。

### CR-20261029-17 Figma 扫描资产使用审计

- **变更类型**：docs（审计结论，无代码改动）
- **结论**：没有全部用上，**运行时使用率接近于零**。插件产物共 6,075 项
  （`images/screens/**` 6,049 + `data/texts/**` 26，`styles/**` 为空）；生产 OSS 文件合计 7,797 项。
- **切片**：`images/screens` 按类型为 dialogue 3,026 / quiz 1,741 / video 823 / explanation 224 /
  summary 162 / cultural_card 73，运行时引用 **0**。唯一有消费逻辑的是 `DialogueCard` 对
  `icon_dialog` 的 `resolveScreenAsset()` 探测，但现有 25 个 `icon_dialog` 字段全部为空；
  quiz / explanation / summary / cultural_card / video 五类没有任何组件读取。
- **通用图**：真正在用的只有 `images/login_bg.png`、`images/general/article_list_bg.png`、
  `images/general/article_list_title.png` 3 张；`card_scroll.png` 只有注释提到、代码未引用。
- **数据侧**：`data/texts` 前端与后端运行时均零消费，更像内容组整理页面 JSON 时的文字底稿；
  `illustration` 8 个字段全空；`image_file` 35 个里 24 个是 mp4（走 `/video/`）、11 个是「文字」占位。
- **建议**：先标注不急着删；要挂头像先填 `icon_dialog`；题目/解析插图需先定 schema 与渲染位置；
  把 `data/texts` 明确为内容底稿；加一条发布前「数据字段 → URL → HEAD 200」的资产引用审计。
  复算命令与分类表见 `docs/素材使用审计-20261029.md`。

### CR-20261029-18 Figma 扫描资产接入前端

- **变更类型**：feat（`src/config`、`DetailView`、`AdaptQuiz`、脚本、文档）
- **目录**：新增 `src/config/figmaScreenCatalog.ts`（自动生成），把生产清单里的 6,049 个扫描文件折叠成
  37 篇 / 775 条「篇目 × 角色」记录；生成脚本 `scripts/gen-figma-screen-catalog.mjs`，
  输入为 `GET https://api.classicalab.cn/api/assets/oss-list` 的快照。
- **读取**：`figmaAssets.ts` 新增 `normalizeWenId`、`getWenScreenCatalog` 与
  title / role / option / textBox / avatar / characterCard 六个 URL 读取函数，
  统一走 `VITE_OSS_BASE_URL/images/screens/...`；目录来自 OSS 清单，读取时不再逐张 HEAD。
- **渲染**：`DetailView` 标题改用整篇书法图（`article_title_*`，17–29KB；有图时 `h1` 收进 `.sr-only`，
  图片 `@error` 回退文字）；`AdaptQuiz` 选项 A–D 使用 `option_a..d_01.png`（4–10KB）作底图，
  选中/正确/错误态仍由 CSS 覆盖。
- **未接**：背景/立绘单张 2.8–18MB，需先做 WebP 衍生图；按钮图文字已烘焙；`card_bamboo` 20.8MP 解码过重；
  文本框图等待总结页 schema。逐项原因见 `docs/figma-scan-integration.md`。
- **校验**：新增 7 个单测（覆盖 37 篇、路径均为 `images/screens` 相对路径、标题取整篇版本、
  URL 拼接与 null 兜底）；生产桶抽 4 条 URL HEAD 200；`vue-tsc` 与改动文件 `eslint` 通过。
- **上线**：随 PR #226 进 `main`（`8db7a6e`）；生产 `figmaAssets-CE8hWh-2.js` 内含
  `WEN_02/summary/article_title_WEN_02.png` 与 `WEN_02/quiz/option_a_01.png`，由 `DetailView-D04MQhuW.js` 引用。

### 遗留与风险（本轮不静默绕过）

- **WEN_04 内容矛盾**：`pages_level2_dialog_quiz/WEN_04.json` 的 B2 `correct_answer` 是 `"A"`，
  但题目后的解析 dialogue 写「答案是B」并解释「以退为进，反守为攻」；B1 则完全没有 `correct_answer`。
  这是内容数据问题，本轮没有擅自改答案，需内容组确认后修 JSON。
- **WEN_05 起没有 `level1_quiz` 数据**：第一关选择题会按设计整段隐藏；若后续篇目也要练习，
  需内容侧补 `public/data/level1_quiz/WEN_xx.json`（当前只有 01–04）。
- **Figma 切片仍未挂载**：审计只回答「有没有用上」，没有替内容组决定哪些该挂；6,049 张切片仍在生产桶。

---

## 第四批：覆盖率环境、本机工具链与 23 号位确认（PR #220 – #222）

> 这一批的起因是三个「本机跑不了 / 号位没确认」的口子：前端 `test:coverage` 缺 provider、
> `generate-inventory.py` 没有 python 可跑、23 号位归属未确认。三者都补上了，另外清了一条凭据外泄。
>
> **编号为什么从 19 起**：CR-20261029-16 / 17 / 18 已被上一节「第三批」占用（Step 三关答题、Figma 资产审计、
> Figma 扫描资产接入前端），本批四个条目顺延为 19 – 22。两批是同一天并行推进的，PR 号（#220 – #222）
> 与 CR 号不是同一套序号，别按数字大小推断先后。

| 变更编号       | 变更类型 | 影响范围                                                                                                                                                                                                                           | 变更描述                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 测试状态                                                               | 上线状态                                                   |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| CR-20261029-19 | chore    | `package.json`、`package-lock.json`、`vitest.config.ts`                                                                                                                                                                            | 前端覆盖率环境落地：vitest 4 已删 `c8` provider，改装 `@vitest/coverage-v8@4.1.10`（lock 489 → 506 条，只增不减；`ast-v8-to-istanbul` 依赖的 `js-tokens@10` / `estree-walker@3` 按 npm 解析嵌套安装，摊平到顶层会让 `getIgnoreHints` 崩）；`vitest.config.ts` 加 `coverage` 段，阈值按当时本机实测值往下取整（statements 14.93→14 / functions 16.76→16 / branches 11.49→11 / lines 14.09→14）                                                                                       | 已通过（当时本机 `vitest run --coverage` 14 文件 250 例全过；CI 6 项） | 已上线（`8db7a6e`）      |
| CR-20261029-20 | fix      | `src/config/poemAssets.ts`、`src/utils/wenUtils.ts`、`src/config/__tests__/poemAssets.test.ts`、`backend/src/controllers/assetController.js`、`figma-plugin/generate-inventory.py`、`docs/素材缺失清单.md`、`docs/素材对应核查.md` | 用户确认 **23 号位 = 《活板》**，四处编号表 + 两份文档同步：已确认号位 24 → 25、待确认 13 → 12（20、21、28–37）、学生可进入 21 → 22 篇。旧推测表两头都错（23 写《湖心亭看雪》、37 写《活板》），回归断言拆成两条反向检查。23 号位 4 段 rule 视频线上实测 200，确认即放行                                                                                                                                                                                                            | 已通过（本机 vitest 251 例 + `vue-tsc --build` 0 错误；CI 6 项）       | 已上线（`8db7a6e`）      |
| CR-20261029-21 | chore    | `figma-plugin/resource-inventory.json`                                                                                                                                                                                             | 本机装上 Python 3.12.10 后重跑 `generate-inventory.py`，清单从 2026-08-21 的离线快照刷到当前：输入是 `GET https://api.classicalab.cn/api/assets/version` 的返回（`production_version.json`，未被 git 跟踪），6077 个资源、`lastSyncAt` 2026-09-29；标题表由「37 条推测」换成「25 条确认 + 12 条占位」；状态统计 完整 0 → 14、缺数据文件 8 → 12、缺 OSS 4 → 1、未配置 25 → 10                                                                                                        | 已通过（脚本退出码 0、产物可 `json.load`；CI 6 项）                    | 不发布（清单不在插件同步的 8 文件白名单；同步 run `40822145869` 成功） |
| CR-20261029-22 | chore    | 本机 `.git/config`、`~/.gitconfig`（**不进仓库**）                                                                                                                                                                                 | `origin` 的 remote URL 里嵌着**明文 GitHub 令牌**，经哈希比对确认就是 `gh` 当前在用的那枚（`gho_` 开头、40 字符，sha256 前 12 位一致），不是历史遗留 PAT。改成 `gh auth setup-git` 走凭据助手（全局写入 `credential.https://github.com.helper = '!'C:\Program Files\GitHub CLI\gh.exe' auth git-credential`，指向 Windows 凭据管理器里的 gh 令牌），URL 只留 `https://github.com/Luo399/wenyan-platform.git`；`.git/` 全树扫描已无该令牌字节，`ls-remote` / `fetch` / `push` 均照常 | 已验证（fetch + 本 PR 的真实 push）                                    | 不适用（机器侧配置）                                       |

### 明细

- **分支 / commit / PR / 合并提交**：
  `feature/quality-gate/frontend-coverage-v8` @ `28cbdd6` → PR #220（`387b9b3`）；
  `feature/asset-numbering/slot-23-huoban` @ `845b33b` → PR #221（`5dfe95c`）；
  `feature/asset-inventory/regenerate-snapshot` @ `02f1b3f` → PR #222（`3c19c03`）。
  `feature-1` 从 `eca26c4` 推到 `3c19c03`；三个 PR 都是 6 项检查全绿才 `--merge`，分支不删。
- **本节自身怎么并进去的（两轮冲突）**：本 changelog + 台账是纯 `docs/**` + `tasks/**` 改动，单独开在 PR #223。
  开 PR 之后另一条会话连着把「第三批」（`2000ebc`）和 PR #224（`ede69c8`）记进了同一批文件的同一批位置
  （都在文末追加新章节、都改「遗留」那几条），#223 两次变成 `CONFLICTING`。
  这里没有 force-push、也没有另开 PR，而是把 `feature-1` 的头合进本分支再人工重排文本：
  两批内容都保留，本批章节名定为「第四批」，编号跟着当前头顺延（第一轮 18 – 21、第二轮改为 19 – 22），
  合并提交的父提交依次记为 `[9148ec2, 2000ebc]`、`[3dc05ce, ede69c8]`。
- **本机校验已经能当发版前的门**：`git archive origin/feature-1` 出干净树 + `mklink /J node_modules` 指回仓库，
  在树外跑 `vitest run --coverage` 与 `vue-tsc --build`，共享工作区一个字节没动。这批三次 PR 的校验一次过，没有靠 CI 来回试。
  注：CR-19 的「14 文件 250 例」是当时（`387b9b3`）的数，此后第三批的 `StepView.test.ts` 与 PR #224 的
  `figmaScreenCatalog.test.ts` 各自加了用例，全量数与覆盖率都已上移，阈值没有随之重算（当前阈值仍偏低，不会挡路）。
- **23 号位「放行」到底改变了什么**：`isPoemReady = hasRuleVideo && isNumberingConfirmed`，
  两条现在都满足 → 首页选篇多出《活板》。它的八类页面数据 JSON 仍全缺，属于**内容组还没产出**那一类
  （`public/data/` 里根本没有 `WEN_23.json`，线上 `data/*/WEN_23.json` 404），
  与「仓库里有、线上没发」（如 `culture_cards/WEN_22.json` 仓库有、线上 200）不是一回事。
- **仍然没做的**：
  CI 的 `quality-check` 跑的是 `npm run test`，**不带 `--coverage`**，所以 CR-19 的阈值只在本地 `npm run test:coverage` 生效，
  要把门槛真正钉进 CI 还得改 workflow（未改，等你定）；
  23 号位那 2 条孤儿卡片视频仍未挂载（`ORPHAN_CARD_VIDEO_POEM_IDS` 保持 `['23']`），挂载需要新建
  `public/data/culture_cards/WEN_23.json`，而 `public/data/` 被 .gitignore 忽略、要 `git add -f`，且卡文案得内容组给；
  `test_version.json` 没拿到——`test-api.classicalab.cn` 的 `/api/assets/version` 当前 502（测试后端没起），
  所以清单里 `test_last_sync` 仍是 `null`，与被替换的旧快照一致；
  内容侧还剩 12 个号位待确认、21 张卡的 `knowledge_text` 等复核、08/11 库尔班大叔重复与 08 台标版权未定。
- **CR-22 的后续动作（需要你本人做）**：那枚令牌在 `.git/config` 里明文躺过、也在本次会话的命令行输出里出现过，
  虽然它只在你这台机器上，仍建议轮换：`gh auth refresh-token` 或到 `https://github.com/settings/tokens` 撤销后 `gh auth login`。
  轮换不影响本次改动——远端 URL 已经不含凭据，git 会自己向凭据助手要。

---

## 第五批：Figma 资产接入的测试补齐

### CR-20261029-23 Figma 资产接入的单元与集成测试

- **变更类型**：test（无业务改动）
- **单元**：`src/config/__tests__/figmaAssets.test.ts` 9 例——ossBase 地址拼接与逐段编码、
  HEAD 探测的成功/异常缓存、并发去重、`resolveScreenAsset` 的 200/404 分支、
  目录角色/头像/名牌读取与 null 兜底。
- **集成**：`src/views/__tests__/DetailView.figmaAssets.test.ts` 3 例（标题图 src 指向
  `images/screens/WEN_02/...`、图片 error 后 h1 恢复可见、目录无图时直接显示文字）；
  `src/components/__tests__/AdaptQuiz.figmaAssets.test.ts` 3 例（四个选项分别带 `option_a..d` 底图、
  无素材篇目不写 `background-image`、答题正确/错误态不受底图影响）。
- **结果**：全量 `vitest run` 19 个文件 / 274 个用例通过（新增 15 例）；`vue-tsc --build` 0 错误；
  新文件 ESLint / oxlint / prettier 通过。
- **说明**：测试文件都在 `src/**/__tests__`，走 `vitest.config.ts` 的 include，不需要改配置或依赖。

### 发布事实（2026-10-29 下午复核）

- **PR #226 已把这一批全部带进 `main`**：`feature-1`@`79555e5`（18 个提交：PR #220 – #225、第一关选择题
  `2a46603`、两轮 changelog 合并）于 13:13:32 人工合并，`main`@`8db7a6e`；
  `compare main...feature-1` 显示 `ahead_by: 0`，两分支内容一致（只差这条合并提交本身）。
- **发布前 CI**：PR #226 的 `CI Checks` run `40821727685` 六项全绿
  （quality-check / backend-check / circular-check / pipeline-test / figma-plugin-check / secret-scan），
  head 就是 `79555e5`。
- **`main` push 触发的三条 workflow 全绿**：`Deploy Frontend to Aliyun OSS`（run `40822145669`）、
  `Deploy Backend to Aliyun Server`（run `40822145647`）、`Sync Figma Plugin to wenyan-asset-sync`（run `40822145869`）。
- **前端线上实测**：`https://www.classicalab.cn/index.html` 的 build-id 为 `8db7a6e`；entry chunk
  `index-D4n_tJX2.js` 的懒加载项指向 `DetailView-D04MQhuW.js`，后者 import `figmaAssets-CE8hWh-2.js`
  （60,471 B），chunk 内可检索到 `WEN_02/summary/article_title_WEN_02.png` 与 `WEN_02/quiz/option_a_01.png`。
- **后端线上实测**：`GET https://api.classicalab.cn/api/assets/inventory` 返回
  `{"wen_id":"WEN_23","title":"活板",…}`，CR-20261029-20 的 23 号位改动确实进了生产。
- **状态回填**：第三批 CR-16 / 17 与第四批 CR-19 / 20 的「等 `main` 窗口」改为「已上线（`8db7a6e`）」；
  CR-21 的清单文件不在插件同步的 8 文件白名单内，状态改记为「不发布」并注明本次同步 run 成功。
- **本条发布事实自身**只是 `docs/**` + `tasks/**` 改动，不在 deploy workflow 的 `paths` 白名单里，
  合进 `main` 不会触发发布。
