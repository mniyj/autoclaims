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
  const domain = data.domain || 'ELIGIBILITY';
  const iconPath = DOMAIN_ICONS[domain] || DOMAIN_ICONS.ELIGIBILITY;
  const label = DOMAIN_LABELS[domain] || domain;
  const laneColor = data.laneColor || '#dbeafe';
  
  const getBorderColor = () => {
    if (domain === 'ELIGIBILITY') return '#3b82f6';
    if (domain === 'ASSESSMENT') return '#22c55e';
    return '#a855f7';
  };
  
  const getTextColor = () => {
    if (domain === 'ELIGIBILITY') return 'text-blue-800';
    if (domain === 'ASSESSMENT') return 'text-green-800';
    return 'text-purple-800';
  };
  
  const getBgColor = () => {
    if (domain === 'ELIGIBILITY') return 'bg-blue-50';
    if (domain === 'ASSESSMENT') return 'bg-green-50';
    return 'bg-purple-50';
  };
  
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-gray-500" />
      
      <div 
        className={`px-6 py-5 rounded-2xl shadow-lg min-w-[240px] max-w-[280px] ${getBgColor()}`}
        style={{ 
          border: `3px solid ${getBorderColor()}`,
          boxShadow: `0 4px 20px ${getBorderColor()}20`,
        }}
      >
        <div className="flex items-center space-x-3 mb-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: getBorderColor() + '20' }}
          >
            <svg className="w-6 h-6" fill="none" stroke={getBorderColor()} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider opacity-60">
              执行阶段
            </span>
            <h3 className={`text-xl font-bold ${getTextColor()}`}>{label}</h3>
          </div>
        </div>
        
        <div className="border-t border-gray-200/50 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">规则数量</span>
            <span className="text-2xl font-bold" style={{ color: getBorderColor() }}>
              {data.count || 0}
            </span>
          </div>          
          {data.executionMode && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">执行模式</span>
              <span className="text-xs font-medium px-2 py-1 bg-white/60 rounded-full">
                {data.executionMode}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ExecutionDomainNode;
