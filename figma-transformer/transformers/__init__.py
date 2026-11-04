# figma-transformer/transformers/__init__.py

from .text_basic_info import transform as text_basic_info_transform
from .word_list import transform as word_list_transform
from .multi_role_reading import transform as multi_role_reading_transform
from .level1_quiz import transform as level1_quiz_transform

__all__ = [
    'text_basic_info_transform',
    'word_list_transform',
    'multi_role_reading_transform',
    'level1_quiz_transform',
]
