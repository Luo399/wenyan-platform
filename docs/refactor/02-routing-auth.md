# 02 - 路由与鉴权系统（P0）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## R01. 路由定义双重冗余，实际路由缺失关键页面
- **优先级**: P0
- **状态**: [x] 已完成
- **文件**: `src/router/index.ts`（第 15-84 行 `routes` 数组 + 第 86-89 行 `createRouter`）
- **问题描述**:
  - 第 18-83 行导出 `routes` 数组（11 条路由）但实际未被 `createRouter` 使用，是死代码
  - `createRouter` 实际只注册 7 条路由，**缺失**：`stepthree`、`steptwo`、`block-demo`、`answer-query`、`NotFoundView`
  - 访问这些路径会命中未定义路由，且无 404 兜底
- **修复方案**:
  1. 删除未使用的 `routes` 数组
  2. 将缺失的 5 条路由添加到 `createRouter` 中
  3. 确保所有路由使用懒加载 `() => import(...)`
- **验证方式**: 访问 `/stepthree`、`/steptwo`、`/answer-query` 正常渲染；访问不存在路径显示 404
- **分支建议**: `refactor/routing-01`
- **依赖**: 无
- **完成说明**: 已在早期提交（`2eef947` / `318adc4`）修复。当前 `src/router/index.ts` 仅保留单一 `routes` 数组（12 条路由，含 `stepthree`、`steptwo`、`block-demo`、`answer-query`、`not-found`），由 `createRouter({ routes })` 直接消费；首屏 `HomeView` 同步加载，其余 7 个视图均懒加载 `() => import(...)`，404 兜底为 `:pathMatch(.*)*` → `NotFoundView`。

## R02. 路由守卫 setupAuthGuard 从未被调用
- **优先级**: P0
- **状态**: [x] 已完成
- **文件**:
  - `src/router/guards.ts`（第 25 行 `setupAuthGuard` 定义）
  - `src/main.ts`（第 18 行调用 `setupAuthGuard(router)`）
- **问题描述**: `setupAuthGuard` 定义了路由守卫逻辑（检查 `requiresAuth` meta），但全项目从未调用，登录拦截完全不工作
- **修复方案**:
  1. 在 `src/router/index.ts` 的 `createRouter` 之后调用 `setupAuthGuard(router)`
  2. 或在 `src/main.ts` 中 `app.use(pinia)` 之后调用
  3. 确保 `requiresAuth: true` meta 添加到 `createRouter` 的实际路由中
- **验证方式**: 未登录访问 `requiresAuth` 路由时重定向到首页
- **分支建议**: `refactor/routing-02`
- **依赖**: R01（路由定义修复后才有意义）
- **完成说明**: 已在早期提交修复。`src/main.ts` 第 18 行在 `app.use(pinia)` + `app.use(router)` 之后调用 `setupAuthGuard(router)`；守卫内部通过 `useAuthStore().isLoggedIn` 判断，未登录访问 `requiresAuth` 路由时标记 `to.meta.showLoginModal = true` 并放行，由目标页监听 meta 触发登录弹窗（非硬重定向，保留目标 URL）。

## R03. requiresAuth 元信息未生效
- **优先级**: P0
- **状态**: [x] 已完成
- **文件**: `src/router/index.ts`（`routes` 数组中 `stepone` / `stepthree` / `steptwo` / `answer-query` 四条路由）
- **问题描述**: `meta: { requiresAuth: true }` 只写在未使用的 `routes` 数组中，`createRouter` 实际路由全部无 meta
- **修复方案**: 在 `createRouter` 的路由定义中添加 `meta: { requiresAuth: true }` 到需要鉴权的页面（answer-query 等）
- **验证方式**: 未登录访问 `/answer-query` 被拦截
- **分支建议**: `refactor/routing-03`
- **依赖**: R01 + R02
- **完成说明**: 已在早期提交修复。R01 合并后 `routes` 数组即为 `createRouter` 的唯一数据源，`meta: { requiresAuth: true }` 已挂在 `stepone`、`stepthree`、`steptwo`、`answer-query` 四条路由上，配合 R02 的 `setupAuthGuard` 生效。

## R04. navigation.ts RouteName 类型与实际路由不匹配
- **优先级**: P1
- **状态**: [x] 已完成
- **文件**: `src/config/navigation.ts`（第 45-54 行 `RouteName` 类型）
- **问题描述**: `RouteName` 类型含 `'stepthree' | 'steptwo'`，但 `createRouter` 未注册这两个路由。调用 `goTo('stepthree')` 会跳转到不存在路由
- **修复方案**:
  1. R01 修复后，确保 `RouteName` 与实际路由 name 一一对应
  2. 考虑用 `as const` 从路由定义自动推导类型
- **验证方式**: `goTo('stepthree')` 正确跳转
- **分支建议**: `refactor/routing-04`
- **依赖**: R01
- **完成说明**: 随 R01 修复。`RouteName` 联合类型的 9 个字面量（home/rules/stepone/steptwo/stepthree/rule1/rule2/rule3/detail）全部在 `routes` 数组中注册；非顺序路由 `block-demo` / `not-found` 故意不纳入 `pageSequence`（属非顺序页面，由 `useNavigation()` 可选参数 + `goHome()` 处理，见 04 专题 C03）。`goTo('stepthree')` 可正确跳转。

## R05. navigation.ts idTransformMap 全是 no-op
- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `src/config/navigation.ts`（原第 134-197 行）、`src/composables/useNavigation.ts`（原第 52-73 行 `getTargetId` / `getDefaultId`）
- **问题描述**: 所有 9 个转换函数都是 `(id) => id || null`，完全无逻辑。`transformId` 调用这些空函数毫无意义
- **修复方案**:
  1. 若转换逻辑确实不需要：删除整块转换机制（`idTransformMap`、`transformId` 及其调用）
  2. 若需要 poemId↔wenId 转换：补充真实转换逻辑
- **验证方式**: 导航功能正常，无空函数调用链
- **分支建议**: `refactor/routing-05`
- **依赖**: R01
- **完成说明**: 采用方案 1（删除）。所有页面共用 poemId（数字格式），9 个转换函数全为 `(id) => id || null` no-op，`transformId` 调用链实际只透传 currentId。删除 `idTransformMap`（28 行）与 `transformId` 函数（18 行）；`useNavigation.getTargetId()` 简化为 `currentId || getDefaultId()`，移除 `targetRouteName` 形参与 `transformId` 调用；`getDefaultId()` 移除无用 `pageSequence.findIndex` 查找；`goNext`/`goPrev`/`goTo` 三处调用点同步去掉 `nextPage.name`/`prevPage.name`/`routeName` 实参。`tests/composables/useNavigation.spec.ts` 走外部 API，行为不变，无需改动。
