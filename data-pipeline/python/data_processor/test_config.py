#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理器配置模块单元测试
"""

import unittest
from config import (
    transform_question_number,
    transform_difficulty,
    transform_correct_index,
    transform_correct_answer,
    post_process_quiz,
    post_process_level2_quiz
)


class TestTransformFunctions(unittest.TestCase):
    """测试数据转换函数"""

    def test_transform_question_number(self):
        """测试题目编号转换"""
        self.assertEqual(transform_question_number(1), 1)
        self.assertEqual(transform_question_number('2'), 2)
        self.assertEqual(transform_question_number('  3  '), 3)
        self.assertEqual(transform_question_number('05'), 5)
        self.assertIsNone(transform_question_number(None))
        self.assertIsNone(transform_question_number('abc'))
        self.assertIsNone(transform_question_number(''))

    def test_transform_difficulty(self):
        """测试难度等级转换"""
        self.assertEqual(transform_difficulty('L1'), 'L1')
        self.assertEqual(transform_difficulty('l2'), 'L2')
        self.assertEqual(transform_difficulty('  L3  '), 'L3')
        self.assertEqual(transform_difficulty('L2'), 'L2')
        self.assertIsNone(transform_difficulty(None))
        self.assertIsNone(transform_difficulty('L4'))
        self.assertIsNone(transform_difficulty('easy'))
        self.assertIsNone(transform_difficulty(''))

    def test_transform_correct_index(self):
        """测试正确答案索引转换"""
        self.assertEqual(transform_correct_index('A'), 0)
        self.assertEqual(transform_correct_index('B'), 1)
        self.assertEqual(transform_correct_index('C'), 2)
        self.assertEqual(transform_correct_index('D'), 3)
        self.assertEqual(transform_correct_index('  b  '), 1)
        self.assertEqual(transform_correct_index('c'), 2)
        self.assertIsNone(transform_correct_index(None))
        self.assertIsNone(transform_correct_index('E'))
        self.assertIsNone(transform_correct_index(''))

    def test_transform_correct_answer(self):
        """测试正确答案选项转换"""
        self.assertEqual(transform_correct_answer('A'), 'A')
        self.assertEqual(transform_correct_answer('B'), 'B')
        self.assertEqual(transform_correct_answer('C'), 'C')
        self.assertEqual(transform_correct_answer('D'), 'D')
        self.assertEqual(transform_correct_answer('  b  '), 'B')
        self.assertEqual(transform_correct_answer('d'), 'D')
        self.assertIsNone(transform_correct_answer(None))
        self.assertIsNone(transform_correct_answer('E'))
        self.assertIsNone(transform_correct_answer(''))


class TestPostProcessFunctions(unittest.TestCase):
    """测试后处理函数"""

    def test_post_process_quiz_auto_calculate_index(self):
        """测试自动计算correct_index"""
        data = {
            'text_id': 'WEN_01',
            'question_number': 1,
            'question_text': '测试问题',
            'option_a': '选项A',
            'option_b': '选项B',
            'option_c': '选项C',
            'option_d': '选项D',
            'correct_answer': 'B',
            'difficulty': 'L2'
        }
        result = post_process_quiz(data)
        self.assertEqual(result['correct_index'], 1)
        self.assertEqual(result['correct_answer'], 'B')

    def test_post_process_quiz_filter_none(self):
        """测试过滤None值字段"""
        data = {
            'text_id': 'WEN_01',
            'question_number': 1,
            'question_text': '测试问题',
            'option_a': '选项A',
            'option_b': '选项B',
            'option_c': None,
            'option_d': '选项D',
            'correct_answer': 'A',
            'correct_index': 0,
            'explanation': None,
            'difficulty': 'L1'
        }
        result = post_process_quiz(data)
        self.assertNotIn('option_c', result)
        self.assertNotIn('explanation', result)
        self.assertIn('text_id', result)
        self.assertIn('correct_answer', result)

    def test_post_process_quiz_field_order(self):
        """测试字段顺序"""
        data = {
            'difficulty': 'L2',
            'text_id': 'WEN_01',
            'correct_answer': 'C',
            'question_text': '测试问题',
            'question_number': 1,
            'option_a': 'A',
            'option_b': 'B',
            'option_c': 'C',
            'option_d': 'D',
            'correct_index': 2
        }
        result = post_process_quiz(data)
        keys = list(result.keys())
        expected_order = [
            'text_id', 'question_number', 'question_text', 'option_a',
            'option_b', 'option_c', 'option_d', 'correct_answer',
            'correct_index', 'difficulty'
        ]
        # 检查前几个关键字段的顺序
        for i, key in enumerate(expected_order[:5]):
            self.assertEqual(keys[i], key, f"第{i}个字段应为{key}，实际为{keys[i]}")

    def test_post_process_quiz_empty_data(self):
        """测试空数据"""
        result = post_process_quiz({})
        self.assertEqual(result, {})

    def test_post_process_quiz_no_correct_answer(self):
        """测试没有correct_answer的情况"""
        data = {
            'text_id': 'WEN_01',
            'question_number': 1,
            'question_text': '测试问题'
        }
        result = post_process_quiz(data)
        self.assertNotIn('correct_index', result)

    def test_post_process_level2_quiz(self):
        """测试level2对话题目后处理"""
        data = {
            'text_id': 'WEN_01',
            'question_number': 1,
            'question_text': '测试对话问题',
            'option_a': 'A',
            'option_b': 'B',
            'option_c': 'C',
            'option_d': 'D',
            'correct_answer': 'C',
            'difficulty': 'L3',
            'pre_dialog': '对话前置内容',
            'icon_dialog': 'icon.png',
            'audio_file': None
        }
        result = post_process_level2_quiz(data)
        self.assertEqual(result['correct_index'], 2)
        self.assertEqual(result['correct_answer'], 'C')
        self.assertNotIn('audio_file', result)
        self.assertIn('pre_dialog', result)


if __name__ == '__main__':
    unittest.main(verbosity=2)
