# figma-transformer/transformers/level1_quiz.py

"""
level1_quiz transformer：插件对象格式 → 前端 RawLevelQuizItem[] 数组。
命名解耦合：不硬编码题号，只做结构性搬运。
"""


def transform(raw, wen_id: str):
    """
    raw:   插件产出的原始 JSON
    wen_id: 课文编号，raw 里没有 text_id 时用作 fallback
    return: 前端期望的数组
    """
    # 内部防御：已是数组（01-04 Excel 遗留）→ 原样返回
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
            item = {'text_id': text_id}
            # 子 Frame 名是题号：纯数字 → 转 int，否则保留字符串
            item['question_number'] = int(key) if str(key).isdigit() else key
            item.update(value)
            items.append(item)

        # 按 question_number 排序，保证展示顺序一致
        items.sort(key=lambda x: x.get('question_number', 0))

    return items
