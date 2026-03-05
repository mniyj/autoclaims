import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type RulesetStartNodeProps = NodeProps<FlowNodeData>;

const RulesetStartNode = memo(function RulesetStartNode({ data }: RulesetStartNodeProps) {
  return (
    <div className="relative">
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500" />
      
      <div className="px-6 py-4 bg-indigo-50 border-2 border-indigo-500 rounded-xl shadow-lg min-w-[200px]">
        <div className="flex items-center space-x-2 mb-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">规则集</span>
        </div>
        
        <h3 className="text-sm font-bold text-gray-900 mb-1 truncate" title={data.label}>
          {data.label}
        </h3>
        <p className="text-xs text-gray-500">{data.description}</p>
        
        {data.count && (
          <div className="mt-2 flex items-center space-x-1">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
              {data.count} 条规则
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export default RulesetStartNode;
