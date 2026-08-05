# Figma-前端自动化管线方案

> **架构概要**：通用组件文件 + 按课文分文件，插件通用，Frame 命名决定 OSS 路径

## 一、现状分析

### 1.1 已完成的工作
- **后端 Figma 同步服务** (`backend/src/services/figmaService.js`)：已实现 Figma REST API 节点树解析、Export Assets 帧解析、图片导出和 OSS 上传
- **Figma 控制器** (`backend/src/controllers/figmaController.js`)：已实现 `POST /api/figma/sync` 和 `GET /api/figma/status` 两个端点
- **路由注册** (`backend/src/routes/index.js`)：已挂载 Figma 相关路由
- **环境变量模板** (`backend/.env.example`)：已添加 FIGMA_ACCESS_TOKEN 和 OSS 配置项
- **前端资源目录** (`public/images/general/`)：已下载 8 张通用图片
- **文化卡片数据** (`public/data/culture_cards/`)：已有 4 篇课文（WEN_01-04）的 JSON 数据
- **前端组件**：CultureCards.vue 已支持 text/image/video 三种媒体类型，虚线边框，翻牌控制

### 1.2 Figma 文件结构（新架构）

**采用 通用组件文件 + 按课文分文件 结构：**

```
Figma 文件清单：
├── 通用组件文件.fig          # Export Assets → images/general/ 等全局资源
├── 论语·学而篇.fig           # Export Assets + 文字资源_论语·学而篇
├── 论语·为政篇.fig           # Export Assets + 文字资源_论语·为政篇
├── 劝学.fig                  # Export Assets + 文字资源_劝学
└── ...                       # 每个课文一个独立 Figma 文件
```

**每个文件内部结构：**
```
Export Assets（顶层 Frame）
  ├── images/general/          # 子 Frame 名 = OSS 路径（通用文件）
  ├── images/culture_cards/WEN_01/
  │   ├── card_bg.png          # 图层名 = 文件名
  │   └── card_1.png
  ├── images/cover/
  └── ...

文字资源_论语·学而篇（顶层 Frame）
  ├── knowledge_text           # TEXT 节点，name = JSON 字段名
  ├── card_name                # TEXT 节点
  └── card_desc                # TEXT 节点
```

### 1.3 存在的差距
- Figma 中未建立 Export Assets 专用容器 Frame
- 文化卡片数据中 `image_file` 字段均为 "文字"，无图片/视频资源引用
- `public/images/culture_cards/` 目录为空
- 前端 `.env.production` 中 `VITE_OSS_BASE_URL` 未配置
- FIGMA_ACCESS_TOKEN 未配置到服务器环境变量

## 二、管线架构设计

### 2.1 整体架构

```
[Figma 文件]（通用组件文件 / 课文文件）
    │
    ├── Export Assets Frame（顶层 Frame）
    │   ├── images/general/（子 Frame = OSS 路径）
    │   │   ├── home_bg.png（图层 = 文件名）
    │   │   └── ...
    │   ├── images/culture_cards/WEN_01/
    │   │   └── ...
    │   └── ...
    │
    ├── 文字资源_论语·学而篇 Frame（顶层 Frame）
    │   ├── knowledge_text（TEXT 节点）
    │   └── ...
    │
    ▼
[Figma 插件]（在任意文件中运行）
    │
    ├── 扫描当前文件顶层 Frame：Export Assets + 文字资源_
    ├── 导出图片（PNG/SVG）+ 读取文字（JSON）
    ▼
[后端 API]（POST /api/assets/upload）
    │
    ├── MD5 比对（相同跳过）
    ├── 上传到 OSS（public-read）
    ├── 更新 version.json
    │
    ▼
[阿里云 OSS 桶]
    │
    ├── images/general/home_bg.png
    ├── images/culture_cards/WEN_01/card_bg.png
    ├── data/texts/文字资源_论语·学而篇.json
    └── ...
    │
    ▼
[前端应用]（通过 VITE_OSS_BASE_URL + ?t=timestamp 引用）
```

### 2.2 数据流

```
Figma 设计稿定稿（通用文件 / 课文文件）
    ↓ (设计师打开 Figma 文件 → 运行插件)
插件扫描当前文件顶层 Frame
    ↓
显示变更列表 → 设计师确认 → 点击同步
    ↓ (POST /api/assets/upload)
后端 MD5 比对 → 上传 OSS → 更新 version.json
    ↓
前端通过 ?t=timestamp 自动刷新缓存
```

### 2.3 Figma 命名约定

| 子 Frame 名称 | 对应 OSS 路径 | 用途 |
|--------------|--------------|------|
| `images/general/` | `oss://{bucket}/images/general/` | 通用图片（首页背景、登录背景等） |
| `images/culture_cards/WEN_01/` | `oss://{bucket}/images/culture_cards/WEN_01/` | 文化卡片图片 |
| `images/cover/` | `oss://{bucket}/images/cover/` | 封面图片 |
| `audio/` | `oss://{bucket}/audio/` | 音频文件 |
| `video/` | `oss://{bucket}/video/` | 视频文件 |
| `文字资源_论语·学而篇` | `oss://{bucket}/data/texts/文字资源_论语·学而篇.json` | 文字资源 JSON |

图层命名规则：`{文件名}.{扩展名}`（如 `home_bg.png`、`card_1.png`）

资源类型映射：

| 资源类型 | Figma 顶层 Frame | 导出产物 | OSS 路径示例 |
|---------|-----------------|---------|-------------|
| 图片 | Export Assets（子 Frame 按 OSS 路径命名） | PNG/SVG 文件 | `images/culture_cards/WEN_01/card_bg.png` |
| 文字 | 文字资源_{名称} | JSON 文件 | `data/texts/文字资源_论语·学而篇.json` |

## 三、实施步骤

### 阶段 1：基础设施搭建（已完成）
- [x] 后端 Figma 同步服务 `figmaService.js`
- [x] 后端 Figma 控制器 `figmaController.js`
- [x] 路由注册 `backend/src/routes/index.js`
- [x] 环境变量模板 `backend/.env.example`
- [x] 前端通用图片目录 `public/images/general/`（8 张图片已下载）
- [x] 文化卡片数据 `public/data/culture_cards/`（4 篇课文 JSON）
- [x] 前端组件修复：RuleVideoView / MultiRoleReading / AdaptQuiz / CultureCards
- [x] 文本工具：adapterUtils.ts 抽取 normalizeQuotes 函数
- [x] 方案文档 `docs/figma-pipeline-plan.md` 编写完成

### 阶段 2：Figma 插件 + 后端上传（推荐方案，已实现）
**由于 Figma REST API 限流（429），转向 Figma 插件方案**

#### 方案说明
```
Figma 设计稿（通用文件 / 课文文件）
    → 设计师打开文件 → 运行插件
    → 扫描 Export Assets / 文字资源_ Frame
    → 导出 PNG/SVG + 读取文字
    → POST /api/assets/upload → 后端
    → MD5 比对（相同跳过）→ 上传 OSS → 更新 version.json
```

#### 插件通用性
**同一个插件可在任意 Figma 文件中使用**，无需为每个文件单独开发：
- 通用组件文件：扫描 Export Assets → 上传到 images/general/ 等
- 课文文件：扫描 Export Assets + 文字资源_ → 上传到对应路径
- 插件根据 Frame 命名自动路由到正确的 OSS 路径

#### 资源类型映射

| 资源类型 | Figma 顶层 Frame | 导出产物 | OSS 路径示例 |
|---------|-----------------|---------|-------------|
| 图片 | Export Assets（子 Frame 按 OSS 路径命名） | PNG/SVG 文件 | `images/culture_cards/WEN_01/card_bg.png` |
| 文字 | 文字资源_论语·学而篇 | JSON 文件 | `data/texts/文字资源_论语·学而篇.json` |

#### 后端 API 端点
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/assets/upload` | 接收文件上传（multipart/form-data 或 JSON） |
| GET | `/api/assets/version` | 获取版本信息（version.json） |
| POST | `/api/assets/pre-signed` | 生成 OSS 预签名 URL（直传模式） |

#### 已实现文件
- [x] `backend/src/services/assetService.js` - MD5 比对、版本管理、OSS 上传
- [x] `backend/src/controllers/assetController.js` - 上传端点
- [x] `backend/src/routes/index.js` - 路由注册
- [x] `backend/.env.example` - 环境变量模板
- [x] `backend/package.json` - multer 依赖
- [x] `figma-plugin/manifest.json` - Figma 插件清单
- [x] `figma-plugin/code.ts` - 插件主逻辑（扫描 + 导出 + 上传）
- [x] `figma-plugin/ui.html` - 插件 UI（变更列表 + 同步按钮）
- [x] `src/utils/asset.ts` - 前端版本戳支持（`?t=lastSyncAt`）

### 阶段 3：设计师使用流程
- [ ] 设计师在 Figma 中按约定创建文件结构：
  - 通用组件文件 → Export Assets（images/general/ 子 Frame）
  - 课文文件 → Export Assets + 文字资源_{课文名} Frame
- [ ] 安装插件：Figma → Plugins → Development → Import plugin from manifest → 选择 `figma-plugin/manifest.json`
- [ ] 打开任意课文文件/通用文件 → 运行插件
- [ ] 配置后端 API 地址（默认 `https://api.classicalab.cn`）
- [ ] 扫描 Export Assets / 文字资源_ Frame → 确认变更列表 → 点击同步
- [ ] 同步后前端自动通过 `?t=timestamp` 刷新缓存

### 阶段 4：CI/CD 集成
- [ ] 在 GitHub Actions 中添加 Figma 同步步骤
- [ ] 设计变更自动触发同步
- [ ] 同步失败自动告警

## 四、前端问题验收清单

- [x] RuleVideoView.vue：视频播放页面无滚动条，完整显示视频和导航按钮
- [x] MultiRoleReading.vue：移除内置滚动条，仅保留系统级滚动条
- [x] adapterUtils.ts：抽取 `normalizeQuotes` 函数解决反引号问题
- [x] wordListAdapter.ts：在注释匹配中使用 `normalizeQuotes`
- [x] AdaptQuiz.vue：删除提交后右下角"完成"标识容器
- [x] CultureCards.vue：支持文字/图片/视频，视频点击跳转播放，虚线边框，翻牌控制
- [x] 通用图片资源：`public/images/general/` 已下载 8 张图片
- [x] 文化卡片数据：`public/data/culture_cards/` 已有 4 篇课文 JSON

## 五、已部署到测试环境（当前状态）

- [x] 当前分支 `feature-1` 已包含所有代码变更
- [x] 后端资产同步 API 已实现（`POST /api/assets/upload`）
- [x] Figma 插件已开发完成（`figma-plugin/`）
- [x] 前端版本戳机制已实现（`asset.ts`）
- [x] 代码已推送到 `feature-1`，Actions 全部 success
- [x] 测试环境前端 `https://test.classicalab.cn` 正常
- [x] 测试环境后端 `http://test-api.classicalab.cn/api/health` 正常

## 六、当前现状与限制

### 6.1 已完成（可部署）
| 模块 | 文件 | 状态 |
|------|------|------|
| 视频播放页 | `RuleVideoView.vue` | 100vh 无滚动条，`object-fit: contain` 完整显示 |
| 多角色朗读 | `MultiRoleReading.vue` | 移除内置滚动条，仅系统滚动条 |
| 引号工具 | `adapterUtils.ts` | `normalizeQuotes` 处理 6 种引号/反引号 |
| 选择题 | `AdaptQuiz.vue` | 删除"完成"标识容器 |
| 文化卡片 | `CultureCards.vue` | 文字/图片/视频，虚线边框，翻牌预留 |
| 方案文档 | `figma-pipeline-plan.md` | 完整架构设计 |
| 资产同步 API | `assetService.js` + `assetController.js` | MD5 比对 + 版本管理 + OSS 上传 |
| Figma 插件 | `figma-plugin/` | 扫描 Export Assets + 文字资源_ Frame → 导出 → 上传 |
| 前端版本戳 | `asset.ts` | `getAssetUrlWithVersion()` 自动拼接 `?t=timestamp` |

### 6.2 受限项（需设计师配合）
- **文化卡片资源**：`public/images/culture_cards/` 目录为空，需设计师在课文 Figma 文件中创建 Export Assets Frame 后通过插件同步
- **文化卡片 JSON**：`image_file` 字段均为 "文字"，需在 Figma 课文文件中创建 `文字资源_` Frame 后通过插件同步
- **VITE_OSS_BASE_URL**：生产环境需配置环境变量
- **Figma 插件安装**：需在 Figma 中通过 `Plugins → Development → Import plugin from manifest` 加载
- **Figma 文件创建**：需按新架构创建通用组件文件和各课文文件，并在每个文件中建立 Export Assets / 文字资源_ Frame

## 七、风险与注意事项

1. **Figma API 速率限制**：免费账户每分钟 60 次请求，大批量导出需分批（插件端已规避）
2. **OSS 文件权限**：上传必须带 `--acl public-read` 或 `x-oss-object-acl: public-read`
3. **CDN 缓存**：前端通过 `?t=timestamp` 参数刷新缓存，无需 CloudFront 手动失效
4. **命名一致性**：Figma 图层命名必须与代码中文件名一致（`{文件名}.{扩展名}`）
5. **大文件处理**：视频/音频文件建议直接上传 OSS，不走 Figma 插件导出
6. **version.json 持久化**：存储在 `backend/data/version.json`，部署后需保留