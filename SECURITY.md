# 安全策略

## 漏洞披露流程

请不要通过公开 Issue、Discussion 或 PR 描述安全问题。

1. 通过 GitHub 仓库的 **Security → Report a vulnerability**（私有安全公告）提交，或直接联系维护者 `@Luo399`。
2. 报告请包含：影响范围、复现步骤、可能的利用方式、受影响文件/接口。
3. 维护者会在 48 小时内确认收到，并在评估后同步修复计划。
4. 修复发布前请勿公开细节；修复后经你同意可在公告中致谢。

支持的版本：仅当前 `main` 分支的最新部署。

## 已知风险

### 1. 历史提交中的真实学生数据（PII）

以下路径曾进入 git 历史，即使当前文件已删除或加入 `.gitignore`，历史提交中仍可检出：

- `data-pipeline/source/学生名单.xlsx`
- `backend/data/students.json`
- `backend/data/answer_records.json`
- `data-pipeline/source/开发需求填写.dbt.xlsx`、根目录 `开发需求填写.dbt.xlsx`

处理方式：先清理历史（见下节），再轮换任何可能与这些数据关联的账号口令。清洗完成前，不要把仓库设为公开。

### 2. 默认口令与密钥轮换

- 教师/管理端初始账号若使用统一默认口令，必须在首次登录后修改；批量导入的账号口令需由管理员逐个重置。
- `AUTH_SECRET`（HMAC 方案）已废弃，历史文档中明文出现过的值一律视为泄露；现统一使用 `JWT_SECRET`，生产/测试分别使用不同值。
- 轮换步骤：`openssl rand -hex 32` 生成新值 → 更新 GitHub Secrets 与服务器 `backend/.env` → `pm2 reload wenyan-backend --update-env`。
- 历史上暴露过的 OSS AK/SK、SSH 私钥同样需要轮换，仅删除文件不算处置完成。

### 3. OSS ACL 与上传凭证

- 前端直接通过 OSS 公开 URL 引用音频/视频/图片，相关桶（或前缀）为公共读，因此**不得**将答题答案、学生名单等敏感数据放入同一公开前缀。
- 上传凭证应使用最小权限的 RAM 子账号（仅目标桶的 PutObject/GetObject），禁止使用主账号 AK。
- AK/SK 只允许存在于 GitHub Secrets 与本地 `.env`，不得写入任何入库文件。
- 发现某个对象被意外公开时，先改 ACL/前缀，再评估内容是否需要轮换关联凭据。

## 已知依赖问题

### `xlsx@0.18.5`（npm 上最后一个公开发布版）

CVE-2023-30533（原型污染）与 CVE-2024-22363（ReDoS）都位于**解析**路径（`XLSX.read`）。
本仓库只在 `backend/src/controllers/exportController.js` 里**写出** xlsx（`book_new` / `aoa_to_sheet` / `write`），
全仓没有 `XLSX.read`，因此上述两个 CVE 当前不可达。

约束：**不要**新增任何 `XLSX.read` 调用；如果将来确实需要导入 Excel，必须先把依赖换成
`xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`（SheetJS 官方源，npm 上的 0.18.5 已停止更新）。

### `npm install` / `npm ci` 崩溃（`Cannot read properties of null (reading 'edgesOut')`）

npm 10 的 arborist 在处理 `vite@8` 声明的可选 peer `@vitejs/devtools` → `@vitejs/devtools-vitest` → `vitest@*`
这条链时会取到不存在的 `@vitest/browser-playwright@5.0.5`，然后抛这个内部错误。
不是仓库问题，也不是依赖声明问题。仓库根目录的 `.npmrc` 已设置 `legacy-peer-deps=true` 绕过，
该文件**不要删**；删除后本地与 CI 的 `npm ci` 都会失败。

## 历史清洗步骤（git filter-repo + 强推，需维护者执行）

> 该操作会重写全部提交哈希，必须在协调窗口内执行；执行前通知所有协作者暂停推送，并确认已有完整备份。`git filter-repo` 要求在新克隆的仓库上运行，并会移除 `origin` remote。

```bash
# 0) 备份（镜像克隆，失败可回滚）
git clone --mirror <REPO_URL> wenyanplatform-backup.git

# 1) 用一份新的镜像克隆做清洗
git clone --mirror <REPO_URL> wenyanplatform-clean.git
cd wenyanplatform-clean.git

# 2) 安装 git-filter-repo（任选其一）
pip install git-filter-repo
# 或：brew install git-filter-repo

# 3) 从所有历史提交中移除 PII 路径（路径按实际仓库根目录写）
git filter-repo --invert-paths \
  --path "data-pipeline/source/学生名单.xlsx" \
  --path "data-pipeline/source/开发需求填写.dbt.xlsx" \
  --path "开发需求填写.dbt.xlsx" \
  --path "backend/data/students.json" \
  --path "backend/data/answer_records.json"

# 4) 强推（--mirror 覆盖分支与标签）
git remote add origin <REPO_URL>
git push --force --all
git push --force --tags
```

执行后必须完成的收尾：

1. 所有协作者删除本地仓库并重新 clone（旧提交仍留在各自本地，重新推送会把 PII 带回）。
2. 轮换清洗期间可能暴露的全部凭据（JWT_SECRET、OSS AK/SK、SSH 私钥、默认口令）。
3. 删除仍引用旧提交的 PR/Issue 附件与 Actions 缓存；如曾公开，联系 GitHub Support 清理不可达对象。
4. 确认 `git log --all -- data-pipeline/source/学生名单.xlsx` 等命令无输出后，再考虑公开仓库。
