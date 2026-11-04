# figma-transformer/__tests__/test_multi_role_reading.py

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from transformers.multi_role_reading import transform


class TestMultiRoleReadingTransform:
    def test_basic_conversion(self):
        raw = {
            "text_id": "WEN_05",
            "audio_file": "WEN_05_multi_role.mp3",
            "旁白📖": {"sentence_index": 1, "time_range": "00:00-00:16", "dialogue": "ABC"},
            "陈胜": {"sentence_index": 2, "time_range": "00:17-00:35", "dialogue": "DEF"},
        }
        result = transform(raw, "WEN_05")

        assert 'segments' in result
        assert isinstance(result['segments'], list)
        assert len(result['segments']) == 2
        # 元数据保留
        assert result['text_id'] == 'WEN_05'
        assert result['audio_file'] == 'WEN_05_multi_role.mp3'
        # segments 里每个项有 role_name
        assert any(s['role_name'] == '旁白📖' and s['sentence_index'] == 1 for s in result['segments'])

    def test_internal_defense_segments_passthrough(self):
        legacy = {"text_id": "WEN_01", "segments": [{"role_name": "旁白📖", "dialogue": "ABC"}]}
        result = transform(legacy, "WEN_01")
        assert result is legacy  # 同一个对象引用

    def test_empty_has_empty_segments(self):
        """只有 text_id，没有角色子 Frame → segments: []"""
        result = transform({"text_id": "WEN_05", "audio_file": "a.mp3"}, "WEN_05")
        assert result['segments'] == []
