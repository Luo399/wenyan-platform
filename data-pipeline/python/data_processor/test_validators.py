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
    is_absolute_path,
    validate_no_absolute_path,
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


class TestIsAbsolutePath(unittest.TestCase):
    """测试 is_absolute_path（P07：禁止 JSON 嵌入绝对路径）"""

    def test_relative_paths_are_safe(self):
        """相对路径与 OSS 相对地址应判定为安全"""
        self.assertFalse(is_absolute_path('audio/wen_01.mp3'))
        self.assertFalse(is_absolute_path('images/icon.png'))
        self.assertFalse(is_absolute_path('./local/file.json'))
        self.assertFalse(is_absolute_path('word_list/WEN_01.json'))

    def test_none_and_empty_are_safe(self):
        """None / 空值不应误报为绝对路径"""
        self.assertFalse(is_absolute_path(None))
        self.assertFalse(is_absolute_path(''))
        self.assertFalse(is_absolute_path('   '))

    def test_non_string_is_safe(self):
        """非字符串类型不应误报"""
        self.assertFalse(is_absolute_path(123))
        self.assertFalse(is_absolute_path(['a', 'b']))

    def test_windows_absolute_path(self):
        """Windows 盘符绝对路径应被识别"""
        self.assertTrue(is_absolute_path('C:\\Users\\dev\\audio.mp3'))
        self.assertTrue(is_absolute_path('D:/data/file.json'))
        self.assertTrue(is_absolute_path('c:/windows/path'))

    def test_unix_absolute_path(self):
        """Unix 绝对路径应被识别"""
        self.assertTrue(is_absolute_path('/home/user/audio.mp3'))
        self.assertTrue(is_absolute_path('/Users/dev/file.json'))
        self.assertTrue(is_absolute_path('/var/data/pipeline'))

    def test_http_url(self):
        """http(s) URL 应被识别"""
        self.assertTrue(is_absolute_path('https://example.com/audio.mp3'))
        self.assertTrue(is_absolute_path('http://localhost:3000/api'))


class TestValidateNoAbsolutePath(unittest.TestCase):
    """测试 validate_no_absolute_path（P07：数据管道输出时校验）"""

    def test_clean_data_passes(self):
        """所有字段均为相对路径时应通过"""
        data = {
            'text_id': 'WEN_01',
            'audio_file': 'audio/wen_01.mp3',
            'bgm': 'bgm/bg.mp3',
            'illustration': 'images/pic.png',
            '_row_index': 1,
        }
        errors = validate_no_absolute_path(
            data, ['audio_file', 'bgm', 'illustration']
        )
        self.assertEqual(len(errors), 0)

    def test_absolute_path_in_audio_file(self):
        """audio_file 含绝对路径应报错"""
        data = {
            'text_id': 'WEN_01',
            'audio_file': 'C:\\dev\\audio.mp3',
            '_row_index': 2,
        }
        errors = validate_no_absolute_path(data, ['audio_file'])
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].field, 'audio_file')
        self.assertEqual(errors[0].row_index, 2)

    def test_none_field_is_skipped(self):
        """字段值为 None 时应跳过（可选字段未填写）"""
        data = {
            'text_id': 'WEN_01',
            'audio_file': None,
            '_row_index': 1,
        }
        errors = validate_no_absolute_path(data, ['audio_file'])
        self.assertEqual(len(errors), 0)

    def test_multiple_violations(self):
        """多字段含绝对路径应全部报错"""
        data = {
            'text_id': 'WEN_01',
            'audio_file': '/home/u/a.mp3',
            'bgm': 'https://cdn.example.com/bgm.mp3',
            'illustration': 'D:/imgs/x.png',
            '_row_index': 3,
        }
        errors = validate_no_absolute_path(
            data, ['audio_file', 'bgm', 'illustration']
        )
        self.assertEqual(len(errors), 3)
        fields = {e.field for e in errors}
        self.assertEqual(fields, {'audio_file', 'bgm', 'illustration'})


if __name__ == '__main__':
    unittest.main()
