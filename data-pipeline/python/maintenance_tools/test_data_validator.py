#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据验证器单元测试

测试内容：
1. 数据结构验证功能
2. 字段类型检查
3. 缺失字段检测
4. 多余字段检测
5. 版本对比功能
"""

import unittest
import sys
import os

# 添加模块路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_validator import DataValidator, FieldStatus, StructureDiff

class TestDataValidator(unittest.TestCase):
    """数据验证器单元测试"""
    
    def setUp(self):
        """测试前准备"""
        self.validator = DataValidator()
    
    def test_validate_word_list_structure(self):
        """测试验证字词列表结构"""
        valid_data = {
            'text_id': 'WEN_01',
            'word': '测试词',
            'basic_meaning': '基本含义',
            'synonym_analysis': '近义词分析',
            'follow_up_questions': ['问题1', '问题2']
        }
        
        result = self.validator.validate_structure('word_list', valid_data, 'test.json', 'WEN_01')
        
        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.issues), 0)
    
    def test_validate_word_list_missing_field(self):
        """测试字词列表缺失必需字段"""
        invalid_data = {
            'text_id': 'WEN_01',
            'word': '测试词',
            # 缺少 basic_meaning
            'synonym_analysis': '近义词分析'
        }
        
        result = self.validator.validate_structure('word_list', invalid_data, 'test.json', 'WEN_01')
        
        self.assertFalse(result.is_valid)
        self.assertIn('缺少必需字段: basic_meaning', result.issues)
    
    def test_validate_word_list_type_mismatch(self):
        """测试字词列表类型不匹配"""
        invalid_data = {
            'text_id': 'WEN_01',
            'word': '测试词',
            'basic_meaning': 123,  # 应为字符串，实际是整数
            'synonym_analysis': '近义词分析'
        }
        
        result = self.validator.validate_structure('word_list', invalid_data, 'test.json', 'WEN_01')
        
        self.assertFalse(result.is_valid)
        self.assertIn("字段 'basic_meaning' 类型不匹配", result.issues)
    
    def test_validate_word_list_extra_field(self):
        """测试字词列表多余字段"""
        data_with_extra = {
            'text_id': 'WEN_01',
            'word': '测试词',
            'basic_meaning': '基本含义',
            'synonym_analysis': '近义词分析',
            'follow_up_questions': None,
            'extra_field': '多余的字段'  # 多余字段
        }
        
        result = self.validator.validate_structure('word_list', data_with_extra, 'test.json', 'WEN_01')
        
        # 多余字段不影响验证通过，但会产生警告
        self.assertTrue(result.is_valid)
        self.assertIn("发现多余字段: extra_field", result.warnings)
    
    def test_validate_text_basic_info(self):
        """测试验证课文基础信息结构"""
        valid_data = {
            'text_id': 'WEN_01',
            'title': '课文标题',
            'author': '作者',
            'dynasty': '朝代',
            'original_text': '原文内容',
            'illustration': 'WEN_01_illus_1.png',
            'bgm': 'WEN_01_bgm_guzheng.mp3'
        }
        
        result = self.validator.validate_structure('text_basic_info', valid_data, 'test.json', 'WEN_01')
        
        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.issues), 0)
    
    def test_validate_text_basic_info_optional_fields(self):
        """测试课文基础信息可选字段可为空"""
        data_with_none = {
            'text_id': 'WEN_01',
            'title': '课文标题',
            'author': '作者',
            'dynasty': '朝代',
            'original_text': '原文内容',
            'illustration': None,  # 可选字段可以为None
            'bgm': None
        }
        
        result = self.validator.validate_structure('text_basic_info', data_with_none, 'test.json', 'WEN_01')
        
        # 可选字段为None是允许的，但会产生警告
        self.assertTrue(result.is_valid)
    
    def test_compare_versions_added_field(self):
        """测试版本对比 - 新增字段"""
        old_data = {'a': 1, 'b': 2}
        new_data = {'a': 1, 'b': 2, 'c': 3}
        
        diffs = self.validator.compare_versions(old_data, new_data)
        
        added_diffs = [d for d in diffs if d.diff_type == 'added']
        self.assertEqual(len(added_diffs), 1)
        self.assertEqual(added_diffs[0].field_name, 'c')
        self.assertEqual(added_diffs[0].new_value, 3)
    
    def test_compare_versions_removed_field(self):
        """测试版本对比 - 删除字段"""
        old_data = {'a': 1, 'b': 2, 'c': 3}
        new_data = {'a': 1, 'b': 2}
        
        diffs = self.validator.compare_versions(old_data, new_data)
        
        removed_diffs = [d for d in diffs if d.diff_type == 'removed']
        self.assertEqual(len(removed_diffs), 1)
        self.assertEqual(removed_diffs[0].field_name, 'c')
        self.assertEqual(removed_diffs[0].old_value, 3)
    
    def test_compare_versions_value_changed(self):
        """测试版本对比 - 值变化"""
        old_data = {'a': 1, 'b': 'original'}
        new_data = {'a': 1, 'b': 'changed'}
        
        diffs = self.validator.compare_versions(old_data, new_data)
        
        value_diffs = [d for d in diffs if d.diff_type == 'value_changed']
        self.assertEqual(len(value_diffs), 1)
        self.assertEqual(value_diffs[0].field_name, 'b')
        self.assertEqual(value_diffs[0].old_value, 'original')
        self.assertEqual(value_diffs[0].new_value, 'changed')
    
    def test_compare_versions_type_changed(self):
        """测试版本对比 - 类型变化"""
        old_data = {'a': 1, 'b': 'string'}
        new_data = {'a': 1, 'b': 123}  # 从字符串变为整数
        
        diffs = self.validator.compare_versions(old_data, new_data)
        
        type_diffs = [d for d in diffs if d.diff_type == 'type_changed']
        self.assertEqual(len(type_diffs), 1)
        self.assertEqual(type_diffs[0].field_name, 'b')
    
    def test_validate_array_data(self):
        """测试验证数组格式数据"""
        array_data = [
            {
                'text_id': 'WEN_01',
                'word': '词1',
                'basic_meaning': '含义1',
                'synonym_analysis': None,
                'follow_up_questions': None
            },
            {
                'text_id': 'WEN_01',
                'word': '词2',
                'basic_meaning': '含义2',
                'synonym_analysis': None,
                'follow_up_questions': None
            }
        ]
        
        result = self.validator.validate_structure('word_list', array_data, 'test.json', 'WEN_01')
        
        self.assertTrue(result.is_valid)
    
    def test_validate_invalid_format(self):
        """测试验证无效格式"""
        invalid_data = "not a json object"
        
        result = self.validator.validate_structure('word_list', invalid_data, 'test.json', 'WEN_01')
        
        self.assertFalse(result.is_valid)
        self.assertIn("数据不是字典或数组格式", result.issues)
    
    def test_validate_empty_array(self):
        """测试验证空数组"""
        empty_array = []
        
        result = self.validator.validate_structure('word_list', empty_array, 'test.json', 'WEN_01')
        
        # 空数组无法验证结构，会返回无效
        self.assertFalse(result.is_valid)
        self.assertIn("数据不是字典或数组格式", result.issues)

if __name__ == '__main__':
    unittest.main(verbosity=2)
