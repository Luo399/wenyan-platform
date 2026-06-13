# Excel 转 JSON 操作手册

## 1. 概述

本项目提供了多个 Python 脚本，用于从固定格式的 Excel 文件 `开发需求填写.dbt.xlsx` 批量生成 JSON 数据文件。

### 脚本功能总览

| 脚本文件 | 功能 | 输入Sheet | 输出格式 |
|---------|------|-----------|----------|
| `excel2json.py` | 通用Excel转JSON | 任意Sheet | 数组格式 |
| `excel2blocks.py` | 生成二级对话测验 | `level2_dialog_quiz` | blocks模式 |
| `excel2textquiz.py` | 生成三级自适应测验 | `level3_adaptive_quiz` | text+quiz模式 |
| `quiz_excel2json.py` | 批量处理所有测验数据 | 多个Sheet | 按类型分文件 |

---

## 2. Excel 文件格式规范

### 2.1 核心规则

**必须严格遵循以下格式，否则脚本无法正确解析：**

| 行号 | 用途 | 示例 |
|------|------|------|
| 第1行 | 中文列名（注释用） | `课文ID`, `题目文本`, `选项A` |
| 第2行 | 英文列名（JSON属性名） | `text_id`, `question_text`, `option_a` |
| 第3行及以后 | 实际数据 | 具体内容 |

### 2.2 空值处理

- Excel 中的空单元格 → JSON 中的 `null`
- 空白字符串 `""` → JSON 中的 `null`
- `"nan"` 字符串 → JSON 中的 `null`

### 2.3 数据类型

- **文本类型**：直接输出字符串
- **数字类型**：保持数字格式（如题号 `question_number`）
- **选项字母**：`correct_answer` 列的 `A/B/C/D` 会自动转换为数字索引 `0/1/2/3`

---

## 3. 使用方法

### 3.1 环境准备

确保已安装所需依赖：

```bash
# 安装依赖
pip install pandas openpyxl numpy
```

### 3.2 通用转换脚本 (`excel2json.py`)

**功能**：将指定的 Sheet 转换为简单的 JSON 数组

```bash
# 运行脚本（默认处理第1、2、3个Sheet）
python excel2json.py

# 或指定处理的Sheet索引（从0开始）
python excel2json.py --sheets 0 1 2 3
```

**输出**：每个 Sheet 生成一个 `{sheet_name}.json` 文件

### 3.3 二级对话测验转换 (`excel2blocks.py`)

**功能**：处理 `level2_dialog_quiz` Sheet，生成 blocks 模式的页面配置

```bash
python excel2blocks.py
```

**处理逻辑**：

| 判断条件 | Block类型 | 输出字段 |
|---------|----------|---------|
| `question_number` 有值 | `quiz` | 题目、选项、答案、解析 |
| `question_number` 为空 | `dialogue` | 对话文本、音频、图标 |

**输出示例** (`WEN_01.json`)：
```json
{
  "pageId": "WEN_01",
  "blocks": [
    {
      "type": "dialogue",
      "data": {
        "text_id": "WEN_01",
        "pre_dialog": "戍卒：二位屯长，冒昧来访...",
        "audio_file": "WEN_01_multi_dialog1",
        "icon_dialog": "WEN_01_icon_dialog1.png"
      }
    },
    {
      "type": "quiz",
      "data": {
        "text_id": "WEN_01",
        "question_number": 1,
        "question_text": "下列对陈胜、吴广起义...",
        "option_a": "...",
        "correct_answer": "B",
        "explanation": "..."
      }
    }
  ]
}
```

### 3.4 三级自适应测验转换 (`excel2textquiz.py`)

**功能**：处理 `level3_adaptive_quiz` Sheet，生成 text+quiz 配对格式

```bash
python excel2textquiz.py
```

**处理逻辑**：
1. 按 `text_id` 分组
2. 每行生成一个 `text + quiz` 配对
3. `correct_answer` 字母自动转换为数字索引

**输出示例** (`WEN_01.json`)：
```json
{
  "pageId": "WEN_01",
  "items": [
    {
      "text": "起义誓师之后，戍卒们围坐一起...",
      "quiz": {
        "question_id": "WEN_01_Q1",
        "question_type": "radio",
        "question_text": "你认为陈胜吴广最重要的特质是...",
        "options": ["胆小懦弱...", "有胆有识...", "有勇无谋...", "阴险狡诈..."],
        "correct_answer": 1,
        "explanation": "陈胜吴广身处绝境敢于奋起反抗...",
        "difficulty": "L1"
      }
    }
  ]
}
```

### 3.5 批量处理脚本 (`quiz_excel2json.py`)

**功能**：一次性处理多个测验 Sheet，生成多个 JSON 文件

```bash
python quiz_excel2json.py
```

**处理的 Sheet**：

| Sheet名称 | 输出文件 | 说明 |
|----------|---------|------|
| `level1_quiz` | `level1_quiz.json` | 一级测验 |
| `level2_dialog_quiz` | `level2_dialog.json` | 二级对话 |
| `level2_dialog_quiz` | `level2_quiz.json` | 二级测验 |
| `level3_adaptive_quiz` | `level3_adaptive_quiz.json` | 三级测验 |
| `level3_adaptive_quiz` | `level3_scenario_text.json` | 三级场景文本 |

---

## 4. Excel Sheet 结构说明

### 4.1 level1_quiz（一级测验）

| 中文列名 | 英文属性名 | 类型 | 必填 |
|---------|-----------|------|------|
| 课文ID | `text_id` | string | ✓ |
| 题号 | `question_number` | number | ✓ |
| 题目文本 | `question_text` | string | ✓ |
| 选项A | `option_a` | string | ✓ |
| 选项B | `option_b` | string | ✓ |
| 选项C | `option_c` | string | ✓ |
| 选项D | `option_d` | string | ✓ |
| 音频文件 | `audio_file` | string | |
| 难度 | `difficulty` | string | |
| 正确答案 | `correct_answer` | string(A/B/C/D) | ✓ |
| 解析 | `explanation` | string | |
| 题型 | `question_type` | string | |

### 4.2 level2_dialog_quiz（二级对话测验）

| 中文列名 | 英文属性名 | 类型 | 必填 |
|---------|-----------|------|------|
| 课文ID | `text_id` | string | ✓ |
| 题号 | `question_number` | number | quiz必填 |
| 题目文本 | `question_text` | string | quiz必填 |
| 选项A | `option_a` | string | quiz必填 |
| 选项B | `option_b` | string | quiz必填 |
| 选项C | `option_c` | string | quiz必填 |
| 选项D | `option_d` | string | quiz必填 |
| 音频文件 | `audio_file` | string | |
| 难度 | `difficulty` | string | |
| 前置对话 | `pre_dialog` | string | dialogue必填 |
| 正确答案 | `correct_answer` | string | |
| 解析 | `explanation` | string | |
| 题型 | `question_type` | string | |
| 对话图标 | `icon_dialog` | string | |

### 4.3 level3_adaptive_quiz（三级自适应测验）

| 中文列名 | 英文属性名 | 类型 | 必填 |
|---------|-----------|------|------|
| 课文ID | `text_id` | string | ✓ |
| 场景文本 | `scenario_text` | string | ✓ |
| 题目ID | `question_id` | string | ✓ |
| 题型 | `question_type` | string | |
| 题目文本 | `question_text` | string | ✓ |
| 选项A | `option_a` | string | ✓ |
| 选项B | `option_b` | string | ✓ |
| 选项C | `option_c` | string | ✓ |
| 选项D | `option_d` | string | ✓ |
| 正确答案 | `correct_answer` | string(A/B/C/D) | ✓ |
| 解析 | `explanation` | string | |
| 难度 | `difficulty` | string | |

---

## 5. 输出文件目录结构

```
数据/
├── level1_quiz.json          # 一级测验数据
├── level2_dialog.json        # 二级对话数据
├── level2_quiz.json          # 二级测验数据
├── level3_adaptive_quiz.json # 三级自适应测验
├── level3_scenario_text.json # 三级场景文本
└── pages/                    # blocks模式页面配置
    ├── WEN_01.json
    ├── WEN_02.json
    └── ...
```

---

## 6. 常见问题

### 6.1 脚本无法运行

**现象**：运行脚本时报错 `ModuleNotFoundError`

**解决**：
```bash
pip install pandas openpyxl numpy
```

### 6.2 Excel 文件找不到

**现象**：报错 `未找到文件 开发需求填写.dbt.xlsx`

**解决**：确保 Excel 文件与脚本在同一目录下，或修改脚本中的 `INPUT_FILE` 路径

### 6.3 数据为空或部分缺失

**现象**：生成的 JSON 文件为空或数据不完整

**检查项**：
1. 确认 Excel 文件的第1行是中文列名，第2行是英文属性名
2. 确认数据从第3行开始
3. 检查 `text_id` 列是否有值（脚本会过滤 `text_id` 为空的行）

### 6.4 正确答案转换错误

**现象**：`correct_answer` 字段值不正确

**原因**：`excel2textquiz.py` 会将字母 `A/B/C/D` 转换为数字索引 `0/1/2/3`

**确认**：检查 Excel 中 `correct_answer` 列的值是否为大写字母

---

## 7. 最佳实践

### 7.1 Excel 填写规范

1. **统一编码**：使用 UTF-8 编码保存 Excel 文件
2. **避免合并单元格**：不要使用合并单元格功能
3. **规范命名**：英文属性名使用小写蛇形命名（`text_id`）
4. **必填项检查**：确保 `text_id`、`question_text`、选项等必填字段有值

### 7.2 数据验证

生成 JSON 后建议验证：

```bash
# 验证JSON格式（需要安装jq）
jq . level1_quiz.json

# 检查数据行数
jq 'length' level1_quiz.json

# 检查是否有空值
jq '[.[] | select(.question_text == null)]' level1_quiz.json
```

### 7.3 版本控制

建议将生成的 JSON 文件纳入版本控制，但不要提交原始 Excel 文件（除非必要）。

---

## 8. 扩展指南

### 8.1 添加新的 Sheet 处理

如需处理新的 Sheet 类型，可参考以下步骤：

1. 在 `excel2json.py` 中添加新的处理逻辑
2. 或创建新的专用脚本（如 `excel2xxx.py`）
3. 定义输出格式和字段映射
4. 添加命令行参数支持

### 8.2 自定义输出目录

修改脚本中的 `OUTPUT_DIR` 变量：

```python
OUTPUT_DIR = r"e:\cpp_discipline\wenyan-platform\public\data\new_folder"
```

---

**版本**: 1.0  
**更新日期**: 2026-06-02  
**适用项目**: wenyan-platform