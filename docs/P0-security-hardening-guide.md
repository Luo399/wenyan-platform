# P0 安全加固实施指南

## 已完成的代码层面改动（无需你操作）

### 后端安全加固（已完成）

| 改动项 | 说明 |
|-------|------|
| CORS 白名单数组化 | 支持逗号分隔的多域名配置 |
| 速率限制 | 全局 100/15min，提交 10/min，查询 30/min |
| helmet 安全头 | X-Frame-Options, X-Content-Type-Options 等 |
| zod 请求体校验 | 白名单字段 + 类型校验 + 长度限制 |
| HMAC 签名鉴权 | 可选启用，前后端共享密钥 |
| 请求体大小限制 | 10MB → 1MB |
| 健康检查端点 | GET /api/health |

### 前端支持（已完成）

| 改动项 | 说明 |
|-------|------|
| HMAC 签名生成 | Web Crypto API 实现 |
| 签名自动附加 | 启用鉴权时自动在请求体中附加 signature 字段 |

### 配置模板更新（已完成）

- `backend/env.example`：新增 AUTH_SECRET 配置项
- `env.example`：新增 VITE_AUTH_SECRET 配置项

---

## 需要你在宝塔/DNS 操作的步骤

### 步骤 1：获取服务器公网 IP

**在宝塔终端执行**：
```bash
# 方法 1：curl
curl ifconfig.me

# 方法 2：或使用脚本
cd /www/wwwroot/wenyan-platform
bash scripts/get-public-ip.sh
```

**记录下来的 IP 地址**：`________________`（请填写）

---

### 步骤 2：配置 DNS 解析

**在阿里云 DNS 控制台**：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|-------|-----|
| A | api | `<步骤1获取的IP>` | 600 |
| A | www | `<OSS绑定域名或CDN地址>` | 600 |

**注意**：
- `api.classicalab.cn` 指向后端服务器 IP
- `www.classicalab.cn` 指向 OSS/CDN（前端静态资源）

---

### 步骤 3：宝塔 nginx 反代配置

**方法 A：使用脚本（推荐）**
```bash
cd /www/wwwroot/wenyan-platform
chmod +x scripts/baota-nginx-proxy-setup.sh
bash scripts/baota-nginx-proxy-setup.sh
```

**方法 B：手动配置**
1. 宝塔面板 → 网站 → 添加站点
2. 域名：`api.classicalab.cn`
3. 根目录：`/www/wwwroot/api.classicalab.cn`（随意）
4. PHP版本：纯静态
5. 提交后，点击站点设置 → 反向代理 → 添加反向代理：
   - 目标URL：`http://127.0.0.1:3000`
   - 发送域名：`$host`

---

### 步骤 4：申请 SSL 证书

**在宝塔面板**：
1. 网站 → api.classicalab.cn → 设置 → SSL
2. Let's Encrypt → 填写邮箱 → 申请

**申请成功后，宝塔会自动配置 HTTPS**。

---

### 步骤 5：生成并配置 AUTH_SECRET 密钥

**⚠️ 重要：此密钥用于前后端 HMAC 签名，必须保密！**

**生成密钥**：
```bash
# 生成 256 位密钥
openssl rand -hex 32
```

**示例输出**：
```
b894c78e09e3eea8c2c1622b04333c8a789b0489feb0f5ece9341dfecb37b1ae
```

**配置位置**：

| 位置 | 配置项 | 值 |
|-----|-------|---|
| 后端 `/www/wwwroot/wenyan-platform/backend/.env` | `AUTH_SECRET` | `<生成的密钥>` |
| GitHub Secrets（生产） | `VITE_AUTH_SECRET` | `<同一个密钥>` |
| `.env.production`（构建时注入） | `VITE_AUTH_SECRET` | `<同一个密钥>` |

**注意**：
- 密钥**必须前后端一致**
- 不要提交到 git（`.env` 文件已在 `.gitignore` 中）

---

### 步骤 6：更新后端 .env 配置

**在宝塔服务器上编辑 `/www/wwwroot/wenyan-platform/backend/.env`**：
```bash
# 后端服务环境配置
PORT=3000

# CORS 白名单（逗号分隔）
CORS_ORIGIN=https://www.classicalab.cn,https://classicalab.cn

# HMAC 签名密钥（与前端保持一致）
AUTH_SECRET=<你的密钥>
```

---

### 步骤 7：重启后端服务

```bash
pm2 reload wenyan-backend --update-env
```

---

### 步骤 8：验证配置

```bash
# 测试 DNS 解析
nslookup api.classicalab.cn

# 测试健康检查（HTTP）
curl http://api.classicalab.cn/api/health

# 测试健康检查（HTTPS）
curl https://api.classicalab.cn/api/health

# 检查 PM2 状态
pm2 status
```

---

## 需要你确认的敏感信息

| 信息 | 你需要做的 |
|-----|----------|
| AUTH_SECRET 密钥 | 生成一个，配置到后端 .env + GitHub Secrets |
| 服务器公网 IP | 获取后配置 DNS A 记录 |
| CORS 白名单域名 | 确认是否包含 www 子域 |

---

## 已修改的文件清单

| 文件 | 改动内容 |
|-----|---------|
| `backend/package.json` | 新增 helmet, express-rate-limit, zod 依赖 |
| `backend/server.js` | CORS 白名单、速率限制、helmet、zod 校验、HMAC 鉴权、健康检查端点 |
| `backend/env.example` | 新增 AUTH_SECRET 配置项 |
| `src/utils/api.ts` | 新增 HMAC 签名生成逻辑 |
| `env.example` | 新增 VITE_AUTH_SECRET 配置项 |
| `scripts/get-public-ip.sh` | 新增获取公网 IP 脚本 |
| `scripts/baota-nginx-proxy-setup.sh` | 新增宝塔 nginx 配置脚本 |
| `scripts/generate-auth-secret.sh` | 新增密钥生成脚本 |

---

## 下一步

1. 完成上述宝塔/DNS 配置后，回复我「配置完成」
2. 我会验证配置并继续处理 P1 级别的问题（部署安全、CDN 优化等）
3. 最后会创建 PR 将改动合并到 `feature-1` 分支

---

## 检查清单

- [ ] 步骤 1：获取服务器公网 IP
- [ ] 步骤 2：配置 DNS 解析（api + www）
- [ ] 步骤 3：宝塔 nginx 反代配置
- [ ] 步骤 4：申请 SSL 证书
- [ ] 步骤 5：生成并配置 AUTH_SECRET
- [ ] 步骤 6：更新后端 .env 配置
- [ ] 步骤 7：重启后端服务
- [ ] 步骤 8：验证配置