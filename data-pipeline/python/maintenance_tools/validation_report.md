# 数据结构验证报告

## 概述

- 验证文件总数: 28
- 通过验证: 26
- 验证失败: 2
- 通过率: 92.9%

## 详细结果

### level1_word_list
**文件**: E:\cpp_discipline\wenyan-platform\public\data\word_list\level1_word_list.json
**状态**: ✅ 通过

**警告**:
- 字段 'synonym_analysis' 值为空
- 字段 'follow_up_questions' 值为空

### WEN_01
**文件**: E:\cpp_discipline\wenyan-platform\public\data\word_list\WEN_01.json
**状态**: ✅ 通过

**警告**:
- 字段 'synonym_analysis' 值为空

### WEN_01_未转义
**文件**: E:\cpp_discipline\wenyan-platform\public\data\word_list\WEN_01_未转义.json
**状态**: ✅ 通过

**警告**:
- 字段 'synonym_analysis' 值为空

### WEN_02
**文件**: E:\cpp_discipline\wenyan-platform\public\data\word_list\WEN_02.json
**状态**: ✅ 通过

**警告**:
- 字段 'synonym_analysis' 值为空

### WEN_03
**文件**: E:\cpp_discipline\wenyan-platform\public\data\word_list\WEN_03.json
**状态**: ✅ 通过

**警告**:
- 字段 'synonym_analysis' 值为空

### WEN_04
**文件**: E:\cpp_discipline\wenyan-platform\public\data\word_list\WEN_04.json
**状态**: ✅ 通过

**警告**:
- 字段 'synonym_analysis' 值为空

### text_basic_info
**文件**: E:\cpp_discipline\wenyan-platform\public\data\text_basic_info\text_basic_info.json
**状态**: ✅ 通过

### WEN_01
**文件**: E:\cpp_discipline\wenyan-platform\public\data\text_basic_info\WEN_01.json
**状态**: ✅ 通过

### WEN_02
**文件**: E:\cpp_discipline\wenyan-platform\public\data\text_basic_info\WEN_02.json
**状态**: ✅ 通过

### WEN_03
**文件**: E:\cpp_discipline\wenyan-platform\public\data\text_basic_info\WEN_03.json
**状态**: ✅ 通过

### WEN_04
**文件**: E:\cpp_discipline\wenyan-platform\public\data\text_basic_info\WEN_04.json
**状态**: ✅ 通过

### level1_multi_role_reading
**文件**: E:\cpp_discipline\wenyan-platform\public\data\multi_role_reading\level1_multi_role_reading.json
**状态**: ✅ 通过

### WEN_01
**文件**: E:\cpp_discipline\wenyan-platform\public\data\multi_role_reading\WEN_01.json
**状态**: ✅ 通过

### WEN_02
**文件**: E:\cpp_discipline\wenyan-platform\public\data\multi_role_reading\WEN_02.json
**状态**: ✅ 通过

### WEN_03
**文件**: E:\cpp_discipline\wenyan-platform\public\data\multi_role_reading\WEN_03.json
**状态**: ✅ 通过

### WEN_04
**文件**: E:\cpp_discipline\wenyan-platform\public\data\multi_role_reading\WEN_04.json
**状态**: ✅ 通过

### level1_quiz
**文件**: E:\cpp_discipline\wenyan-platform\public\data\level1_quiz\level1_quiz.json
**状态**: ❌ 失败

**问题**:
- 缺少必需字段: correct_index

**警告**:
- 发现多余字段: audio_file
- 发现多余字段: question_type

### WEN_01
**文件**: E:\cpp_discipline\wenyan-platform\public\data\level1_quiz\WEN_01.json
**状态**: ✅ 通过

### WEN_02
**文件**: E:\cpp_discipline\wenyan-platform\public\data\level1_quiz\WEN_02.json
**状态**: ✅ 通过

### WEN_03
**文件**: E:\cpp_discipline\wenyan-platform\public\data\level1_quiz\WEN_03.json
**状态**: ✅ 通过

### WEN_04
**文件**: E:\cpp_discipline\wenyan-platform\public\data\level1_quiz\WEN_04.json
**状态**: ✅ 通过

### WEN_01
**文件**: E:\cpp_discipline\wenyan-platform\public\data\level2_quiz\WEN_01.json
**状态**: ❌ 失败

**问题**:
- 字段 'correct_answer' 类型不匹配
- 字段 'explanation' 类型不匹配
- 字段 'question_type' 类型不匹配

**警告**:
- 字段 'correct_answer' 值为空
- 字段 'explanation' 值为空
- 字段 'question_type' 值为空

### WEN_01
**文件**: E:\cpp_discipline\wenyan-platform\public\data\level3_quiz\WEN_01.json
**状态**: ✅ 通过

**警告**:
- 发现多余字段: audio_file

### answer_records
**文件**: E:\cpp_discipline\wenyan-platform\backend\data\answer_records.json
**状态**: ✅ 通过

**警告**:
- 发现多余字段: id
- 发现多余字段: wen_id
- 发现多余字段: student_id
- 发现多余字段: question_id
- 发现多余字段: user_answer
- 发现多余字段: correct_answer
- 发现多余字段: is_correct
- 发现多余字段: score
- 发现多余字段: submitted_at
- 发现多余字段: attempt_number

### students
**文件**: E:\cpp_discipline\wenyan-platform\backend\data\students.json
**状态**: ✅ 通过

**警告**:
- 发现多余字段: student_id
- 发现多余字段: name
- 发现多余字段: class
- 发现多余字段: created_at

### level1_quiz
**文件**: E:\cpp_discipline\wenyan-platform\data-pipeline\temp\level1_quiz.json
**状态**: ✅ 通过

**警告**:
- 发现多余字段: text_id
- 发现多余字段: question_number
- 发现多余字段: question_text
- 发现多余字段: option_a
- 发现多余字段: option_b
- 发现多余字段: option_c
- 发现多余字段: option_d
- 发现多余字段: audio_file
- 发现多余字段: difficulty
- 发现多余字段: correct_answer
- 发现多余字段: correct_index
- 发现多余字段: explanation
- 发现多余字段: question_type

### level2_dialog_quiz
**文件**: E:\cpp_discipline\wenyan-platform\data-pipeline\temp\level2_dialog_quiz.json
**状态**: ✅ 通过

**警告**:
- 发现多余字段: text_id
- 发现多余字段: question_number
- 发现多余字段: question_text
- 发现多余字段: option_a
- 发现多余字段: option_b
- 发现多余字段: option_c
- 发现多余字段: option_d
- 发现多余字段: audio_file
- 发现多余字段: difficulty
- 发现多余字段: correct_answer
- 发现多余字段: correct_index
- 发现多余字段: explanation
- 发现多余字段: question_type
- 发现多余字段: pre_dialog
- 发现多余字段: icon_dialog

### level3_adaptive_quiz
**文件**: E:\cpp_discipline\wenyan-platform\data-pipeline\temp\level3_adaptive_quiz.json
**状态**: ✅ 通过

**警告**:
- 发现多余字段: text_id
- 发现多余字段: question_number
- 发现多余字段: question_text
- 发现多余字段: option_a
- 发现多余字段: option_b
- 发现多余字段: option_c
- 发现多余字段: option_d
- 发现多余字段: audio_file
- 发现多余字段: difficulty
- 发现多余字段: correct_answer
- 发现多余字段: correct_index
- 发现多余字段: explanation
- 发现多余字段: question_type
- 发现多余字段: scenario_text
