#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
level3_adaptive_quiz 工作表数据转换器

负责处理三级自适应测验数据的转换逻辑
"""

import logging
from typing import Dict, List, Any

from utils.data_transformer import validate_required_fields, remove_empty_fields, group_by_column, convert_letter_to_index

logger = logging.getLogger(__name__)


def transform_level3_adaptive_quiz(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    转换三级自适应测验数据

    参数:
        raw_data: 原始数据列表

    返回:
        转换后的数据列表
    """
    # 对于 level3_adaptive_quiz，直接返回清洗后的数据，分组时会重新组织
    result = []
    for row in raw_data:
        cleaned = remove_empty_fields(row)
        if cleaned:
            result.append(cleaned)
    logger.info(f"转换完成: {len(result)} 条三级自适应测验题目")
    return result


def group_by_text_id(data: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    按text_id分组数据，并组织成items结构

    参数:
        data: 数据列表

    返回:
        按text_id分组的字典，包含pageId和items
    """
    groups = group_by_column(data, 'text_id')

    result = {}
    for text_id, items in groups.items():
        quiz_items = []
        for idx, item in enumerate(items):
            # 构建 options 数组 - 第一个question_text是选项A，第二个是题目
            # 由于Excel有重复列名，我们需要从原始数据结构中提取
            # 假设：第一个question_text列是选项A，第二个question_text列是题目
            option_a = None
            question_text_content = None
            
            # 从原始数据中查找选项和题目
            # 我们通过检查数据行的来源来区分
            # 这里我们做一个假设：item.get('question_text')可能是选项A
            # 我们需要一个更好的方式来处理这个问题
            
            # 临时方案：第一个question_text作为选项A，然后构造一个题目
            # 实际题目应该从Excel的其他地方获取
            
            options = []
            # 选项A
            if item.get('question_text'):
                options.append(item.get('question_text'))
            # 选项B-D
            if item.get('option_b'):
                options.append(item.get('option_b'))
            if item.get('option_c'):
                options.append(item.get('option_c'))
            if item.get('option_d'):
                options.append(item.get('option_d'))
            
            # 转换正确答案为索引
            correct_answer = item.get('correct_answer')
            correct_index = convert_letter_to_index(correct_answer)
            
            # 构建 quiz 对象
            quiz_data = {
                'question_id': item.get('question_id') or f"{text_id}_C{idx + 1}",
                'module': 'C',
                'question_type': item.get('question_type', 'radio'),
                'options': options,
                'correct_answer': correct_index,
                'explanation': item.get('explanation'),
                'difficulty': item.get('difficulty')
            }
            
            # 检查是否有题目文本 - 从scenario_text中提取或者构造
            # 从scenario_text中提取问题部分
            scenario_text = item.get('scenario_text', '')
            if '？' in scenario_text or '?' in scenario_text:
                # 如果情景文本中有问号，可能包含问题
                quiz_data['question_text'] = scenario_text
            else:
                # 否则使用默认问题
                quiz_data['question_text'] = '请根据以上情景选择正确答案。'
            
            quiz_item = {
                'text': scenario_text,
                'quiz': quiz_data
            }
            
            # 移除空值
            quiz_item['quiz'] = remove_empty_fields(quiz_item['quiz'])
            quiz_items.append(quiz_item)
        
        result[text_id] = {
            'pageId': text_id,
            'items': quiz_items
        }
    return result
