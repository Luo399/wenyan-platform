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
- **仍然没做的**（前两条已在**第六批**关掉，见 CR-20261029-24 / 25）：
  ~~CI 的 `quality-check` 跑的是 `npm run test`，**不带 `--coverage`**，所以 CR-19 的阈值只在本地 `npm run test:coverage` 生效，
  要把门槛真正钉进 CI 还得改 workflow（未改，等你定）~~
  → 已钉进 CI（PR #228）。**顺带更正此处原先的说法**：它写「阈值只在本地 `npm run test:coverage` 生效」，
  但当时仓库里**根本没有 `test:coverage` 这个脚本**（`package.json` 只有 `test`），那句话连本地都不成立——
  脚本是第六批补的，CR-19 的阈值从落地到被真正执行之间空转了一整天。
  ~~23 号位那 2 条孤儿卡片视频仍未挂载（`ORPHAN_CARD_VIDEO_POEM_IDS` 保持 `['23']`），挂载需要新建
  `public/data/culture_cards/WEN_23.json`，而 `public/data/` 被 .gitignore 忽略、要 `git add -f`，且卡文案得内容组给~~
  → 已按 `8c51427` 那批的同一口径挂载完（PR #229），孤儿表清空；`public/data/` 那个 .gitignore 坑照旧存在，
  本批用 plumbing 直接落 blob 绕开；`knowledge_text` 仍留空串等内容组给正文。
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

---

## 第六批：覆盖率门禁钉进 CI + 23 号位卡片挂载（PR #228 – #229）

> 口径来自用户两句话：**「CI 的进 workflow，23 号的问题，其他怎么解决的它就怎么解决」**。
> 所以本批一个只动 CI 配置、不碰业务代码；另一个不发明新约定，逐条照 2026-10-28 那批挂载提交 `8c51427` 的做法做。
>
> **编号为什么从 24 起**：CR-20261029-23 已被上一节「第五批」（另一条会话的 Figma 测试补齐）占用，本批两条顺延为 24 / 25。

| 变更编号       | 变更类型   | 影响范围                                                                                                                                                                       | 变更描述                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 测试状态                                                                       | 上线状态                                                  |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| CR-20261029-24 | ci         | `.github/workflows/ci-checks.yml`、`package.json`、`vitest.config.ts`                                                                                                          | 把覆盖率门禁真正接进 CI：`quality-check` 的前端测试步骤由 `npm run test` 改为 `npm run test:coverage`（该步骤无 `continue-on-error`，不达标直接非零退出），并补上此前**根本不存在**的 `test:coverage` 脚本。阈值按当日两次实测的下界定为 lines 18 / functions 20 / branches 13 / statements 18。前置核对：`@vitest/coverage-v8@^4.1.10` 已在 devDependencies 且在 `package-lock.json`，CI 的 `npm install` 装得到；三个文件都命中 `on.push.paths`                                                                                                                       | 已通过（CI job 日志实测 `Coverage enabled with v8`、19 文件全过、覆盖率 23.06/16.84/25.04/22.45）    | 已上线（`main`@`8760894`；覆盖率门禁从此在主干 CI 真正生效） |
| CR-20261029-25 | feat(素材) | `public/data/culture_cards/WEN_23.json`、`backend/data/culture_cards/WEN_23.json`、`src/config/poemAssets.ts`、`src/config/__tests__/poemAssets.test.ts`、`docs/素材缺失清单.md`、`docs/素材对应核查.md` | 23 号位《活板》的两张卡片视频按既有口径挂载。`public` 与 `backend` 两份 JSON 是**同一个 blob**（`bba4ac7`，606 字节 LF）；`card_name` 沿用「历史回响」、`image_file` 写交付原名、`unlock_condition` 照 01–04 文案、`knowledge_text` **两张都留空串**（画面未抽帧验证，不编造学生可见文案，组件 `v-if="card.knowledge_text"` 不渲染空字幕）。`CULTURE_CARD_DATA_POEM_IDS` 15 → 16 个号，`ORPHAN_CARD_VIDEO_POEM_IDS` 由 `['23']` 清空；两份素材文档的孤儿计数同步（24 个孤儿文件清零）。测试新增三条锁，`poemAssets.test.ts` 21 → 24 例 | 已通过（本机合并态导出树 19 文件 278 例、覆盖率 23.08/16.84/25.11/22.46；`vue-tsc --build` 0 错误；CI 12 项全绿） | 已上线（`main`@`8760894`；生产实测 `/data/culture_cards/WEN_23.json` → 200） |

### 明细

- **分支 / commit / PR / 合并提交**：
  `feature/quality-gate/ci-coverage-gate` @ `68eabad` → PR #228（合并提交 `20e03c4`）；
  `feature/asset-numbering/slot-23-card-mount` @ `04f73da` → PR #229（合并提交 `1072821`）。
  两条分支都从 `79555e5` 切出、改动文件互不相交，各 12 项检查（`push` + `pull_request` 两条 run × 6 job）全绿才 `--merge`，分支不删。
- **门禁不是只看绿灯，日志里验过它真的跑了**：CI job 日志出现
  `##[group]Run npm run test:coverage` → `> vitest run --coverage` → `Coverage enabled with v8` → 覆盖率四列表格；
  这一步没有 `continue-on-error`（上一步 Lint 才有），所以阈值不达标会把 `quality-check` 判红。
- **本机导出树的数字与 CI 对得上**：CI 在 #228 上跑 `23.06 | 16.84 | 25.04 | 22.45`，合并后在 `feature-1`@`1072821` 跑
  `23.08 | 16.84 | 25.11 | 22.46`（四列依次是 stmts / branch / funcs / lines）；本机在同一棵导出树
  （`git archive` + `mklink /J node_modules`）测得后者，逐项一致——说明这套「树外校验」的数字可以直接当 CI 的预测值用。
  阈值 `statements 18 / branches 13 / functions 20 / lines 18`，相对实测的余量分别是 5.08 / 3.84 / 5.11 / 4.46 个点。
- **23 号位逐条对齐 `8c51427`，且卡片数量是核过的**：线上 `GET /api/assets/oss-list` 的 `wen_list` 里 23 号位名下
  **只有** `WEN_23_card_paper.mp4` 与 `WEN_23_card_printing.mp4` 两个卡片视频（没有第三张），两个视频此前逐个 HEAD 均 200，
  所以挂载不引入 404。`card_id` 按交付顺序 1/2，`text_id` 三处同号。逐字段依据写在 `docs/素材缺失清单.md` 第二节末尾新增的「23 号位补挂（2026-10-29）」。
- **三条新断言**：① `CULTURE_CARD_DATA_POEM_IDS` ↔ `public/data/culture_cards/` **双向**一一对应（历史上两个方向都漂过：
  表里有号但目录没文件、目录有文件但表没登记）；② 23 号位已挂载且卡片清单就是那两个文件；③ 挂载表与孤儿表不许有交集。
  原有的「挂载契约」那组用例是遍历目录的通用断言，新 JSON 自动被同号性 / 防跨号 / 扩展名 / 双扩展名 / 占位文本五道检查覆盖。
- **一处顺手纠正**：本批发现 `docs/素材对应核查.md` 的覆盖矩阵是**线上实测**口径，所以「卡片」列不因本批挂载而改，
  只在汇总行标注「线上 15/37、仓库 16/37」——`CULTURE_CARD_DATA_POEM_IDS` 只代表构建里有这份 JSON，不代表线上已经有了。
- **仍然没做 / 待你这边**：
  **发版前线上看不到 23 号位的卡片**，`https://www.classicalab.cn/data/culture_cards/WEN_23.json` 现在仍是 404，
  发版后用 `scripts/check-video-inventory.sh` 探线上复核；
  `figma-plugin/resource-inventory.json` 反映的是**线上**快照，仓库侧挂载不该改它，本批未动；
  23 号位两张卡的 `knowledge_text` 导语、其余 12 个号位（20、21、28–37）待确认、08/11 库尔班大叔重复与 08 台标版权待定；
  GitHub 令牌轮换（CR-20261029-22 的后续）仍待你本人执行。

## 第七批：按行业规则全站审查的 70 项修复（PR #231）

> 口径来自用户一句话：**「按行业规则审查网站代码，全部都要审，列出清单」→「一一解决，并行」**。
> 审查基线是 OWASP ASVS 4.0 L2 / Top 10 2021 / CWE Top 25、WCAG 2.1 AA、12-Factor、Vue 官方风格指南，
> 加 PIPL、未成年人网络保护条例、等保 2.0 二级；台账与 70 项清单本身只留在对话与 PR 正文里，不落报告文件。
>
> **编号从 26 起**：CR-20261029-25 已被第六批占用。本批按并行分组（A–G）成行，不按 70 项逐条成行——
> 逐条状态在 PR #231 正文与提交信息里，本表只记「哪一组动了哪些文件、结果如何」。
>
> 台账终值：**已修 52 / 部分修 18 / 未修 0**。18 条「部分修」不是漏做，是本轮明确不越界的项（见文末「仍没做」）。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
| --- | --- | --- | --- | --- | --- |
| CR-20261029-26 | fix(security) | `backend/src/middleware/{authMiddleware,validate,assetAuthMiddleware,dashboardAuthMiddleware}.js`、`backend/src/controllers/{authController,adminController}.js`、`backend/src/services/authService.js`、`backend/init_db.js` | 补回被摘掉的 zod 校验中间件；登录改成先验密码再判账号状态（消掉用户名枚举的时序差）；注册路径不接受 `can_view_all`；admin 重置口令改随机 + 写 `must_reset_password` + 落 `password_resets` 审计；内置 `admin/admin123` 取消，初始管理员必须由 `INITIAL_ADMIN_PASSWORD` 显式配置；内部看板在无 `DASHBOARD_PASSWORD` 时 fail-closed 返回 503 | 已通过 | 已上线（`main`@`8760894`；生产匿名看板三口由 200 收敛为 503，见发布事实） |
| CR-20261029-27 | fix(backend) | `backend/src/controllers/{answerController,studentController,teacherController,assetController,trackingController}.js`、`backend/src/services/{answerService,assetService}.js`、`backend/src/utils/{jsonReader,dbPromise,logger}.js` | 答题归属与判分：提交加 IDOR 守卫 `authorizeSubmit`，越权代答直接拒；资产上传与预签名 URL 补角色/归属校验，`/api/upload/resource` 与前端路由口径统一（含 `super_admin`）；埋点接口忽略 body 里的 `user_id`、只信登录态，并加 32KB payload 上限与 24h 时间戳偏移校验；日志与事务安全收口 | 已通过 | 已上线（`main`@`8760894`） |
| CR-20261029-28 | fix(frontend) | `src/utils/api.ts`（`sanitizeRedirect`、上传超时与 `signal`）、`src/stores/auth.ts`、`src/router/{index,guards}.ts`、`src/components/{LoginModal,StudentDisplay}.vue`、`src/views/{StudentLoginView,TeacherLoginView,AnswerQueryView}.vue` | 登录态与失效接口修正；越权入口按路由 `meta.role` 门禁拦截；`sanitizeRedirect`（在 `api.ts`）把 `route.query.redirect` 收敛到站内路径白名单，防开放重定向；上传单独 60s 超时并支持外部 `signal` 中止 | 已通过 | 已上线（`main`@`8760894`） |
| CR-20261029-29 | refactor(frontend) | `vite.config.ts`、`eslint.config.ts`、`src/components/**`、`src/composables/index.ts`、`src/mock/**`（删除） | 删首页桶文件、mock 目录与过期文档；修 `MultiRoleReading` 父子组件循环依赖；无障碍（`aria-live`、焦点可见、label 关联）与死代码清理。顺带补回此前只存在于工作区、导致 HEAD 干净克隆构建不出来的 `src/utils/tooltipPosition.ts` 与看板视图/图表组件 | 已通过 | 已上线（`main`@`8760894`；生产 `/v1/texts` 别名实测 200） |
| CR-20261029-30 | ci | `.github/workflows/*`、`.github/{CODEOWNERS,dependabot.yml,PULL_REQUEST_TEMPLATE.md}`、`scripts/*.sh`、`Dockerfile`、`docker-compose.yml`、`ecosystem.config.js` | 部署与环境变量、OSS 工具链、脚本健壮性：workflow 全部 `permissions: contents: read`、生产部署挂 `environment: production` + `concurrency`；脚本统一 `set -euo pipefail` 与显式错误退出；`package.json` 的 `lint` 拆成 `lint:oxlint` + `lint:eslint` 并加不带 `--fix` 的 `lint:ci` | 已通过（12 项检查 + 测试环境部署） | 已上线（`main`@`8760894`；生产部署 run `40863153617` 成功，`environment: production` 首次生效且**无审批人**） |
| CR-20261029-31 | chore(repo) | `.gitignore`、`backend/data/students.json`、`backend/data/answer_records.json`、`backend/database/answers.db`、`data-pipeline/source/*.xlsx`、`*.zip`、`SECURITY.md`、`CONTRIBUTING.md`、`LICENSE`、`README.md` | 移除误提交的 sqlite 数据库、真实学生名单与压缩包（PII 不再入库，本地文件保留所以数据管线照跑）；新增仓库治理文件。**`xlsx` 依赖删除**：npm 上 0.18.5 停在有原型污染通告的版本、官方修复只发在 SheetJS 自己的 CDN，导出改标准 CSV（UTF-8 BOM + RFC 4180 引号转义），内部看板下载名同步 `.csv` | 已通过 | 已上线（`main`@`8760894`） |
| CR-20261029-32 | test | `backend/tests/{security-hardening,export-format,answer-p0-security,admin-dashboard,teacher-dashboard}.test.js`、`tests/**`、`src/**/__tests__/*`、`vitest.config.ts` | 后端新增 `security-hardening.test.js`（30 例）与 `export-format.test.js`（8 例）；前端新增 open redirect、路由角色门禁、WordList 浮层、图表工具等用例；两张看板测试改按新鉴权契约（显式配 `INITIAL_ADMIN_PASSWORD`、学生登录用创建接口返回的一次性口令）；`vitest.config.ts` 的 `include` 恢复 `tests/**/*.spec.ts` + `setupFiles`，覆盖率门槛按合并后实测重定 | 已通过 | 不适用 |
| CR-20261029-33 | fix(ci) | `.github/workflows/{deploy-backend-test,deploy-backend}.yml` | 修本轮 E 组带回的测试部署回归：`.env` 门禁由「四把密钥全必需」改成「只对 `JWT_SECRET` 判红、其余三把 WARN 并写明哪个功能 503」；测试环境 `JWT_SECRET` 按旧值 > Secret > 现场生成一次并持久化补齐；剔除阶段顺带丢掉这四把的空值行。生产仍绝不自动生成密钥 | 已通过（本机抽出 `.env` 重建段跑三种机器状态 + `bash -n` + YAML parse；PR #250 六项检查全绿；合并后 run `40858018689` 部署成功、健康检查第 2 次通过） | 已上线（`main`@`8760894`；生产 `.env` 门禁实跑：旧 `JWT_SECRET` 保留未轮换，缺两把可选键只 WARN） |

### 合并后暴露的部署回归（同一轮内修掉，CR-20261029-33）

`Deploy Backend to Test Server` 在合并提交 `5e4886c` 上判红：
`ERROR: backend/.env 缺少必需变量: JWT_SECRET DASHBOARD_PASSWORD DEEPSEEK_API_KEY`——合并前该工作流连续 10 次成功，
所以是 E 组「fail-closed 环境变量校验」的回归，不是测试机坏了（部署中止，测试后端仍是上一个版本，没有半部署状态）。

根因是**门禁口径比后端代码严**：本仓库的 Actions Secrets 里只有 `ASSET_SYNC_TOKEN`（`gh api actions/secrets` 实查），
`JWT_SECRET` / `DASHBOARD_PASSWORD` / `DEEPSEEK_API_KEY` 三把 `inject_if_missing` 永远填不上；而代码对这三把的态度是
「功能关掉」而不是「服务起不来」（资产同步 503 / 内部看板 503 / AI 对话 503），真正硬抛的只有
`NODE_ENV=production` 且 `JWT_SECRET` 缺失一条。测试机上 `JWT_SECRET=` 还是**空值行**——旧版工作流无条件
`echo "JWT_SECRET=${{ secrets.JWT_SECRET }}"` 留下的痕迹。

改法（PR #250 @ `5c18a00`，只动两个 workflow 文件）：测试工作流的 `JWT_SECRET` 走「旧值 > GitHub Secret > 现场
`openssl rand -hex 32` 一次并持久化」，绝不留空（留空等于用可预测的 `dev-only-secret` 在公网域名 `test.classicalab.cn`
上发 token）；两个工作流把另外三把降为 WARNING 并写明「对应接口 503、不影响本次部署」，只有 `JWT_SECRET` 缺失才判红；
**生产不自动生成密钥**（静默换密钥会一次性作废全网已签发 token），缺失时保持人工处置。
剔除阶段顺手丢掉这四把的空白值行，避免新旧两行同时存在于一个文件里。

本机验证（不 SSH、不部署）：把 workflow 里的 `.env` 重建段抽出来在临时目录跑——复现测试机状态 → `rc=0` 且
`JWT_SECRET` 恰好 1 行、长度 64、其它键原样保留，**再跑一次值不变**（幂等，不会每次部署作废 token）；
已有真实值 → 不覆盖；生产段空值 → `rc=1` 并打印人工处置提示。

### 明细

- **分支 / commit / PR / 合并提交**：`feature/continue-nav-stuck`（Step-0 先落 `c149427` 快照保存当时工作区未提交改动，之后 22 个内容提交，末位 `0830713`）
  → 与 `origin/feature-1` 的 108 个新提交在 `d2f62b3` 合并（42 文件冲突）→ PR #231 → 合并提交 `5e4886c`。
  PR 上 `push` + `pull_request` 两条 run × 6 job 全绿才 `--merge`，分支不删；合并后 `feature-1` 复跑 CI。
- **一个真实回归**（就是它把台账从 51/19 改回 52/18）：`/v1` 别名原先写成挂载式 `app.use('/v1', fn)`，
  Express 在挂载层 `next()` 返回时会用保存的原始 url 还原 `req.url`，层内改写等于没生效，`/v1/texts` 实测 404。
  改成 app 级前缀判断后重写，测试覆盖 `/v1` 与 `/v1/api` 两种形态。**教训：URL 重写不能在挂载中间件里做。**
- **并行分组的文件所有权是真约束**：A–G 七组按「改动文件互不相交」划分，每组独立提交；撞车的只有 `package.json`
  与两份 workflow，靠 Step-0 快照保证任何一组都能回退。
- **与 feature-1 的冲突处理口径**（编号事实、测试面、门槛都以合并后为准）：素材编号四张表统一到 feature-1 的
  25 个已确认号 + `WEN_23=《活板》`；双方各自新建的同名文件（看板 service、charts、核查脚本、核查文档、几份测试）
  取 feature-1 版——它们已在自己的 CI 上跑绿，本分支一侧没有独有内容损失；安全侧改动逐条复核仍在（`/v1` 仍 app 级、
  导出仍 CSV 且 `xlsx` 命中 0、上传仍三角色、埋点 `user_id` 仍只信登录态、初始管理员仍需显式配置）。
  `vite.config.ts` 取并集（`vueDevTools` 只在 dev 注入 + 保留 `buildIdMeta`/`__BUILD_ID__`）；
  部署工作流取 feature-1 的分组缓存 + 构建指纹自检 + 线上黑盒验证，再补回 `data/`、`fonts/`、`favicon.ico` 走 no-cache
  （素材 JSON 改了必须立刻生效，否则旧 data 配新代码会给出错的篇目清单）。
- **覆盖率门槛为什么当场重定**：并入 feature-1 后测试面从 19 文件 278 例回到 64 文件 967 例，
  实测 stmts 53.05 / branch 44.58 / funcs 51.25 / lines 53.84，原为小测试面定的 18/20/13/18 已不构成任何约束，
  按实测留 ≥5 个点余量改为 45/38/42/45。门槛的作用仍是「不许往下走」，不是达标线。
- **合并后的验证数字**（本机与 CI 逐项一致；CI run `40855488092` 六项全绿）：后端 Jest 27 suites / 527 tests；
  前端 Vitest 64 files / 967 tests；`vue-tsc --build` 0 error；`oxlint .` 302 文件 0 warning 0 error；`eslint .` 0 problem；
  `vite build` 成功并产出 `TeacherDashboardView` / figma 资产 chunk。
- **用户已确认「明确不做」的五项**：git 历史清洗（`filter-repo` + 强推，历史里 2026-06 的 `JWT_SECRET` 就留着）、
  登录强制改密（`must_reset_password` 仍只写不校验）、JWT 刷新与密钥轮换、OSS ACL / 桶策略操作、生产库运维。
- **仍没做（18 条部分修集中在这里，留给后续 PR）**：`AnswerQueryView.vue` 仍 1812 行未拆；前端无 CSP；
  `jsonReader` 仍是每请求同步 `readFileSync`；`tsconfig.app.json` 仍排除 `src/**/__tests__/*`（这批测试不在任何
  vue-tsc project 里）；残留 2 处 `as any`；`StudentLogin.vue` 死代码仍在；`parseLimit` 未导出所以钳制逻辑没有单测。
  另：`.vscode/extensions.json` 仍被跟踪——当前 sparse-checkout 排除了 `.vscode/**`，这条删除既无法暂存也没进本 PR。
- **验证边界（不给自己加分）**：按项目约束本批全程未启动本地服务、未部署、未 SSH，因此没有真实浏览器端到端验证，
  CI 是唯一外部门禁；无障碍项按代码与 ARIA 契约核对，未做屏幕阅读器实测。
- **`docs/QUALITY_ASSESSMENT.md`（2026-10-23）的安全性 86 分 / B+ 已不成立**。该文件按 feature-1 的版本入库（10-23 快照，
  文件头的「落库时点说明」只提到 PR #207 / #210 / #211 三笔），本批不回填重算，只在其说明里补一句
  「PR #231 的 70 项台账取代本报告的**安全性**结论」——原稿其余打分继续作历史记录保留。
- **两处 `as any` 是核过的**：`src/views/AdminConsoleView.vue:120`、`src/views/StepView.vue:151`
  （`grep "as any"` 的第三条命中是 `ClassPicker.test.ts` 里「无需 as any」那句注释，不是违规）。

### 发布事实

- 本批只到 `feature-1`（`5e4886c` + `de822c6`），**没进 `main`**：`feature-1` → `main` 只走人工审批的发布 PR。
  所以生产仍是 10-29 中午那版，`https://api.classicalab.cn` 的行为没变；测试环境已带上新契约。
- 测试环境副作用一条，说明白：CR-33 的修复让测试机第一次现场生成了 `JWT_SECRET`，
  **此前签发的测试站 token 全部作废一次**，测试账号需重新登录（此后每次部署沿用已持久化的那把，不再变）。
- 需要人工确认的一件事：`seedInitialAdmin()` 只在 `admins` 表为空时按 `INITIAL_ADMIN_PASSWORD` 建号，
  所以**已存在的库里那行 admin 的口令哈希不会被本批改掉**——如果测试/生产库里的 admin 还是当年
  `admin/admin123` 播下的，得人工登进去改密（我没动库、也没 SSH，无法代为确认）。
- **测试环境黑盒核对（CR-33 部署后，run `40858018689` 成功、健康检查第 2 次通过）**：
  `https://test-api.classicalab.cn` 上 `/v1/texts` 与 `/v1/api/texts` 均 200 且返回同一份 4 篇课文
  ——证明 `/v1` 别名那条真回归**在部署产物里已经好了**；`/api/home/dashboard` 返回
  `503 DASHBOARD_AUTH_NOT_CONFIGURED`——证明看板 fail-closed 也生效了（测试机没配 `DASHBOARD_PASSWORD`，
  这正是 CR-33 那条 WARNING 说的事；要在测试环境看看板就写进 `.env` 或建同名 Secret）。
- **⚠️ 生产当前是未修状态**（同一时刻在 `https://api.classicalab.cn` 实测）：
  `/v1/texts` → 404（别名回归仍在生产）、`/api/home/dashboard` → **200 且返回真实汇总**
  （`studentCount:1 / submissionCount:0 / passRate:0`）、`/api/home/dashboard/raw` → 200、
  `/api/tracking/funnel` → 200，三者都**不带任何凭据**；`/api/admin/students` → 401（管理端一直是保护的）。
  也就是说内部看板那几个代理接口此刻对公网匿名开放，修它的代码已经在 `feature-1`，
  **只有走 `main` 的发布 PR 才会生效**（本批没有那个权限，也不该自动合）。
  → **本条已闭合**：当晚 PR #253 合入 `main`@`8760894`，三口在生产实测收敛为 503、`/v1/texts` 恢复 200，
  见文末「发布事实（2026-10-29 晚）」。

### 本批新增的 dependabot 配置立刻开了 18 个 PR（待你处置，我没合任何一个）

PR #231 里加的 `.github/dependabot.yml`（4 个生态各 `open-pull-requests-limit: 5`，weekly）第一次扫描就开了
PR #232–#249 共 18 条，正好每个生态顶到 5 条上限。抽查：#242/#247/#244 六项检查全绿，**#238（vitest 4→5）有 1 条红**。
这些几乎全是 major（vitest 5、TypeScript 7、zod 4、dotenv 18、supertest 7、actions 大版本），
major 升级要人工判断（zod 4 会动所有 schema、vitest 5 会动配置），所以**本批一条都没合**。
要少受这个干扰可以把三个 npm 生态加 `ignore: update-types: ["version-update:semver-major"]`，
只留 minor/patch + 安全更新；但那样 CVE 需要 major 才能修时依赖更新不会自动来，得人工发起——要不要收紧由你定。

### 发布事实（2026-10-29 晚：第六批 + 第七批上 `main`@`8760894`）

> 触发口径是用户的一句话「**合并main**」。这一班把第六批（覆盖率门禁接进 CI、23 号位卡片）与第七批
> （70 项全站审查修复 + 它自己带回的测试部署回归）一起发进生产。

- **前置：先把 `main` 合回 `feature-1`**。`main` 上有两个 `feature-1` 没有的提交（#226 发布后的状态回填 `2bcec3e`
  与其合并提交 `07a823c`，纯 `docs/**` + `tasks/**`），直接开发布 PR 会在 `changelog-20261029.md`、`nightly-tasks.md`
  撞冲突——两条会话都往文件尾追加。PR #252（合并提交 `1b62516`）只做这件事：两边文字一句没删，
  只把 `### 发布事实（2026-10-29 下午复核）` 按真实时序放回第五批之后、第六批之前（13:13:31 发布 → 13:19:33 回填 →
  13:28/13:29 第六批并进 `feature-1`）。合完 `compare main...feature-1` = `ahead_by: 37 / behind_by: 0`，
  `main` 成为 `feature-1` 的祖先，发布 PR 的 `mergeStateStatus` 才变 CLEAN。
- **发布 PR #253**（`feature-1`@`1b62516` → `main`）：`CI Checks` run `40862897607` 六项全绿
  （quality-check 48s / backend-check 27s / circular-check / figma-plugin-check / pipeline-test / secret-scan），
  19:09:08（UTC+8）`--merge` 为 `main`@`8760894`。
- **`main` push 触发的四条 run 全绿**：`CI Checks` `40863153667`、`Deploy Frontend to Aliyun OSS` `40863153680`、
  `Deploy Backend to Aliyun Server` `40863153617`、`Sync Figma Plugin to wenyan-asset-sync` `40863153595`。
- **`environment: production` 第一次被真正使用，且它没有任何闸口**：仓库此前只有 `test` 一个 environment，
  GitHub 在本次 run 里自动建了 `production`；发布后实测 `GET /repos/.../environments` 返回
  `production: {protection_rules: [], reviewers: null, can_admins_bypass: true}`
  ⇒ **合进 `main` 就是自动部署生产，没有人工审批步骤**。要恢复人工闸口得在 Settings → Environments → `production`
  加 Required reviewers；那是账号权限设置，我没有动，也不该由我给自己开。
- **生产部署日志实抄**（run `40863153617` 的 `[2/5]` 之后）：
  `WARNING: 以下可选密钥未配置，对应接口将 fail-closed 返回 503（不影响本次部署）: DASHBOARD_PASSWORD DEEPSEEK_API_KEY`。
  `JWT_SECRET` 走「旧值优先」被完整保留 ⇒ **本次没有轮换密钥，已签发的生产 token 不失效**；`ASSET_SYNC_TOKEN` 有值
  （仓库里确实建了这把 Secret）。新版脚本这次没有截断 `.env`——旧版是 `echo "PORT=3000" > backend/.env` 重建，
  会把手工键连根抹掉，这正是 CR-20261029-30 改成「保留旧值 + 只覆盖受管键」的原因，现在写进 `.env` 的键能留住。

#### 线上黑盒对照（合并前 `8db7a6e` → 合并后 `8760894`，全部不带任何凭据）

| 探针                                       | 合并前（实测）                       | 合并后（实测）                          | 判定                                                     |
| ------------------------------------------ | ------------------------------------ | --------------------------------------- | -------------------------------------------------------- |
| 前端 `index.html` 的 build-id              | `8db7a6e`                            | **`8760894`**                           | 新版前端确实发布到生产 OSS                               |
| `GET /v1/texts`                            | 404                                  | **200**                                 | R7 别名修复生效（`app.js` 的 app 级 URL 改写）           |
| `GET /v1/api/texts`                        | 未测                                 | 200                                     | 没被改写成 `/api/api/texts`                              |
| `GET /api/home/dashboard`                  | **200 且返回真实汇总**（`studentCount:1 / submissionCount:0 / passRate:0`） | **503** `DASHBOARD_AUTH_NOT_CONFIGURED` | 公网匿名口子闭合；代价见下方「要补的两把键」             |
| `GET /api/home/dashboard/raw`              | 200                                  | 503                                     | 同上                                                     |
| `GET /api/tracking/funnel`                 | 200                                  | 503                                     | 同上                                                     |
| `GET /api/admin/students`                  | 401                                  | 401                                     | 管理端一直受保护，无回归                                 |
| `POST /api/auth/student/login`（空 body）   | 400                                  | 400 `VALIDATION_ERROR`                  | zod 校验中间件回来了，且没有过拒                         |
| `POST /api/auth/student/login`（错凭据）    | 401                                  | 401 `INVALID_CREDENTIALS`               | bcrypt 对**存量**用户行仍可比对（没有 500，改密逻辑没伤到既有账号） |
| `GET /api/texts` / `/api/assets/inventory` / `/api/health` | 200 / 200 / 200        | 200 / 200 / 200                         | 读接口无回归                                             |
| `GET /data/culture_cards/WEN_23.json`      | 发版前记录 404（本轮未复测）         | **200**（`text_id: WEN_23`，两张卡）    | 23 号位卡片数据随本次构建上线                            |

#### 因此要在服务器上补两把键（否则这两个功能在生产是 503）

1. **`DASHBOARD_PASSWORD`**：不写就没有任何人能看到内部数据看板（上面三口全 503）。这是审查里定的 fail-closed 口径，
   不是回归——之前那个 200 是把学生答题汇总对公网匿名开放。
2. **`DEEPSEEK_API_KEY`**：不写则 AI 对话 503。**这一把不是本次发布弄坏的**：旧版部署脚本每次 `> backend/.env` 截断重建，
   它历史上每部署一次就被抹一次，所以生产 AI 对话早就不可用；新版只是把这件事变成一条明确的 503 加一行 WARNING，
   而不是静默 500。

做法（我没有 SSH 权限，也不该有，需要你本人在服务器执行）：往生产的 `backend/.env` 追加
`DASHBOARD_PASSWORD=<强口令>` 与 `DEEPSEEK_API_KEY=<sk-...>`，然后 `pm2 restart wenyan-backend --update-env`。
下次部署不会再覆盖它们；也可以建同名 GitHub Actions Secret，让 `inject_if_missing` 在 `.env` 缺值时补上——
但对 `JWT_SECRET` 生产**仍然绝不自动生成**，静默换密钥会一次性作废全网 token。

#### 更正我写在 PR #253 正文里的一句

PR #253 描述写「`/api/v1/texts` 现在是 404，合并后应为 200」——**路径口径错了**。别名是 `/v1/...`
（`backend/src/app.js` 在 app 级判断前缀再改写 URL，注释里就写了不能挂 `app.use('/v1', fn)`），
`/api/v1/texts` 这个路径本来就不存在，生产与测试都 404。实测成立的是 `GET /v1/texts` → 200、
`GET /v1/api/texts` → 200。上面表格按实测写。
