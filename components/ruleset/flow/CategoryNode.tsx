import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type CategoryNodeProps = NodeProps<FlowNodeData>;

const CategoryNode = memo(function CategoryNode({ data }: CategoryNodeProps) {
  const colorClass = data.colorClass || 'bg-gray-50 border-gray-300 text-gray-700';
  const label = data.label || data.category || '';
  
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
