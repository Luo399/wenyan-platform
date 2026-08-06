# 安全配置指南

> ⚠️ 本仓库为公开仓库。**任何密钥值都禁止以明文形式出现在本仓库任何文件中**。
> 历史版本曾在此文档明文记录 AUTH_SECRET 值，已被视为泄露并轮换。请勿再次写入真实值。

## 鉴权方案现状（R90）

- 后端鉴权统一走 **JWT Bearer token**，HMAC 签名方案（AUTH_SECRET）已废弃。
- 前端不再持有任何服务端密钥（`VITE_AUTH_SECRET` 已移除）。
- 后端签名密钥为 **`JWT_SECRET`**，生产环境缺失时服务将拒绝启动（S02）。

## 需要配置的密钥

| 密钥 | 用途 | 配置位置 |
|------|------|---------|
| `JWT_SECRET` | 签发/校验 JWT token | GitHub Secrets + 服务器 `backend/.env` |
| `TEST_JWT_SECRET` | 测试环境 JWT | GitHub Secrets（`TEST_JWT_SECRET`） |
| OSS AK/SK | 前端构建产物上传 OSS | GitHub Secrets |
| `SSH_PRIVATE_KEY` | Actions 部署 SSH | GitHub Secrets |

密钥生成方式（本地执行，不要提交）：
```bash
openssl rand -hex 32
```

## 配置位置

### 1. GitHub Secrets（必须）

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中添加：

| Secret 名称 | 说明 |
|------------|------|
| `JWT_SECRET` | 生产 JWT 密钥 |
| `TEST_JWT_SECRET` | 测试环境 JWT 密钥 |
| `OSS_ACCESS_KEY_ID` | OSS AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | OSS AccessKey Secret |
| `SSH_PRIVATE_KEY` | 服务器 SSH 私钥 |

### 2. 后端服务器（必须）

SSH 登录后端服务器，编辑 `/www/wwwroot/wenyan-platform/backend/.env`：

```bash
PORT=3000
CORS_ORIGIN=https://www.classicalab.cn,https://classicalab.cn
JWT_SECRET=<由本地安全生成，不要写入仓库>
```

重启后端服务：
```bash
pm2 reload wenyan-backend --update-env
```

### 3. 本地开发（可选）

本地开发不需要真实密钥；`NODE_ENV` 非 production 时后端使用显式 dev 密钥（见 `backend/src/config/app.js`）。

---

## ⚠️ 禁止事项

1. **不要将任何密钥值提交到 git**（包括 `.md`、`.yml`、`.js`、`.json` 等任何文件）。
2. **不要在公开渠道分享密钥**。
3. **不要在代码中硬编码密钥**。
4. 涉及密钥的改动提交前，先检查 `git diff` 中不应出现 `secret=`、`AKID`、`-----BEGIN` 等字样。

---

## 验证配置

```bash
# 后端健康检查
curl https://api.classicalab.cn/api/health
```

预期返回 `{"success":true,"message":"OK",...}`。

---

## 如果密钥泄露

立即：
1. 生成新密钥：`openssl rand -hex 32`
2. 更新 GitHub Secrets（生产 + 测试）
3. 更新服务器 `.env`
4. 重启后端服务
5. 使用 gitleaks / GitHub secret scanning 检查仓库历史，必要时清理历史。
