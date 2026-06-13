#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
level1_quiz 工作表数据转换器

负责处理一级测验数据的转换逻辑
"""

import logging
from typing import Dict, List, Any

from utils.data_transformer import validate_required_fields, remove_empty_fields, group_by_column, convert_letter_to_index

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ['text_id', 'question_text', 'option_a', 'option_b']

def transform_level1_quiz(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    转换一级测验数据
    
    参数:
        raw_data: 原始数据列表
    
    返回:
        转换后的数据列表
    
    数据结构:
        {
            "text_id": "WEN_01",              // 课文ID
            "question_number": 1,             // 第几道题
            "question_text": "下列哪个选项是正确的？",  // 题目内容
            "option_a": "选项A",              // 选项A
            "option_b": "选项B",              // 选项B
            "option_c": "选项C",              // 选项C（可选）
            "option_d": "选项D",              // 选项D（可选）
            "correct_answer": "A",            // 正确答案
            "correct_index": 0,               // 正确答案索引（0-3）
            "explanation": "答案解析",         // 答案解析
            "difficulty": "L2",               // 难度等级
            "question_type": null,
            "audio_file": null
        }
    """
    result = []
    
    for row in raw_data:
        # 验证必需字段
        is_valid, missing = validate_required_fields(row, REQUIRED_FIELDS)
        if not is_valid:
            logger.warning(f"跳过无效行，缺失字段: {missing}")
            continue
        
        # 获取正确答案并转换为索引
        correct_answer = row.get('correct_answer')
        correct_index = convert_letter_to_index(correct_answer)
        
        transformed = {
            'text_id': row.get('text_id'),
            'question_number': row.get('question_number'),
            'question_text': row.get('question_text'),
            'option_a': row.get('option_a'),
            'option_b': row.get('option_b'),
            'option_c': row.get('option_c'),
            'option_d': row.get('option_d'),
            'correct_answer': correct_answer,
            'correct_index': correct_index,
            'explanation': row.get('explanation'),
            'difficulty': row.get('difficulty'),
            'question_type': row.get('question_type'),
            'audio_file': row.get('audio_file')
        }
        
        # 移除空值字段
        cleaned = remove_empty_fields(transformed)
        result.append(cleaned)
    
    logger.info(f"转换完成: {len(result)} 条一级测验题目")
    return result

def group_by_text_id(data: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    按text_id分组数据
    
    参数:
        data: 数据列表
    
    返回:
        按text_id分组的字典，key为text_id，value为题列表
    """
    return group_by_column(data, 'text_id')