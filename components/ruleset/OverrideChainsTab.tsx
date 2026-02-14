import React from 'react';
import { type OverrideChain } from '../../types';
import { DOMAIN_LABELS } from '../../constants';

interface OverrideChainsTabProps {
  chains: OverrideChain[];
}

const CONFLICT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  OVERRIDE: { label: '覆盖', color: 'bg-orange-100 text-orange-700' },
  SAME_PRIORITY_CONFLICT: { label: '同优先级冲突', color: 'bg-red-100 text-red-700' },
  COMPLEMENT: { label: '互补', color: 'bg-green-100 text-green-700' },
};

const OverrideChainsTab: React.FC<OverrideChainsTabProps> = ({ chains }) => {
  if (chains.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <p className="text-sm text-gray-500">暂无覆盖链，规则之间无冲突</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {chains.map((chain) => {
        const conflictInfo = CONFLICT_TYPE_LABELS[chain.conflict_type] || { label: chain.conflict_type, color: 'bg-gray-100 text-gray-700' };
        return (
          <div key={chain.chain_id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h4 className="text-sm font-medium text-gray-900">{chain.topic}</h4>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${conflictInfo.color}`}>{conflictInfo.label}</span>
              </div>
              {chain.affected_domain && (
                <span className="text-xs text-gray-500">{DOMAIN_LABELS[chain.affected_domain]}</span>
              )}
            </div>

            <div className="p-4">
              <div className="relative">
                {chain.chain.map((item, idx) => {
                  const isEffective = item.rule_id === chain.effective_rule_id;
                  return (
                    <div key={item.rule_id} className="flex items-start mb-3 last:mb-0">
                      {/* Timeline */}
                      <div className="flex flex-col items-center mr-3 shrink-0">
                        <div className={`w-3 h-3 rounded-full border-2 ${isEffective ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}></div>
                        {idx < chain.chain.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-1"></div>}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 p-3 rounded-lg ${isEffective ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-gray-500">{item.rule_id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${isEffective ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                              {item.status === 'EFFECTIVE' ? '生效' : item.status === 'OVERRIDDEN' ? '已覆盖' : item.status}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">优先级 {item.priority_level}</span>
                        </div>
                        <p className="text-sm text-gray-700">{item.summary}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OverrideChainsTab;
