#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
level2_dialog_quiz 工作表数据转换器

负责处理二级对话测验数据的转换逻辑
"""

import logging
from typing import Dict, List, Any

from utils.data_transformer import validate_required_fields, remove_empty_fields, group_by_column

logger = logging.getLogger(__name__)


def transform_level2_dialog_quiz(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    转换二级对话测验数据

    参数:
        raw_data: 原始数据列表

    返回:
        转换后的数据列表
    """
    # 对于 level2_dialog_quiz，直接返回清洗后的数据，分组时会重新组织
    result = []
    for row in raw_data:
        cleaned = remove_empty_fields(row)
        if cleaned:
            result.append(cleaned)
    logger.info(f"转换完成: {len(result)} 条二级对话测验数据")
    return result


def group_by_text_id(data: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    按text_id分组数据，并组织成blocks结构

    参数:
        data: 数据列表

    返回:
        按text_id分组的字典，包含pageId和blocks
    """
    groups = group_by_column(data, 'text_id')

    result = {}
    for text_id, items in groups.items():
        blocks = []
        for item in items:
            # 判断是dialogue还是quiz类型
            if item.get('question_number') is not None and item.get('question_text') is not None:
                # quiz类型 - 构建quiz数据
                block_data = {
                    'text_id': item.get('text_id'),
                    'question_id': f"{text_id}_B{item.get('question_number', '')}",
                    'module': 'B',
                    'question_number': item.get('question_number'),
                    'question_text': item.get('question_text'),
                    'option_a': item.get('option_a'),
                    'option_b': item.get('option_b'),
                    'option_c': item.get('option_c'),
                    'option_d': item.get('option_d'),
                    'correct_answer': item.get('correct_answer'),
                    'explanation': item.get('explanation'),
                    'difficulty': item.get('difficulty'),
                    'question_type': item.get('question_type', 'radio'),
                    'pre_dialog': item.get('pre_dialog'),
                    'audio_file': item.get('audio_file')
                }
                # 移除空值
                block_data = remove_empty_fields(block_data)
                blocks.append({
                    'type': 'quiz',
                    'data': block_data
                })
            else:
                # dialogue类型
                block_data = {
                    'text_id': item.get('text_id'),
                    'pre_dialog': item.get('pre_dialog'),
                    'audio_file': item.get('audio_file'),
                    'icon_dialog': item.get('icon_dialog')
                }
                block_data = remove_empty_fields(block_data)
                blocks.append({
                    'type': 'dialogue',
                    'data': block_data
                })

        result[text_id] = {
            'pageId': text_id,
            'blocks': blocks
        }
    return result
