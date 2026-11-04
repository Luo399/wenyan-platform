# figma-transformer/transformers/multi_role_reading.py

"""
multi_role_reading transformer：插件对象格式 → 前端 MultiRoleData。
插件产出: {text_id, audio_file, "角色名": {sentence_index, time_range, dialogue}}
前端期望: {text_id, audio_file, segments: [{role_name, sentence_index, time_range, dialogue}]}
"""


def transform(raw, wen_id: str):
    """
    raw:   插件产出的原始 JSON
    wen_id: 课文编号，raw 里没有 text_id 时用作 fallback
    return: 前端期望的对象（带 segments 数组）
    """
    # 内部防御：已有 segments 字段（01-04 Excel 遗留）→ 原样返回
    if isinstance(raw, dict) and 'segments' in raw:
        return raw

    META = {'text_id', 'audio_file'}
    segments = []

    if isinstance(raw, dict):
        # 元数据字段原样保留在顶层
        result = {k: v for k, v in raw.items() if k in META}
        # 没有 text_id 时 fallback
        if 'text_id' not in result:
            result['text_id'] = wen_id

        for key, value in raw.items():
            if key in META or not isinstance(value, dict):
                continue
            segment = {'role_name': key}
            segment.update(value)
            segments.append(segment)

        result['segments'] = segments
        return result

    # 非 dict 兜底：返回空结构，不崩
    return {'text_id': wen_id, 'segments': []}
