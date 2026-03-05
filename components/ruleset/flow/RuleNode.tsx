import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type RuleNodeProps = NodeProps<FlowNodeData>;

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  EFFECTIVE: { 
    bg: 'bg-green-50', 
    border: 'border-green-300', 
    text: 'text-green-800',
    dot: 'bg-green-500'
  },
  DISABLED: { 
    bg: 'bg-gray-50', 
    border: 'border-gray-300', 
    text: 'text-gray-600',
    dot: 'bg-gray-400'
  },
  DRAFT: { 
    bg: 'bg-yellow-50', 
    border: 'border-yellow-300', 
    text: 'text-yellow-800',
    dot: 'bg-yellow-500'
  },
};

const RuleNode = memo(function RuleNode({ data }: RuleNodeProps) {
  const status = data.status || 'DRAFT';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  const action = data.details?.action as string || '';
  
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-gray-300" />
      
      <div className={`px-3 py-2 border-2 rounded-lg shadow-sm min-w-[160px] max-w-[200px] cursor-pointer transition-all hover:shadow-md hover:scale-105 ${colors.bg} ${colors.border}`}>
        <div className="flex items-start space-x-2">
          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${colors.dot}`}></span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium truncate ${colors.text}`} title={data.label}>
              {data.label}
            </p>            
            {data.count !== undefined && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                {data.count} 个条件
                {action && ` → ${action}`}
              </p>
            )}
          </div>
        </div>
        
        <div className="mt-1.5 pt-1.5 border-t border-gray-200/50">
          <p className="text-[10px] text-gray-400 truncate">双击查看详情</p>
        </div>
      </div>
    </div>
  );
});

export default RuleNode;
