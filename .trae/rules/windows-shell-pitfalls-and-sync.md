---
alwaysApply: true
scene: generic
---
# Windows PowerShell 通用格式坑 + 仓库同步机制（血泪教训）

> 记录本机 Windows / PowerShell 环境下反复踩过的坑，以及插件仓库的同步机制，**下次遇到同类问题直接对号入座，不要再试错**。

## A. PowerShell 命令格式坑（最容易浪费时间的 4 处）

### 1. `curl` 是 `Invoke-WebRequest` 别名，不是 curl
- 现象：`curl -s -m 20 "url"` 报 `Parameter cannot be processed because the parameter name 'm' is ambiguous`（`-m`、`-s`、`-o`、`-w` 等都不认识）。
- 根因：PowerShell 把 `curl` 解析成 `Invoke-WebRequest`，其参数是 `-Method/-MaximumRedirection`，没有 `-m`。
- 用法：**一律用 `curl.exe`**（`curl.exe -sS -m 30 ...`、`-o NUL -w "%{http_code}"` 亦可用）。

### 2. `git stash` 引用 `stash@{0}`（及一切 `alias{n}`）必须用引号
- 现象：`git stash show --stat stash@{0}` 报 `Too many revisions specified: 'stash@' 'MAA=' 'xml' 'text'`。
- 根因：PowerShell 把花括号里的 `0` 当数组索引表达式拆掉了。
- 用法：**`git stash show --stat "stash@{0}"`**（stash@{0}、@{-1}、@^ 等带花括号的都引号包裹）。

### 3. `git commit -m "多行/含中文标点"` 会被拆词，必须用单行
- 现象：多行字符串里含 `，`、`。`、`\n`、引号时，PowerShell 把消息拆散，后续 token 被 git 当成 pathspec：`error: pathspec '...' did not match any file(s)`。
- 用法：提交信息**写成一行**，不跨行、避免易拆符号；需要详细说明时用 `git commit -F <file>` 或 `--no-edit`。
- 多行正文可用 heredoc 写入临时文件再 `-F`，不要直接在 `-m` 里拼多行。

### 4. `gh ... --jq '...'` 内含双引号会被 PowerShell 拆断
- 现象：`--jq ".[] | \"\(.number) | \(.title)\""` 报 `\.number is not recognized` / `unknown arguments`。
- 根因：PowerShell 对双引号内嵌 `\(...)` 的处理与 shell 不同，被拆成多个参数。
- 用法：
  - jq 表达式**用单引号包裹且内部不用双引号**，如 `--jq '.[] | [.number,.headRefName] | @tsv'`；
  - 或干脆省略 `--jq`，直接引用 `--json` 输出的原始 JSON 自己读。

## B. 后端「新增 controller 路由函数」的常见 CI 挂
- 现象：新增 `async function getOssList(...)` 并注册 `app.get('/api/assets/oss-list', assetController.getOssList)` 后，启动报 `Route.get() requires a callback function but got a [object Undefined]`，CI backend-check fail。
- 根因：函数定义了，但**忘了加进 `module.exports`**，导出对象里没有 `getOssList`。
- 红线：**新增 controller 方法时，立即同步加入文件末尾 `module.exports = {...}`，再注册路由**；两者必须成对出现，缺一即启动错。

## C. 插件仓库（wenyan-asset-sync）同步机制——不要手动 push
- **本机 SSH 身份是 deploy key，直接手动推插件仓会被拒**：
  - `git subtree push --prefix=figma-plugin figma-plugin main` 报 `Permission to Luo399/wenyan-asset-sync.git denied to deploy key`。
- **正确通道（唯一）**：`main`/`feature-1` 上 push 时会自动触发 `Sync Figma Plugin to wenyan-asset-sync` workflow：
  - 它用 `ASSET_SYNC_REPO_TOKEN`（独立 PAT，专门操作 wenyan-asset-sync，**与后端上传鉴权的 ASSET_SYNC_TOKEN/X-API-Key 严格区分**）checkout 插件仓，复制固定文件后 `create-pull-request` **开 PR 到插件仓 main**。
  - 因此插件仓的更新是"自动开 PR → 手动合并"。合并方式：
    ```bash
    gh pr list -R Luo399/wenyan-asset-sync --state open # 看自动 sync PR
    gh pr merge <number> -R Luo399/wenyan-asset-sync --merge --delete-branch
    ```
  - **合并后插件仓 code.js 可能仍比主干"旧"**，属正常：分支上 sync PR 一般挂多期，合并需要用到的那个最新 PR（按 headRefName 里含的源 commit 判断）。
- **sync workflow 只复制硬编码清单**（code.ts/code.js/ui.html/manifest.json/package*.json/tsconfig.json）。**新增源模块（如 core.ts）不在清单内就不会被同步**：
  - 若插件仓需要该新源码文件，须把新文件 `cp` 加进 `.github/workflows/sync-figma-plugin.yml` 的 "Sync plugin files" 步骤并走 PR 流程；
  - 但只要新逻辑被 `code.ts` import 并经 esbuild 打进 `code.js`，插件仓只持有 code.js 也能正常运行，不强制补 sync 清单。