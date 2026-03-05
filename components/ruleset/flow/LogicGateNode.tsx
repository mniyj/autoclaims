import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type LogicGateNodeProps = NodeProps<FlowNodeData>;

/**
 * Logic gate node - displays AND/OR/NOT in a diamond shape
 */
const LogicGateNode = memo(function LogicGateNode({ data }: LogicGateNodeProps) {
  const operator = data.operator || 'AND';
  
  const colors: Record<string, string> = {
    AND: 'bg-blue-100 border-blue-500 text-blue-800',
    OR: 'bg-green-100 border-green-500 text-green-800',
    NOT: 'bg-red-100 border-red-500 text-red-800',
  };
  
  const colorClass = colors[operator] || colors.AND;
  
  return (
    <div className="relative">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400"
      />
      
      {/* Diamond shape container */}
      <div
        className={`
          w-24 h-24 flex items-center justify-center
          border-2 ${colorClass}
          transform rotate-45
          shadow-md
        `}
        style={{ borderRadius: '4px' }}
      >
        <span className="transform -rotate-45 font-bold text-sm">
          {operator}
        </span>
      </div>
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400"
      />
    </div>
  );
});

export default LogicGateNode;
