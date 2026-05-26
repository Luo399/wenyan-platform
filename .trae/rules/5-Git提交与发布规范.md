# 5-Git提交与发布规范

## 1. 分支策略

### 1.1 分支类型

| 分支类型 | 命名格式 | 用途 | 生命周期 | 示例 |
|---------|---------|-----|---------|-----|
| 主分支 | `main` | 稳定版本 | 永久 | - |
| 开发分支 | `develop` | 集成开发 | 永久 | - |
| 功能分支 | `feature/xxx` | 新功能开发 | 临时 | `feature/add-wordlist-cache` |
| 修复分支 | `bugfix/xxx` | bug修复 | 临时 | `bugfix/fix-wordlist-encoding` |
| 发布分支 | `release/xxx` | 发布准备 | 临时 | `release/v1.0.0` |
| 热修复分支 | `hotfix/xxx` | 线上紧急修复 | 临时 | `hotfix/emergency-audio-load` |

### 1.2 分支管理流程

```
main ←─── merge ←─── release/vx.y.z ←─── merge ←─── develop
                ↑                              ↑
                │                              │
                └─── hotfix/xxx ───────────────┘
                              ↑
                              │
                     bugfix/xxx
                              ↑
                              │
                     feature/xxx
```

### 1.3 当前项目分支（示例）

| 分支 | 用途 | 状态 |
|-----|------|-----|
| `main` | 主分支，稳定版本 | 活跃 |
| `develop` | 开发集成分支 | 活跃 |
| `feature/wordlist` | WordList组件开发 | 已合并 |
| `feature/multi-role-reading` | 多角色朗读功能 | 已合并 |

## 2. 提交信息规范

### 2.1 提交格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### 2.2 Type类型

| Type | 说明 | 示例 |
|-----|------|-----|
| **feat** | 新功能 | `feat(WordList): 添加注释悬浮提示` |
| **fix** | bug修复 | `fix(WordList): 修复中文乱码问题` |
| **docs** | 文档更新 | `docs: 更新数据与编码规范` |
| **style** | 代码风格 | `style(WordList): 格式化代码` |
| **refactor** | 重构 | `refactor(StepOneView): 优化导航逻辑` |
| **test** | 测试 | `test(WordList): 添加单元测试` |
| **chore** | 构建/工具 | `chore: 更新依赖` |
| **perf** | 性能优化 | `perf(MultiRoleReading): 添加音频缓存` |

### 2.3 Scope说明

| Scope类型 | 示例 |
|----------|-----|
| 组件名 | `WordList`, `MultiRoleReading`, `VideoPlayer` |
| 页面名 | `HomeView`, `StepOneView`, `RuleView` |
| 工具模块 | `api`, `utils`, `wenUtils`, `perfMonitor` |
| 配置文件 | `vite`, `eslint`, `router` |
| 数据文件 | `data/word_list`, `data/multi_role_reading` |

### 2.4 提交示例

```
feat(WordList): 添加超时检测功能

- 设置10秒超时时间
- 添加超时警告日志
- 使用TextDecoder显式解码UTF-8

Closes #123
```

```
fix(MultiRoleReading): 修复音频加载失败问题

- 修复arrayBuffer解码逻辑
- 添加错误状态展示
- 提供重试按钮

Fixes #124
```

```
docs: 更新组件开发规范

- 添加WordList组件示例
- 更新props设计原则
- 添加事件定义规范
```

## 3. 代码审查规范

### 3.1 PR提交要求

- **标题**: 清晰描述改动内容（如 `feat(WordList): 添加注释悬浮提示功能`）
- **描述**: 改动原因和影响
- **关联Issue**: Closes #xxx 或 Fixes #xxx
- **测试用例**: 新增功能必须有测试覆盖
- **文档更新**: 相关文档已更新

### 3.2 审查要点

| 检查项 | 说明 | 检查方法 |
|-------|------|---------|
| 代码质量 | 符合编码规范，无语法错误 | 运行 `npm run lint` |
| 测试覆盖 | 新增功能有测试覆盖 | 运行 `npm test` |
| 影响范围 | 不影响其他功能 | 检查修改的文件范围 |
| 文档更新 | 相关文档已更新 | 检查docs目录 |
| 性能影响 | 无性能退化 | 使用perfMonitor验证 |

### 3.3 PR模板

```markdown
## 改动说明

[描述改动内容和原因]

## 修改文件

- src/components/WordList.vue
- src/utils/wenUtils.ts
- docs/2-数据与编码规范.md

## 测试验证

- [x] 单元测试通过
- [x] 手动测试通过
- [x] 代码审查完成

## 相关Issue

Closes #123
```

## 4. 发布流程

### 4.1 版本号规则

```
v<major>.<minor>.<patch>
```

| 部分 | 说明 | 示例 |
|-----|------|-----|
| **major** | 重大变更，不兼容升级 | v2.0.0 |
| **minor** | 新功能，向后兼容 | v1.1.0 |
| **patch** | bug修复，向后兼容 | v1.0.1 |

### 4.2 发布步骤

```bash
# 1. 创建release分支
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# 2. 更新版本号
# 修改 package.json 中的 version 字段

# 3. 更新CHANGELOG
# 修改 CHANGELOG.md

# 4. 执行测试
npm test

# 5. 合并到main分支
git checkout main
git merge --no-ff release/v1.0.0

# 6. 打标签
git tag v1.0.0
git push origin v1.0.0

# 7. 合并到develop
git checkout develop
git merge --no-ff release/v1.0.0

# 8. 删除release分支
git branch -d release/v1.0.0

# 9. 发布到生产环境
npm run build
# 部署dist目录到服务器
```

### 4.3 CHANGELOG格式

```markdown
## v1.0.0 (2026-05-26)

### Features
- WordList组件：添加字词注释悬浮提示功能
- MultiRoleReading组件：添加多角色朗读播放器
- VideoPlayer组件：添加视频自动播放功能

### Bug Fixes
- WordList组件：修复中文乱码问题（使用TextDecoder显式解码）
- MultiRoleReading组件：修复音频加载超时问题

### Improvements
- 添加perfMonitor性能监控工具
- 添加ErrorDisplay统一错误展示组件
- 更新vite.config.ts配置JSON响应头

### Breaking Changes
- 移除旧版数据加载方式，改用arrayBuffer解码
```

## 5. 标签管理

### 5.1 标签命名

```
vx.y.z           # 正式版本
vx.y.z-beta.x    # 测试版本
vx.y.z-rc.x      # 候选版本
```

### 5.2 标签操作

```bash
# 创建标签
git tag v1.0.0

# 推送标签
git push origin v1.0.0

# 删除标签
git tag -d v1.0.0
git push origin :v1.0.0

# 查看标签
git tag -l

# 查看标签详情
git show v1.0.0
```

## 6. 常见场景示例

### 6.1 新功能开发

```bash
# 从develop创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/add-wordlist-tooltip

# 开发完成后合并
git checkout develop
git merge --no-ff feature/add-wordlist-tooltip
git branch -d feature/add-wordlist-tooltip
git push origin develop
```

### 6.2 Bug修复

```bash
# 从develop创建修复分支
git checkout develop
git pull origin develop
git checkout -b bugfix/fix-wordlist-encoding

# 修复完成后合并
git checkout develop
git merge --no-ff bugfix/fix-wordlist-encoding
git branch -d bugfix/fix-wordlist-encoding
git push origin develop
```

### 6.3 紧急修复

```bash
# 从main创建热修复分支
git checkout main
git pull origin main
git checkout -b hotfix/emergency-audio-load

# 修复完成后合并到main和develop
git checkout main
git merge --no-ff hotfix/emergency-audio-load
git tag v1.0.1
git push origin main
git push origin v1.0.1

git checkout develop
git merge --no-ff hotfix/emergency-audio-load
git branch -d hotfix/emergency-audio-load
git push origin develop
```

## 7. 项目特定规范

### 7.1 数据文件提交

- JSON文件必须使用UTF-8编码（无BOM）
- 数据文件存放在 `public/data/` 目录
- 文件名格式：`WEN_xx.json`
- 提交前使用 `JSON.parse` 验证格式正确性

### 7.2 资源文件提交

- 音频文件：`public/audio/WEN_xx_*.mp3`
- 视频文件：`public/video/WEN_xx_*.mp4`
- 图片文件：`public/img/WEN_xx_*.png/jpg`
- 大型资源文件考虑使用CDN或OSS托管

### 7.3 测试提交

- 测试文件存放在 `tests/` 目录
- 测试文件命名：`[组件名].spec.ts`
- 提交前确保所有测试通过

---

**文档版本**: 1.1  
**更新日期**: 2026-05-26  
**适用项目**: wenyan-platform