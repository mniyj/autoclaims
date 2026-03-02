import React, { useState, useEffect } from 'react';
import { type ClaimItem, type ProductClaimConfig, type ResponsibilityItem } from '../../types';
import { api } from '../../services/api';

interface ClaimItemSelectorProps {
  value: string;
  onChange: (value: string) => void;
  productCode?: string;  // 产品代码，用于获取该产品的索赔项目
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const ClaimItemSelector: React.FC<ClaimItemSelectorProps> = ({
  value,
  onChange,
  productCode,
  placeholder = '请选择索赔项目',
  required = false,
  className = '',
}) => {
  const [claimItems, setClaimItems] = useState<Array<ClaimItem & { responsibilityName?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClaimItems = async () => {
      if (!productCode) {
        setIsLoading(false);
        return;
      }

      try {
        const [
          allClaimItems,
          productClaimConfigs,
          responsibilities,
        ] = await Promise.all([
          api.claimItems.list(),
          api.productClaimConfigs.list(),
          api.responsibilities.list(),
        ]);

        const claimItemsData = allClaimItems as ClaimItem[];
        const configsData = productClaimConfigs as ProductClaimConfig[];
        const responsibilitiesData = responsibilities as ResponsibilityItem[];

        // 找到该产品的配置
        const productConfig = configsData.find((c) => c.productCode === productCode);
        
        if (!productConfig) {
          setClaimItems([]);
          setIsLoading(false);
          return;
        }

        // 收集该产品关联的所有索赔项目
        const itemsWithResponsibility: Array<ClaimItem & { responsibilityName?: string }> = [];
        
        productConfig.responsibilityConfigs.forEach((respConfig) => {
          const responsibility = responsibilitiesData.find((r) => r.id === respConfig.responsibilityId);
          
          respConfig.claimItemIds.forEach((itemId) => {
            const item = claimItemsData.find((ci) => ci.id === itemId);
            if (item) {
              itemsWithResponsibility.push({
                ...item,
                responsibilityName: responsibility?.name || respConfig.responsibilityId,
              });
            }
          });
        });

        setClaimItems(itemsWithResponsibility);
      } catch (error) {
        console.error('Failed to fetch claim items:', error);
        setClaimItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClaimItems();
  }, [productCode]);

  if (!productCode) {
    return (
      <div className={`relative ${className}`}>
        <select
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm"
        >
          <option>请先选择产品</option>
        </select>
        <div className="mt-1 text-xs text-gray-500">
          索赔项目选项需要基于产品配置动态加载
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <select
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm"
        >
          <option>加载中...</option>
        </select>
      </div>
    );
  }

  if (claimItems.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <select
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm"
        >
          <option>暂无索赔项目配置</option>
        </select>
        <div className="mt-1 text-xs text-amber-600">
          请先在「理赔项目及材料配置」中为该产品配置责任和索赔项目
        </div>
      </div>
    );
  }

  // 按责任分组
  const groupedItems = claimItems.reduce((acc, item) => {
    const respName = item.responsibilityName || '其他';
    if (!acc[respName]) {
      acc[respName] = [];
    }
    acc[respName].push(item);
    return acc;
  }, {} as Record<string, typeof claimItems>);

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <option value="">{placeholder}</option>
        {Object.entries(groupedItems).map(([respName, items]) => (
          <optgroup key={respName} label={respName}>
            {items.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
                {item.description && ` - ${item.description}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="mt-1 text-xs text-gray-500">
        共 {claimItems.length} 个索赔项目
      </div>
    </div>
  );
};

export default ClaimItemSelector;
