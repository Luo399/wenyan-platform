#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validators 模块单元测试
"""

import unittest

import sys
import os

# 添加父目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_processor.validators import (
    ValidationError,
    validate_required_field,
    validate_text_id_format,
    validate_difficulty_level,
    validate_correct_answer,
    validate_options_count,
    validate_question_data,
    validate_word_data,
    validate_batch,
    get_validation_summary,
)


class TestValidateRequiredField(unittest.TestCase):
    """测试 validate_required_field"""

    def test_non_empty_string(self):
        self.assertTrue(validate_required_field('hello', 'field'))

    def test_empty_string(self):
        self.assertFalse(validate_required_field('', 'field'))

    def test_whitespace_string(self):
        self.assertFalse(validate_required_field('   ', 'field'))

    def test_none(self):
        self.assertFalse(validate_required_field(None, 'field'))

    def test_non_empty_number(self):
        self.assertTrue(validate_required_field(0, 'field'))
        self.assertTrue(validate_required_field(100, 'field'))


class TestValidateTextIdFormat(unittest.TestCase):
    """测试 validate_text_id_format"""

    def test_valid_format(self):
        self.assertTrue(validate_text_id_format('WEN_01'))
        self.assertTrue(validate_text_id_format('WEN_99'))
        self.assertTrue(validate_text_id_format('WEN_123'))

    def test_invalid_format(self):
        self.assertFalse(validate_text_id_format('wen_01'))
        self.assertFalse(validate_text_id_format('WEN_'))
        self.assertFalse(validate_text_id_format('01'))
        self.assertFalse(validate_text_id_format('WEN_XX'))

    def test_non_string(self):
        self.assertFalse(validate_text_id_format(1))
        self.assertFalse(validate_text_id_format(None))


class TestValidateDifficultyLevel(unittest.TestCase):
    """测试 validate_difficulty_level"""

    def test_valid_chinese_levels(self):
        self.assertTrue(validate_difficulty_level('easy'))
        self.assertTrue(validate_difficulty_level('medium'))
        self.assertTrue(validate_difficulty_level('hard'))

    def test_valid_l_levels(self):
        self.assertTrue(validate_difficulty_level('L1'))
        self.assertTrue(validate_difficulty_level('L2'))
        self.assertTrue(validate_difficulty_level('L3'))

    def test_none_allowed(self):
        self.assertTrue(validate_difficulty_level(None))

    def test_invalid_value(self):
        self.assertFalse(validate_difficulty_level('L4'))
        self.assertFalse(validate_difficulty_level('extreme'))


class TestValidateCorrectAnswer(unittest.TestCase):
    """测试 validate_correct_answer"""

    def test_valid_answers(self):
        self.assertTrue(validate_correct_answer('A'))
        self.assertTrue(validate_correct_answer('B'))
        self.assertTrue(validate_correct_answer('C'))
        self.assertTrue(validate_correct_answer('D'))
        self.assertTrue(validate_correct_answer('a'))  # 大小写不敏感

    def test_none_allowed(self):
        self.assertTrue(validate_correct_answer(None))

    def test_invalid_answers(self):
        self.assertFalse(validate_correct_answer('E'))
        self.assertFalse(validate_correct_answer('AB'))


class TestValidateOptionsCount(unittest.TestCase):
    """测试 validate_options_count"""

    def test_valid_options(self):
        self.assertTrue(validate_options_count(['A', 'B', 'C', 'D']))
        self.assertTrue(validate_options_count(['1', '2']))

    def test_too_few_options(self):
        self.assertFalse(validate_options_count(['A']))
        self.assertFalse(validate_options_count([]))

    def test_empty_string_options(self):
        self.assertFalse(validate_options_count(['A', '', 'C']))

    def test_non_list(self):
        self.assertFalse(validate_options_count('ABCD'))


class TestValidateQuestionData(unittest.TestCase):
    """测试 validate_question_data"""

    def test_valid_question(self):
        data = {
            'text_id': 'WEN_01',
            'question_text': '问题内容',
            'correct_answer': 'A',
            '_row_index': 1
        }
        errors = validate_question_data(data)
        self.assertEqual(len(errors), 0)

    def test_missing_text_id(self):
        data = {
            'question_text': '问题',
            'correct_answer': 'A',
            '_row_index': 1
        }
        errors = validate_question_data(data)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].field, 'text_id')

    def test_invalid_text_id(self):
        data = {
            'text_id': 'invalid',
            'question_text': '问题',
            'correct_answer': 'A',
            '_row_index': 1
        }
        errors = validate_question_data(data)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].field, 'text_id')

    def test_invalid_correct_answer(self):
        data = {
            'text_id': 'WEN_01',
            'question_text': '问题',
            'correct_answer': 'X',
            '_row_index': 1
        }
        errors = validate_question_data(data)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].field, 'correct_answer')


class TestValidateWordData(unittest.TestCase):
    """测试 validate_word_data"""

    def test_valid_word(self):
        data = {
            'text_id': 'WEN_01',
            'word': '学',
            'basic_meaning': '学习',
            '_row_index': 1
        }
        errors = validate_word_data(data)
        self.assertEqual(len(errors), 0)

    def test_missing_required(self):
        data = {
            'text_id': 'WEN_01',
            'word': '学',
            '_row_index': 1
        }
        errors = validate_word_data(data)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].field, 'basic_meaning')


class TestValidateBatch(unittest.TestCase):
    """测试 validate_batch"""

    def test_batch_validation(self):
        data_list = [
            {'text_id': 'WEN_01', 'question_text': 'Q1', 'correct_answer': 'A', '_row_index': 1},
            {'text_id': 'WEN_02', 'question_text': 'Q2', 'correct_answer': 'B', '_row_index': 2},
            {'text_id': 'invalid', 'question_text': 'Q3', 'correct_answer': 'C', '_row_index': 3},
        ]
        errors = validate_batch(data_list, validate_question_data)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].row_index, 3)


class TestGetValidationSummary(unittest.TestCase):
    """测试 get_validation_summary"""

    def test_empty_errors(self):
        summary = get_validation_summary([])
        self.assertEqual(summary['total_errors'], 0)
        self.assertFalse(summary['has_errors'])
        self.assertEqual(summary['error_fields'], [])

    def test_with_errors(self):
        errors = [
            ValidationError(1, 'text_id', 'msg1'),
            ValidationError(2, 'text_id', 'msg2'),
            ValidationError(3, 'question_text', 'msg3'),
        ]
        summary = get_validation_summary(errors)
        self.assertEqual(summary['total_errors'], 3)
        self.assertTrue(summary['has_errors'])
        self.assertIn('text_id', summary['error_fields'])
        self.assertIn('question_text', summary['error_fields'])
        self.assertIn(1, summary['error_rows'])
        self.assertIn(3, summary['error_rows'])


class TestValidationError(unittest.TestCase):
    """测试 ValidationError"""

    def test_to_dict(self):
        error = ValidationError(5, 'field_name', 'error message')
        result = error.to_dict()
        self.assertEqual(result['row_index'], 5)
        self.assertEqual(result['field'], 'field_name')
        self.assertEqual(result['message'], 'error message')


if __name__ == '__main__':
    unittest.main()
