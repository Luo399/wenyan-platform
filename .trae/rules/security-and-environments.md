---
alwaysApply: true
scene: security_and_env_isolation
---

# 安全与多环境隔离（必须遵守）

## A. 生产环境禁止事项

1. **API 与前端禁止同源**：
   - `VITE_API_BASE_URL` 必须是独立子域 `https://api.classicalab.cn`，不能是 `https://classicalab.cn`。
   - 宝塔侧用 nginx 把 `api.classicalab.cn` 反代到 `127.0.0.1:3000`，**禁止把 3000 端口直接对外暴露**。

2. **CORS 必须白名单数组**：
   ```js
   app.use(cors({
     origin: (process.env.CORS_ORIGIN || '')
       .split(',').map(s => s.trim()).filter(Boolean),
     methods: ['GET', 'POST'],
     allowedHeaders: ['Content-Type'],
   }))
   ```
   生产 `CORS_ORIGIN=https://www.classicalab.cn,https://classicalab.cn`。

3. **API 鉴权**（最关键）：
   - 学生端 `/api/submit`：必须带 `Authorization: Bearer <token>`，token = HMAC 签名（`studentId + submittedAt + serverSecret`）。
   - 教师/管理端 `/api/answers/*`：必须登录态 + 角色校验（teacher / admin）。
   - 在加鉴权之前，**临时**用 `express-rate-limit` 限制单 IP 每分钟 ≤ 30 次提交，作为"止血"。

4. **速率限制**（必装）：
   ```bash
   npm i express-rate-limit
   ```
   - 全局：100 req / 15min / IP
   - `/api/submit`：10 req / 1min / IP
   - `/api/answers/:id`：30 req / 1min / IP

5. **安全头**（必装）：
   ```bash
   npm i helmet
   ```
   - 自动加 `X-Content-Type-Options`、`X-Frame-Options`、`Strict-Transport-Security`。
   - 配合 nginx 加 CSP（`default-src 'self'; img-src 'self' https://*.classicalab.cn data:; media-src https://*.classicalab.cn; connect-src 'self' https://api.classicalab.cn https://*.aliyuncs.com;`）。

6. **请求体白名单**：
   - 提交接口只接受 `{ studentId, wenId, submittedAt, answers, questions }` 五个字段，多余字段丢弃。
   - 用 `zod` 或手写 schema 校验每个字段类型与长度。

7. **HTTPS 强制**：宝塔开启 Let's Encrypt，`http → https` 301，HSTS 一年。

8. **管理后台鉴权**：`backend/public/admin.html` 现在裸奔，必须加 basic auth（nginx 层）或会话登录。

## B. 多环境隔离

### 分支策略

```
main                     # 生产（protected, PR only, 1 reviewer + CI green）
└── release/staging      # 预发（阿里云 staging 桶 + 预发服务器）
    └── feature-1        # 特性集成（阿里云 test 桶 + 测试服务器）
        └── trae/agent-X # AI 会话开发分支
```

### 触发规则

| 推送目标 | 触发 workflow | 部署目标 | 环境变量来源 |
|---------|--------------|---------|------------|
| `trae/agent-X` | 不部署 | — | — |
| `feature-1` | `deploy-*-test.yml` | OSS test 桶 + 宝塔测试机 | GitHub Environment `test` |
| `release/staging` | `deploy-*-staging.yml` | OSS staging 桶 + 预发机 | GitHub Environment `staging` |
| `main` | `deploy-*-prod.yml` | OSS prod 桶 + 阿里云宝塔生产机 | GitHub Environment `production` |

### GitHub 配置

1. **创建 Environments**：`Settings → Environments → New environment`
   - `production` / `staging` / `test`
   - 每个 environment 设置独立的 secrets（`SERVER_HOST`、`SERVER_SSH_KEY`、`SERVER_USER`、`SERVER_PROJECT_PATH`、`ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`ALIYUN_OSS_BUCKET`、`CLOUDFRONT_DISTRIBUTION_ID`）
   - `production` 加 Required reviewers（要求人工批准）

2. **main 分支保护规则**：
   - ✅ Require pull request before merging
   - ✅ Require approvals: 1
   - ✅ Require status checks: `type-check` / `lint` / `test`
   - ✅ Require conversation resolution
   - ✅ Do not allow force pushes
   - ✅ Do not allow deletions
   - ✅ Include administrators（管理员也要走 PR）

3. **拆分 workflow 文件**：
   - 原 `deploy-frontend.yml` 拆为 `deploy-frontend-{test,staging,prod}.yml`
   - 原 `deploy-backend.yml` 拆为 `deploy-backend-{test,staging,prod}.yml`
   - 每个文件 `on.push.branches` 与 `environment` 对应

### 配置文件管理

- 仓库**只**跟踪 `.env.example` / `backend/.env.example`
- 真实 `.env` 通过 `SERVER_PROJECT_PATH/.env` 存在于服务器本地（PM2 启动时读取）
- 修改环境变量的流程：
  1. 改 `env.example`（声明变量名与占位值）
  2. 通过宝塔面板或 SSH 改服务器 `/path/to/project/.env`
  3. `pm2 restart wenyan-backend`
- 永远**不要**把真实 `.env` commit 进 git
- 历史已泄露的 `backend/.env`（`CORS_ORIGIN=https://classicalab.cn`）**敏感度低**，但仍需清理历史

## C. SSH 与部署安全

1. `StrictHostKeyChecking=no` → 改为用 `known_hosts` 提前写入服务器指纹：
   ```yaml
   - name: Set up SSH
     uses: webfactory/ssh-agent@v0.8.0
     with:
       ssh-private-key: ${{ secrets.SERVER_SSH_KEY }}
   ```
   在 server 端预生成 `~/.ssh/known_hosts` 并打包到 secrets。

2. `pm2 restart wenyan-backend || pm2 start ...` 改为：
   ```bash
   pm2 reload wenyan-backend --update-env
   ```
   `--update-env` 让 PM2 重新读取 `.env`，避免改了环境变量不生效。

3. OSS 部署避免 `--delete` 清空窗口期：
   - 先 sync 到临时目录 `dist-new/`
   - 用 `aws s3 sync` + `--delete` 同步到 `dist/`
   - 或使用 OSS 的版本化（OSS → Bucket Settings → Versioning）保留历史

4. CloudFront 失效路径 `/*` → 改为只失效改动的文件：
   ```bash
   aws s3 sync ./dist s3://$BUCKET --endpoint-url ... --dryrun | \
     awk '/upload/ {print $4}' > changed.txt
   aws cloudfront create-invalidation \
     --paths "$(tr '\n' ' ' < changed.txt)/*"
   ```
   或在 `actions/cache` 步骤记录上次构建产物做 diff。

## D. 立即执行清单（按顺序）

1. 在宝塔添加 `api.classicalab.cn` 域名 + nginx 反代 + HTTPS。
2. 在阿里云 DNS 把 `api.classicalab.cn` 解析到后端服务器。
3. 改 `backend/.env`：`CORS_ORIGIN=https://www.classicalab.cn,https://classicalab.cn`。
4. 改 `.env.production`：`VITE_API_BASE_URL=https://api.classicalab.cn`。
5. 后端装 `helmet` + `express-rate-limit` + `zod`，提交 1 个 PR 到 `feature-1`。
6. CI 跑通后，PR 合并到 `release/staging` → 部署到预发机 → 人工验证。
7. 预发验证通过后，PR 合并到 `main` → 部署到生产。
8. 创建 GitHub Environments（`production` / `staging` / `test`）并配置 secrets。
9. 添加 main 分支保护规则。
10. 拆分 deploy yml 文件。

## E. 提交答案的安全流程（学生端 + 服务端双向签名）

```
[学生答题]
  客户端：用 studentId + submittedAt + 客户端密钥(localStorage)生成 HMAC
  提交时附带 Authorization: Bearer <hmac>
[服务端]
  验证：studentId + submittedAt + 服务端密钥(secret) 重新算 HMAC
  一致 → 通过；不一致 → 401
```

这样即使前端 `localStorage` 被改，攻击者没有服务端 secret 也无法构造有效 token。
