# figma-transformer/__tests__/test_text_basic_info.py

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from transformers.text_basic_info import transform


class TestTextBasicInfoTransform:
    def test_fills_missing_required_fields(self):
        raw = {"text_id": "WEN_05", "title": "陈涉世家"}
        result = transform(raw, "WEN_05")
        assert result['author'] == ''
        assert result['dynasty'] == ''
        assert result['original_text'] == ''

    def test_fills_missing_text_id_from_wen_id(self):
        raw = {"title": "陈涉世家", "author": "司马迁", "dynasty": "西汉", "original_text": "..."}
        result = transform(raw, "WEN_05")
        assert result['text_id'] == 'WEN_05'

    def test_preserves_existing_fields(self):
        raw = {"text_id": "WEN_05", "title": "陈涉世家", "author": "司马迁", "dynasty": "西汉", "original_text": "...", "bgm": "bgm.mp3"}
        result = transform(raw, "WEN_05")
        assert result['bgm'] == 'bgm.mp3'  # 非必填字段原样保留
