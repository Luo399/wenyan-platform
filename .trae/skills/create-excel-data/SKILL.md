---
name: create-excel-data
description: 当用户提供 Excel 内容时
---

---
name: excel-to-json-converter
description: 读取用户提供的 Excel 表格内容，并根据项目规范（例如，为 `WEN_01` 生成 `questions.json`）将其转换为 JSON 格式。当用户提到“Excel”、“表格”、“题目数据”、“转换JSON”等词时应被触发。
---

# Excel 转 JSON 转换器
此技能用于处理内容提供者（如老师）填写的 Excel 表格，并生成项目可用的 JSON 文件。

## 指令
1.  **确认数据**：要求用户提供完整的表格数据，或说明要生成哪篇课文的题目。
2.  **转换格式**：将表格数据转换为符合 `Question` 组件要求的 JSON 数组格式。
3.  **输出结果**：输出格式化的 JSON 代码块，并告知用户建议保存的文件名（如 `public/questions.json` 或 `public/data/WEN_01_segments.json`）。
4.  **解释路径**：解释如何将生成的 JSON 文件集成到项目中。