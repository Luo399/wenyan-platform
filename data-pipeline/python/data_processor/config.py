#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理配置模块
定义Excel到JSON的数据映射规则和处理配置
"""

import os
import json
from typing import Dict, List, Any, Optional, Callable


class FieldMapping:
    """字段映射配置"""
    def __init__(
        self,
        source_column: str,
        target_field: str,
        transform_func: Optional[Callable] = None,
        default_value: Any = None,
        required: bool = False,
        validators: Optional[List[Callable]] = None
    ):
        self.source_column = source_column
        self.target_field = target_field
        self.transform_func = transform_func
        self.default_value = default_value
        self.required = required
        self.validators = validators or []


class SheetConfig:
    """工作表处理配置"""
    def __init__(
        self,
        sheet_name: str,
        output_file: str,
        field_mappings: List[FieldMapping],
        header_row: int = 1,
        property_row: int = 2,
        data_start_row: int = 3,
        filter_func: Optional[Callable] = None,
        post_process_func: Optional[Callable] = None,
        group_by_column: Optional[str] = None
    ):
        self.sheet_name = sheet_name
        self.output_file = output_file
        self.field_mappings = field_mappings
        self.header_row = header_row
        self.property_row = property_row
        self.data_start_row = data_start_row
        self.filter_func = filter_func
        self.post_process_func = post_process_func
        self.group_by_column = group_by_column


class DataProcessorConfig:
    """数据处理器全局配置"""
    def __init__(
        self,
        input_file: str,
        output_dir: str,
        sheet_configs: List[SheetConfig],
        encoding: str = 'utf-8',
        json_indent: int = 2,
        log_level: str = 'INFO'
    ):
        self.input_file = input_file
        self.output_dir = output_dir
        self.sheet_configs = sheet_configs
        self.encoding = encoding
        self.json_indent = json_indent
        self.log_level = log_level


# ============================================================
# 默认配置定义 - 文言文平台题目数据处理规则
# ============================================================

def transform_question_number(value: Any) -> Optional[int]:
    """转换题目编号为整数"""
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None


def transform_difficulty(value: Any) -> Optional[str]:
    """转换难度等级"""
    if value is None:
        return None
    val = str(value).strip().upper()
    if val in ['L1', 'L2', 'L3']:
        return val
    return None


def transform_correct_index(value: Any) -> Optional[int]:
    """转换正确答案索引"""
    if value is None:
        return None
    val = str(value).strip().upper()
    if val == 'A':
        return 0
    elif val == 'B':
        return 1
    elif val == 'C':
        return 2
    elif val == 'D':
        return 3
    return None


def transform_correct_answer(value: Any) -> Optional[str]:
    """转换正确答案选项"""
    if value is None:
        return None
    val = str(value).strip().upper()
    if val in ['A', 'B', 'C', 'D']:
        return val
    return None


def post_process_quiz(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    题目数据后处理函数
    1. 根据 correct_answer 自动计算 correct_index
    2. 过滤值为 None 的字段
    3. 确保字段顺序与后端一致
    """
    # 如果没有 correct_index 但有 correct_answer，自动计算
    if data.get('correct_index') is None and data.get('correct_answer'):
        answer_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
        data['correct_index'] = answer_map.get(data['correct_answer'])
    
    # 过滤 None 值字段
    filtered_data = {k: v for k, v in data.items() if v is not None}
    
    # 确保字段顺序与后端一致（level1_quiz 顺序）
    desired_order = [
        'text_id', 'question_number', 'question_text', 'option_a', 
        'option_b', 'option_c', 'option_d', 'correct_answer', 
        'correct_index', 'explanation', 'difficulty'
    ]
    
    # 按期望顺序重新排列字段
    result = {}
    for key in desired_order:
        if key in filtered_data:
            result[key] = filtered_data[key]
    # 添加剩余字段
    for key in filtered_data:
        if key not in result:
            result[key] = filtered_data[key]
    
    return result


def post_process_level2_quiz(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Level2 对话题目后处理函数
    1. 根据 correct_answer 自动计算 correct_index
    2. 过滤值为 None 的字段
    """
    # 如果没有 correct_index 但有 correct_answer，自动计算
    if data.get('correct_index') is None and data.get('correct_answer'):
        answer_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
        data['correct_index'] = answer_map.get(data['correct_answer'])
    
    # 过滤 None 值字段
    filtered_data = {k: v for k, v in data.items() if v is not None}
    
    # level2 特定的字段顺序
    desired_order = [
        'text_id', 'question_number', 'question_text', 'option_a', 
        'option_b', 'option_c', 'option_d', 'audio_file', 
        'difficulty', 'correct_answer', 'correct_index',
        'explanation', 'question_type', 'pre_dialog', 'icon_dialog'
    ]
    
    result = {}
    for key in desired_order:
        if key in filtered_data:
            result[key] = filtered_data[key]
    for key in filtered_data:
        if key not in result:
            result[key] = filtered_data[key]
    
    return result


def filter_wen01(data: Dict) -> bool:
    """只处理WEN_01的数据"""
    text_id = data.get('text_id')
    return str(text_id).strip() == 'WEN_01' if text_id else False


def filter_not_empty_question(data: Dict) -> bool:
    """过滤题目文本为空的行"""
    question_text = data.get('question_text')
    return bool(question_text and str(question_text).strip())


def transform_follow_up_questions(value: Any) -> Optional[List[str]]:
    """转换追问问题列表为数组"""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        parts = [p.strip() for p in value.replace('\n', ';').replace('；', ';').split(';') if p.strip()]
        return parts if parts else []
    return []


def post_process_multi_role_reading(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    多角色朗读数据后处理函数
    将扁平行数据转换为嵌套结构: {text_id, audio_file, segments: [...]}
    """
    if not rows:
        return {}
    
    text_id = rows[0].get('text_id', '')
    
    # 顶层 audio_file: 从第一行获取，或使用默认命名
    audio_file = None
    for row in rows:
        if row.get('audio_file') and row.get('audio_file') != text_id + '_multi_role.mp3':
            # 检查是否是整段音频文件名（不是分段的）
            val = str(row.get('audio_file', ''))
            if 'multi_role' in val or val.endswith('.mp3') and not val.startswith('seg'):
                audio_file = val
                break
    
    if not audio_file:
        audio_file = f'{text_id}_multi_role.mp3'
    
    segments = []
    for row in rows:
        segment = {
            'sentence_index': row.get('sentence_index', 0),
            'time_range': row.get('time_range', ''),
            'role_name': row.get('role_name', ''),
            'dialogue': row.get('dialogue', ''),
        }
        # 只有当行级 audio_file 与顶层不同时，才保留在 segment 中（分段音频情况）
        row_audio = row.get('audio_file')
        if row_audio and row_audio != audio_file and row_audio != f'{text_id}_multi_role.mp3':
            segment['audio_file'] = row_audio
        segments.append(segment)
    
    segments.sort(key=lambda s: s['sentence_index'])
    
    return {
        'text_id': text_id,
        'audio_file': audio_file,
        'segments': segments
    }


def post_process_text_basic_info(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    课文基础信息后处理函数
    取第一行数据作为对象返回
    """
    if not rows:
        return {}
    return rows[0]


# level1_quiz 字段映射
LEVEL1_QUIZ_MAPPINGS = [
    FieldMapping('text_id', 'text_id', required=True),
    FieldMapping('question_number', 'question_number', transform_question_number),
    FieldMapping('question_text', 'question_text', required=True),
    FieldMapping('option_a', 'option_a'),
    FieldMapping('option_b', 'option_b'),
    FieldMapping('option_c', 'option_c'),
    FieldMapping('option_d', 'option_d'),
    FieldMapping('audio_file', 'audio_file'),
    FieldMapping('difficulty', 'difficulty', transform_difficulty),
    FieldMapping('correct_answer', 'correct_answer', transform_correct_answer),
    FieldMapping('correct_index', 'correct_index', transform_correct_index),
    FieldMapping('explanation', 'explanation'),
    FieldMapping('question_type', 'question_type')
]


# level2_dialog_quiz 字段映射
LEVEL2_DIALOG_QUIZ_MAPPINGS = [
    FieldMapping('text_id', 'text_id', required=True),
    FieldMapping('question_number', 'question_number', transform_question_number),
    FieldMapping('question_text', 'question_text', required=True),
    FieldMapping('option_a', 'option_a'),
    FieldMapping('option_b', 'option_b'),
    FieldMapping('option_c', 'option_c'),
    FieldMapping('option_d', 'option_d'),
    FieldMapping('audio_file', 'audio_file'),
    FieldMapping('difficulty', 'difficulty', transform_difficulty),
    FieldMapping('correct_answer', 'correct_answer', transform_correct_answer),
    FieldMapping('correct_index', 'correct_index', transform_correct_index),
    FieldMapping('explanation', 'explanation'),
    FieldMapping('question_type', 'question_type'),
    FieldMapping('pre_dialog', 'pre_dialog'),
    FieldMapping('icon_dialog', 'icon_dialog')
]


# level3_adaptive_quiz 字段映射
LEVEL3_ADAPTIVE_QUIZ_MAPPINGS = [
    FieldMapping('text_id', 'text_id', required=True),
    FieldMapping('question_number', 'question_number', transform_question_number),
    FieldMapping('question_text', 'question_text', required=True),
    FieldMapping('option_a', 'option_a'),
    FieldMapping('option_b', 'option_b'),
    FieldMapping('option_c', 'option_c'),
    FieldMapping('option_d', 'option_d'),
    FieldMapping('audio_file', 'audio_file'),
    FieldMapping('difficulty', 'difficulty', transform_difficulty),
    FieldMapping('correct_answer', 'correct_answer', transform_correct_answer),
    FieldMapping('correct_index', 'correct_index', transform_correct_index),
    FieldMapping('explanation', 'explanation'),
    FieldMapping('question_type', 'question_type'),
    FieldMapping('scenario_text', 'scenario_text')
]


def create_default_config(input_file: str, output_dir: str) -> DataProcessorConfig:
    """创建默认配置"""
    sheet_configs = [
        # text_basic_info - 课文基础信息（按text_id分文件，单对象结构）
        SheetConfig(
            sheet_name='text_basic_info',
            output_file='text_basic_info',
            field_mappings=[
                FieldMapping('text_id', 'text_id', required=True),
                FieldMapping('title', 'title', required=True),
                FieldMapping('author', 'author'),
                FieldMapping('dynasty', 'dynasty'),
                FieldMapping('original_text', 'original_text', required=True),
                FieldMapping('illustration', 'illustration'),
                FieldMapping('bgm', 'bgm')
            ],
            group_by_column='text_id',
            post_process_func=post_process_text_basic_info
        ),
        # level1_word_list - 字词注释（按text_id分文件，数组结构）
        SheetConfig(
            sheet_name='level1_word_list',
            output_file='word_list',
            field_mappings=[
                FieldMapping('text_id', 'text_id', required=True),
                FieldMapping('word', 'word', required=True),
                FieldMapping('basic_meaning', 'basic_meaning', required=True),
                FieldMapping('synonym_analysis', 'synonym_analysis', default_value=''),
                FieldMapping('follow_up_questions', 'follow_up_questions', transform_follow_up_questions, default_value=[])
            ],
            group_by_column='text_id'
        ),
        # level1_multi_role_reading - 多角色朗读（按text_id分文件，嵌套结构）
        SheetConfig(
            sheet_name='level1_multi_role_reading',
            output_file='multi_role_reading',
            field_mappings=[
                FieldMapping('text_id', 'text_id', required=True),
                FieldMapping('sentence_index', 'sentence_index', transform_question_number),
                FieldMapping('time_range', 'time_range'),
                FieldMapping('role_name', 'role_name'),
                FieldMapping('dialogue', 'dialogue'),
                FieldMapping('audio_file', 'audio_file')
            ],
            group_by_column='text_id',
            post_process_func=post_process_multi_role_reading
        ),
        # level1_quiz - 一级测验（按text_id分文件，数组结构）
        SheetConfig(
            sheet_name='level1_quiz',
            output_file='level1_quiz',
            field_mappings=LEVEL1_QUIZ_MAPPINGS,
            filter_func=filter_not_empty_question,
            group_by_column='text_id',
            post_process_func=lambda rows: [post_process_quiz(r) for r in rows]
        ),
        # level2_dialog_quiz - 二级对话测验（按text_id分文件，数组结构）
        SheetConfig(
            sheet_name='level2_dialog_quiz',
            output_file='level2_dialog_quiz',
            field_mappings=LEVEL2_DIALOG_QUIZ_MAPPINGS,
            filter_func=filter_not_empty_question,
            group_by_column='text_id',
            post_process_func=lambda rows: [post_process_level2_quiz(r) for r in rows]
        ),
        # level3_adaptive_quiz - 三级自适应测验（按text_id分文件，数组结构）
        SheetConfig(
            sheet_name='level3_adaptive_quiz',
            output_file='level3_adaptive_quiz',
            field_mappings=LEVEL3_ADAPTIVE_QUIZ_MAPPINGS,
            filter_func=filter_not_empty_question,
            group_by_column='text_id',
            post_process_func=lambda rows: [post_process_quiz(r) for r in rows]
        ),
        # culture_cards - 文化卡片（按text_id分文件，数组结构）
        SheetConfig(
            sheet_name='culture_cards',
            output_file='culture_cards',
            field_mappings=[
                FieldMapping('text_id', 'text_id', required=True),
                FieldMapping('card_id', 'card_id'),
                FieldMapping('card_name', 'card_name'),
                FieldMapping('image_file', 'image_file'),
                FieldMapping('knowledge_text', 'knowledge_text')
            ],
            group_by_column='text_id'
        )
    ]
    
    return DataProcessorConfig(
        input_file=input_file,
        output_dir=output_dir,
        sheet_configs=sheet_configs
    )


def load_config_from_file(config_path: str) -> DataProcessorConfig:
    """从JSON文件加载配置"""
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"配置文件不存在: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config_data = json.load(f)
    
    sheet_configs = []
    for sheet_data in config_data.get('sheet_configs', []):
        field_mappings = []
        for mapping_data in sheet_data.get('field_mappings', []):
            field_mappings.append(FieldMapping(
                source_column=mapping_data['source_column'],
                target_field=mapping_data['target_field'],
                required=mapping_data.get('required', False),
                default_value=mapping_data.get('default_value')
            ))
        
        sheet_configs.append(SheetConfig(
            sheet_name=sheet_data['sheet_name'],
            output_file=sheet_data['output_file'],
            field_mappings=field_mappings,
            header_row=sheet_data.get('header_row', 1),
            property_row=sheet_data.get('property_row', 2),
            data_start_row=sheet_data.get('data_start_row', 3)
        ))
    
    return DataProcessorConfig(
        input_file=config_data['input_file'],
        output_dir=config_data['output_dir'],
        sheet_configs=sheet_configs,
        encoding=config_data.get('encoding', 'utf-8'),
        json_indent=config_data.get('json_indent', 2),
        log_level=config_data.get('log_level', 'INFO')
    )


def save_config_to_file(config: DataProcessorConfig, config_path: str):
    """保存配置到JSON文件"""
    config_data = {
        'input_file': config.input_file,
        'output_dir': config.output_dir,
        'encoding': config.encoding,
        'json_indent': config.json_indent,
        'log_level': config.log_level,
        'sheet_configs': []
    }
    
    for sheet_config in config.sheet_configs:
        mapping_data = []
        for mapping in sheet_config.field_mappings:
            mapping_data.append({
                'source_column': mapping.source_column,
                'target_field': mapping.target_field,
                'required': mapping.required,
                'default_value': mapping.default_value
            })
        
        config_data['sheet_configs'].append({
            'sheet_name': sheet_config.sheet_name,
            'output_file': sheet_config.output_file,
            'field_mappings': mapping_data,
            'header_row': sheet_config.header_row,
            'property_row': sheet_config.property_row,
            'data_start_row': sheet_config.data_start_row
        })
    
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, ensure_ascii=False, indent=2)