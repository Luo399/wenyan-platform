---
name: "add-quiz"
description: "根据Excel生成题目JSON，简化数据录入"
---
根据提供的Excel表格数据，为《陋室铭》(WEN_01) 生成题目JSON。
请执行以下步骤：
1.  读取用户提供的Excel文件或其内容。
2.  将题目数据严格转换为 `public/questions.json` 文件所需的JSON数组格式。
3.  确保生成的JSON中，每个题目对象的 `wenId` 字段被正确设置为 "WEN_01"。
4.  并确保每个选项对象的 `id` 为字母（'A', 'B', ...）。
5.  检查JSON格式的有效性。