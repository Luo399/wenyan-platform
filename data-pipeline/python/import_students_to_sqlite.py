# -*- coding: utf-8 -*-
"""
学生名单导入SQLite数据库工具

功能说明：
- 读取Excel格式的学生信息数据
- 建立与SQLite数据库的连接
- 将数据批量导入到students表中

依赖安装：
    pip install pandas openpyxl
"""

import pandas as pd
import sqlite3
import os
import sys


class StudentImporter:
    """学生信息导入器"""

    def __init__(self, db_path='./backend/database/answers.db'):
        """
        初始化数据库连接参数

        参数:
            db_path: 数据库文件路径
        """
        self.db_path = db_path
        self.connection = None
        self.cursor = None

    def connect(self):
        """
        建立数据库连接
        """
        try:
            print("🔄 正在连接数据库...")
            self.connection = sqlite3.connect(self.db_path)
            self.cursor = self.connection.cursor()
            print(f"✅ 数据库连接成功: {self.db_path}")
            return True
        except Exception as e:
            print(f"❌ 数据库连接失败: {e}")
            return False

    def disconnect(self):
        """
        关闭数据库连接
        """
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
            print("🔌 数据库连接已关闭")

    def create_table_if_not_exists(self):
        """
        创建students表（如果不存在）
        """
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS students (
            student_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        try:
            self.cursor.execute(create_table_sql)
            self.connection.commit()
            print("✅ students表已创建或已存在")
        except Exception as e:
            print(f"❌ 创建表失败: {e}")
            raise

    def validate_student_data(self, df):
        """
        验证学生数据

        参数:
            df: 学生数据DataFrame

        返回:
            valid_df: 验证通过的数据
            errors: 错误信息列表
        """
        errors = []
        valid_rows = []

        for index, row in df.iterrows():
            row_errors = []
            
            # 尝试不同的列名
            student_id = str(row.get('学号', row.get('student_id', row.get('studentId', '')))).strip()
            
            # 优先使用 studentName，因为数据预览显示列名是这个
            name = str(row.get('姓名', row.get('studentName', row.get('name', row.get('Name', ''))))).strip()

            if not student_id:
                row_errors.append("学号不能为空")
            elif len(student_id) < 1 or len(student_id) > 20:
                row_errors.append(f"学号'{student_id}'格式不正确（长度应为1-20位）")

            if not name:
                row_errors.append("姓名不能为空")
            elif len(name) > 50:
                row_errors.append(f"姓名'{name}'过长（最多50个字符）")

            if row_errors:
                errors.append(f"第{index + 2}行数据验证失败: {', '.join(row_errors)}")
            else:
                valid_rows.append({
                    'student_id': student_id,
                    'name': name
                })

        print(f"📊 数据验证结果: {len(valid_rows)}条通过, {len(errors)}条失败")
        return valid_rows, errors

    def batch_import(self, students_data):
        """
        批量导入学生数据

        参数:
            students_data: 学生数据列表

        返回:
            success_count: 成功导入数量
            error_count: 失败数量
        """
        if not students_data:
            print("⚠️ 没有可导入的数据")
            return 0, 0

        insert_sql = """
        INSERT OR REPLACE INTO students (student_id, name)
        VALUES (?, ?)
        """

        success_count = 0
        error_count = 0

        print(f"📦 开始批量导入，共{len(students_data)}条数据")

        try:
            for student in students_data:
                try:
                    self.cursor.execute(insert_sql, (student['student_id'], student['name']))
                    success_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"❌ 导入失败 {student['student_id']}: {e}")
            
            self.connection.commit()
            print(f"✅ 批量导入完成")

        except Exception as e:
            error_count += len(students_data) - success_count
            print(f"❌ 批量导入失败: {e}")
            self.connection.rollback()

        return success_count, error_count

    def get_existing_count(self):
        """
        获取已存在的学生数量
        """
        try:
            self.cursor.execute("SELECT COUNT(*) FROM students")
            count = self.cursor.fetchone()[0]
            return count
        except Exception:
            return 0


def read_excel_students(excel_path):
    """
    从Excel文件读取学生数据

    参数:
        excel_path: Excel文件路径

    返回:
        DataFrame: 学生数据
    """
    print(f"📂 正在读取Excel文件: {excel_path}")

    try:
        df = pd.read_excel(excel_path, header=0)
        print(f"📊 成功读取Excel，共{len(df)}行数据")
        print(f"📋 列名: {list(df.columns)}")
        
        # 打印前5行数据用于调试
        print("\n🔍 前5行数据预览:")
        for i in range(min(5, len(df))):
            row_data = df.iloc[i]
            print(f"  第{i+2}行: {dict(row_data)}")
        
        return df
    except Exception as e:
        print(f"❌ 读取Excel文件失败: {e}")
        raise


def main():
    """主函数"""
    print("=" * 60)
    print("学生信息导入SQLite数据库工具")
    print("=" * 60)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_file = os.path.join(script_dir, '学生名单.xlsx')
    db_path = os.path.join(script_dir, '../backend/database/answers.db')

    if not os.path.exists(excel_file):
        print(f"❌ 错误: 未找到学生名单文件 {excel_file}")
        sys.exit(1)

    print(f"📥 Excel文件: {excel_file}")
    print(f"🗄️ 数据库文件: {db_path}")
    print("-" * 60)

    # 确保数据库目录存在
    db_dir = os.path.dirname(db_path)
    if not os.path.exists(db_dir):
        os.makedirs(db_dir)
        print(f"📁 创建数据库目录: {db_dir}")

    importer = StudentImporter(db_path)

    if not importer.connect():
        sys.exit(1)

    try:
        importer.create_table_if_not_exists()
        existing_count = importer.get_existing_count()
        print(f"📊 数据库中现有学生数量: {existing_count}")

        df = read_excel_students(excel_file)

        valid_data, validation_errors = importer.validate_student_data(df)

        if validation_errors:
            print("\n⚠️ 数据验证警告:")
            for error in validation_errors[:10]:
                print(f"  - {error}")
            if len(validation_errors) > 10:
                print(f"  ... 还有{len(validation_errors) - 10}条警告")

        if not valid_data:
            print("\n❌ 没有有效数据可导入")
            sys.exit(1)

        print("\n" + "-" * 60)
        print(f"确认导入 {len(valid_data)} 条学生数据? (自动确认)")
        # 自动确认导入
        confirm = 'y'

        print("\n" + "-" * 60)
        print("开始导入...")
        success_count, error_count = importer.batch_import(valid_data)

        print("\n" + "=" * 60)
        print("导入结果汇总")
        print("=" * 60)
        print(f"✅ 成功导入: {success_count}条")
        print(f"❌ 导入失败: {error_count}条")
        print(f"📊 导入前数据库学生数: {existing_count}")
        print(f"📊 导入后数据库学生数: {importer.get_existing_count()}")

        if success_count > 0:
            print("\n🎉 学生数据导入完成!")

    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        sys.exit(1)
    finally:
        importer.disconnect()


if __name__ == '__main__':
    main()
