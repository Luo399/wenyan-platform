#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据结构验证器 - 用于持续维护阶段的数据一致性检查

功能：
1. 验证JSON数据结构与预期结构的一致性
2. 对比新旧版本数据结构的差异
3. 检测缺失字段和新增字段
4. 生成详细的验证报告
"""

import json
import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class FieldStatus(Enum):
    """字段状态枚举"""
    MISSING = "缺失"
    EXTRA = "多余"
    TYPE_MISMATCH = "类型不匹配"
    OK = "正常"
    VALUE_EMPTY = "值为空"

@dataclass
class FieldInfo:
    """字段信息"""
    name: str
    expected_type: type
    actual_type: Optional[type]
    status: FieldStatus
    description: str = ""

@dataclass
class ValidationResult:
    """验证结果"""
    file_path: str
    text_id: str
    is_valid: bool
    fields: List[FieldInfo]
    issues: List[str]
    warnings: List[str]

@dataclass
class StructureDiff:
    """结构差异"""
    field_name: str
    diff_type: str  # 'added', 'removed', 'type_changed', 'value_changed'
    old_value: Any
    new_value: Any

class DataValidator:
    """数据结构验证器"""
    
    # 预期的数据结构定义
    EXPECTED_STRUCTURES = {
        'word_list': {
            'text_id': str,
            'word': str,
            'basic_meaning': str,
            'synonym_analysis': (str, type(None)),
            'follow_up_questions': (list, type(None)),
        },
        'text_basic_info': {
            'text_id': str,
            'title': str,
            'author': str,
            'dynasty': str,
            'original_text': str,
            'illustration': (str, type(None)),
            'bgm': (str, type(None)),
        },
        'multi_role_reading': {
            'text_id': str,
            'audio_file': str,
            'segments': list,
        },
        'level1_quiz': {
            'text_id': str,
            'question_number': int,
            'question_text': str,
            'option_a': str,
            'option_b': str,
            'option_c': str,
            'option_d': str,
            'correct_answer': str,
            'correct_index': int,
            'explanation': str,
            'difficulty': str,
        },
        'level2_quiz': {
            'text_id': str,
            'question_number': int,
            'question_text': str,
            'option_a': str,
            'option_b': str,
            'option_c': str,
            'option_d': str,
            'correct_answer': str,
            'explanation': str,
            'question_type': str,
            'difficulty': str,
            'audio_file': str,
        },
        'level3_quiz': {
            'text_id': str,
            'question_number': int,
            'question_text': str,
            'option_a': str,
            'option_b': str,
            'option_c': str,
            'option_d': str,
            'correct_answer': str,
            'explanation': str,
            'question_type': str,
            'difficulty': str,
        },
    }
    
    def __init__(self):
        self.results: List[ValidationResult] = []
    
    def validate_structure(self, data_type: str, data: Any, file_path: str, text_id: str = "") -> ValidationResult:
        """
        验证数据结构
        
        参数:
            data_type: 数据类型（word_list, text_basic_info等）
            data: 待验证的数据
            file_path: 文件路径
            text_id: 课文ID
        """
        expected = self.EXPECTED_STRUCTURES.get(data_type, {})
        fields: List[FieldInfo] = []
        issues: List[str] = []
        warnings: List[str] = []
        is_valid = True
        
        # 如果是数组，验证第一个元素
        if isinstance(data, list) and len(data) > 0:
            data = data[0]
        
        if not isinstance(data, dict):
            return ValidationResult(
                file_path=file_path,
                text_id=text_id,
                is_valid=False,
                fields=[],
                issues=["数据不是字典或数组格式"],
                warnings=[]
            )
        
        # 检查预期字段
        for field_name, expected_type in expected.items():
            if field_name not in data:
                fields.append(FieldInfo(
                    name=field_name,
                    expected_type=expected_type,
                    actual_type=None,
                    status=FieldStatus.MISSING,
                    description=f"缺少必需字段 '{field_name}'"
                ))
                issues.append(f"缺少必需字段: {field_name}")
                is_valid = False
            else:
                actual_value = data[field_name]
                actual_type = type(actual_value)
                
                # 检查类型
                if isinstance(expected_type, tuple):
                    # 允许多种类型
                    if actual_type not in expected_type:
                        fields.append(FieldInfo(
                            name=field_name,
                            expected_type=expected_type,
                            actual_type=actual_type,
                            status=FieldStatus.TYPE_MISMATCH,
                            description=f"类型不匹配: 预期 {expected_type}, 实际 {actual_type}"
                        ))
                        issues.append(f"字段 '{field_name}' 类型不匹配")
                        is_valid = False
                    else:
                        fields.append(FieldInfo(
                            name=field_name,
                            expected_type=expected_type,
                            actual_type=actual_type,
                            status=FieldStatus.OK
                        ))
                else:
                    if actual_type != expected_type:
                        fields.append(FieldInfo(
                            name=field_name,
                            expected_type=expected_type,
                            actual_type=actual_type,
                            status=FieldStatus.TYPE_MISMATCH,
                            description=f"类型不匹配: 预期 {expected_type}, 实际 {actual_type}"
                        ))
                        issues.append(f"字段 '{field_name}' 类型不匹配")
                        is_valid = False
                    else:
                        fields.append(FieldInfo(
                            name=field_name,
                            expected_type=expected_type,
                            actual_type=actual_type,
                            status=FieldStatus.OK
                        ))
                
                # 检查空值
                if actual_value is None or (isinstance(actual_value, str) and actual_value.strip() == ""):
                    warnings.append(f"字段 '{field_name}' 值为空")
        
        # 检查多余字段
        for field_name in data.keys():
            if field_name not in expected:
                fields.append(FieldInfo(
                    name=field_name,
                    expected_type=None,
                    actual_type=type(data[field_name]),
                    status=FieldStatus.EXTRA,
                    description=f"多余字段: '{field_name}'"
                ))
                warnings.append(f"发现多余字段: {field_name}")
        
        return ValidationResult(
            file_path=file_path,
            text_id=text_id,
            is_valid=is_valid,
            fields=fields,
            issues=issues,
            warnings=warnings
        )
    
    def compare_versions(self, old_data: Dict, new_data: Dict) -> List[StructureDiff]:
        """
        对比两个版本的数据结构差异
        
        参数:
            old_data: 旧版本数据
            new_data: 新版本数据
        
        返回:
            差异列表
        """
        diffs: List[StructureDiff] = []
        
        old_keys = set(old_data.keys())
        new_keys = set(new_data.keys())
        
        # 新增字段
        added_keys = new_keys - old_keys
        for key in added_keys:
            diffs.append(StructureDiff(
                field_name=key,
                diff_type='added',
                old_value=None,
                new_value=new_data[key]
            ))
        
        # 删除字段
        removed_keys = old_keys - new_keys
        for key in removed_keys:
            diffs.append(StructureDiff(
                field_name=key,
                diff_type='removed',
                old_value=old_data[key],
                new_value=None
            ))
        
        # 类型或值变化
        common_keys = old_keys & new_keys
        for key in common_keys:
            old_val = old_data[key]
            new_val = new_data[key]
            
            # 检查类型变化
            if type(old_val) != type(new_val):
                diffs.append(StructureDiff(
                    field_name=key,
                    diff_type='type_changed',
                    old_value=f"{type(old_val).__name__}: {old_val}",
                    new_value=f"{type(new_val).__name__}: {new_val}"
                ))
            elif old_val != new_val:
                # 检查值变化（仅对简单类型）
                if isinstance(old_val, (str, int, float, bool)):
                    diffs.append(StructureDiff(
                        field_name=key,
                        diff_type='value_changed',
                        old_value=old_val,
                        new_value=new_val
                    ))
        
        return diffs
    
    def validate_directory(self, data_type: str, directory: str) -> List[ValidationResult]:
        """
        验证目录下所有JSON文件
        
        参数:
            data_type: 数据类型
            directory: 目录路径
        
        返回:
            验证结果列表
        """
        results: List[ValidationResult] = []
        
        if not os.path.exists(directory):
            print(f"❌ 目录不存在: {directory}")
            return results
        
        for filename in os.listdir(directory):
            if filename.endswith('.json'):
                file_path = os.path.join(directory, filename)
                text_id = filename.replace('.json', '')
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    result = self.validate_structure(data_type, data, file_path, text_id)
                    results.append(result)
                    self.results.append(result)
                    
                except json.JSONDecodeError as e:
                    results.append(ValidationResult(
                        file_path=file_path,
                        text_id=text_id,
                        is_valid=False,
                        fields=[],
                        issues=[f"JSON解析错误: {str(e)}"],
                        warnings=[]
                    ))
                except Exception as e:
                    results.append(ValidationResult(
                        file_path=file_path,
                        text_id=text_id,
                        is_valid=False,
                        fields=[],
                        issues=[f"读取文件失败: {str(e)}"],
                        warnings=[]
                    ))
        
        return results
    
    def generate_report(self, output_path: str = None) -> str:
        """
        生成验证报告
        
        参数:
            output_path: 报告输出路径（可选）
        
        返回:
            报告内容
        """
        total_files = len(self.results)
        valid_files = sum(1 for r in self.results if r.is_valid)
        invalid_files = total_files - valid_files
        
        report = [
            "# 数据结构验证报告",
            "",
            "## 概述",
            "",
            f"- 验证文件总数: {total_files}",
            f"- 通过验证: {valid_files}",
            f"- 验证失败: {invalid_files}",
            f"- 通过率: {(valid_files/total_files*100):.1f}%",
            "",
            "## 详细结果",
            ""
        ]
        
        for result in self.results:
            report.append(f"### {result.text_id}")
            report.append(f"**文件**: {result.file_path}")
            report.append(f"**状态**: {'✅ 通过' if result.is_valid else '❌ 失败'}")
            
            if result.issues:
                report.append("")
                report.append("**问题**:")
                for issue in result.issues:
                    report.append(f"- {issue}")
            
            if result.warnings:
                report.append("")
                report.append("**警告**:")
                for warning in result.warnings:
                    report.append(f"- {warning}")
            
            report.append("")
        
        report_text = "\n".join(report)
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(report_text)
            print(f"✅ 报告已保存: {output_path}")
        
        return report_text

def main():
    """主入口"""
    validator = DataValidator()
    
    # 获取项目根目录（maintenance_tools -> python -> data-pipeline -> wenyan-platform）
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    
    # 定义要验证的数据目录
    data_dirs = [
        ('word_list', os.path.join(project_root, 'public', 'data', 'word_list')),
        ('text_basic_info', os.path.join(project_root, 'public', 'data', 'text_basic_info')),
        ('multi_role_reading', os.path.join(project_root, 'public', 'data', 'multi_role_reading')),
        ('level1_quiz', os.path.join(project_root, 'public', 'data', 'level1_quiz')),
        ('level2_quiz', os.path.join(project_root, 'public', 'data', 'level2_quiz')),
        ('level3_quiz', os.path.join(project_root, 'public', 'data', 'level3_quiz')),
        ('backend_data', os.path.join(project_root, 'backend', 'data')),
        ('temp_data', os.path.join(project_root, 'data-pipeline', 'temp')),
    ]
    
    print("=" * 60)
    print("数据结构验证器")
    print("=" * 60)
    print(f"📂 项目根目录: {project_root}")
    print()
    
    for data_type, directory in data_dirs:
        print(f"🔍 正在验证: {data_type}")
        print(f"   目录: {directory}")
        
        if os.path.exists(directory):
            validator.validate_directory(data_type, directory)
            count = sum(1 for r in validator.results if data_type in r.file_path)
            print(f"   验证文件数: {count}")
        else:
            print(f"   ⚠️ 目录不存在")
        print()
    
    # 生成报告
    report_path = os.path.join(os.path.dirname(__file__), 'validation_report.md')
    validator.generate_report(report_path)
    
    print("=" * 60)
    print("验证完成！")
    print("=" * 60)

if __name__ == '__main__':
    main()
