# figma-transformer/transformers/word_list.py

"""
word_list transformer：插件对象格式 → 前端 RawWordItem[] 数组。
命名解耦合：不硬编码词名，只做结构性搬运。
"""


def transform(raw, wen_id: str):
    """
    raw:   插件产出的原始 JSON（对象嵌套格式）
           {text_id: "WEN_05", "史记": {basic_meaning: "...", ...}, "阳城": {...}}
    wen_id: 课文编号，raw 里没有 text_id 时用作 fallback
    return: 前端期望的数组
           [{text_id: "WEN_05", word: "史记", basic_meaning: "...", ...}, ...]
    """
    # 内部防御：已是数组（01-04 Excel 遗留）→ 原样返回，不被改写
    if isinstance(raw, list):
        return raw

    META = {'text_id'}
    items = []
    text_id = raw.get('text_id') if isinstance(raw, dict) else None
    text_id = text_id or wen_id

    if isinstance(raw, dict):
        for key, value in raw.items():
            if key in META or not isinstance(value, dict):
                continue
            item = {'text_id': text_id, 'word': key}
            item.update(value)
            items.append(item)

    return items
