# figma-transformer/__tests__/test_level1_quiz.py

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from transformers.level1_quiz import transform


class TestLevel1QuizTransform:
    def test_basic_conversion(self):
        raw = {
            "text_id": "WEN_05",
            "1": {"question_text": "Q1", "option_a": "A", "correct_answer": "A"},
            "2": {"question_text": "Q2", "option_a": "X", "correct_answer": "D"},
        }
        result = transform(raw, "WEN_05")

        assert isinstance(result, list)
        assert len(result) == 2
        # 按 question_number 排序
        assert result[0]['question_number'] == 1
        assert result[1]['question_number'] == 2
        assert result[0]['text_id'] == 'WEN_05'

    def test_internal_defense_array_passthrough(self):
        legacy = [{"text_id": "WEN_01", "question_number": 1, "question_text": "Q1"}]
        result = transform(legacy, "WEN_01")
        assert result is legacy

    def test_non_numeric_key_kept_as_string(self):
        """如果子 Frame 名不是纯数字 → question_number 保留字符串"""
        raw = {"text_id": "WEN_05", "题一": {"question_text": "..."}}
        result = transform(raw, "WEN_05")
        assert result[0]['question_number'] == '题一'
