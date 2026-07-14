# 安全配置指南

## ⚠️ 重要：仓库是公共的，请严格按此指南操作

### 需要配置的密钥

**AUTH_SECRET**（前后端共享的 HMAC 签名密钥）：
```
6e6903646a771268f1d2dc499a2a9b3547eb894a0ba619f71820d4d29d3a02dd
```

---

## 配置位置

### 1. GitHub Secrets（必须）

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 值 |
|------------|---|
| `VITE_AUTH_SECRET` | `6e6903646a771268f1d2dc499a2a9b3547eb894a0ba619f71820d4d29d3a02dd` |
| `AUTH_SECRET` | `6e6903646a771268f1d2dc499a2a9b3547eb894a0ba619f71820d4d29d3a02dd` |

### 2. 后端服务器（必须）

SSH 登录后端服务器，执行：
```bash
# 编辑 .env 文件
nano /www/wwwroot/wenyan-platform/backend/.env

# 添加以下行
AUTH_SECRET=6e6903646a771268f1d2dc499a2a9b3547eb894a0ba619f71820d4d29d3a02dd

# 重启后端服务
pm2 reload wenyan-backend --update-env
```

### 3. 本地开发（可选）

如需本地开发，创建 `.env.development`：
```
VITE_AUTH_SECRET=6e6903646a771268f1d2dc499a2a9b3547eb894a0ba619f71820d4d29d3a02dd
```

---

## ⚠️ 禁止事项

1. **不要将密钥提交到 git**
2. **不要在公开渠道分享密钥**
3. **不要在代码中硬编码密钥**

---

## 验证配置

### 1. 验证 GitHub Secrets

进入 Actions 页面，查看 workflow 是否正常运行。

### 2. 验证后端

```bash
# SSH 到服务器
curl https://api.classicalab.cn/api/health
```

预期返回：
```json
{"success":true,"message":"OK","timestamp":"...","authEnabled":true}
```

`authEnabled: true` 表示鉴权已启用。

### 3. 验证前端

访问 https://www.classicalab.cn/，提交答案应该正常工作。

---

## 如果密钥泄露

立即：
1. 生成新密钥：`openssl rand -hex 32`
2. 更新 GitHub Secrets
3. 更新服务器 `.env`
4. 重启后端服务