# figma-transformer/transformers/text_basic_info.py

"""
text_basic_info transformer：插件和 Excel 管线产出格式一致，只做必填字段校验 + 默认值填充。
不改变结构，每次都跑（内部不需要防御，因为永远只校验）。
"""


def transform(raw, wen_id: str):
    """
    raw:   对象格式，两种来源产出相同
    wen_id: fallback 用
    return: 原样 dict，补全缺失的必填字段
    """
    if not isinstance(raw, dict):
        raw = {}

    REQUIRED = {'text_id', 'title', 'author', 'dynasty', 'original_text'}
    for field in REQUIRED:
        if field not in raw or raw[field] is None:
            raw[field] = ''  # 填默认值，不崩

    # text_id 缺失时 fallback
    if not raw.get('text_id'):
        raw['text_id'] = wen_id

    return raw
