# 变更记录 2026-10-09

> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成；保存位置 `docs/maintenance/changelog/`，命名 `changelog-YYYYMMDD.md`。
>
> 本次变更聚焦文化卡片多类型媒体能力；同日完成本地 feature-1 与远端分叉的同步（远端含 agent-101~105 的合并）。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
|---|---|---|---|---|---|
| CR-20261009-01 | feat | `src/components/CultureCards.vue`、`src/config/cultureCards.ts` | 文化卡片支持视频/图片/文字多类型媒体；视频改为卡内固定尺寸播放（复用 VideoPlayer 自带全屏键）；卡片与视频区尺寸走 Figma 配置接入点 | 已通过 | 待上线 |
| CR-20261009-02 | chore | `src/utils/api.ts` | 同步远端 feature-1（agent-101~105）与本地登录过期修复，401 语义分流冲突取双方之长 | 已通过 | 待上线 |

## 变更明细

### CR-20261009-01 文化卡片多类型媒体与卡内视频播放

- **变更类型**：feat（功能）
- **变更时间**：2026-10-09
- **分支**：`feature/culture-card-media/video-inline-player` @ `de43f00`；子分支并入父分支 `feature/culture-card-media/main` 合并提交 `947c40a`；并入 `feature-1` 合并提交 `2539278`
- **影响范围**：`src/components/CultureCards.vue`（修改）、`src/config/cultureCards.ts`（新增）
- **变更描述**：
  - 按「只做逻辑嵌入，不做页面视觉」原则：新增 `src/config/cultureCards.ts` 作为 Figma 尺寸数据的唯一接入点（`CultureCardSizeConfig`：`cardWidth` / `cardHeight` / `videoWidth` / `videoHeight`，当前为 `null` 待 Figma 方填入具体数值，为 `null` 时回退现有自适应布局）。
  - 视频卡片由「新窗口打开」改为卡内固定尺寸播放：复用 `VideoPlayer` 组件（自带全屏键），新增 `playingCards` 状态在封面缩略图与播放器之间切换。
  - `CultureCards.vue` 按 `cultureCardSize` 动态生成卡片与视频播放区尺寸样式；`:deep()` 穿透修正播放器在固定尺寸容器内的布局（`video-wrapper` 填满、控制条不压缩）。
  - 组件继续支持文字/图片/视频三种媒体类型（`cardMediaType` 分流）。
- **测试状态**：已通过（`npm run type-check` 通过；eslint 对改动文件无报错）
- **上线状态**：待上线

### CR-20261009-02 同步远端 feature-1 分叉

- **变更类型**：chore（集成同步）
- **变更时间**：2026-10-09
- **分支**：`feature-1`，合并提交 `f43671c`
- **影响范围**：`src/utils/api.ts`（冲突解决）；其余为远端既有变更自动并入（agent-101 导航延迟、agent-102 学生登录修复、agent-103~105 管理端/教师端功能）
- **变更描述**：
  - 本地 feature-1 持有 20261008 的登录过期修复（此前因缺少推送凭证未上远端），远端 feature-1 已含 agent-101~105 的合并，两侧在 `src/utils/api.ts` 的 401 处理产生冲突。
  - 解决方案取双方之长：保留本地 F-002 `INVALID_CREDENTIALS` 原样透传与 F-005 `AUTH_REQUIRED`/`AUTH_EXPIRED` 提示分流（`tests/unit/apiAuth401.spec.ts` 期望），登录态读写改用远端 R104 的 `isLoggedInSafely()` / `logoutSafely()`（Pinia 未就绪不抛错），会话消息回退优先透传后端 message。
- **测试状态**：已通过（`tests/unit/apiAuth401.spec.ts` + `tests/unit/apiAuthHeader.spec.ts` 共 8 项；`npm run type-check` 通过）
- **上线状态**：待上线
