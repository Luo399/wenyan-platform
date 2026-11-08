# 发布新鲜度方案（Release Freshness）

- 起草：2026-10-26
- 状态：**执行中**（阶段 0 / 1 / 2 / 3 / 4 的代码与单测都已落地；余下的是 `feature-1 → main` 人工审批与线上浏览器矩阵复验，见第 8 节）
- 父功能分支（拟）：`feature/release-freshness`，从 `feature-1` 拉取
- 关联：`docs/test-environment-deployment-guide.md`、`docs/上线检查清单.md`、`tasks/nightly-tasks.md`、`.trae/rules/project-workflow.md`

---

## 1. 事实基线（2026-10-26 实测，非推断）

| 环境 | 域名 | 源 | 当前构建 | 触发条件 |
|------|------|----|---------|---------|
| 生产前端 | `www.classicalab.cn` | OSS `wenyan-online` + 阿里云 CDN | `main` = `1939ad1`（10-22 09:32 合 PR #184）；`deploy-frontend` 最后成功 10-22 04:53:09Z；实测 `Last-Modified: Thu, 22 Oct 2026 04:53:47 GMT`，引用 `/assets/index-CMpvJ45v.js` | push `main` 且命中 `src/**` 等路径 |
| 测试前端 | `test.classicalab.cn` | OSS `wenyan-test-online`，**实测 `Server: AliyunOSS` 直连、无 CDN** | `feature-1` = `f42f2ed`；`deploy-frontend-test` 最后成功 10-23 02:49:08Z；实测 `Last-Modified: Fri, 23 Oct 2026 02:49:45 GMT`，引用 `/assets/index-DVZS5nIx.js` | push `feature-1` |

实测响应头：

- 生产 `/` 与 `/index.html` 均返回 `Cache-Control: max-age=0`（OSS 对象上传的是 `no-cache`，CDN 改写），`Via: cache*.l2et15-1 → cache*.cn9340` 两级边缘节点，`X-Cache` 在 HIT/MISS 之间浮动。
- 生产 hash 资源 `/assets/index-CMpvJ45v.js` 返回 `Cache-Control: max-age=31536000`、`X-Cache: HIT TCP_MEM_HIT`。
- 测试根路径返回 `Cache-Control: no-cache`（未被改写，因为没走 CDN）。

三条由此可得的结论：

1. **10-26 的导航修复（`fb87b47` / `84290bd` / `0d7005b`）既不在生产也不在测试**——它们只在 `feature/continue-nav-stuck` 上，连 `origin/feature-1` 都没进。所以「某些浏览器已经好了」不可能是新代码生效，而是同一份旧构建在特定时序下不复现。这是本方案要先钉死的事实，否则会把 bug 当成已修。
2. 入口 HTML 的缓存契约方向是对的（hash 资源长缓存 + HTML 每次回源）。跨浏览器差异更可能来自：多级 CDN 边缘节点刷新不一致、浏览器磁盘缓存/BFCache 里挂着的旧会话页面、以及素材 `version.json` 那一层**数据**缓存（与代码无关，见 `src/utils/asset.ts`）。
3. 顺带发现两个证书问题：`classicalab.cn`（裸域）与 `test.classicalab.cn` 在严格客户端下主机名校验失败（`SEC_E_WRONG_PRINCIPAL`），只有 `www.classicalab.cn` 通过。这不影响本方案，但会让「换浏览器/换域名复现」的判断失真，建议单列一条修证书的任务。

---

## 2. 目标与验收标准

- **G1 可辨识**：任何人 5 秒内能说出用户跑的是哪次构建。验收：测试与生产页面显示不同的构建号，且与 `git rev-parse --short HEAD` 一致。
- **G2 部署即生效**：部署完成后 5 分钟内，所有边缘节点返回新入口。验收：workflow 内 CDN 刷新失败会让 job 变红；并有一条 curl 自检步骤比对 `Last-Modified` 已变。
- **G3 旧会话自愈**：懒加载 chunk 拉取失败时自动恢复，不停留在半死页面。验收：手工把某个 chunk 改名后触发路由跳转，页面自动刷新一次且不死循环。
- **G4 先测后上**：导航修复必须在 `test.classicalab.cn` 人工复验通过后才允许进 `main`。

---

## 3. 阶段与分支规划

阶段 0 是前置，不属于新功能，但必须最先做——否则后面所有验证都在一份落后 31 个提交的构建上跑。

| 阶段 | 分支 | 内容 | 完成后去向 |
|------|------|------|-----------|
| 0 | `feature/continue-nav-stuck` → `feature-1` | `--no-ff` 合并并 push，触发测试环境部署；在 test 上按复现矩阵人工复验「继续」按钮 | 留在 `feature-1` 等生产窗口 |
| 1 | `feature/release-freshness/build-id-visibility` | 构建号注入 + 页脚显示 + 单测 | `--no-ff` → `feature/release-freshness` |
| 2 | `feature/release-freshness/deploy-cache-contract` | 两个 deploy workflow 的上传拆分与 CDN 刷新校验 | 同上 |
| 3 | `feature/release-freshness/chunk-reload-recovery` | `vite:preloadError` / chunk 失败自动刷新一次 | 同上 |
| 4 | `feature/release-freshness/version-prompt` | 版本探测 + 更新提示（D2 已定：只提示不自动刷新）—— 已完成，见第 8 节 | 同上 |

父分支 `feature/release-freshness` 全部子项完成后合入 `feature-1` 并 push（触发 `deploy-frontend-test` + `deploy-backend-test`），在 test 复验，再单独创建一个 `feature-1 → main` 的 PR 等人工审批上线。台账按约定勾 `tasks/nightly-tasks.md` 并记分支名与 commit，变更记录写 `docs/maintenance/changelog/changelog-YYYYMMDD.md`。

**每次 push 后必须轮询 Actions 到 completed**（`.trae/rules/project-workflow.md` 第 1 节）。监控矩阵：子分支看 `CI Checks`；`feature-1` 看 `CI Checks` + `Deploy Backend to Test Server` + `Deploy Frontend to Test OSS`；`main` 看 `CI Checks` + `Deploy Backend to Aliyun Server` + `Deploy Frontend to Aliyun OSS`。注意 `quality-check` 在 `f42f2ed` 基线上本来就是红的（前端 vitest 步骤），不能算成本方案引入的回归，但也不能拿它当挡箭牌——新引入的失败必须当场修。

---

## 4. 文件级改动点

### 阶段 1：构建号可辨识

- `vite.config.ts`：加 `define: { __BUILD_ID__: JSON.stringify(buildId) }`。`buildId` 取 `process.env.GITHUB_SHA?.slice(0,7) ?? 'local'` 拼 CI 提供的 run 序号，**不要用 `Date.now()`**——构建时间戳会让同输入产出不同字节，与素材链路「产物字节稳定」的既有约定冲突。
- `src/env.d.ts`：`declare const __BUILD_ID__: string`。
- 新增 `src/components/common/BuildStamp.vue`（组件名 ≥ 2 词），页脚灰色小字；挂在 `src/App.vue`。是否对学生可见见决策点 D1。
- 新增 `tests/components/BuildStamp.test.ts`。

### 阶段 2：部署缓存契约

`deploy-frontend.yml` 与 `deploy-frontend-test.yml` 各改三处：

1. 长缓存只给 hash 产物：`cp -r ./dist/assets oss://<bucket>/assets --meta "Cache-Control:public,max-age=31536000,immutable"`；`index.html` 单独 `no-cache`；其余 `public/` 静态文件（favicon、robots）走 1 小时中缓存。**现在的写法是整个 dist（含 index.html）先打一年缓存，只靠第二步补救，顺序一失败就出现「某台浏览器一年不更新」。**
2. CDN 刷新：`RefreshObjectCaches` 同时刷 `/` 与 `/index.html`，之后轮询 `DescribeRefreshTasks` 直到任务完成；**把现在的 `|| echo "Warning: ..."` 改成失败即 `exit 1`**。测试域名实测不过 CDN，那一步对它只做 OSS 自检。
3. 新增「部署自检」步骤：`curl -sI` 比对 `Last-Modified` 是否等于本次上传时间、index.html 里的 `/assets/index-*.js` hash 是否等于本次构建产物；不一致直接 job 失败。
4. 顺带更正 `.trae/rules/project-workflow.md` 第 3 节「CDN 走 CloudFront 失效」——实际主链路是阿里云 CDN，CloudFront 那步是 legacy 兜底（`CLOUDFRONT_DISTRIBUTION_ID` 未设置即跳过）。

### 阶段 3：旧会话自愈

- `src/main.ts`：`window.addEventListener('vite:preloadError', ...)`，并在 `router.onError` 里匹配 `Failed to fetch dynamically imported module` / `ChunkLoadError`，命中后用 `sessionStorage` 标记做**最多一次**整页刷新（防死循环），刷新前把当前路由 name 存下来以便回到原页。
- 这条的价值：部署瞬间挂着页面的用户，点进懒加载路由（`src/router/index.ts` 里 `DetailView`、`StudentLoginView` 等都是动态 import）时不会再白屏。

### 阶段 4：版本探测（需 D2 通过）

- 新增 `src/utils/buildVersion.ts`：定时（页面重新可见时 + 每 10 分钟）以 `cache: 'no-store'` 拉 `/index.html`，比对 script src 的 hash；变化则提示「有新版本，点击刷新」，**不自动刷新**。
- 走 `utils/` 层，不在组件里直接 fetch，符合分层红线；素材侧已有的 `version.json` 机制（`src/utils/asset.ts`）只管数据，不复用它做代码探测。

### 文档

- `docs/test-environment-deployment-guide.md` 增补「部署后自检三行命令」；`docs/上线检查清单.md` 增加版本核对项；复现矩阵（无痕 / `Ctrl+F5` / 换出口网络）写进测试规范，用来区分浏览器磁盘缓存、CDN 边缘节点与真 bug。

---

## 5. 需要定的三件事

- **D1 构建号给谁看**：学生端也显示（最省沟通成本，美术报 bug 先报版本号）／只在 `test` 显示、生产仅进 `console`／生产页脚对所有人可见。我倾向第一种。
- **D2 发现新版本时**：只提示不刷新（推荐，避免学生答题中途被刷掉）／自动静默刷新（危险）／不提示，只让 G3 的失败自愈兜底。
- **D3 生产窗口**：`feature-1 → main` 的合并与上线时间。规则要求接近次日 08:00 不开新任务，且生产部署会同时触发后端 workflow，需要避开学生使用高峰。

---

## 6. 风险与回滚

- OSS 是覆盖式上传且从不删旧对象，所以旧 index.html 引用的 chunk 始终在——**回滚 = 用备份重传 index.html 一条命令**。建议部署时把本次 index.html 另存为 `index-<buildId>.html`。
- `immutable` 对已经存在一年的 index.html 缓存无效（用户本地已经存了一年），拆分上传只能防止**新增**受害者；已中招的浏览器要靠一次硬刷新清掉，这也是 G1 存在的理由。
- CDN 刷新需要 AK 具备 `cdn:RefreshObjectCaches` 权限。当前 workflow 复用 `OSS_ACCESS_KEY_ID`，若权限不足，今天会**静默**失败（那行 `|| echo Warning`），阶段 2 让它显式变红。
- 自动刷新兜底必须带单次限制，否则 chunk 持续 404 会变成无限刷新循环。
- 明确不做的事：不引入 Service Worker / PWA。它会把缓存不一致从边缘节点搬到每台机器上，与本方案目标相反。
- 约束沿用：不启本地服务、不 SSH、不改真实 `.env` 密钥，所有验证都在云端与 `curl` 上做。

---

## 7. 验证清单（每阶段收尾必查）

```bash
# 1. 现在线上是哪次构建
curl -sSI https://www.classicalab.cn/index.html | grep -i last-modified
curl -sS  https://www.classicalab.cn/ | grep -o '/assets/index-[^"]*'
# 2. 测试环境对照
curl -kSs https://test.classicalab.cn/ | grep -o '/assets/index-[^"]*'
# 3. CI 闭环
gh run list --branch feature-1 --limit 5
```

外加人工矩阵：Chrome / Edge / Safari 各一次，每浏览器再跑「无痕」「`Ctrl+F5`」「手机热点」三种组合，记录构建号而不是记录「看起来好了没好」。

---

## 8. 执行记录（滚动更新）

### 2026-10-28 收尾：生产已上线，测试环境待补一轮

- **已上线（生产）**：阶段 0（导航修复）+ 阶段 2 的 `deploy-frontend.yml` 随 PR #190 进入 `main` 并完成部署。实测 `https://www.classicalab.cn/` 返回 `Cache-Control: max-age=0`、入口 `/assets/index-BFzw8KIW.js`。
- **已在测试环境**：阶段 2（测试侧 workflow）+ 阶段 3 + 阶段 1 合入 `feature-1`，`Deploy Frontend to Test OSS` 首跑成功，自检第 1 轮命中 `/assets/index-DiJuirkI.js`。
- **仍未完成的验证**（阶段 1 的 meta 生效只能在这一步确认，生产那份构建里没有它）：
  1. ~~`curl -kSs https://test.classicalab.cn/ | grep build-id` —— 期望 `content="<feature-1 提交短 sha>"`；显示 `content="local"` 说明 `define` 没吃到 `GITHUB_SHA`。~~ 已验：`feature-1` 到 `4b44b2f8` 后测试环境返回 `<meta name="build-id" content="4b44b2f">`，与提交短 sha 一致；部署后的入口 chunk `assets/index-PXv-Td1Z.js` 里是 `function jd(){return Md("4b44b2f")}`，`__BUILD_ID__` 出现 0 次（`define` 生效、`typeof` 守卫被折叠掉）。
  2. 浏览器打开测试环境，页脚备案号右侧应出现「· 构建 xxxxxxx」；出现「本地构建」同上原因。（curl 已证明常量进了产物，这一条只剩肉眼确认）
  3. G3 的人工验收（把某个 chunk 改名后触发路由跳转，页面自动刷新一次且不死循环）与浏览器矩阵复验（无痕 / `Ctrl+F5` / 手机热点）尚未执行 —— 测试环境证书与账号问题见下。
- **仍未完成的收尾**：阶段 4 的代码与单测已并入集成分支（`ca8c6c96`），等 `feature-1` 合并与测试环境真跑；`feature-1 → main` 的 [PR #193](https://github.com/Luo399/wenyan-platform/pull/193) 仍等人工审批。

### 2026-10-26 阶段 0 —— 完成

`feature/continue-nav-stuck` 经 [PR #187](https://github.com/Luo399/wenyan-platform/pull/187) 以 `--no-ff` 合入 `feature-1`（合并提交 `762f3f3`）。CI 轮询到 completed：`Deploy Frontend to Test OSS` 成功；`CI Checks` 仅 `quality-check` 红，失败的是 `ClassPicker.test.ts` 那 9 条与基线 `f42f2ed` 完全相同的用例，本分支新增的 `useNavigation.test.ts` 通过。`secret-scan` 在合并这次是绿的——之前那次红是 `fetch-depth: 0` 全历史扫到 6 月的 16 条 JWT_SECRET 命中。测试环境入口从 `/assets/index-DVZS5nIx.js` 换成 `/assets/index-C9scjl38.js`，`Last-Modified` 与部署时刻一致。

行为级复验被两件实测出来的事挡住：`test.classicalab.cn` 证书主机名不匹配（Chrome 直接 `ERR_CERT_COMMON_NAME_INVALID`，连测试构建的图片都加载失败），以及 `99999999/99999999` 在 `test-api` 返回 401、同一组凭据在 `api`（生产）返回 200。经用户决定：跳过 test，改走生产复验。

### 2026-10-26 阶段 2 —— 代码已提交，待合入验证

[PR #188](https://github.com/Luo399/wenyan-platform/pull/188)：`feature/release-freshness/deploy-cache-contract` → `feature/release-freshness/main`，提交 `7599a12`。两个 deploy workflow 改成分段上传（assets 一年 immutable / index.html no-cache / 其余 1 小时）、CDN 刷新失败即红、新增部署后黑盒自检。本地校验：js-yaml 解析通过、15 个 run 脚本 `bash -n` 通过、自检正则对生产与测试真实响应实测过匹配与不匹配两条分支、远端 blob sha 与本地 `git hash-object` 逐个一致。

### 两条对方案本身的修正

- **分支命名**：`feature/<父>` 与 `feature/<父>/<子>` 在 git 里是互斥的（前者是文件、后者要当目录，D/F 冲突）。仓库既有做法是 `feature/data-dashboard/main` 这种「`<父>/main` 作集成分支」，本方案照此改为 `feature/release-freshness/main` 当集成目标。
- **CI 覆盖盲区**：`.github/workflows/deploy-*.yml` 的改动不触发任何检查（`ci-checks.yml` 的 push 路径过滤不含它，`pull_request` 只听 main / feature-1）。也就是说部署脚本的第一次执行就是在 feature-1 或 main 上真跑。已单列任务补 actionlint。
- **单测落点**：第 4 节原写 `tests/components/BuildStamp.test.ts`，但 `vitest.config.ts` 的 `include` 是 `src/**/*.test.ts`（`tests/**` 那批老 spec 已不参与 CI），写在 `tests/` 下等于没有测试。阶段 1 实际落在 `src/utils/__tests__/buildStamp.test.ts` 与 `src/components/__tests__/BuildStamp.test.ts`。

### 2026-10-28 阶段 3 —— 完成

`feature/release-freshness/chunk-reload-recovery` @ `490c06e`（父 `762f3f3`），经 [PR #191](https://github.com/Luo399/wenyan-platform/pull/191) 合入 `feature/release-freshness/main`（`8dcbddba`）。

新增 `src/utils/chunkRecovery.ts`（328 行）+ `src/main.ts` 注册 + 419 行单测（21 项，CI 全绿）。与第 4 节的设想相比有三处收窄：

- 重载目标是**本次导航要去的路由地址**（`beforeEach` 记 `to.fullPath`，`onError` 优先用 vue-router 5 传入的 `to`），不是当前地址 —— 刷新完还能回到用户要点的那一页。前提是深链可重载：实测 OSS 静态网站的 404 回落到 index.html，`www` 与 `test` 都成立。
- 只认动态 import / 预加载失败的错误文案（Chrome、Firefox、Safari、Vite CSS 预加载、webpack `ChunkLoadError`）。业务接口失败绝不刷新，否则一次断网就把学生正在答题的页面刷掉。
- 一次会话内同一地址只重载一次：内存标志 + sessionStorage 记录 + 10s 冷却，且**真正到达该地址后**才由 `afterEach` 释放记录，避免新旧版本交替时死循环。`vite:preloadError` 不 `preventDefault`，让 `router.onError` 也能命中同一条链路（`reloadScheduled` 保证只刷一次）。
- 放弃重载的四种情况（离线 / 已重载过 / 冷却中 / sessionStorage 不可用）会写 `wenyan:chunk-reload-hint` 并派发 `wenyan:chunk-reload-failed` 事件，阶段 4 的「只提示不刷新」直接对接。

### 2026-10-28 阶段 2 —— 已合入并在测试环境首次真跑

[PR #188](https://github.com/Luo399/wenyan-platform/pull/188) 合入集成分支（`c6cebe18`），[PR #192](https://github.com/Luo399/wenyan-platform/pull/192) 把阶段 2 + 3 落到 `feature-1`（合并提交 `3c0a786`）。push 触发 `Deploy Frontend to Test OSS`，新 workflow 第一次真实执行即成功：分段上传（assets `immutable` / index.html `no-cache` / 其余 1 小时）跑通，自检第 1 轮就命中 —— `https://test.classicalab.cn/` 返回本次构建的 `/assets/index-DiJuirkI.js`。

同一次 push 的 `CI Checks` 只有 `quality-check` 的 vitest 步骤红，失败的是继承的 `ClassPicker.test.ts` 9 条；本分支新增的 `chunkRecovery.test.ts` 21 条全绿。生产侧的阶段 0 复核（入口 `/assets/index-BFzw8KIW.js`、`Cache-Control: max-age=0`）由用户自行合 [PR #190](https://github.com/Luo399/wenyan-platform/pull/190) 完成。

### 2026-10-28 阶段 1 —— 完成

`feature/release-freshness/build-id-visibility` @ `7013e55` + 修复 `d452d16`，经 [PR #194](https://github.com/Luo399/wenyan-platform/pull/194) / [PR #195](https://github.com/Luo399/wenyan-platform/pull/195) 合入集成分支（`a25c377`）。

- `vite.config.ts`：`define.__BUILD_ID__` 取 `GITHUB_SHA` 前 7 位，本地退回 `local`；另加 `inject-build-id-meta` 插件把同一个号写进 `index.html` 的 `<meta name="build-id">`（页脚的号给人看，这条给 curl / CI 看）。按第 4 节约定没有掺时间戳。
- `env.d.ts` 声明常量（该文件在仓库根目录，已被 `tsconfig.app.json` 的 include 覆盖，不在 `src/` 下）；`src/utils/buildStamp.ts` 收全部格式化分支，`src/components/common/BuildStamp.vue` 只负责摆进页脚那一行，与备案号同一行、`pointer-events` 单独放开便于复制。
- **踩到并修掉的坑**：模板里一条根级 HTML 注释在开发模式下也是一份子节点，组件变成 fragment，`@vue/test-utils` 的 `wrapper.element` 是挂载容器 `DIV`，三条用例因此红。说明移进 `<script setup>`，并把「必须是单根」写成断言锁死。
- D1 按第一选项实施：学生端也显示。要改成只测试环境可见的话，是删一行的事。

### 2026-10-28 阶段 4 —— 代码与单测完成

`feature/release-freshness/version-prompt` @ `a4f0330` + 修红 `2b2edf0`，经 [PR #197](https://github.com/Luo399/wenyan-platform/pull/197) / [PR #198](https://github.com/Luo399/wenyan-platform/pull/198) 合入集成分支（`ca8c6c96`）。新增 `src/utils/buildVersion.ts`（331 行）+ `src/components/common/UpdatePrompt.vue`（187 行）+ `src/App.vue` 挂载 + `src/main.ts` 注册，单测 23 + 10 项。

- **探测路径的选择是这一阶段的关键**：请求的就是用户手动刷新时会走的那条 `/index.html`，`cache: no-store` 但**不加时间戳参数**。加了时间戳会绕过边缘节点，测出「线上并不提供的那份」，提示就变成假消息。
- **指纹两档**：主口径 `meta[name=build-id]`（阶段 1 注入的），备口径入口 chunk 文件名 `/assets/index-*.js`；两种口径之间不比较，口径不同宁可不说，避免误报。本地开发（构建号为 `local`）拿不到本地指纹，整条链路不参与。
- **只提示不刷新的落点**：探测层只 `dispatchEvent`；`requestManualRefresh()` 只有组件的点击会调用，单测把「事件到来时它没被调用」写成断言。节流是「首屏不查 + 10 分钟一次 + 切回标签页补一次，最小间隔 60s」，离线与请求失败全部静默（仅开发环境一行 `debugWarn`）。
- **接住了阶段 3 的放弃分支**：`wenyan:chunk-reload-failed` 事件与 `wenyan:chunk-reload-hint` 记录都在这里变成人话。文案用 `Record<ChunkRecoveryHint['reason'], string>` 而非 switch，以后阶段 3 加了新原因，这里编译期就漏。hint 带 10 分钟有效期，旧记录不再弹。
- **两条被 CI 教的事**：① 根级注释 / 根级 `v-if` 都会让组件变 fragment，`wrapper.element` 就不是那个 div —— 阶段 1 踩过一次，这里直接把「单根」写成断言，隐藏改用 `.is-hidden` 控制 `display`。② `onMounted` 里改状态是异步重渲染，挂载那一帧还是隐藏；「监听就绪之前的 hint」必须回到 setup 里读，顺带也免掉了先藏后现的闪动（PR #198 修的就是这条）。

### 决策点结论

- **D1 构建号给谁看**：已定 —— 全员可见（阶段 1 已实施，12px 灰字与备案号同行）。
- **D2 发现新版本时**：已定 —— **只提示不自动刷新**（阶段 4 按此实现；figma 插件那条与浏览器无关，美术在自己电脑上手动更新打包好的插件）。
- **D3 生产窗口**：按「修一个功能上线一次」的节奏走，`feature-1 → main` 只创建 PR 等人工合并（当前是 [PR #193](https://github.com/Luo399/wenyan-platform/pull/193)）。
