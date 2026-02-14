#!/usr/bin/env python3
"""
中意一生挚爱（传世版）终身寿险（分红型）现金价值表查询工具
针对实际文件格式优化的版本
"""

import pandas as pd
import numpy as np
import re
from typing import Union, Optional, Dict, List
import os

class ZhongyiCashValueProcessor:
    """中意人寿现金价值表处理器"""
    
    def __init__(self, excel_path: str):
        """
        初始化处理器
        
        Args:
            excel_path: Excel文件路径
        """
        self.excel_path = excel_path
        self.df_processed = None
        self.product_info = {}
        self._load_and_process_table()
    
    def _load_and_process_table(self):
        """加载并处理Excel表格"""
        print(f"📖 正在加载Excel文件: {os.path.basename(self.excel_path)}")
        
        # 读取原始数据（无表头）
        # 根据文件扩展名选择合适的引擎
        if self.excel_path.lower().endswith('.xls'):
            engine = "xlrd"
        else:
            engine = "openpyxl"
        
        df_raw = pd.read_excel(self.excel_path, sheet_name=0, header=None, engine=engine)
        print(f"📊 原始数据形状: {df_raw.shape}")
        
        # 提取产品信息
        self._extract_product_info(df_raw)
        
        # 处理数据
        self.df_processed = self._process_data(df_raw)
        
        print(f"✅ 数据处理完成，有效行数: {len(self.df_processed)}")
    
    def _extract_product_info(self, df_raw: pd.DataFrame):
        """提取产品信息"""
        # 产品名称通常在第2行
        if len(df_raw) > 1:
            product_row = df_raw.iloc[1].tolist()
            for cell in product_row:
                if pd.notna(cell) and '终身寿险' in str(cell):
                    self.product_info['产品名称'] = str(cell).strip()
                    break
        
        # 现金价值表标题
        if len(df_raw) > 2:
            title_row = df_raw.iloc[2].tolist()
            for cell in title_row:
                if pd.notna(cell) and '现金价值表' in str(cell):
                    self.product_info['表格类型'] = str(cell).strip()
                    break
        
        # 单位信息
        if len(df_raw) > 5:
            unit_row = df_raw.iloc[5].tolist()
            for cell in unit_row:
                if pd.notna(cell) and '单位' in str(cell):
                    self.product_info['单位'] = str(cell).strip()
                    break
        
        print(f"📋 产品信息: {self.product_info}")
    
    def _process_data(self, df_raw: pd.DataFrame) -> pd.DataFrame:
        """处理数据"""
        # 数据从第9行开始（索引8）
        # 表头在第8行（索引7）
        header_row = df_raw.iloc[7].tolist()
        
        # 提取列名
        columns = []
        for i, cell in enumerate(header_row):
            if pd.isna(cell):
                columns.append(f'col_{i}')
            else:
                cell_str = str(cell).strip()
                if i == 0:
                    columns.append('交费期间')
                elif i == 1:
                    columns.append('性别')
                elif i == 2:
                    columns.append('年龄')
                else:
                    # 保单年度列
                    try:
                        year = int(float(cell_str))
                        columns.append(f'现金价值_{year}年')
                    except:
                        columns.append(f'col_{i}')
        
        # 提取数据行
        data_rows = []
        start_row = 8  # 数据从第9行开始
        
        for row_idx in range(start_row, len(df_raw)):
            row_data = df_raw.iloc[row_idx].tolist()
            
            # 跳过空行
            if len(row_data) < 3 or pd.isna(row_data[0]) or pd.isna(row_data[1]) or pd.isna(row_data[2]):
                continue
            
            # 创建数据字典
            data_dict = {}
            
            for col_idx, col_name in enumerate(columns):
                if col_idx < len(row_data):
                    value = row_data[col_idx]
                    
                    # 处理不同类型的列
                    if col_name == '交费期间':
                        try:
                            data_dict[col_name] = int(float(str(value).strip()))
                        except:
                            data_dict[col_name] = None
                    elif col_name == '性别':
                        data_dict[col_name] = str(value).strip()
                    elif col_name == '年龄':
                        try:
                            data_dict[col_name] = int(float(str(value).strip()))
                        except:
                            data_dict[col_name] = None
                    elif col_name.startswith('现金价值_'):
                        try:
                            # 处理可能包含逗号的数字
                            value_str = str(value).replace(',', '').strip()
                            data_dict[col_name] = float(value_str)
                        except:
                            data_dict[col_name] = None
                    else:
                        data_dict[col_name] = value
            
            # 只保留有效数据行
            if (data_dict.get('交费期间') is not None and 
                data_dict.get('性别') is not None and 
                data_dict.get('年龄') is not None):
                data_rows.append(data_dict)
        
        # 创建DataFrame
        df_result = pd.DataFrame(data_rows)
        
        # 数据清洗
        numeric_cols = ['交费期间', '年龄']
        for col in numeric_cols:
            if col in df_result.columns:
                df_result[col] = pd.to_numeric(df_result[col], errors='coerce')
        
        # 性别标准化
        if '性别' in df_result.columns:
            df_result['性别'] = df_result['性别'].str.strip()
        
        return df_result
    
    def get_cash_value(self, pay_period: int, gender: str, age: int, policy_year: int) -> float:
        """
        查询现金价值
        
        Args:
            pay_period: 交费期间（如：1、3、5、10）
            gender: 性别（"男"或"女"）
            age: 年龄（0-100）
            policy_year: 保单年度（1,2,3...）
        
        Returns:
            现金价值（元）
        
        Raises:
            KeyError: 未找到匹配的记录
            ValueError: 参数无效
        """
        # 参数验证
        if age < 0 or age > 100:
            raise ValueError(f"年龄必须在0-100之间，当前: {age}")
        
        if policy_year < 1 or policy_year > 106:  # 根据实际文件，最大106年
            raise ValueError(f"保单年度必须在1-106之间，当前: {policy_year}")
        
        gender = str(gender).strip()
        if gender not in ['男', '女']:
            raise ValueError(f"性别必须是'男'或'女'，当前: {gender}")
        
        # 转换交费期间为数字
        try:
            pay_period = int(pay_period)
        except (ValueError, TypeError):
            raise ValueError(f"交费期间必须是数字，当前: {pay_period}")
        
        # 构建查询条件
        conditions = (
            (self.df_processed['交费期间'] == pay_period) &
            (self.df_processed['性别'] == gender) &
            (self.df_processed['年龄'] == age)
        )
        
        matching_rows = self.df_processed[conditions]
        
        if matching_rows.empty:
            available_data = self.get_available_options()
            raise KeyError(
                f"未找到匹配记录: 交费期间={pay_period}, 性别={gender}, 年龄={age}\n"
                f"可用数据范围:\n"
                f"交费期间: {available_data.get('交费期间', '未知')}\n"
                f"性别: {available_data.get('性别', '未知')}\n"
                f"年龄: {available_data.get('年龄', '未知')}"
            )
        
        # 查找现金价值列
        cash_value_col = f'现金价值_{policy_year}年'
        
        if cash_value_col not in self.df_processed.columns:
            available_years = [col.replace('现金价值_', '').replace('年', '') 
                             for col in self.df_processed.columns 
                             if col.startswith('现金价值_')]
            available_years = sorted([int(year) for year in available_years])
            raise KeyError(
                f"保单年度{policy_year}年不存在\n"
                f"可用年度: {available_years[0]}-{available_years[-1]}年"
            )
        
        value = matching_rows.iloc[0][cash_value_col]
        
        if pd.isna(value):
            raise ValueError(f"保单年度{policy_year}年的现金价值数据为空")
        
        return float(value)
    
    def get_available_options(self) -> Dict[str, List]:
        """获取可用选项范围"""
        options = {}
        
        for col in ['交费期间', '性别', '年龄']:
            if col in self.df_processed.columns:
                if col == '年龄':
                    # 年龄范围
                    age_min = int(self.df_processed['年龄'].min())
                    age_max = int(self.df_processed['年龄'].max())
                    options[col] = f"{age_min}-{age_max}岁"
                elif col == '交费期间':
                    # 交费期间列表
                    pay_periods = sorted(self.df_processed['交费期间'].dropna().unique())
                    options[col] = pay_periods
                else:
                    # 性别列表
                    genders = sorted(self.df_processed['性别'].dropna().unique())
                    options[col] = genders
        
        # 保单年度范围
        year_cols = [col for col in self.df_processed.columns if col.startswith('现金价值_')]
        years = [int(col.replace('现金价值_', '').replace('年', '')) for col in year_cols]
        if years:
            options['保单年度'] = f"{min(years)}-{max(years)}年"
        
        return options
    
    def get_summary_statistics(self) -> Dict:
        """获取汇总统计"""
        stats = {
            '总行数': len(self.df_processed),
            '产品信息': self.product_info,
            '可用交费期间': [],
            '可用性别': [],
            '年龄范围': [],
            '保单年度范围': []
        }
        
        options = self.get_available_options()
        
        for key, value in options.items():
            if key == '交费期间':
                stats['可用交费期间'] = value
            elif key == '性别':
                stats['可用性别'] = value
            elif key == '年龄':
                stats['年龄范围'] = value
            elif key == '保单年度':
                stats['保单年度范围'] = value
        
        return stats
    
    def display_sample_data(self, n: int = 5):
        """显示样本数据"""
        print("📊 样本数据:")
        print(self.df_processed.head(n).to_string())
    
    def batch_query(self, queries: List[Dict]) -> List[float]:
        """
        批量查询多个条件
        
        Args:
            queries: 查询条件列表，每个元素是包含 pay_period, gender, age, policy_year 的字典
        
        Returns:
            查询结果列表
        """
        results = []
        
        for i, query in enumerate(queries):
            try:
                value = self.get_cash_value(
                    pay_period=query['pay_period'],
                    gender=query['gender'],
                    age=query['age'],
                    policy_year=query['policy_year']
                )
                results.append(value)
                print(f"✅ 查询 {i+1}: {value}元")
            except Exception as e:
                print(f"❌ 查询 {i+1} 失败: {e}")
                results.append(None)
        
        return results

def test_with_actual_file():
    """使用实际文件进行测试"""
    print("🏦 中意人寿现金价值表查询工具")
    print("=" * 60)
    
    # 文件路径
    file_path = "中意一生挚爱（传世版）终身寿险（分红型）- 现金价值表.xls"
    
    if not os.path.exists(file_path):
        print(f"❌ 文件不存在: {file_path}")
        return
    
    try:
        # 初始化处理器
        processor = ZhongyiCashValueProcessor(file_path)
        
        # 显示汇总信息
        print("\n📊 数据汇总:")
        stats = processor.get_summary_statistics()
        for key, value in stats.items():
            if key == '产品信息':
                print(f"   {key}:")
                for k, v in value.items():
                    print(f"     {k}: {v}")
            else:
                print(f"   {key}: {value}")
        
        # 显示样本数据
        processor.display_sample_data(3)
        
        # 查询示例
        print("\n🔍 查询示例:")
        test_queries = [
            {"pay_period": 1, "gender": "男", "age": 0, "policy_year": 1},
            {"pay_period": 1, "gender": "男", "age": 0, "policy_year": 8},
            {"pay_period": 1, "gender": "男", "age": 10, "policy_year": 20},
            {"pay_period": 1, "gender": "女", "age": 5, "policy_year": 10},
        ]
        
        for query in test_queries:
            try:
                value = processor.get_cash_value(**query)
                print(f"   交费期间={query['pay_period']}, 性别={query['gender']}, 年龄={query['age']}, 保单年度={query['policy_year']}年")
                print(f"   现金价值: {value}元")
            except Exception as e:
                print(f"   ❌ 查询失败: {e}")
            print()
        
        # 显示可用选项
        print("📋 可用选项:")
        options = processor.get_available_options()
        for key, value in options.items():
            print(f"   {key}: {value}")
        
        print("\n✅ 测试完成！")
        
    except Exception as e:
        print(f"❌ 处理过程中出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_with_actual_file()