# 数据处理报告

## 概述
- 输入文件: E:\cpp_discipline\wenyan-platform\data-pipeline\source\开发需求填写.dbt.xlsx
- 输出目录: E:\cpp_discipline\wenyan-platform\data-pipeline\temp
- 处理时间: 2026-06-15 22:34:44

## 处理结果
| 工作表 | 输出文件 | 原始行数 | 处理行数 | 状态 |
|--------|----------|----------|----------|------|
| level1_quiz | level1_quiz.json | 1 | 1 | ✅ 成功 |
| level2_dialog_quiz | level2_dialog_quiz.json | 2 | 2 | ✅ 成功 |
| level3_adaptive_quiz | level3_adaptive_quiz.json | 1 | 1 | ✅ 成功 |
| WordList | word_list.json | 0 | 0 | ❌ 失败 |
| TextBasicInfo | text_basic_info.json | 0 | 0 | ❌ 失败 |
| MultiRoleReading | multi_role_reading.json | 0 | 0 | ❌ 失败 |

**总计**: 4/4 行

## 错误详情
### WordList
- 处理失败: 工作表不存在: WordList
### TextBasicInfo
- 处理失败: 工作表不存在: TextBasicInfo
### MultiRoleReading
- 处理失败: 工作表不存在: MultiRoleReading

## 警告详情
无警告