# 项目环境总览与开发全流程手册

## 一、环境架构总览

### 1.1 环境拓扑图

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发者工作机                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  trae/agent   │  │   feature-1   │  │     main     │           │
│  │  开发分支     │  │  测试集成分支 │  │  生产分支     │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                  │                  │                   │
│         │  git merge       │  git merge       │                   │
│         └─────────────────►│                  │                   │
│                            └─────────────────►│                   │
└───────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                      GitHub Actions CI/CD                        │
│                                                                   │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────────────┐ │
│  │ CI Checks   │   │ Test Deploy     │   │ Production Deploy    │ │
│  │ lint+type   │   │ feature-1 push  │   │ main push/PR merge   │ │
│  └─────────────┘   └───────┬─────────┘   └──────────┬───────────┘ │
└─────────────────────────────┼─────────────────────────┼─────────────┘
                              │                         │
              ┌───────────────┴──────────┐  ┌───────────┴──────────────┐
              ▼                          ▼  ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│    测试环境 (test)    │  │    测试环境 (test)    │  │   生产环境 (prod)     │
│                      │  │                      │  │                      │
│ 前端: OSS test 桶    │  │ 后端: 阿里云服务器   │  │ 前端: OSS prod 桶    │
│ wenyan-test-online   │  │ /www/.../-test/     │  │ wenyan-online        │
│ test.classicalab.cn  │  │ 端口: 3001          │  │ classicalab.cn       │
│                      │  │ test-api.classi...   │  │ api.classicalab.cn   │
│ ACL: public-read     │  │ PM2: wenyan-be-test │  │ 端口: 3000           │
└──────────────────────┘  └──────────────────────┘  │ PM2: wenyan-backend  │
                                                     └──────────────────────┘
```

### 1.2 环境对照表

| 维度 | 开发环境 | 测试环境 | 生产环境 |
|------|---------|---------|---------|
| **分支** | `trae/agent-XXXX` | `feature-1` | `main` |
| **触发部署** | 不部署 | push 自动触发 | PR 合并触发 |
| **CI 检查** | lint + type-check | lint + type-check | lint + type-check |
| **前端域名** | - | `http://test.classicalab.cn` | `https://classicalab.cn` |
| **后端域名** | - | `http://test-api.classicalab.cn` | `https://api.classicalab.cn` |
| **前端存储** | - | OSS `wenyan-test-online` | OSS `wenyan-online` |
| **后端路径** | - | `/www/wwwroot/wenyan-platform-test` | `/www/wwwroot/wenyan-platform` |
| **后端端口** | - | 3001 | 3000 |
| **PM2 进程** | - | `wenyan-backend-test` | `wenyan-backend` |
| **HTTPS** | - | 否（测试用） | 是（Let's Encrypt） |
| **CORS** | - | `http://test.classicalab.cn` | `https://www.classicalab.cn,https://classicalab.cn` |

### 1.3 GitHub Actions Workflow 总览

| Workflow 文件 | 触发条件 | 作用 |
|--------------|---------|------|
| [ci-checks.yml](file:///workspace/.github/workflows/ci-checks.yml) | PR 到 main/feature-1；push 到 trae/agent-* | 代码质量检查（lint + type-check） |
| [deploy-frontend-test.yml](file:///workspace/.github/workflows/deploy-frontend-test.yml) | push feature-1，src/public 变更 | 构建前端 → 部署到 OSS test 桶 |
| [deploy-backend-test.yml](file:///workspace/.github/workflows/deploy-backend-test.yml) | push feature-1，backend 变更 | SSH 部署后端到测试服务器 3001 端口 |
| [deploy-frontend.yml](file:///workspace/.github/workflows/deploy-frontend.yml) | push main，src/public 变更 | 构建前端 → 部署到 OSS prod 桶 |
| [deploy-backend.yml](file:///workspace/.github/workflows/deploy-backend.yml) | push main，backend 变更 | SSH 部署后端到生产服务器 3000 端口 |

---

## 二、GitHub Secrets 清单

### 2.1 已配置 Secrets

| Secret 名称 | 用途 | 使用方 |
|------------|------|--------|
| `SSH_HOST` | 服务器 IP | 所有 deploy workflow |
| `SSH_PRIVATE_KEY` | SSH 私钥 | 所有 deploy workflow |
| `SERVER_USER` | 服务器用户名 (root) | 所有 deploy workflow |
| `SERVER_PROJECT_PATH` | 生产项目路径 | deploy-backend.yml |
| `OSS_ACCESS_KEY_ID` | OSS AccessKey ID | 所有 frontend workflow |
| `OSS_ACCESS_KEY_SECRET` | OSS AccessKey Secret | 所有 frontend workflow |
| `OSS_BUCKET` | 生产 OSS 桶名 | deploy-frontend.yml |
| `OSS_TEST_BUCKET` | 测试 OSS 桶名 | deploy-frontend-test.yml |
| `OSS_REGION` | OSS 地域 | 所有 frontend workflow |
| `AUTH_SECRET` | 后端 HMAC 密钥 | deploy-backend.yml |
| `VITE_AUTH_SECRET` | 前端 HMAC 密钥 | 所有 frontend workflow |

### 2.2 需要补充的 Secrets

| Secret 名称 | 用途 | 是否必须 |
|------------|------|---------|
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront CDN 分配 ID | 否（无 CDN 时跳过） |

---

## 三、环境变量对照表

### 3.1 前端环境变量

| 变量 | 开发环境 | 测试环境 | 生产环境 |
|------|---------|---------|---------|
| `VITE_OSS_BASE_URL` | `http://localhost:5173` | OSS test 桶域名 | `https://classicalab.cn` |
| `VITE_API_BASE_URL` | `http://localhost:3000` | `http://test-api.classicalab.cn` | `https://api.classicalab.cn` |
| `VITE_AUTH_SECRET` | - | GitHub Secret | GitHub Secret |

### 3.2 后端环境变量

| 变量 | 测试环境 | 生产环境 |
|------|---------|---------|
| `PORT` | 3001 | 3000 |
| `CORS_ORIGIN` | `http://test.classicalab.cn` | `https://www.classicalab.cn,https://classicalab.cn` |
| `AUTH_SECRET` | `wenyan-test-secret-2024` | GitHub Secret |

### 3.3 配置文件位置

| 文件 | 位置 | 用途 |
|------|------|------|
| [.env.development](file:///workspace/.env.development) | 仓库内 | 前端开发环境参考 |
| [.env.production](file:///workspace/.env.production) | 仓库内 | 前端生产环境参考 |
| [env.example](file:///workspace/env.example) | 仓库内 | 前端环境变量模板 |
| [backend/env.example](file:///workspace/backend/env.example) | 仓库内 | 后端环境变量模板 |
| `.env` (后端) | 服务器 `/path/to/backend/.env` | 实际运行配置（不进 git） |

---

## 四、开发全流程

### 4.1 新功能开发流程

```
① 创建开发分支
   git checkout feature-1
   git pull origin feature-1
   git checkout -b trae/agent-<功能名>

② 本地开发
   - 修改代码
   - 提交到 trae/agent-<功能名>

③ 合并到测试集成分支
   git checkout feature-1
   git merge trae/agent-<功能名>
   git push origin feature-1

④ 等待测试环境自动部署
   - 监控 Actions: Deploy Backend to Test Server
   - 监控 Actions: Deploy Frontend to Test OSS
   - 两个 workflow 必须都 success

⑤ 测试环境验证
   - 前端: http://test.classicalab.cn
   - 后端: http://test-api.classicalab.cn/api/health
   - 验证功能是否符合预期

⑥ 创建 PR 合并到 main
   - 在 GitHub 创建 PR: feature-1 → main
   - 等待 CI 检查通过
   - 合并 PR

⑦ 等待生产环境自动部署
   - 监控 Actions: Deploy Backend to Aliyun Server
   - 监控 Actions: Deploy Frontend to Aliyun OSS
   - 两个 workflow 必须都 success

⑧ 生产环境冒烟测试
   - 前端: https://classicalab.cn
   - 后端: https://api.classicalab.cn/api/health
```

### 4.2 Bug 修复流程

```
① 从 main 创建 hotfix 分支
   git checkout main
   git pull origin main
   git checkout -b trae/agent-hotfix-<bug描述>

② 修复 bug
   - 修改代码
   - 提交到 hotfix 分支

③ 合并到 feature-1 验证
   git checkout feature-1
   git merge trae/agent-hotfix-<bug描述>
   git push origin feature-1

④ 测试环境验证 bug 已修复

⑤ 创建 PR 合并到 main
   - PR: feature-1 → main
   - 合并后监控生产部署

⑥ 生产环境验证 bug 已修复
```

### 4.3 Actions 监控流程

```bash
# 查看最新 Actions 运行状态
gh run list --branch feature-1 --limit 5
gh run list --branch main --limit 5

# 查看具体运行详情
gh run view <run-id> --log

# 如果失败，查看失败步骤
gh run view <run-id> --log-failed
```

---

## 五、各环境部署详情

### 5.1 测试环境部署

**触发条件**：push 到 `feature-1` 分支

**前端部署**（[deploy-frontend-test.yml](file:///workspace/.github/workflows/deploy-frontend-test.yml)）：
1. Checkout 代码
2. `npm ci` 安装依赖
3. `npm run build` 构建前端（注入 `VITE_API_BASE_URL=http://test-api.classicalab.cn`）
4. 下载 ossutil
5. `ossutil cp -r ./dist oss://wenyan-test-online/ --acl public-read` 上传到 OSS

**后端部署**（[deploy-backend-test.yml](file:///workspace/.github/workflows/deploy-backend-test.yml)）：
1. SSH 连接服务器
2. 拉取最新代码到 `/www/wwwroot/wenyan-platform-test`
3. 创建 `.env` 文件（PORT=3001, CORS=test 域名）
4. `npm install --production` 安装依赖
5. PM2 启动 `wenyan-backend-test` 进程
6. 健康检查 `curl http://127.0.0.1:3001/api/health`
7. 配置 Nginx 反向代理 `test-api.classicalab.cn → 127.0.0.1:3001`

### 5.2 生产环境部署

**触发条件**：push 到 `main` 分支（通过 PR 合并）

**前端部署**（[deploy-frontend.yml](file:///workspace/.github/workflows/deploy-frontend.yml)）：
1. Checkout 代码
2. `npm ci` 安装依赖
3. `npm run build` 构建前端（注入 `VITE_API_BASE_URL=https://api.classicalab.cn`）
4. 下载 ossutil
5. `ossutil cp -r ./dist oss://wenyan-online/ --acl public-read` 上传到 OSS
6. CloudFront CDN 缓存失效（如配置了 CLOUDFRONT_DISTRIBUTION_ID）

**后端部署**（[deploy-backend.yml](file:///workspace/.github/workflows/deploy-backend.yml)）：
1. SSH 连接服务器
2. 拉取最新代码到 `/www/wwwroot/wenyan-platform`
3. 创建 `.env` 文件（PORT=3000, CORS=生产域名, AUTH_SECRET=GitHub Secret）
4. `npm install --production` 安装依赖
5. PM2 reload `wenyan-backend` 进程（`--update-env`）
6. 健康检查 `curl http://127.0.0.1:3000/api/health`

---

## 六、Nginx 反向代理配置

### 6.1 测试环境

```
test-api.classicalab.cn → 127.0.0.1:3001
test.classicalab.cn → OSS (CNAME 解析)
```

### 6.2 生产环境

```
api.classicalab.cn → 127.0.0.1:3000
classicalab.cn → OSS (CNAME 解析)
www.classicalab.cn → OSS (CNAME 解析)
```

### 6.3 Nginx 配置要点

- 后端 API 反代必须设置 `proxy_set_header Host $host`
- 生产环境强制 HTTPS（301 重定向）
- OSS 静态网站托管需配置默认首页 `index.html`

---

## 七、注意事项与红线

### 7.1 部署红线

| 红线 | 原因 | 正确做法 |
|------|------|---------|
| 禁止 `npm ci` 用于后端部署 | lock 文件不同步导致安装失败 | 使用 `npm install --production` |
| 禁止省略 `--acl public-read` | OSS 文件默认私有导致 403 | 所有 OSS 上传必须带此参数 |
| 禁止从非 backend 目录启动 PM2 | dotenv 找不到 .env 导致端口错误 | 必须 `cd backend` 后启动 |
| 禁止 `StrictHostKeyChecking=no` | 安全风险（MITM 攻击） | 使用 `ssh-keyscan` 预写入 known_hosts |
| 禁止将真实 .env 提交到 git | 密钥泄露 | 仅提交 env.example |

### 7.2 常见问题速查

| 现象 | 根因 | 修复 |
|------|------|------|
| Nginx 502 | 后端未启动或端口不匹配 | 检查 PM2 状态 + 端口 |
| OSS 403 | 文件权限私有 | 上传时加 `--acl public-read` |
| PM2 errored | 依赖缺失或端口冲突 | `pm2 logs` 查看错误 → 修复 → 重启 |
| OSS "bucket does not belong to you" | 域名未绑定 | OSS 控制台绑定自定义域名 |
| 前端访问根路径 404 | 未配置默认首页 | OSS 静态网站托管设 `index.html` |
| CORS 错误 | CORS_ORIGIN 配置错误 | 检查后端 .env 的 CORS_ORIGIN |

### 7.3 回滚方法

**前端回滚**：
```bash
# 使用 ossutil 上传旧版本的 dist
# 或重新触发上一次成功的 Actions run
```

**后端回滚**：
```bash
# SSH 到服务器
cd /www/wwwroot/wenyan-platform  # 或 -test
git log --oneline -5             # 找到上一个稳定版本
git reset --hard <commit-hash>
cd backend
npm install --production
pm2 reload wenyan-backend --update-env
```

---

## 八、服务器进程与端口映射

| 端口 | PM2 进程名 | 项目路径 | 环境 |
|------|-----------|---------|------|
| 3000 | `wenyan-backend` | `/www/wwwroot/wenyan-platform/backend` | 生产 |
| 3001 | `wenyan-backend-test` | `/www/wwwroot/wenyan-platform-test/backend` | 测试 |

**常用 PM2 命令**：
```bash
pm2 status                    # 查看所有进程
pm2 logs wenyan-backend       # 查看生产日志
pm2 logs wenyan-backend-test  # 查看测试日志
pm2 restart wenyan-backend --update-env  # 重启并重新加载 .env
pm2 delete wenyan-backend-test          # 删除进程
```

---

## 九、验证检查清单

每次部署后，按以下清单验证：

### 测试环境
- [ ] `curl http://test-api.classicalab.cn/api/health` 返回 200
- [ ] `curl -I http://test.classicalab.cn/index.html` 返回 200
- [ ] 浏览器访问 `http://test.classicalab.cn` 能加载页面
- [ ] PM2 状态为 `online`

### 生产环境
- [ ] `curl https://api.classicalab.cn/api/health` 返回 200
- [ ] `curl -I https://classicalab.cn/index.html` 返回 200
- [ ] 浏览器访问 `https://classicalab.cn` 能加载页面
- [ ] PM2 状态为 `online`
- [ ] HTTPS 证书有效
- [ ] CORS 头正确返回
