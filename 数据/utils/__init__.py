#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工具函数模块包

包含Excel读取、JSON输出、数据转换等通用工具函数
"""

from .excel_reader import (
    ExcelHeader,
    ExcelConfig,
    open_workbook,
    read_sheet_headers,
    read_sheet_data,
    read_sheet_full,
    get_english_sheets,
    print_sheet_info
)

from .json_writer import (
    save_json,
    save_json_by_group,
    save_json_items,
    format_json,
    validate_json
)

from .data_transformer import (
    convert_letter_to_index,
    group_by_column,
    validate_required_fields,
    remove_empty_fields,
    merge_dicts,
    ensure_list,
    safe_get
)

__all__ = [
    # excel_reader
    'ExcelHeader',
    'ExcelConfig',
    'open_workbook',
    'read_sheet_headers',
    'read_sheet_data',
    'read_sheet_full',
    'get_english_sheets',
    'print_sheet_info',
    
    # json_writer
    'save_json',
    'save_json_by_group',
    'save_json_items',
    'format_json',
    'validate_json',
    
    # data_transformer
    'convert_letter_to_index',
    'group_by_column',
    'validate_required_fields',
    'remove_empty_fields',
    'merge_dicts',
    'ensure_list',
    'safe_get'
]