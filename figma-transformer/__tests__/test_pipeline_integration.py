# figma-transformer/__tests__/test_pipeline_integration.py

"""
集成测试：用真实 fixtures 验证转换后的 JSON 能被前端 schema 正常消费。
不走 OSS mock，直接调 transformer，验证输出结构。
"""

import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), 'fixtures')


def load_fixture(rel_path):
    with open(os.path.join(FIXTURES_DIR, rel_path), 'r', encoding='utf-8') as f:
        return json.load(f)


class TestWordListIntegration:
    """word_list 集成测试"""

    def test_plugin_fixture_becomes_adapter_compatible(self):
        """插件 fixture → 转换 → 前端 RawWordItem[] schema"""
        raw = load_fixture('word_list/WEN_05_plugin_object.json')
        from transformers.word_list import transform
        result = transform(raw, 'WEN_05')

        assert isinstance(result, list)
        assert len(result) == 2
        for item in result:
            # 必填字段（wordListAdapter.processWordList 会用 .filter(item.word && item.basic_meaning)）
            assert 'text_id' in item
            assert 'word' in item
            assert 'basic_meaning' in item
            assert item['text_id'] == 'WEN_05'

    def test_legacy_fixture_stays_unchanged(self):
        """Excel 遗留 fixture → 内部防御 → 原样返回"""
        original = load_fixture('word_list/WEN_01_legacy_array.json')
        from transformers.word_list import transform
        result = transform(original, 'WEN_01')

        # 内部防御：isinstance(array) → return raw
        assert result is original
        assert json.dumps(result, ensure_ascii=False) == json.dumps(original, ensure_ascii=False)
