import React from 'react';
import { type ExecutionPipeline } from '../../types';
import { DOMAIN_LABELS, EXECUTION_MODE_LABELS, INPUT_GRANULARITY_LABELS } from '../../constants';

interface ExecutionPipelineTabProps {
  pipeline: ExecutionPipeline;
}

const DOMAIN_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  ELIGIBILITY: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  ASSESSMENT: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  POST_PROCESS: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
};

const RULE_KIND_LABELS: Record<string, string> = {
  GATE: '准入',
  TRIGGER: '触发',
  EXCLUSION: '免责',
  ADJUSTMENT: '调整',
  BENEFIT: '给付规则',
  ITEM_ELIGIBILITY: '费用项准入',
  ITEM_RATIO: '比例规则',
  ITEM_PRICING: '限价规则',
  ITEM_CAP: '限额规则',
  ITEM_FLAG: '复核标记',
  POST_PROCESS: '后处理',
};

const ExecutionPipelineTab: React.FC<ExecutionPipelineTabProps> = ({ pipeline }) => {
  return (
    <div className="space-y-6">
      {/* Pipeline flow */}
      <div className="flex items-start space-x-4 overflow-x-auto pb-4">
        {pipeline.domains.map((domain, idx) => {
          const colors = DOMAIN_COLORS[domain.domain] || DOMAIN_COLORS.ELIGIBILITY;
          return (
            <React.Fragment key={domain.domain}>
              {idx > 0 && (
                <div className="flex items-center pt-8 shrink-0">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              )}
              <div className={`${colors.bg} ${colors.border} border rounded-xl p-4 min-w-[280px] shrink-0`}>
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`}></span>
                  <h3 className={`text-sm font-semibold ${colors.text}`}>
                    {DOMAIN_LABELS[domain.domain] || domain.label}
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">执行模式</span>
                    <span className="font-medium text-gray-700">{EXECUTION_MODE_LABELS[domain.execution_mode] || domain.execution_mode}</span>
                  </div>
                  {domain.input_granularity && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">输入粒度</span>
                      <span className="font-medium text-gray-700">{INPUT_GRANULARITY_LABELS[domain.input_granularity] || domain.input_granularity}</span>
                    </div>
                  )}
                  {domain.loop_collection && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">循环对象</span>
                      <span className="font-mono font-medium text-gray-700">{domain.loop_collection}</span>
                    </div>
                  )}
                  {domain.short_circuit_on && domain.short_circuit_on.length > 0 && (
                    <div>
                      <span className="text-gray-500">短路触发</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {domain.short_circuit_on.map((trigger) => (
                          <span key={trigger} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs font-mono">{trigger}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Semantic sequence */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1.5">语义执行顺序</p>
                  <div className="space-y-1">
                    {(domain.semantic_sequence && domain.semantic_sequence.length > 0 ? domain.semantic_sequence : domain.category_sequence).map((item, itemIdx) => (
                      <div key={item} className="flex items-center text-xs">
                        <span className="text-gray-400 w-4 text-right mr-2">{itemIdx + 1}.</span>
                        <span className="text-gray-700">{RULE_KIND_LABELS[item] || item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ExecutionPipelineTab;
