# 0-开发规则简明手册

## 一、核心原则

### 1.1 数据加载

- **必须**使用 `useDataLoader` 获取 JSON 数据，禁止直接调用 `fetch`
- JSON 请求必须使用 `arrayBuffer + TextDecoder('utf-8')` 解码
- 所有 JSON 文件必须使用 UTF-8 无 BOM 编码

### 1.2 组件开发

- 组件**必须**处理四态：`loading`、`error`、`timeout`、`empty`
- 组件样式**必须**使用 `<style scoped>`
- 组件本地状态（`loading`、`error`、`data`）使用 `ref`/`reactive`，禁止放入 Pinia store

### 1.3 响应式安全

- **禁止**在 `watch` 回调中修改被监听的值
- **禁止**在组件内进行复杂数据加工，使用 `src/adapters/` 目录下的适配器
- computed 链**必须**拆分，避免单一 computed 处理过多逻辑

## 二、命名规范

| 类别     | 规则                   | 示例                     |
| :----- | :------------------- | :--------------------- |
| 文件与组件名 | PascalCase           | `WordList.vue`         |
| Props  | camelCase            | `wenId`, `autoLoad`    |
| Events | kebab-case           | `@load-success`        |
| 布尔状态   | `is`/`has`/`show` 前缀 | `isPlaying`            |
| 数据状态   | 名词复数                 | `wordList`, `segments` |
| 变量/函数  | camelCase            | `loadData`             |
| 常量     | 全大写+下划线              | `DEFAULT_TIMEOUT`      |

## 三、项目命名约定

```
课文ID: WEN_xx（如 WEN_01, WEN_02）
音频文件: WEN_xx_multi_role.mp3
视频文件: WEN_xx_rule_1.mp4
图片文件: WEN_xx_illus_1.png
数据文件: WEN_xx.json
```

## 四、目录结构

```
src/
├── components/     # 可复用组件（PascalCase命名）
├── views/          # 页面视图
├── composables/    # 组合式函数（useXxx.ts）
├── stores/         # Pinia状态管理
├── adapters/       # 数据适配层（纯函数）
├── utils/          # 工具函数
├── router/         # 路由配置
└── config/         # 配置文件

public/data/
├── word_list/           # 字词数据
├── text_basic_info/     # 课文基础信息
├── multi_role_reading/  # 多角色朗读数据
├── level1_quiz/         # 一级测验
├── level2_dialog/       # 二级对话
└── level3_quiz/         # 三级测验
```

## 五、Git 提交规范

### 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 类型

| Type     | 说明    | 示例                            |
| -------- | ----- | ----------------------------- |
| feat     | 新功能   | `feat(WordList): 添加注释悬浮提示`    |
| fix      | bug修复 | `fix(WordList): 修复中文乱码`       |
| docs     | 文档更新  | `docs: 更新规范`                  |
| style    | 代码风格  | `style: 格式化代码`                |
| refactor | 重构    | `refactor(StepOneView): 优化导航` |
| test     | 测试    | `test: 添加单元测试`                |
| chore    | 构建/工具 | `chore: 更新依赖`                 |
| perf     | 性能优化  | `perf: 添加缓存`                  |

### 分支命名

| 类型    | 格式               | 示例                    |
| ----- | ---------------- | --------------------- |
| 功能分支  | `feature/xxx`    | `feature/add-login`   |
| 修复分支  | `bugfix/xxx`     | `bugfix/fix-encoding` |
| 发布分支  | `release/vx.y.z` | `release/v1.0.0`      |
| 热修复分支 | `hotfix/xxx`     | `hotfix/urgent-fix`   |

## 六、组件开发检查清单

新建组件时必须检查：

- [ ] PascalCase 命名，`<style scoped>`
- [ ] 使用 `useDataLoader` 获取数据
- [ ] 实现四态处理：loading、error、timeout、empty
- [ ] 生命周期清理：abort、pause、clearTimeout
- [ ] Props 定义使用 `withDefaults(defineProps<Props>())`
- [ ] Events 使用 `defineEmits<{}>()`
- [ ] 顶部包含组件注释模板

## 七、常见问题速查

| 现象     | 原因                  | 解决方法                         |
| ------ | ------------------- | ---------------------------- |
| 页面一直加载 | JSON 解析失败           | 使用 `TextDecoder('utf-8')` 解码 |
| 中文乱码   | 编码不匹配               | 检查文件编码和响应头                   |
| 响应式卡死  | computed/watch 循环依赖 | 拆分 computed，避免 watch 中修改监听值  |
| 刷新无反应  | 错误被吞掉               | 确保 finally 块重置 loading       |
| API请求502错误 | 后端服务未启动或端口未监听 | 在 `backend` 目录执行 `node server.js` 启动后端服务 |

## 八、安全约束

- **禁止**使用 `eval()`
- **禁止**使用 `with` 语句
- **禁止** SQL 拼接
- 对用户输入进行校验和转义
- 使用 `AbortController` 取消未完成的请求

***

**版本**: 1.0
**更新日期**: 2026-05-28
