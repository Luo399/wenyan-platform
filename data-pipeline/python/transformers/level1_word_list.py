#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
level1_word_list 工作表数据转换器

负责处理字词注释数据的转换逻辑
"""

import logging
from typing import Dict, List, Any

from utils.data_transformer import validate_required_fields, remove_empty_fields, group_by_column

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ['text_id', 'word', 'basic_meaning']

def transform_level1_word_list(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    转换字词注释数据
    
    参数:
        raw_data: 原始数据列表
    
    返回:
        转换后的数据列表
    
    数据结构:
        {
            "text_id": "WEN_01",          // 课文ID
            "word": "阳城",               // 字词内容
            "basic_meaning": "在今河南登封东南",  // 基本释义
            "synonym_analysis": "...",    // 近义辨析
            "follow_up_questions": [...]  // 追问问题列表
        }
    """
    result = []
    
    for row in raw_data:
        # 验证必需字段
        is_valid, missing = validate_required_fields(row, REQUIRED_FIELDS)
        if not is_valid:
            logger.warning(f"跳过无效行，缺失字段: {missing}")
            continue
        
        # 处理追问问题（可能是逗号分隔的字符串或列表）
        questions = row.get('follow_up_questions')
        if isinstance(questions, str):
            questions = [q.strip() for q in questions.split('，') if q.strip()]
        elif questions is None:
            questions = []
        
        transformed = {
            'text_id': row.get('text_id'),
            'word': row.get('word'),
            'basic_meaning': row.get('basic_meaning'),
            'synonym_analysis': row.get('synonym_analysis'),
            'follow_up_questions': questions,
            'pinyin': row.get('pinyin'),
            'part_of_speech': row.get('part_of_speech'),
            'frequency': row.get('frequency'),
            'examples': row.get('examples'),
            'notes': row.get('notes')
        }
        
        # 移除空值字段
        cleaned = remove_empty_fields(transformed)
        result.append(cleaned)
    
    logger.info(f"转换完成: {len(result)} 条字词注释")
    return result

def group_by_text_id(data: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    按text_id分组数据
    
    参数:
        data: 数据列表
    
    返回:
        按text_id分组的字典，key为text_id，value为字词列表
    """
    return group_by_column(data, 'text_id')