import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../../utils/rulesetFlowTransformer';

type ExecutionDomainNodeProps = NodeProps<FlowNodeData>;

const DOMAIN_ICONS: Record<string, string> = {
  ELIGIBILITY: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  ASSESSMENT: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  POST_PROCESS: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

const DOMAIN_LABELS: Record<string, string> = {
  ELIGIBILITY: '定责',
  ASSESSMENT: '定损',
  POST_PROCESS: '后处理',
};

const ExecutionDomainNode = memo(function ExecutionDomainNode({ data }: ExecutionDomainNodeProps) {
  const colorClass = data.colorClass || 'bg-gray-50 border-gray-400 text-gray-700';
  const domain = data.domain || 'ELIGIBILITY';
  const iconPath = DOMAIN_ICONS[domain] || DOMAIN_ICONS.ELIGIBILITY;
  const label = DOMAIN_LABELS[domain] || domain;
  
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400" />
      
      <div className={`px-4 py-3 border-2 rounded-xl shadow-md min-w-[180px] max-w-[240px] ${colorClass}`}>
        <div className="flex items-center space-x-2 mb-2">
          <svg className="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
          <span className="text-xs font-medium opacity-75 uppercase tracking-wider">{label}</span>
        </div>
        
        <h4 className="text-sm font-bold truncate">{domain}</h4>
        
        {data.executionMode && (
          <p className="text-xs opacity-75 mt-1">模式: {data.executionMode}</p>
        )}
        
        {data.count !== undefined && (
          <div className="mt-2">
            <span className="px-2 py-0.5 bg-white/50 rounded-full text-xs font-medium">
              {data.count} 条规则
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export default ExecutionDomainNode;
