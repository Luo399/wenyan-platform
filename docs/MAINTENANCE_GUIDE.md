# 网站维护与迭代指南

---

## 文档信息
- **版本**: v1.2
- **创建日期**: 2026-06-12
- **更新日期**: 2026-06-13
- **适用项目**: 文言文预习平台 (classicalab.cn)

---

## 目录
1. [宝塔面板的作用](#1-宝塔面板现在的作用)
2. [本地开发调试](#2-本地开发调试)
   - [前端本地调试](#21-改前端代码)
   - [后端本地调试](#22-改后端代码)
   - [日常开发循环](#23-日常开发循环总结)
3. [代码更新流程](#3-代码更新到生产环境)
   - [只改前端](#31-只改前端)
   - [只改后端](#32-只改后端)
   - [前后端都改](#33-前后端都改)
4. [媒体文件管理](#4-媒体文件管理)
   - [文件存储策略](#41-文件存储策略)
   - [OSS上传流程](#42-oss上传流程)
5. [数据库管理](#5-数据库管理)
   - [数据库初始化](#51-数据库初始化)
   - [数据导入导出](#52-数据导入导出)
6. [日常维护小贴士](#6-日常维护小贴士)
7. [故障恢复指南](#7-如果改代码时把网站搞崩了怎么办)

---

## 1. 宝塔面板现在的作用

您的网站架构分为两部分：

| 模块 | 部署位置 | 管理方式 |
|-----|---------|---------|
| **前端** (www.classicalab.cn) | 阿里云 OSS + DCDN 加速 | 与宝塔无关 |
| **后端** (api.classicalab.cn) | 云服务器 | 宝塔面板统一管理 |

### 宝塔面板负责的功能

- **网站管理**: `api.classicalab.cn` 站点的 Nginx 配置（SSL 证书、反向代理）
- **文件管理**: 后端代码（`/www/wwwroot/api`）的上传、编辑
- **进程守护**: PM2 管理器确保 Node 服务永久在线，崩溃自动重启
- **终端**: 执行命令行操作（`npm install`、`node server.js` 等）
- **数据库**: SQLite 文件的权限管理、备份等

**总结**: 宝塔是服务器的管理控制台，**所有后端操作都需要通过宝塔进行**。

---

## 2. 本地开发调试

### 2.1 改前端代码（页面、样式、JSON 数据等）

#### 优势
- **实时预览**: Vite 开发服务器在 `localhost:5173` 运行，修改代码自动热更新
- **真实数据**: Vite 代理自动把 `/api` 请求转发到线上后端，接口调用真实数据

#### 步骤

1. **本地修改**: 在 Trae IDE 中编辑前端代码

2. **启动开发服务器**:
   ```bash
   npm run dev
   ```

3. **预览效果**: 浏览器访问 `http://localhost:5173`

4. **接口代理配置**（已配置好）:
   - `vite.config.ts` 中已配置代理: `target: 'http://8.138.106.162'`
   - 所有 `/api/*` 请求自动转发到线上后端
   - 与生产环境接口调用方式完全一致

5. **验证无误后**: 打包上线（见 [3.1 只改前端](#31-只改前端)）

> **注意**: 本地调试没问题后，必须执行 `npm run build` 打包，再上传 OSS，线上才会更新。

---

### 2.2 改后端代码（server.js 等）

#### 本地限制
**本地不能直接运行后端**，因为：
- 数据库文件 (`*.db`) 在云服务器上
- `.env` 配置文件在云服务器上
- 本地缺少运行时依赖数据

#### 正确做法

```
本地编辑 → 上传服务器 → 重启服务 → 本地前端验证
```

1. **本地修改**: 在 Trae IDE 中编辑后端代码

2. **上传到服务器**（二选一）:

   **方式A：宝塔文件上传**
   - 登录宝塔面板 → "文件" → 进入 `/www/wwwroot/api`
   - 上传修改后的文件，直接覆盖原文件

   **方式B：Git 拉取**（推荐）
   - 服务器终端执行:
     ```bash
     cd /www/wwwroot/api
     git pull origin main
     npm install  # 如有依赖变化
     ```

3. **重启后端服务**:
   - 宝塔 → PM2 管理器 → 找到 `wenyan-api` → 点击 **重启**

4. **本地验证**:
   - 本地前端 `localhost:5173` 已配置代理指向线上后端
   - 可直接测试接口调用，验证修改是否生效

5. **查看日志排查问题**:
   - 宝塔 → PM2 管理器 → `wenyan-api` → "日志"

---

### 2.3 日常开发循环总结

```
┌─────────────────────────────────────────────────────────────┐
│                        前端改动                              │
│  本地编辑 → localhost:5173 实时预览 → 满意后打包上传 OSS   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        后端改动                              │
│  本地编辑 → 上传服务器覆盖 → 重启 PM2 → 本地前端测试接口  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 代码更新到生产环境

### 3.1 只改前端

```
本地开发 → 测试 → 打包 → 上传 OSS → 刷新 CDN → 验证
```

**步骤**:

1. **本地修改**: 在开发环境编辑代码，确保 `npm run dev` 测试无误

2. **确认生产环境配置**:
   ```bash
   # 检查 .env.production
   VITE_API_BASE=https://api.classicalab.cn
   ```

3. **打包**:
   ```bash
   npm run build
   ```

4. **上传到 OSS**:
   - 打开 **ossbrowser**，进入 Bucket 根目录
   - 将 `dist` 文件夹**里面的所有内容**上传，覆盖原有文件

5. **刷新 CDN 缓存**（如页面无变化）:
   - 阿里云 DCDN 控制台 → 域名管理 → `www.classicalab.cn` → **刷新缓存**
   - 选择"目录刷新"，输入 `https://www.classicalab.cn/`

6. **验证**: 浏览器强制刷新（Ctrl+F5）查看效果

---

### 3.2 只改后端

```
本地开发 → 测试 → 上传代码 → 安装依赖 → 重启服务 → 验证
```

**步骤**:

1. **本地修改代码**，使用 Postman 或前端联调测试

2. **上传新代码到服务器**:

   **方式A：宝塔文件上传**
   - 登录宝塔面板 → "文件" → 进入 `/www/wwwroot/api`
   - 上传修改过的文件（如 `server.js`、路由文件等），直接覆盖

   **方式B：Git 拉取**
   ```bash
   cd /www/wwwroot/api
   git pull origin main
   ```

3. **如有依赖变化**:
   ```bash
   cd /www/wwwroot/api
   npm install
   ```

4. **重启后端服务**:
   - 宝塔 → PM2 管理器 → 找到 `wenyan-api` → 点击 **重启**

5. **验证**:
   - 访问 `https://api.classicalab.cn/api/texts` 确认服务正常
   - 检查 PM2 日志确认无报错

---

### 3.3 前后端都改

**执行顺序**:
1. **先更新后端**（上传代码 → 安装依赖 → 重启 PM2）
2. **再更新前端**（本地打包 → 上传 OSS → 刷新 DCDN 缓存）

> **原因**: 确保后端接口先就绪，避免前端调用不存在的 API

---

## 4. 媒体文件管理

### 4.1 文件存储策略

项目采用**代码与媒体分离**的架构：

| 文件类型 | 存储位置 | Git管理 | 说明 |
|---------|---------|---------|------|
| 前端代码 | OSS + CDN | ✅ 提交 | `dist/` 打包后上传 |
| 后端代码 | 宝塔服务器 | ✅ 提交 | `git pull` 拉取 |
| 媒体文件 | OSS | ❌ 不提交 | 通过脚本上传 |
| 数据库文件 | 服务器本地 | ❌ 不提交 | `migrate.js` + `seed.js` |

**为什么媒体文件不提交到 Git？**

- Git 是**代码版本控制工具**，不适合存储大文件
- 媒体文件（视频、音频、图片）会让仓库体积急剧膨胀
- 每次克隆仓库都要下载所有历史版本的大文件，效率极低
- OSS 专门用于存储和分发静态资源，支持 CDN 加速

### 4.2 OSS 上传流程

#### 配置 OSS 凭证

在 `.env` 文件中配置：

```bash
# OSS 区域，如 oss-cn-hangzhou
OSS_REGION=oss-cn-hangzhou

# 阿里云 AccessKey（从控制台获取）
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret

# OSS Bucket 名称
OSS_BUCKET=your-bucket-name
```

#### 上传媒体文件

```bash
# 预览模式（仅显示待上传文件，不上传）
npm run upload:oss:dry

# 执行上传
npm run upload:oss
```

#### 更新媒体文件流程

```
本地修改媒体文件 → 执行 npm run upload:oss → 验证 CDN 链接
```

**注意**：
- 媒体文件修改后**不需要**提交 Git
- 上传脚本会自动扫描 `public/video/`、`public/audio/`、`public/img/` 目录
- 上传后文件 URL 格式：`https://bucket.oss-cn-hangzhou.aliyuncs.com/video/xxx.mp4`

---

## 5. 数据库管理

### 5.1 数据库初始化

项目使用 SQLite 数据库，分为两个独立的数据库文件：

| 数据库文件 | 内容 | 路径 |
|-----------|------|------|
| `students.db` | 学生信息表 | `backend/database/students.db` |
| `answer_records.db` | 答题记录表 | `backend/database/answer_records.db` |

**服务器首次部署流程**：

```bash
cd /www/wwwroot/api.classicalab.cn

# 1. 拉取代码
git pull origin main

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 设置数据库路径、JWT密钥等

# 4. 创建数据库表结构
node scripts/migrate.js

# 5. 导入初始数据（学生名单等）
node scripts/seed.js

# 6. 启动服务
pm2 start server.js --name wenyan-api
pm2 save
```

### 5.2 数据导入导出

#### 导出数据到 JSON（用于备份或迁移）

```bash
cd backend
node scripts/export.js
```

导出的文件：
- `backend/data/students.json` - 学生数据
- `backend/data/answer_records.json` - 答题记录数据

这些 JSON 文件会提交到 Git 进行版本管理。

#### 导入数据到数据库

```bash
# 导入全部数据
node scripts/seed.js

# 仅导入学生数据
node scripts/seed.js --students-only

# 仅导入答题记录
node scripts/seed.js --answers-only
```

**特性**：
- **幂等性设计**：已存在的数据会跳过，不会重复插入
- 多次执行脚本不会造成数据重复

#### 更新学生名单流程

```
修改 backend/data/students.json → git commit → 服务器 git pull → node scripts/seed.js
```

---

## 6. 日常维护小贴士

### 数据库备份

SQLite 数据文件位置：`/www/wwwroot/api/database/answers.db`

**建议**:
- 使用宝塔"计划任务"功能定期自动备份
- 备份目标：OSS 或本地存储
- 备份频率：至少每周一次

### 日志排查

| 问题类型 | 查看位置 |
|---------|---------|
| 后端报错 | 宝塔 PM2 管理器 → `wenyan-api` → "日志" |
| 前端报错 | 浏览器 F12 → 控制台/Network 标签 |
| Nginx 错误 | 宝塔网站管理 → 站点设置 → "日志" |

### SSL 证书管理

- 宝塔的 Let's Encrypt 证书会**自动续期**
- 建议每三个月手动检查一次证书状态
- 证书到期前宝塔会有提醒通知

### 版本管理建议

强烈建议将代码托管到 **GitHub/Gitee**:

**好处**:
- 版本控制，便于回滚
- 服务器端可直接 `git pull` 更新代码
- 多人协作更方便

**服务器端更新命令**:
```bash
cd /www/wwwroot/api
git pull origin main
npm install
# 重启 PM2
```

---

## 7. 如果改代码时把网站搞崩了怎么办？

### 后端崩溃

**排查步骤**:
1. **查看日志**: 宝塔 PM2 管理器 → `wenyan-api` → "日志"
2. **定位问题**: 根据报错信息修改代码
3. **重新上传**: 覆盖问题文件
4. **重启服务**: PM2 点击"重启"

### 前端崩溃

**解决方案**:
1. **本地回退**: 撤销问题修改，重新测试
2. **重新打包**: `npm run build`
3. **重新上传**: 覆盖 OSS 上的文件
4. **回滚文件**: 利用 OSS 版本管理功能恢复历史版本

### 数据库损坏

**恢复步骤**:
1. **停止服务**: 宝塔 PM2 → 停止 `wenyan-api`
2. **恢复备份**: 将备份的 `.db` 文件覆盖到 `/www/wwwroot/api/database/`
3. **启动服务**: PM2 → 启动 `wenyan-api`

### 紧急回滚

**终极方案**:
- 保留一个已知可用的稳定版本作为备份
- 使用 Git 回退到稳定版本:
  ```bash
  git log --oneline
  git checkout <稳定版本commit>
  ```

---

## 附录：常用命令

### 前端操作

```bash
# 开发模式（实时预览）
npm run dev

# 生产打包
npm run build

# 预览构建结果（需安装 serve）
npm install -g serve
serve -s dist
```

### 后端操作（服务器终端）

```bash
# 进入项目目录
cd /www/wwwroot/api

# 安装依赖
npm install

# 启动生产模式
npm start

# 查看进程状态
pm2 status

# 查看日志
pm2 logs wenyan-api

# 重启服务（宝塔面板也可操作）
pm2 restart wenyan-api
```

---

## 联系人信息

| 角色 | 联系方式 |
|-----|---------|
| 技术负责人 | 需要时联系 |

---

**文档版本**: v1.2
**最后更新**: 2026-06-13
**适用项目**: wenyan-platform