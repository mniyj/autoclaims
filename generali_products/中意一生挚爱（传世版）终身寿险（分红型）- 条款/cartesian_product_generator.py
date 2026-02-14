import pandas as pd
import itertools
from pathlib import Path

def generate_cartesian_product_table():
    """
    生成笛卡尔积表，包含以下字段：
    - 交费期间：1、3、5、10
    - 性别：男、女
    - 年龄：0～65
    - 保单年度：1～105
    """
    
    # 定义各字段的取值范围
    payment_periods = [1, 3, 5, 10]  # 交费期间
    genders = ['男', '女']  # 性别
    ages = list(range(0, 66))  # 年龄 0-65
    policy_years = list(range(1, 106))  # 保单年度 1-105
    
    print("正在生成笛卡尔积表...")
    print(f"交费期间: {len(payment_periods)} 种")
    print(f"性别: {len(genders)} 种")
    print(f"年龄: {len(ages)} 种")
    print(f"保单年度: {len(policy_years)} 种")
    
    # 计算总记录数
    total_records = len(payment_periods) * len(genders) * len(ages) * len(policy_years)
    print(f"预计总记录数: {total_records:,}")
    
    # 生成笛卡尔积
    cartesian_product = list(itertools.product(
        payment_periods, genders, ages, policy_years
    ))
    
    # 创建DataFrame
    df = pd.DataFrame(cartesian_product, columns=[
        '交费期间', '性别', '年龄', '保单年度'
    ])
    
    print(f"实际生成记录数: {len(df):,}")
    
    return df

def save_to_csv(df, filename='cartesian_product_table.csv'):
    """保存为CSV文件"""
    output_path = Path(filename)
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"数据已保存到: {output_path.absolute()}")
    return output_path

def save_to_excel(df, filename='cartesian_product_table.xlsx'):
    """保存为Excel文件"""
    output_path = Path(filename)
    df.to_excel(output_path, index=False, engine='openpyxl')
    print(f"数据已保存到: {output_path.absolute()}")
    return output_path

def main():
    """主函数"""
    try:
        # 生成笛卡尔积表
        df = generate_cartesian_product_table()
        
        # 显示前10行数据作为示例
        print("\n前10行数据示例:")
        print(df.head(10))
        
        # 显示数据统计信息
        print(f"\n数据统计:")
        print(f"总行数: {len(df):,}")
        print(f"内存使用: {df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB")
        
        # 保存文件
        csv_path = save_to_csv(df)
        excel_path = save_to_excel(df)
        
        print(f"\n文件生成完成!")
        print(f"CSV文件: {csv_path}")
        print(f"Excel文件: {excel_path}")
        
        # 显示文件大小
        csv_size = csv_path.stat().st_size / 1024 / 1024
        excel_size = excel_path.stat().st_size / 1024 / 1024
        print(f"CSV文件大小: {csv_size:.2f} MB")
        print(f"Excel文件大小: {excel_size:.2f} MB")
        
    except Exception as e:
        print(f"生成过程中出现错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()