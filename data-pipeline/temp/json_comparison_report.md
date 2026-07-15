# JSON 数据对比报告

## 报告信息

| 项目 | 内容 |
|-----|------|
| **报告编号** | JSON-CMP-20260615 |
| **生成日期** | 2026-06-15 |
| **对比类型** | 新生成JSON vs Backend现有JSON |

---

## 1. 数据结构对比

### 1.1 level1_quiz 对比

**新生成 (temp/level1_quiz.json):**
```json
{
  "text_id": "WEN_01",
  "question_number": 1,
  "question_text": "...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "audio_file": null,
  "difficulty": "L2",
  "correct_answer": "C",
  "correct_index": null,
  "explanation": "...",
  "question_type": null
}
```

**现有 (backend/data/level1_quiz/WEN_01.json):**
```json
{
  "text_id": "WEN_01",
  "question_number": 1,
  "question_text": "...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_answer": "C",
  "correct_index": 2,
  "explanation": "...",
  "difficulty": "L2"
}
```

**差异分析:**

| 字段 | 新生成 | 现有 | 状态 |
|-----|------|-----|------|
| `audio_file` | null | 不存在 | 新增字段 |
| `question_type` | null | 不存在 | 新增字段 |
| `correct_index` | null | 2 | 值缺失 |
| `difficulty` 位置 | 在 `explanation` 前 | 在 `explanation` 后 | 顺序差异 |

---

### 1.2 level2_dialog_quiz 对比

**新生成 (temp/level2_dialog_quiz.json):**
```json
{
  "text_id": "WEN_01",
  "question_number": 1,
  "question_text": "...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "audio_file": "WEN_01_multi_dialog2",
  "difficulty": "L3",
  "correct_answer": null,
  "correct_index": null,
  "explanation": null,
  "question_type": null,
  "pre_dialog": "...",
  "icon_dialog": "WEN_01_icon_dialog2.png"
}
```

**现有 (backend/data/pages_level2_dialog_quiz/WEN_01.json):**
```json
{
  "pageId": "WEN_01",
  "blocks": [
    { "type": "dialogue", "data": {...} },
    { "type": "quiz", "data": {...} },
    ...
  ]
}
```

**差异分析:**

| 对比项 | 新生成 | 现有 | 状态 |
|-------|------|-----|------|
| 整体结构 | 扁平数组 | 嵌套 blocks | **结构差异** |
| 字段数量 | 13个 | 嵌套结构 | 结构不同 |
| `correct_answer` | null | 不存在 | 值缺失 |
| `correct_index` | null | 不存在 | 值缺失 |

---

## 2. 中文编码检查

### 2.1 检测结果

| 文件 | 中文显示 | 状态 |
|-----|---------|------|
| temp/level1_quiz.json | ✅ 正常 | 通过 |
| temp/level2_dialog_quiz.json | ✅ 正常 | 通过 |
| temp/level3_adaptive_quiz.json | ✅ 正常 | 通过 |
| backend/data/level1_quiz/WEN_01.json | ✅ 正常 | 通过 |
| backend/data/pages_level2_dialog_quiz/WEN_01.json | ✅ 正常 | 通过 |

### 2.2 编码格式

所有JSON文件均为 UTF-8 编码，无BOM标记。

---

## 3. 问题汇总

### 3.1 字段值缺失问题

| 文件 | 缺失字段 | 期望值 |
|-----|---------|-------|
| temp/level1_quiz.json | `correct_index` | 2 |
| temp/level2_dialog_quiz.json | `correct_answer` | B (第1题), C (第2题) |
| temp/level2_dialog_quiz.json | `correct_index` | 1 (第1题), 2 (第2题) |
| temp/level2_dialog_quiz.json | `explanation` | 应有解释内容 |

### 3.2 结构不一致问题

| 问题 | 描述 | 影响 |
|-----|------|-----|
| level2_dialog_quiz 结构 | 新生成是扁平数组，现有是嵌套blocks | 后端可能无法正确解析 |
| 字段顺序 | 部分字段顺序不一致 | 不影响功能，但影响diff比较 |
| 多余null字段 | `audio_file`, `question_type` 等字段为null | 增加文件大小 |

### 3.3 数据一致性问题

| 问题 | 描述 |
|-----|------|
| 答案数据缺失 | Excel中可能未填写答案列 |
| 字段映射错误 | `correct_index` 未正确映射 |

---

## 4. 建议修复方案

### 4.1 短期修复

1. **补充缺失的答案数据**：
   - 在Excel中填写 `correct_answer` 和 `correct_index` 列
   - 第1题 (L3): correct_answer = "B", correct_index = 1
   - 第2题 (L2): correct_answer = "C", correct_index = 2

2. **清理null字段**：
   - 在数据处理器中过滤值为null的字段

### 4.2 长期优化

1. **统一数据结构**：
   - 定义标准化的JSON Schema
   - 确保Excel模板与JSON结构一致

2. **增强数据验证**：
   - 在数据处理流程中增加必填字段检查
   - 对缺失值提供默认值或警告

3. **文档更新**：
   - 更新数据字典文档
   - 记录字段变更历史

---

## 5. 验证结论

| 项目 | 状态 | 说明 |
|-----|------|-----|
| 中文编码 | ✅ 通过 | 所有文件UTF-8编码正确 |
| 数据完整性 | ⚠️ 警告 | 部分字段值缺失 |
| 结构一致性 | ⚠️ 警告 | level2_dialog_quiz结构不一致 |
| 字段类型 | ✅ 通过 | 数据类型正确 |

---

**报告结束**