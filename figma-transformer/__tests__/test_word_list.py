# figma-transformer/__tests__/test_word_list.py

"""
word_list transformer 纯函数测试。
测试命名解耦合：key 名（史记/阳城/项伯）不硬编码，transformer 只负责搬运。
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestWordListTransform:
    """word_list transformer 的转换逻辑测试"""

    def test_basic_conversion(self):
        """插件对象格式 → 前端数组格式"""
        from transformers.word_list import transform

        raw = {
            "text_id": "WEN_05",
            "史记": {"basic_meaning": "选自《太史公书》", "follow_up_questions": []},
            "阳城": {"basic_meaning": "在今河南登封东南"}
        }
        result = transform(raw, "WEN_05")

        assert isinstance(result, list)
        assert len(result) == 2
        # 排序不稳定，用 any 查
        assert any(item['word'] == '史记' and item['basic_meaning'] == '选自《太史公书》' for item in result)
        assert any(item['word'] == '阳城' and item['basic_meaning'] == '在今河南登封东南' for item in result)
        # 每个项的 text_id 都是 wen_id
        assert all(item['text_id'] == 'WEN_05' for item in result)

    def test_internal_defense_array_passthrough(self):
        """内部防御：传入数组（01-04 Excel 遗留）→ 原样返回，不动"""
        from transformers.word_list import transform

        legacy = [{"text_id": "WEN_01", "word": "史记", "basic_meaning": "选自《太史公书》"}]
        result = transform(legacy, "WEN_01")

        assert result is legacy  # 同一个对象引用，证明没被改写
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]['word'] == '史记'

    def test_empty_returns_empty_list(self):
        """只有 text_id，没有子 Frame → 空数组"""
        from transformers.word_list import transform

        result = transform({"text_id": "WEN_05"}, "WEN_05")
        assert result == []

    def test_preserves_all_sub_fields(self):
        """子 Frame 里所有字段都要原样透传到数组项"""
        from transformers.word_list import transform

        raw = {
            "text_id": "WEN_05",
            "项伯": {
                "basic_meaning": "项羽的叔父",
                "synonym_analysis": "无",
                "follow_up_questions": ["谁是项伯？"]
            }
        }
        result = transform(raw, "WEN_05")
        assert result[0]['synonym_analysis'] == '无'
        assert result[0]['follow_up_questions'] == ['谁是项伯？']

    def test_text_id_fallback(self):
        """插件漏写 text_id → fallback 用 wen_id 参数"""
        from transformers.word_list import transform

        raw = {"司马迁": {"basic_meaning": "西汉史学家"}}
        result = transform(raw, "WEN_05")
        assert result[0]['text_id'] == 'WEN_05'
        assert result[0]['word'] == '司马迁'
