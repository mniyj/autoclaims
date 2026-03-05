import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type ConditionNodeProps = NodeProps<FlowNodeData>;

/**
 * Condition node - displays a field comparison
 */
const ConditionNode = memo(function ConditionNode({ data }: ConditionNodeProps) {
  return (
    <div className="relative">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-400"
      />
      
      {/* Node content */}
      <div className="px-4 py-3 bg-white rounded-lg shadow-md border-2 border-blue-400 min-w-[160px] max-w-[240px]">
        {/* Field name */}
        <div className="text-xs text-gray-500 mb-1 truncate" title={data.field}>
          {data.field}
        </div>
        
        {/* Operator and value */}
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium text-blue-600">
            {data.operator}
          </span>
          <span className="text-sm text-gray-800 truncate" title={String(data.value)}>
            {String(data.value)}
          </span>
        </div>
      </div>
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-400"
      />
    </div>
  );
});

export default ConditionNode;
