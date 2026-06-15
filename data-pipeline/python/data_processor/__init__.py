#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理器包
提供Excel到JSON的数据处理功能
"""

from .config import (
    FieldMapping,
    SheetConfig,
    DataProcessorConfig,
    create_default_config,
    load_config_from_file,
    save_config_to_file,
    transform_question_number,
    transform_difficulty,
    transform_correct_index,
    transform_correct_answer,
    filter_wen01,
    filter_not_empty_question
)

from .excel_reader import ExcelReader, ExcelHeader, print_excel_info

from .processor import DataProcessor, run_processor

__all__ = [
    # config
    'FieldMapping',
    'SheetConfig',
    'DataProcessorConfig',
    'create_default_config',
    'load_config_from_file',
    'save_config_to_file',
    'transform_question_number',
    'transform_difficulty',
    'transform_correct_index',
    'transform_correct_answer',
    'filter_wen01',
    'filter_not_empty_question',
    # excel_reader
    'ExcelReader',
    'ExcelHeader',
    'print_excel_info',
    # processor
    'DataProcessor',
    'run_processor'
]

__version__ = '1.0.0'
__author__ = 'System Administrator'
__description__ = 'Excel to JSON data processor for wenyan-platform'