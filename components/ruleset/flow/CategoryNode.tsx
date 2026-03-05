import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type CategoryNodeProps = NodeProps<FlowNodeData>;

const CATEGORY_LABELS: Record<string, string> = {
  COVERAGE_SCOPE: '承保范围',
  EXCLUSION: '除外责任',
  WAITING_PERIOD: '等待期',
  CLAIM_TIMELINE: '索赔时效',
  COVERAGE_PERIOD: '保障期间',
  POLICY_STATUS: '保单状态',
  ITEM_CLASSIFICATION: '项目分类',
  PRICING_REASONABILITY: '定价合理性',
  DISABILITY_ASSESSMENT: '残疾评估',
  DEPRECIATION: '折旧计算',
  PROPORTIONAL_LIABILITY: '比例赔付',
  DEDUCTIBLE: '免赔额',
  SUB_LIMIT: '分项限额',
  SOCIAL_INSURANCE: '社保结合',
  BENEFIT_OFFSET: '利益抵扣',
  AGGREGATE_CAP: '累计限额',
  POST_ADJUSTMENT: '后处理调整',
};

const CategoryNode = memo(function CategoryNode({ data }: CategoryNodeProps) {
  const colorClass = data.colorClass || 'bg-gray-50 border-gray-300 text-gray-700';
  const category = data.category || '';
  const label = CATEGORY_LABELS[category] || category;
  
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-gray-300" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-gray-300" />
      
      <div className={`px-3 py-2 border-2 rounded-lg shadow-sm min-w-[140px] ${colorClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium truncate flex-1" title={label}>{label}</span>
          {data.count !== undefined && (
            <span className="ml-2 px-1.5 py-0.5 bg-white/60 rounded text-xs font-medium shrink-0">
              {data.count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default CategoryNode;
