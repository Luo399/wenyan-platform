#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从Excel读取题目答案，补充到现有的JSON文件中
遵循数据结构一致性原则，只修改内容值，不改变结构
"""

import os
import json
import openpyxl

# 配置
INPUT_EXCEL = r"