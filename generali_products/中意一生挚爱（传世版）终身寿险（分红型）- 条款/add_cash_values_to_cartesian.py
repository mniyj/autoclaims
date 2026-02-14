#!/usr/bin/env python3
"""
为笛卡尔积表添加现金价值列
使用zhongyi_cash_value_processor.py查询每个组合的现金价值
"""

import pandas as pd
import numpy as np
import os
import sys
import time
from pathlib import Path

# 导入现金价值处理器
from zhongyi_cash_value_processor import ZhongyiCashValueProcessor

def add_cash_values_to_cartesian(cartesian_file: str, excel_file: str, output_file: str = None):
    """
    为笛卡尔积表添加现金价值列
    
    Args:
        cartesian_file: 笛卡尔积表文件路径 (CSV)
        excel_file: 现金价值Excel文件路径
        output_file: 输出文件路径，如果为None则自动生成
    """
    print("🏦 开始为笛卡尔积表添加现金价值...")
    print("=" * 60)
    
    # 检查输入文件
    if not os.path.exists(cartesian_file):
        raise FileNotFoundError(f"笛卡尔积表文件不存在: {cartesian_file}")
    
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"现金价值Excel文件不存在: {excel_file}")
    
    # 读取笛卡尔积表
    print(f"📖 读取笛卡尔积表: {cartesian_file}")
    df_cartesian = pd.read_csv(cartesian_file)
    print(f"📊 原始数据形状: {df_cartesian.shape}")
    print(f"📋 列名: {list(df_cartesian.columns)}")
    
    # 显示前几行数据
    print("\n🔍 样本数据:")
    print(df_cartesian.head())
    
    # 初始化现金价值处理器
    print(f"\n⚙️  初始化现金价值处理器...")
    processor = ZhongyiCashValueProcessor(excel_file)
    
    # 获取可用选项范围
    available_options = processor.get_available_options()
    print(f"📋 可用数据范围:")
    for key, value in available_options.items():
        print(f"   {key}: {value}")
    
    # 添加现金价值列
    print(f"\n💰 开始查询现金价值...")
    cash_values = []
    errors = []
    
    total_rows = len(df_cartesian)
    start_time = time.time()
    
    for idx, row in df_cartesian.iterrows():
        if idx % 1000 == 0 and idx > 0:  # 每1000行显示进度
            elapsed = time.time() - start_time
            rate = idx / elapsed
            remaining = (total_rows - idx) / rate
            print(f"⏳ 进度: {idx}/{total_rows} ({idx/total_rows*100:.1f}%) - "
                  f"速度: {rate:.1f} 行/秒 - 预计剩余: {remaining/60:.1f} 分钟")
        
        try:
            # 提取参数
            pay_period = int(row['交费期间'])
            gender = str(row['性别']).strip()
            age = int(row['年龄'])
            policy_year = int(row['保单年度'])
            
            # 查询现金价值
            cash_value = processor.get_cash_value(pay_period, gender, age, policy_year)
            cash_values.append(cash_value)
            
        except Exception as e:
            # 记录错误并设置空值
            error_info = {
                '行号': idx + 2,  # Excel行号（从2开始）
                '交费期间': row.get('交费期间', '未知'),
                '性别': row.get('性别', '未知'),
                '年龄': row.get('年龄', '未知'),
                '保单年度': row.get('保单年度', '未知'),
                '错误': str(e)
            }
            errors.append(error_info)
            cash_values.append(np.nan)
    
    # 添加现金价值列
    df_cartesian['现金价值'] = cash_values
    
    # 统计结果
    successful_queries = len([v for v in cash_values if not pd.isna(v)])
    failed_queries = len([v for v in cash_values if pd.isna(v)])
    
    print(f"\n📊 查询结果统计:")
    print(f"   ✅ 成功查询: {successful_queries:,} 行")
    print(f"   ❌ 失败查询: {failed_queries:,} 行")
    print(f"   📈 成功率: {successful_queries/total_rows*100:.2f}%")
    
    if errors:
        print(f"\n⚠️  错误详情 (前10个):")
        for i, error in enumerate(errors[:10]):
            print(f"   {i+1}. 行{error['行号']}: {error['交费期间']}-{error['性别']}-{error['年龄']}岁-"
                  f"{error['保单年度']}年 - {error['错误']}")
        
        if len(errors) > 10:
            print(f"   ... 还有 {len(errors)-10} 个错误")
    
    # 生成输出文件名
    if output_file is None:
        input_path = Path(cartesian_file)
        output_file = str(input_path.parent / f"{input_path.stem}_with_cash_values{input_path.suffix}")
    
    # 保存结果
    print(f"\n💾 保存结果到: {output_file}")
    df_cartesian.to_csv(output_file, index=False, encoding='utf-8-sig')
    
    # 同时保存Excel版本
    excel_output = output_file.replace('.csv', '.xlsx')
    print(f"💾 同时保存Excel版本: {excel_output}")
    df_cartesian.to_excel(excel_output, index=False, engine='openpyxl')
    
    # 显示结果统计
    print(f"\n📈 结果统计:")
    print(f"   💰 现金价值统计:")
    valid_cash_values = df_cartesian['现金价值'].dropna()
    if len(valid_cash_values) > 0:
        print(f"     最小值: {valid_cash_values.min():,.2f} 元")
        print(f"     最大值: {valid_cash_values.max():,.2f} 元")
        print(f"     平均值: {valid_cash_values.mean():,.2f} 元")
        print(f"     中位数: {valid_cash_values.median():,.2f} 元")
    
    print(f"\n✅ 处理完成!")
    print(f"   输出文件: {output_file}")
    print(f"   Excel文件: {excel_output}")
    
    return df_cartesian, errors

def main():
    """主函数"""
    try:
        # 文件路径
        cartesian_file = "cartesian_product_table.csv"
        excel_file = "中意一生挚爱（传世版）终身寿险（分红型）- 现金价值表.xls"
        
        # 检查文件是否存在
        if not os.path.exists(cartesian_file):
            print(f"❌ 笛卡尔积表文件不存在: {cartesian_file}")
            print("请先运行 cartesian_product_generator.py 生成基础数据")
            return
        
        if not os.path.exists(excel_file):
            print(f"❌ 现金价值Excel文件不存在: {excel_file}")
            return
        
        # 处理数据
        df_result, errors = add_cash_values_to_cartesian(cartesian_file, excel_file)
        
        # 显示结果样本
        print(f"\n🔍 结果样本:")
        print(df_result.head(10))
        
    except Exception as e:
        print(f"❌ 处理过程中出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()