# figma-transformer/__tests__/test_is_already_correct.py

"""
格式预检测试：is_already_correct() 对正确格式返回 True（skip），对插件格式返回 False（转换）。
保护 01-04 Excel 遗留文件不被误覆盖。
"""

import sys, os
# 把 figma-transformer 加到 sys.path，pytest 运行时能 import config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import is_already_correct


class TestWordListPreCheck:
    """word_list：正确格式是数组，插件产出是对象"""

    def test_legacy_array_should_skip(self):
        """01-04 Excel 遗留的数组格式 → skip"""
        data = [{"text_id": "WEN_01", "word": "史记", "basic_meaning": "..."}]
        assert is_already_correct('word_list', data) is True

    def test_plugin_object_should_convert(self):
        """插件产出的对象格式 → 需要转换"""
        data = {"text_id": "WEN_05", "史记": {"basic_meaning": "..."}}
        assert is_already_correct('word_list', data) is False


class TestMultiRolePreCheck:
    """multi_role_reading：正确格式已有 segments 字段"""

    def test_legacy_with_segments_should_skip(self):
        """01-04 已有 segments → skip"""
        data = {"text_id": "WEN_01", "audio_file": "...", "segments": []}
        assert is_already_correct('multi_role_reading', data) is True

    def test_plugin_without_segments_should_convert(self):
        """插件产出没有 segments → 需要转换"""
        data = {"text_id": "WEN_05", "audio_file": "...", "旁白📖": {}}
        assert is_already_correct('multi_role_reading', data) is False


class TestLevel1QuizPreCheck:
    """level1_quiz：和 word_list 同款，正确格式是数组"""

    def test_legacy_array_should_skip(self):
        data = [{"text_id": "WEN_01", "question_number": 1}]
        assert is_already_correct('level1_quiz', data) is True

    def test_plugin_object_should_convert(self):
        data = {"text_id": "WEN_05", "1": {"question_text": "..."}}
        assert is_already_correct('level1_quiz', data) is False


class TestTextBasicInfoPreCheck:
    """text_basic_info：永远返回 False，每次都跑校验"""

    def test_always_should_run(self):
        data = {"text_id": "WEN_01", "title": "陈涉世家"}
        assert is_already_correct('text_basic_info', data) is False


class TestUnknownDirectoryPreCheck:
    """未知目录：默认不跳过"""

    def test_unknown_should_not_skip(self):
        assert is_already_correct('unknown_dir', {'foo': 'bar'}) is False
