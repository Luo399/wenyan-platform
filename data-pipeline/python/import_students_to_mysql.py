# -*- coding: utf-8 -*-
"""
学生信息导入MySQL数据库工具

功能说明：
- 读取Excel格式的学生信息数据
- 建立与MySQL数据库的连接
- 将数据批量导入到students表中

依赖安装：
    pip install pandas openpyxl mysql-connector-python
"""

import pandas as pd
import mysql.connector
from mysql.connector import Error
import os
import sys
from datetime import datetime


class StudentImporter:
    """学生信息导入器"""

    def __init__(self, host='localhost', port=3306, user='root', password='', database='wenyan_platform'):
        """
        初始化数据库连接参数

        参数:
            host: 数据库主机地址
            port: 数据库端口
            user: 数据库用户名
            password: 数据库密码
            database: 数据库名称
        """
        self.config = {
            'host': host,
            'port': port,
            'user': user,
            'password': password,
            'database': database,
        }
        self.connection = None
        self.cursor = None

    def connect(self):
        """
        建立数据库连接
        """
        try:
            print("🔄 正在连接数据库...")
            self.connection = mysql.connector.connect(**self.config)
            self.cursor = self.connection.cursor()
            print(f"✅ 数据库连接成功: {self.config['host']}:{self.config['port']}/{self.config['database']}")
            return True
        except Error as e:
            print(f"❌ 数据库连接失败: {e}")
            return False

    def disconnect(self):
        """
        关闭数据库连接
        """
        if self.cursor:
            self.cursor.close()
        if self.connection and self.connection.is_connected():
            self.connection.close()
            print("🔌 数据库连接已关闭")

    def create_table_if_not_exists(self):
        """
        创建students表（如果不存在）
        """
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS students (
            student_id VARCHAR(20) PRIMARY KEY COMMENT '学生ID（学号）',
            name VARCHAR(50) NOT NULL COMMENT '学生姓名',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生信息表';
        """
        try:
            self.cursor.execute(create_table_sql)
            print("✅ students表已创建或已存在")
        except Error as e:
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
            student_id = str(row.get('student_id', '')).strip()
            name = str(row.get('name', '')).strip()

            if not student_id:
                row_errors.append("学号不能为空")
            elif len(student_id) < 4 or len(student_id) > 20:
                row_errors.append(f"学号'{student_id}'格式不正确（长度应为4-20位）")

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

    def batch_import(self, students_data, batch_size=100):
        """
        批量导入学生数据

        参数:
            students_data: 学生数据列表
            batch_size: 每批处理数量

        返回:
            success_count: 成功导入数量
            error_count: 失败数量
            errors: 错误信息列表
        """
        if not students_data:
            print("⚠️ 没有可导入的数据")
            return 0, 0, []

        insert_sql = """
        INSERT INTO students (student_id, name)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = CURRENT_TIMESTAMP
        """

        success_count = 0
        error_count = 0
        errors = []

        total_batches = (len(students_data) + batch_size - 1) // batch_size
        print(f"📦 开始批量导入，共{len(students_data)}条数据，分{total_batches}批处理")

        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, len(students_data))
            batch = students_data[start_idx:end_idx]

            print(f"  处理第{batch_num + 1}/{total_batches}批 ({start_idx + 1}-{end_idx}条)...")

            try:
                self.cursor.executemany(insert_sql, [(s['student_id'], s['name']) for s in batch])
                self.connection.commit()
                success_count += len(batch)
                print(f"    ✅ 第{batch_num + 1}批导入成功: {len(batch)}条")

            except Error as e:
                error_count += len(batch)
                error_msg = f"第{batch_num + 1}批导入失败: {e}"
                errors.append(error_msg)
                print(f"    ❌ {error_msg}")
                self.connection.rollback()

        return success_count, error_count, errors

    def get_existing_count(self):
        """
        获取已存在的学生数量
        """
        try:
            self.cursor.execute("SELECT COUNT(*) FROM students")
            count = self.cursor.fetchone()[0]
            return count
        except Error:
            return 0

    def get_total_imported_count(self):
        """
        获取导入后的总学生数量
        """
        try:
            self.cursor.execute("SELECT COUNT(*) FROM students")
            count = self.cursor.fetchone()[0]
            return count
        except Error:
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
        return df
    except Exception as e:
        print(f"❌ 读取Excel文件失败: {e}")
        raise


def main():
    """主函数"""
    print("=" * 60)
    print("学生信息导入MySQL数据库工具")
    print("=" * 60)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_file = os.path.join(script_dir, '学生名单.xlsx')

    if not os.path.exists(excel_file):
        print(f"❌ 错误: 未找到学生名单文件 {excel_file}")
        sys.exit(1)

    print(f"📥 Excel文件: {excel_file}")
    print("-" * 60)

    print("\n请输入数据库连接信息:")
    print("(直接按Enter使用默认值: localhost:3306, root, wenyan_platform)")
    host = input("数据库主机 [localhost]: ").strip() or 'localhost'
    port = input("数据库端口 [3306]: ").strip() or '3306'
    user = input("用户名 [root]: ").strip() or 'root'
    password = input("密码: ").strip()
    database = input("数据库名 [wenyan_platform]: ").strip() or 'wenyan_platform'

    try:
        port = int(port)
    except ValueError:
        print("❌ 端口必须是数字")
        sys.exit(1)

    importer = StudentImporter(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database
    )

    if not importer.connect():
        sys.exit(1)

    try:
        importer.create_table_if_not_exists()
        existing_count = importer.get_existing_count()
        print(f"📊 数据库中现有学生数量: {existing_count}")

        df = read_excel_students(excel_file)

        if 'student_id' not in df.columns or 'name' not in df.columns:
            print("❌ 错误: Excel文件缺少必需的列 'student_id' 或 'name'")
            print(f"📋 当前列名: {list(df.columns)}")
            sys.exit(1)

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
        confirm = input(f"确认导入 {len(valid_data)} 条学生数据? (y/n): ").strip().lower()
        if confirm != 'y':
            print("已取消导入")
            sys.exit(0)

        print("\n" + "-" * 60)
        print("开始导入...")
        success_count, error_count, errors = importer.batch_import(valid_data)

        print("\n" + "=" * 60)
        print("导入结果汇总")
        print("=" * 60)
        print(f"✅ 成功导入: {success_count}条")
        print(f"❌ 导入失败: {error_count}条")
        print(f"📊 导入前数据库学生数: {existing_count}")
        print(f"📊 导入后数据库学生数: {importer.get_total_imported_count()}")

        if errors:
            print("\n⚠️ 错误详情:")
            for error in errors[:5]:
                print(f"  - {error}")
            if len(errors) > 5:
                print(f"  ... 还有{len(errors) - 5}条错误")

        if success_count > 0:
            print("\n🎉 学生数据导入完成!")

    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        sys.exit(1)
    finally:
        importer.disconnect()


if __name__ == '__main__':
    main()
