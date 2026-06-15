#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
level1_multi_role_reading 工作表数据转换器

负责处理多角色朗读数据的转换逻辑
"""

import logging
from typing import Dict, List, Any

from utils.data_transformer import validate_required_fields, remove_empty_fields, group_by_column

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ['text_id', 'sentence_index', 'time_range', 'role_name', 'dialogue']

def transform_level1_multi_role_reading(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    转换多角色朗读数据
    
    参数:
        raw_data: 原始数据列表
    
    返回:
        转换后的数据列表
    
    数据结构:
        {
            "text_id": "WEN_01",              // 课文ID
            "audio_file": "WEN_01_multi_role.mp3",  // 音频文件名
            "sentence_index": 1,              // 段落序号
            "time_range": "00:00-00:16",      // 时间范围
            "role_name": "旁白📖",             // 角色名称
            "dialogue": "陈胜者，阳城人也。"   // 朗读文本
        }
    """
    result = []
    
    for row in raw_data:
        # 验证必需字段
        is_valid, missing = validate_required_fields(row, REQUIRED_FIELDS)
        if not is_valid:
            logger.warning(f"跳过无效行，缺失字段: {missing}")
            continue
        
        # 生成音频文件名
        text_id = row.get('text_id')
        audio_file = f"{text_id}_multi_role.mp3" if text_id else None
        
        transformed = {
            'text_id': text_id,
            'audio_file': audio_file,
            'sentence_index': row.get('sentence_index'),
            'time_range': row.get('time_range'),
            'role_name': row.get('role_name'),
            'dialogue': row.get('dialogue'),
            'emotion': row.get('emotion'),
            'speed': row.get('speed'),
            'notes': row.get('notes')
        }
        
        # 移除空值字段
        cleaned = remove_empty_fields(transformed)
        result.append(cleaned)
    
    logger.info(f"转换完成: {len(result)} 条多角色朗读数据")
    return result

def group_by_text_id(data: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    按text_id分组数据，并组织成结构化格式
    
    参数:
        data: 数据列表
    
    返回:
        按text_id分组的字典，包含audio_file和segments列表
    """
    groups = group_by_column(data, 'text_id')
    
    result = {}
    for text_id, items in groups.items():
        # 从第一个item获取音频文件名
        audio_file = items[0].get('audio_file') if items else None
        
        # 构建segments列表（移除text_id和audio_file字段）
        segments = []
        for item in items:
            segment = {k: v for k, v in item.items() if k not in ['text_id', 'audio_file']}
            segments.append(segment)
        
        result[text_id] = {
            'text_id': text_id,
            'audio_file': audio_file,
            'segments': segments
        }
    
    return result