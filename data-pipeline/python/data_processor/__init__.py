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

from .validators import (
    ValidationError,
    validate_required_field,
    validate_text_id_format,
    validate_difficulty_level,
    validate_correct_answer,
    validate_options_count,
    is_absolute_path,
    validate_no_absolute_path,
    validate_question_data,
    validate_word_data,
    validate_batch,
    get_validation_summary,
)

from .incremental import (
    compute_record_hash,
    compute_records_hashes,
    diff_records,
    PipelineState,
    IncrementalProcessor,
    DEFAULT_STATE_FILE,
    STATE_VERSION,
)

from .version import (
    VersionManager,
    DEFAULT_VERSION_DIR,
    DEFAULT_KEEP_VERSIONS,
    META_FILE_NAME,
    MANIFEST_FILE_NAME,
)

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
    'run_processor',
    # validators
    'ValidationError',
    'validate_required_field',
    'validate_text_id_format',
    'validate_difficulty_level',
    'validate_correct_answer',
    'validate_options_count',
    'is_absolute_path',
    'validate_no_absolute_path',
    'validate_question_data',
    'validate_word_data',
    'validate_batch',
    'get_validation_summary',
    # incremental
    'compute_record_hash',
    'compute_records_hashes',
    'diff_records',
    'PipelineState',
    'IncrementalProcessor',
    'DEFAULT_STATE_FILE',
    'STATE_VERSION',
    # version
    'VersionManager',
    'DEFAULT_VERSION_DIR',
    'DEFAULT_KEEP_VERSIONS',
    'META_FILE_NAME',
    'MANIFEST_FILE_NAME',
]

__version__ = '1.0.0'
__author__ = 'System Administrator'
__description__ = 'Excel to JSON data processor for wenyan-platform'