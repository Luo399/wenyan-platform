#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据校验模块
提供数据完整性校验功能
"""

import logging
from typing import Dict, List, Any, Callable

logger = logging.getLogger(__name__)


class ValidationError:
    """校验错误信息"""

    def __init__(self, row_index: int, field: str, message: str):
        self.row_index = row_index
        self.field = field
        self.message = message

    def to_dict(self) -> Dict[str, Any]:
        return {
            'row_index': self.row_index,
            'field': self.field,
            'message': self.message
        }


def validate_required_field(value: Any, field_name: str) -> bool:
    """校验必需字段非空"""
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def validate_text_id_format(value: Any) -> bool:
    """校验 text_id 格式（如 WEN_01）"""
    if not isinstance(value, str):
        return False
    import re
    return bool(re.match(r'^WEN_\d+$', value.strip()))


def validate_difficulty_level(value: Any) -> bool:
    """校验难度等级（easy/medium/hard 或 L1/L2/L3）"""
    if value is None:
        return True  # 可选字段
    valid_values = {'easy', 'medium', 'hard', 'L1', 'L2', 'L3'}
    return str(value).strip() in valid_values


def validate_correct_answer(value: Any) -> bool:
    """校验正确答案（A/B/C/D）"""
    if value is None:
        return True  # 可选字段
    return str(value).strip().upper() in {'A', 'B', 'C', 'D'}


def validate_options_count(options: List[str], expected_min: int = 2) -> bool:
    """校验选项数量"""
    if not isinstance(options, list):
        return False
    if len(options) < expected_min:
        return False
    return all(isinstance(opt, str) and opt.strip() for opt in options)


def validate_question_data(data: Dict[str, Any]) -> List[ValidationError]:
    """
    校验单道题目数据

    :param data: 题目数据
    :return: 错误列表（为空表示通过）
    """
    errors = []

    # 校验 text_id
    text_id = data.get('text_id')
    if not validate_required_field(text_id, 'text_id'):
        errors.append(ValidationError(
            row_index=data.get('_row_index', 0),
            field='text_id',
            message='text_id 不能为空'
        ))
    elif not validate_text_id_format(text_id):
        errors.append(ValidationError(
            row_index=data.get('_row_index', 0),
            field='text_id',
            message=f'text_id 格式错误: {text_id}（应为 WEN_XX 格式）'
        ))

    # 校验 question_text
    question_text = data.get('question_text') or data.get('question')
    if not validate_required_field(question_text, 'question_text'):
        errors.append(ValidationError(
            row_index=data.get('_row_index', 0),
            field='question_text',
            message='question_text 不能为空'
        ))

    # 校验正确答案
    correct_answer = data.get('correct_answer')
    if correct_answer is not None and not validate_correct_answer(correct_answer):
        errors.append(ValidationError(
            row_index=data.get('_row_index', 0),
            field='correct_answer',
            message=f'correct_answer 必须是 A/B/C/D 之一: {correct_answer}'
        ))

    return errors


def validate_word_data(data: Dict[str, Any]) -> List[ValidationError]:
    """
    校验单条字词数据

    :param data: 字词数据
    :return: 错误列表
    """
    errors = []

    for required_field in ['text_id', 'word', 'basic_meaning']:
        value = data.get(required_field)
        if not validate_required_field(value, required_field):
            errors.append(ValidationError(
                row_index=data.get('_row_index', 0),
                field=required_field,
                message=f'{required_field} 不能为空'
            ))

    return errors


def validate_batch(data_list: List[Dict[str, Any]], validator: Callable) -> List[ValidationError]:
    """
    批量校验数据

    :param data_list: 数据列表
    :param validator: 校验函数
    :return: 所有错误信息
    """
    all_errors = []
    for data in data_list:
        errors = validator(data)
        all_errors.extend(errors)
    return all_errors


def get_validation_summary(errors: List[ValidationError]) -> Dict[str, Any]:
    """
    生成校验结果摘要

    :param errors: 错误列表
    :return: 摘要信息
    """
    return {
        'total_errors': len(errors),
        'has_errors': len(errors) > 0,
        'error_fields': list(set(e.field for e in errors)),
        'error_rows': list(set(e.row_index for e in errors if e.row_index > 0))
    }


__all__ = [
    'ValidationError',
    'validate_required_field',
    'validate_text_id_format',
    'validate_difficulty_level',
    'validate_correct_answer',
    'validate_options_count',
    'validate_question_data',
    'validate_word_data',
    'validate_batch',
    'get_validation_summary',
]
