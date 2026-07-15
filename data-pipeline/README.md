# 数据工作流 (Data Pipeline)

## 概述

本目录用于管理文言文平台的数据处理流程，包含从 Excel 原始数据到最终 JSON 的完整转换链路。

## 目录结构

```
data-pipeline/
├── source/               # 原始 Excel 文件（教研人员/编辑修改这里）
│   ├── 开发需求填写.dbt.xlsx
│   └── 学生名单.xlsx
├── python/               # Python 清洗脚本
│   ├── data_processor/   # 数据处理器模块
│   ├── maintenance_tools/# 维护工具
│   ├── transformers/     # 数据转换器
│   ├── utils/            # 工具函数
│   └── *.py              # 各类转换脚本
├── typescript/           # TypeScript 适配器（如有需要）
├── temp/                 # 临时中间文件（已加入 .gitignore）
└── README.md             # 本说明文档
```

## 数据工作流层次

```
Excel 基础数据 (source/)
        ↕（数据提取与标准化）
初步清洗层 (python/)
        ↕（数据处理与转换）
适配器层 (typescript/)
        ↕（数据格式转换与验证）
JSON 层 (backend/data/)   ← 最终 JSON，会被 Git 管理并部署到服务器
```

## 各层职责

| 层次 | 目录 | 职责 |
|-----|------|-----|
| Excel 基础数据 | `source/` | 教研人员编辑的原始 Excel 文件 |
| 初步清洗层 | `python/` | 读取 Excel、检查错误、清洗数据、输出临时中间文件 |
| 适配器层 | `typescript/` | 将中间文件转换成最终 JSON 格式 |
| JSON 层 | `backend/data/` | 生成的 JSON 最终存放处 |

## 使用流程

### 1. 准备数据

将 Excel 文件放入 `source/` 目录：
- `开发需求填写.dbt.xlsx` - 主要数据文件
- `学生名单.xlsx` - 学生信息文件

### 2. 运行 Python 清洗脚本

```bash
cd data-pipeline/python

# 运行数据处理器（推荐）
python data_processor/main.py

# 或使用命令行参数
python data_processor/main.py --input ../source/开发需求填写.dbt.xlsx --output ../temp

# 或运行单独的转换脚本
python excel2json.py
python quiz_excel2json.py
```

### 3. 自动数据处理功能

数据处理器会自动执行以下操作：

| 功能 | 说明 |
|-----|------|
| ✅ 字段映射 | Excel 列映射到 JSON 字段 |
| ✅ 数据验证 | 检查必需字段完整性 |
| ✅ 类型转换 | 自动转换数字、难度等级等 |
| ✅ 答案索引计算 | 根据 correct_answer 自动计算 correct_index |
| ✅ None 值过滤 | 自动过滤值为 null 的字段 |
| ✅ 字段排序 | 按标准顺序排列字段 |
| ✅ 报告生成 | 生成详细的处理报告 |

### 4. 生成临时中间文件

处理后的中间文件会输出到 `temp/` 目录：
- `level1_quiz.json` - 一级测验数据
- `level2_dialog_quiz.json` - 二级对话测验数据
- `level3_adaptive_quiz.json` - 三级自适应测验数据
- `processing_report.md` - 处理报告

该目录已加入 `.gitignore`。

### 5. 运行 TypeScript 适配器（如有需要）

```bash
cd data-pipeline/typescript
npm run build
```

### 6. 最终输出

最终生成的 JSON 文件会复制到 `backend/data/` 目录，该目录会被 Git 管理并部署到服务器。

## 自动推送钩子

项目已配置 Git pre-push hook，在推送代码时会自动：

1. 检测数据文件变更（Excel、配置、脚本）
2. 自动执行数据流水线
3. 暂存新生成的 JSON 文件
4. 如果流水线失败，阻断推送

这样可以确保：
- 前后端代码与最新数据始终一致
- 不会忘记运行流水线
- 数据问题在推送前被发现

## 数据验证

运行数据结构验证器检查数据完整性：

```bash
cd data-pipeline/python/maintenance_tools
python data_validator.py
```

## 核心脚本说明

| 脚本 | 功能 |
|-----|------|
| `excel_utils.py` | Excel 读取工具函数 |
| `excel2json.py` | Excel 转 JSON 通用工具 |
| `quiz_excel2json.py` | 题目数据专用转换 |
| `generate_all_json.py` | 批量生成所有 JSON |
| `data_processor/main.py` | 统一数据处理入口 |

## 维护工具

| 工具 | 功能 |
|-----|------|
| `maintenance_tools/data_validator.py` | 数据结构验证器 |
| `maintenance_tools/test_data_validator.py` | 验证器单元测试 |

## 配置文件

| 文件 | 说明 |
|-----|------|
| `extraction-config.json` | 数据提取配置（待创建） |
| `data_processor/config.py` | 数据处理器配置 |

## 注意事项

1. **不要直接修改 `backend/data/` 目录的文件**，应通过本工作流生成
2. `temp/` 目录用于存放临时文件，不会被 Git 追踪
3. 修改 Excel 文件后，需重新运行转换脚本更新 JSON
4. 运行脚本前请确保已安装依赖：`pip install openpyxl`

## 版本历史

| 版本 | 日期 | 修改内容 |
|-----|------|---------|
| V1.0 | 2026-06-15 | 初始版本，建立目录结构 |