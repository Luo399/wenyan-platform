# 测试环境部署操作手册

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-07-15 |
| 适用场景 | 文言文预习平台测试环境部署与故障排查 |
| 作者 | AI 开发助手 |

---

## 一、问题汇总与分类

### 1.1 问题清单

| 问题编号 | 问题描述 | 错误码 | 影响范围 |
|---------|---------|--------|---------|
| P001 | 后端反向代理 502 Bad Gateway | 502 | 后端 API |
| P002 | 前端 OSS 403 Forbidden | 403 | 前端静态资源 |
| P003 | OSS 自定义域名访问被拒绝 | AccessDenied | 前端域名访问 |
| P004 | PM2 进程启动后立即崩溃 | errored | 后端服务 |
| P005 | .env 文件反引号解析错误 | - | 环境变量配置 |

### 1.2 行业层级分类

| 问题编号 | 层级分类 | 说明 | 常见度 |
|---------|---------|------|--------|
| P001 | **基础设施层** | Nginx 反向代理配置与后端服务连通性问题 | 高 |
| P002 | **云服务层** | OSS 权限配置与对象存储访问控制 | 中 |
| P003 | **域名与CDN层** | DNS 解析与 OSS 自定义域名绑定 | 中 |
| P004 | **应用层** | Node.js 进程管理与依赖安装 | 高 |
| P005 | **配置层** | 环境变量与 shell 转义问题 | 低 |

---

## 二、问题根因分析

### 2.1 P001：后端反向代理 502 Bad Gateway

**根因**：PM2 从项目根目录启动，`dotenv` 模块在当前工作目录查找 `.env` 文件，导致找不到配置，使用默认端口 3000。而 3000 端口已被生产环境 `wenyan-backend` 占用，服务启动失败。

**错误链路**：
```
PM2 启动目录 → .env 文件位置不匹配 → PORT 未读取 → 使用默认端口 3000 → 端口冲突 → 进程崩溃 → Nginx 502
```

**行业标准解决方法**：
1. 确保进程从正确的工作目录启动
2. 使用绝对路径指定 `.env` 文件位置
3. 在代码中使用 `path.resolve()` 定位配置文件

### 2.2 P002：前端 OSS 403 Forbidden

**根因**：OSS 桶默认权限为私有，部署时未设置文件的访问控制列表（ACL）为公共读。

**错误链路**：
```
桶权限私有 → 上传文件继承私有属性 → 浏览器访问被拒绝 → 403 Forbidden
```

**行业标准解决方法**：
1. 在上传时指定 `--acl public-read` 参数
2. 在 OSS 控制台设置桶为公共读权限
3. 使用 OSS 预签名 URL（适用于需要鉴权的场景）

### 2.3 P003：OSS 自定义域名访问被拒绝

**根因**：DNS CNAME 解析已生效，但 OSS 控制台未配置自定义域名绑定，导致请求路由到错误的桶。

**错误链路**：
```
DNS CNAME 解析 → 请求到达 OSS → 缺少域名绑定 → 无法识别桶归属 → AccessDenied
```

**行业标准解决方法**：
1. 在 OSS 控制台绑定自定义域名
2. 配置 CNAME 记录指向 OSS 域名
3. 配置静态网站托管（默认首页）

### 2.4 P004：PM2 进程启动后立即崩溃

**根因**：`npm ci` 需要 `package-lock.json` 与 `package.json` 完全同步，但仓库中 `package-lock.json` 可能过时，导致依赖安装不完整。

**错误链路**：
```
package-lock.json 过时 → npm ci 失败 → 依赖缺失 → 启动时 MODULE_NOT_FOUND → 进程崩溃
```

**行业标准解决方法**：
1. 使用 `npm install` 代替 `npm ci`（灵活模式）
2. 删除 `node_modules` 和 `package-lock.json` 后重新安装
3. 确保 CI/CD 流程中使用一致的 Node.js 版本

### 2.5 P005：.env 文件反引号解析错误

**根因**：终端（可能是 zsh）在输入 URL 时自动添加反引号进行转义，导致 `.env` 文件内容包含反引号字符。

**错误链路**：
```
终端自动转义 → .env 文件包含反引号 → dotenv 解析错误 → CORS_ORIGIN 配置错误
```

**行业标准解决方法**：
1. 使用 `printf` 或 `cat` heredoc 写入配置文件
2. 使用编辑器（vi/nano）直接编辑
3. 创建自动化脚本来生成配置文件

---

## 三、解决方案与操作步骤

### 3.1 修复后端服务（P001 + P004）

**前置条件**：
- 已安装 PM2：`npm install -g pm2`
- 已安装 Node.js：v20+

**操作步骤**：

```bash
# 1. 进入后端目录（关键：必须从 backend 目录启动）
cd /www/wwwroot/wenyan-platform-test/backend

# 2. 创建正确的 .env 文件（使用 printf 避免反引号问题）
printf 'PORT=3001\nCORS_ORIGIN=http://test.classicalab.cn,https://test.classicalab.cn\nAUTH_SECRET=wenyan-test-secret-2024\n' > .env

# 3. 验证 .env 文件内容
cat .env

# 4. 删除旧进程
pm2 delete wenyan-backend-test 2>&1 || true

# 5. 重新安装依赖（删除旧的以避免版本冲突）
rm -rf node_modules package-lock.json
npm install --production

# 6. 启动后端服务
pm2 start server.js --name wenyan-backend-test

# 7. 等待启动并验证
sleep 3
pm2 status
curl http://127.0.0.1:3001/api/health
```

**预期结果**：
- PM2 状态显示 `online`
- `curl` 返回 JSON：`{"success":true,"message":"OK",...}`

### 3.2 修复前端 OSS 权限（P002）

**通过 GitHub Actions 部署（推荐）**：

修改 `.github/workflows/deploy-frontend-test.yml`，添加 `--acl public-read` 参数：

```yaml
- name: Deploy to Aliyun OSS test bucket
  run: |
    ./ossutil64 cp -r ./dist oss://${{ secrets.OSS_TEST_BUCKET }}/ \
      -i ${{ secrets.OSS_ACCESS_KEY_ID }} \
      -k ${{ secrets.OSS_ACCESS_KEY_SECRET }} \
      -e oss-cn-guangzhou.aliyuncs.com \
      --acl public-read \
      --meta "Cache-Control:public,max-age=31536000"
```

**手动修复（如果已有文件需要更新权限）**：

```bash
# 使用 ossutil 更新已有文件的 ACL
./ossutil64 cp -r oss://wenyan-test-online/ oss://wenyan-test-online/ \
  -i <ACCESS_KEY_ID> \
  -k <ACCESS_KEY_SECRET> \
  -e oss-cn-guangzhou.aliyuncs.com \
  --acl public-read
```

### 3.3 配置 OSS 自定义域名（P003）

**步骤 1：阿里云 OSS 控制台配置**

1. 登录阿里云 OSS 控制台：https://oss.console.aliyun.com
2. 找到桶 `wenyan-test-online`
3. 点击左侧菜单 **"域名管理"**
4. 点击 **"绑定自定义域名"**
5. 输入域名：`test.classicalab.cn`
6. 选择协议：HTTP（测试环境）
7. 点击确定

**步骤 2：配置静态网站托管**

1. 在桶设置中找到 **"基础设置"**
2. 找到 **"静态网站托管"**
3. 点击 **"配置"**
4. 设置：
   - 状态：开启
   - 默认首页：`index.html`
   - 默认 404 页：`index.html`（SPA 应用）
5. 点击确定

**步骤 3：配置 DNS 解析**

1. 登录阿里云域名控制台：https://dc.console.aliyun.com
2. 找到域名 `classicalab.cn`
3. 添加 CNAME 记录：
   - 主机记录：`test`
   - 记录类型：`CNAME`
   - 记录值：`wenyan-test-online.oss-cn-guangzhou.aliyuncs.com`

**验证命令**：
```bash
# 验证 DNS 解析
nslookup test.classicalab.cn

# 验证 OSS 访问
curl -I http://test.classicalab.cn/index.html
```

---

## 四、可复现脚本

### 4.1 后端一键修复脚本

保存为 `/www/wwwroot/wenyan-platform-test/scripts/fix-backend.sh`：

```bash
#!/bin/bash
set -e

PROJECT_PATH="/www/wwwroot/wenyan-platform-test"
BACKEND_PATH="$PROJECT_PATH/backend"

echo "========================================"
echo "  后端服务一键修复脚本"
echo "========================================"

echo ""
echo "[1/6] 创建 .env 文件..."
printf 'PORT=3001\nCORS_ORIGIN=http://test.classicalab.cn,https://test.classicalab.cn\nAUTH_SECRET=wenyan-test-secret-2024\n' > "$BACKEND_PATH/.env"
cat "$BACKEND_PATH/.env"

echo ""
echo "[2/6] 删除旧 PM2 进程..."
pm2 delete wenyan-backend-test 2>&1 || true

echo ""
echo "[3/6] 重新安装依赖..."
cd "$BACKEND_PATH"
rm -rf node_modules package-lock.json
npm install --production 2>&1 | tail -3

echo ""
echo "[4/6] 启动后端服务..."
pm2 start server.js --name wenyan-backend-test

echo ""
echo "[5/6] 等待启动..."
sleep 3

echo ""
echo "[6/6] 验证服务..."
pm2 status
echo ""
curl -s http://127.0.0.1:3001/api/health
echo ""

echo ""
echo "========================================"
echo "  修复完成！"
echo "========================================"
```

**使用方法**：
```bash
chmod +x /www/wwwroot/wenyan-platform-test/scripts/fix-backend.sh
/www/wwwroot/wenyan-platform-test/scripts/fix-backend.sh
```

### 4.2 环境验证脚本

保存为 `/www/wwwroot/wenyan-platform-test/scripts/verify-env.sh`：

```bash
#!/bin/bash

echo "========================================"
echo "  测试环境验证脚本"
echo "========================================"

echo ""
echo "1. PM2 进程状态"
pm2 status

echo ""
echo "2. 端口监听检查"
ss -tlnp | grep -E ':(3000|3001)\s' || echo "⚠️  3000/3001 端口未监听"

echo ""
echo "3. 后端本地 API 测试"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ 后端本地 API: $HTTP_CODE OK"
else
  echo "❌ 后端本地 API: $HTTP_CODE"
fi

echo ""
echo "4. 后端反向代理测试"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://test-api.classicalab.cn/api/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ 后端反向代理: $HTTP_CODE OK"
else
  echo "❌ 后端反向代理: $HTTP_CODE"
fi

echo ""
echo "5. 前端 OSS 测试"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://test.classicalab.cn/index.html)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ 前端 OSS: $HTTP_CODE OK"
else
  echo "❌ 前端 OSS: $HTTP_CODE"
fi

echo ""
echo "6. .env 文件检查"
cat /www/wwwroot/wenyan-platform-test/backend/.env

echo ""
echo "========================================"
echo "  验证完成！"
echo "========================================"
```

**使用方法**：
```bash
chmod +x /www/wwwroot/wenyan-platform-test/scripts/verify-env.sh
/www/wwwroot/wenyan-platform-test/scripts/verify-env.sh
```

---

## 五、时间估算与实际耗时

### 5.1 问题解决时间对比

| 问题编号 | 预期时间 | 实际时间 | 差异原因 |
|---------|---------|---------|---------|
| P001 | 15分钟 | 60分钟 | 未及时检查 PM2 错误日志，初期假设错误 |
| P002 | 10分钟 | 20分钟 | 需要重新部署前端，等待 Actions 执行 |
| P003 | 15分钟 | 30分钟 | DNS 解析需要等待生效时间 |
| P004 | 10分钟 | 30分钟 | `npm ci` 失败后尝试多种方案 |
| P005 | 5分钟 | 45分钟 | 终端反引号问题难以定位，反复试验 |

### 5.2 经验教训

1. **优先查看日志**：PM2 错误日志是定位问题的关键，应首先执行 `pm2 logs <name> --nostream`
2. **不要假设配置正确**：`.env` 文件内容、权限、路径都需要逐一验证
3. **终端环境差异**：不同 shell（bash/zsh）的转义行为不同，需要注意
4. **分步验证**：从本地到远程、从直连到代理，逐步缩小问题范围

---

## 六、预防措施

### 6.1 代码层面

1. **使用绝对路径加载配置**：在 `server.js` 中使用 `path.resolve(__dirname, '.env')` 确保配置文件路径正确
2. **添加启动检查**：在服务启动前验证关键环境变量是否存在
3. **添加端口冲突检测**：启动前检查端口是否被占用

### 6.2 部署层面

1. **在部署脚本中创建 `.env`**：确保每次部署都生成正确的配置文件
2. **使用 `npm install` 替代 `npm ci`**：避免 lock 文件同步问题
3. **从正确目录启动 PM2**：使用 `--cwd` 参数指定工作目录

### 6.3 运维层面

1. **配置健康检查**：定期检查服务状态，异常时自动重启
2. **设置告警通知**：当服务宕机或 API 返回异常时发送通知
3. **定期备份配置**：重要配置文件定期备份

---

## 七、参考链接

| 资源 | URL |
|------|-----|
| 阿里云 OSS 自定义域名绑定 | https://help.aliyun.com/document_detail/31837.html |
| 阿里云 OSS 静态网站托管 | https://help.aliyun.com/document_detail/31895.html |
| PM2 官方文档 | https://pm2.keymetrics.io/docs/usage/quick-start/ |
| dotenv 文档 | https://github.com/motdotla/dotenv |

---

## 八、附录

### 8.1 常见问题速查表

| 现象 | 可能原因 | 快速检查 |
|------|---------|---------|
| PM2 进程 errored | 依赖缺失、端口冲突、配置错误 | `pm2 logs` |
| Nginx 502 | 后端未启动、端口不匹配 | `curl localhost:3001` |
| OSS 403 | 权限私有、域名未绑定 | `ossutil ls oss://bucket` |
| 域名无法访问 | DNS 未生效、CNAME 错误 | `nslookup` |

### 8.2 端口与进程映射

| 端口 | 进程名 | 路径 | 用途 |
|------|--------|------|------|
| 3000 | wenyan-backend | /www/wwwroot/wenyan-platform/backend | 生产环境 |
| 3001 | wenyan-backend-test | /www/wwwroot/wenyan-platform-test/backend | 测试环境 |

### 8.3 域名映射

| 域名 | 目标 | 用途 |
|------|------|------|
| test.classicalab.cn | OSS wenyan-test-online | 测试前端 |
| test-api.classicalab.cn | 127.0.0.1:3001 | 测试后端 |
| classicalab.cn | OSS wenyan-online | 生产前端 |
| api.classicalab.cn | 127.0.0.1:3000 | 生产后端 |
