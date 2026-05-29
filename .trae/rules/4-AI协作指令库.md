# 4-AI协作指令库

## 1. 代码生成指令

### 1.1 创建Vue组件

```
请创建一个Vue 3组件，路径：src/components/[ComponentName].vue

功能说明：[详细功能描述]

技术要求：
- 使用TypeScript和Composition API
- 包含完整的props定义（参考WordList.vue的props风格）
- 定义emit事件（参考MultiRoleReading.vue的事件风格）
- 处理loading/error/empty/data四态
- 使用perfMonitor监控性能
- 添加适当的注释

参考项目中类似组件：src/components/WordList.vue 或 src/components/MultiRoleReading.vue
```

### 1.2 创建页面视图

```
请创建一个Vue页面组件，路径：src/views/[PageName].vue

功能需求：
- [需求1]
- [需求2]

技术要求：
- 使用TypeScript
- 引入必要的组件（如WordList, MultiRoleReading, BackContinue）
- 使用useNavigation进行页面导航
- 使用getWenId转换ID格式
- 实现完整的页面布局

参考项目中类似页面：src/views/StepOneView.vue
```

### 1.3 创建工具函数

```
请创建一个工具函数，路径：src/utils/[fileName].ts

功能：[功能描述]

参数：
- param1: 类型，说明
- param2: 类型，说明

返回值：类型，说明

要求：
- 编写完整的TypeScript类型定义
- 添加JSDoc注释
- 考虑边界情况处理
- 参考项目中其他工具函数的风格：src/utils/wenUtils.ts, src/utils/api.ts
```

### 1.4 创建组合式函数

```
请创建一个composable，路径：src/composables/use[Name].ts

功能：[功能描述]

返回值：
- functionName: 函数说明
- stateName: 状态说明

要求：
- 使用Vue 3 Composition API
- 处理异步操作的loading/error状态
- 添加适当的注释
- 参考项目中useNavigation.ts的风格

示例参考：
src/composables/useNavigation.ts
```

### 1.5 创建Pinia Store

```
请创建一个Pinia store，路径：src/stores/[storeName].ts

功能：[功能描述]

状态定义：
- stateName: 类型，说明

方法定义：
- methodName: 功能说明

要求：
- 使用defineStore和setup语法
- 包含完整的TypeScript类型定义
- 参考项目中student.ts的风格

示例参考：
src/stores/student.ts
```

## 2. 代码修改指令

### 2.1 添加功能

```
请在[文件路径]中添加以下功能：

功能描述：[详细说明]

修改范围：
- 在[函数/方法]中添加逻辑
- 添加新的props/state
- 添加新的事件

要求：
- 保持原有代码风格
- 添加适当的注释
- 不破坏现有功能
- 参考项目中类似功能的实现方式
```

### 2.2 修复bug

```
请修复[文件路径]中的bug：

问题描述：[详细说明]
复现步骤：[步骤]
期望行为：[描述]

要求：
- 定位并修复根因
- 添加测试用例（如果适用）
- 确保修复后不引入新问题
- 参考项目中类似bug的修复方式

示例：修复WordList.vue中的中文乱码问题，使用arrayBuffer+TextDecoder方案
```

### 2.3 优化性能

```
请优化[文件路径]中的性能问题：

问题描述：[性能瓶颈说明]
影响范围：[描述]

优化方向：
- 减少重复渲染
- 优化数据请求（参考WordList.vue的并行加载方式）
- 使用perfMonitor进行监控
- 优化算法复杂度

要求：
- 保持功能不变
- 添加优化前后的对比说明
- 参考项目中perfMonitor.ts的使用方式
```

### 2.4 重构代码

```
请重构[文件路径]中的代码：

重构目标：
- [目标1]
- [目标2]

重构原则：
- 保持对外接口不变
- 提高代码可读性
- 减少代码重复
- 参考项目中其他组件的代码结构

要求：
- 添加重构说明
- 确保测试通过
```

## 3. 数据处理指令

### 3.1 Excel转JSON

```
请处理Excel文件，生成JSON数据：

输入文件：开发需求填写.dbt.xlsx
输出路径：public/data/[模块名]/WEN_xx.json

转换规则：
- 表名作为数据结构的基础
- 列名使用camelCase
- 特殊字符由JSON.stringify自动转义
- 输出格式：UTF-8，带缩进

数据结构要求：
参考项目中现有JSON文件格式：
- public/data/word_list/WEN_01.json
- public/data/text_basic_info/WEN_01.json
- public/data/multi_role_reading/WEN_01.json

要求：
- 使用JSON.stringify生成
- 确保数据格式正确
- 提供转换说明
```

### 3.2 数据验证

```
请验证[文件路径]中的JSON数据：

验证规则：
- 必需字段检查（参考数据结构定义）
- 数据类型验证
- 格式规范检查

参考项目中的数据结构：
- WordItem: text_id, word, basic_meaning
- TextBasicInfo: text_id, title, original_text
- MultiRoleData: text_id, audio_file, segments

要求：
- 输出验证报告
- 指出问题位置和原因
- 提供修复建议
```

## 4. 测试相关指令

### 4.1 编写测试用例

```
请为[文件路径]编写单元测试：

测试目标：
- [功能1]
- [功能2]

测试要求：
- 使用Vitest
- 覆盖主要场景
- 包含边界条件测试
- 参考项目中现有测试的风格

输出路径：tests/[对应路径]/[文件名].spec.ts

示例参考：
tests/components/WordList.spec.ts
tests/composables/useNavigation.spec.ts
```

### 4.2 运行测试

```
请运行测试并生成报告：

测试范围：[描述，如：所有测试、特定文件、特定组件]

要求：
- 执行测试命令：npm test 或 npm run test:coverage
- 输出测试结果
- 分析失败原因
```

## 5. 部署与配置指令

### 5.1 构建项目

```
请构建项目并输出结果：

构建类型：[development/production]

要求：
- 执行构建命令：npm run build
- 检查构建输出
- 验证产物完整性
- 检查dist目录结构
```

### 5.2 环境配置

```
请配置环境变量：

目标环境：[开发/测试/生产]

配置项（参考.env.development）：
- VITE_API_BASE_URL: [后端API地址]
- VITE_OSS_BASE_URL: [静态资源地址]
- 其他配置...

要求：
- 更新.env文件
- 说明配置用途
- 检查配置正确性
```

### 5.3 Vite配置

```
请更新vite.config.ts配置：

配置需求：
- [配置项1]
- [配置项2]

参考项目中现有配置：
src/vite.config.ts

要求：
- 保持现有配置结构
- 添加必要的配置项
- 测试配置是否生效
```

## 6. 通用约束指令

### 6.1 编码规范约束

```
请遵循以下规范：
- 所有JSON文件使用UTF-8编码（无BOM）
- 所有fetch请求使用arrayBuffer + TextDecoder('utf-8')解码（参考WordList.vue）
- 组件必须处理loading/error/empty/data四态
- 设置10秒超时（参考WordList.vue的超时实现）
- 使用TypeScript严格模式
- 使用perfMonitor监控函数执行时间
```

### 6.2 安全约束

```
安全要求：
- 禁止使用eval()
- 禁止使用with语句
- 禁止SQL拼接
- 对用户输入进行校验和转义
- 防止XSS攻击（参考WordList.vue的sanitizeHtml函数）
- 使用AbortController取消未完成的请求
```

### 6.3 代码风格约束

```
代码风格：
- 使用2空格缩进
- 变量/函数使用camelCase（如wenId, loadData）
- 组件/类使用PascalCase（如WordList, MultiRoleReading）
- 常量使用全大写加下划线（如DEFAULT_TIMEOUT）
- 文件编码UTF-8
- 使用console.log进行调试时添加组件前缀（如[WordList]）
```

### 6.4 项目命名约定

```
项目命名约定：
- 课文ID格式：WEN_xx（如WEN_01, WEN_02）
- 音频文件：WEN_xx_multi_role.mp3
- 视频文件：WEN_xx_rule_1.mp4
- 图片文件：WEN_xx_illus_1.png
- 页面路由：/stepone/:id, /detail/:id
- 导航配置：src/config/navigation.ts
```

---

**文档版本**: 1.1  
**更新日期**: 2026-05-26  
**适用项目**: wenyan-platform