# figma-transformer/config.py

"""
目录 → transformer 的统一映射表 + 元数据字段定义 + 格式预检规则。
所有目录相关的配置集中在这里，transform.py 和各 transformer 都从这里读。
"""

# 每个目录的元数据字段（跳过不拆，直接透传到顶层）
# 非元数据的 key 一律视为数据项，按 transformer 类型拆入数组/嵌套
META_FIELDS: dict[str, set[str]] = {
    'text_basic_info': set(),                             # 没有元数据，全是字段
    'word_list': {'text_id'},
    'multi_role_reading': {'text_id', 'audio_file'},
    'level1_quiz': {'text_id'},
}

# transformer 函数引用（在 Task 3 各 transformer 创建后填这里）
# 先用占位 None，Task 4 统一注入
TRANSFORM_MAP: dict[str, object] = {}


def is_already_correct(directory: str, data) -> bool:
    """
    格式预检：判断 data 是否已经是前端期望的正确格式。
    返回 True → 应跳过转换，保护 01-04 Excel 管线遗留文件。
    返回 False → 需要转换。
    """
    # 目录不在 transformer 范围内 → 不跳过
    if directory not in TRANSFORM_MAP:
        return False

    if directory in ('word_list', 'level1_quiz'):
        # 正确格式是数组
        return isinstance(data, list)

    if directory == 'multi_role_reading':
        # 正确格式是 {..., segments: [...]}
        return isinstance(data, dict) and 'segments' in data

    if directory == 'text_basic_info':
        # 每次都跑校验，无害
        return False

    return False
