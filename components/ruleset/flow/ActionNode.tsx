import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type ActionNodeProps = NodeProps<FlowNodeData>;

/**
 * Action node - displays the rule action
 */
const ActionNode = memo(function ActionNode({ data }: ActionNodeProps) {
  return (
    <div className="relative">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-green-400"
      />
      
      {/* Node content - capsule shape */}
      <div className="px-6 py-2.5 bg-green-100 rounded-full border-2 border-green-500 shadow-md min-w-[140px]">
        <div className="flex items-center space-x-2">
          {/* Action icon */}
          <svg 
            className="w-4 h-4 text-green-600 flex-shrink-0" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 10V3L4 14h7v7l9-11h-7z" 
            />
          </svg>
          
          {/* Action label */}
          <span className="text-sm font-medium text-green-800 truncate">
            {data.label || data.action}
          </span>
        </div>
      </div>
    </div>
  );
});

export default ActionNode;
