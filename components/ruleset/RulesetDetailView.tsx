import React, { useState } from 'react';
import { type InsuranceRuleset, type RulesetRule, RuleStatus } from '../../types';
import { PRODUCT_LINE_LABELS, DOMAIN_LABELS } from '../../constants';
import RuleListTab from './RuleListTab';
import ExecutionPipelineTab from './ExecutionPipelineTab';
import OverrideChainsTab from './OverrideChainsTab';
import FieldDictionaryTab from './FieldDictionaryTab';
import RulesetFlowCanvas from './RulesetFlowCanvas';
import type { RulesetFlowNode } from '../../utils/rulesetFlowTransformer';

interface RulesetDetailViewProps {
  ruleset: InsuranceRuleset;
  onBack: () => void;
  onUpdateRuleset: (updated: InsuranceRuleset) => void;
}

type DetailTab = 'rules' | 'visualization' | 'pipeline' | 'chains' | 'dictionary' | 'metadata';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'rules', label: '规则列表' },
  { id: 'visualization', label: '可视化' },
  { id: 'pipeline', label: '执行管道' },
  { id: 'chains', label: '覆盖链' },
  { id: 'dictionary', label: '字段字典' },
  { id: 'metadata', label: '元信息' },
];

const RulesetDetailView: React.FC<RulesetDetailViewProps> = ({ ruleset, onBack, onUpdateRuleset }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('rules');
  const [currentRuleset, setCurrentRuleset] = useState<InsuranceRuleset>(ruleset);
  const [selectedRule, setSelectedRule] = useState<RulesetRule | null>(null);
  const [selectedNode, setSelectedNode] = useState<RulesetFlowNode | null>(null);
  const [showNodePanel, setShowNodePanel] = useState(false);

  const handleUpdateRule = (updatedRule: RulesetRule) => {
    const newRules = currentRuleset.rules.map(r => r.rule_id === updatedRule.rule_id ? updatedRule : r);
    const updated = { ...currentRuleset, rules: newRules };
    setCurrentRuleset(updated);
    onUpdateRuleset(updated);
  };

  const handleToggleStatus = (ruleId: string) => {
    const rule = currentRuleset.rules.find(r => r.rule_id === ruleId);
    if (rule) {
      handleUpdateRule({
        ...rule,
        status: rule.status === RuleStatus.EFFECTIVE ? RuleStatus.DISABLED : RuleStatus.EFFECTIVE,
      });
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(currentRuleset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentRuleset.ruleset_id}_v${currentRuleset.metadata.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNodeClick = (node: RulesetFlowNode) => {
    setSelectedNode(node);
    setShowNodePanel(true);
  };

  const handleCloseNodePanel = () => {
    setShowNodePanel(false);
    setSelectedNode(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{currentRuleset.policy_info.product_name}</h1>
            <div className="flex items-center space-x-3 mt-1">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                {PRODUCT_LINE_LABELS[currentRuleset.product_line]}
              </span>
              <span className="text-xs text-gray-500">v{currentRuleset.metadata.version}</span>
              <span className="text-xs text-gray-400 font-mono">{currentRuleset.ruleset_id}</span>
            </div>
          </div>
        </div>
        <button onClick={handleExport} className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          <span>导出 JSON</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
        {tab.id === 'rules' && (
          <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{currentRuleset.rules.length}</span>
        )}
        {tab.id === 'visualization' && (
          <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs">新</span>
        )}
              {tab.id === 'chains' && currentRuleset.override_chains.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs">{currentRuleset.override_chains.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'rules' && (
          <RuleListTab
            rules={currentRuleset.rules}
            fieldDictionary={currentRuleset.field_dictionary}
            onUpdateRule={handleUpdateRule}
            onToggleStatus={handleToggleStatus}
            onSelectRule={(rule) => {
              setSelectedRule(rule);
              setActiveTab('visualization');
            }}
          />
        )}

        {activeTab === 'visualization' && (
          <div className="flex h-[600px]">
            <div className="flex-1">
              {selectedRule ? (
                <RulesetFlowCanvas
                  rule={selectedRule}
                  onNodeClick={handleNodeClick}
                  className="h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <p className="text-lg font-medium">选择规则查看可视化</p>
                    <p className="text-sm mt-1">从"规则列表"中选择一个规则以查看决策树</p>
                  </div>
                </div>
              )}
            </div>

            {/* Node detail panel */}
            {showNodePanel && selectedNode && (
              <div className="w-80 ml-4 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">节点详情</h3>
                  <button
                    onClick={handleCloseNodePanel}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">类型</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedNode.type === 'logicGate' ? 'bg-yellow-100 text-yellow-800' :
                      selectedNode.type === 'condition' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {selectedNode.type === 'logicGate' ? '逻辑门' :
                       selectedNode.type === 'condition' ? '条件' : '动作'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">标签</p>
                    <p className="text-sm font-medium text-gray-900">{selectedNode.data.label}</p>
                  </div>
                  {selectedNode.data.description && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">描述</p>
                      <p className="text-sm text-gray-700">{selectedNode.data.description}</p>
                    </div>
                  )}
                  {selectedNode.data.field && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">字段</p>
                      <p className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">{selectedNode.data.field}</p>
                    </div>
                  )}
                  {selectedNode.data.operator && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">操作符</p>
                      <p className="text-sm font-medium text-gray-900">{selectedNode.data.operator}</p>
                    </div>
                  )}
                  {selectedNode.data.value !== undefined && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">值</p>
                      <p className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">{String(selectedNode.data.value)}</p>
                    </div>
                  )}
                  {selectedNode.data.action && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">动作</p>
                      <p className="text-sm font-medium text-gray-900">{selectedNode.data.action}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pipeline' && (
          <ExecutionPipelineTab pipeline={currentRuleset.execution_pipeline} />
        )}

        {activeTab === 'chains' && (
          <OverrideChainsTab chains={currentRuleset.override_chains} />
        )}

        {activeTab === 'dictionary' && (
          <FieldDictionaryTab dictionary={currentRuleset.field_dictionary} />
        )}

        {activeTab === 'metadata' && (
          <div className="space-y-6">
            {/* Basic metadata */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">基本信息</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Schema 版本', value: currentRuleset.metadata.schema_version },
                  { label: '规则集版本', value: currentRuleset.metadata.version },
                  { label: '生成时间', value: new Date(currentRuleset.metadata.generated_at).toLocaleString('zh-CN') },
                  { label: '生成方式', value: currentRuleset.metadata.generated_by === 'AI_PARSING' ? 'AI解析' : currentRuleset.metadata.generated_by === 'MANUAL_ENTRY' ? '手动录入' : '混合' },
                  { label: 'AI模型', value: currentRuleset.metadata.ai_model || '-' },
                  { label: '规则总数', value: String(currentRuleset.metadata.total_rules) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">统计信息</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {currentRuleset.metadata.rules_by_domain && Object.entries(currentRuleset.metadata.rules_by_domain).map(([domain, count]) => (
                  <div key={domain} className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">{DOMAIN_LABELS[domain.toUpperCase() as keyof typeof DOMAIN_LABELS] || domain}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{count}</p>
                  </div>
                ))}
                {(currentRuleset.metadata.low_confidence_rules ?? 0) > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-center">
                    <p className="text-xs text-yellow-600">低置信度规则</p>
                    <p className="text-lg font-bold text-yellow-700 mt-1">{currentRuleset.metadata.low_confidence_rules}</p>
                  </div>
                )}
                {(currentRuleset.metadata.unresolved_conflicts ?? 0) > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-xs text-red-600">未解决冲突</p>
                    <p className="text-lg font-bold text-red-700 mt-1">{currentRuleset.metadata.unresolved_conflicts}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Policy info */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">保单信息</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: '保单号', value: currentRuleset.policy_info.policy_no },
                  { label: '产品代码', value: currentRuleset.policy_info.product_code },
                  { label: '保险公司', value: currentRuleset.policy_info.insurer },
                  { label: '生效日期', value: currentRuleset.policy_info.effective_date },
                  { label: '到期日期', value: currentRuleset.policy_info.expiry_date },
                  { label: '保障数量', value: String(currentRuleset.policy_info.coverages.length) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit trail */}
            {currentRuleset.metadata.audit_trail && currentRuleset.metadata.audit_trail.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">审计日志</h3>
                <div className="space-y-3">
                  {currentRuleset.metadata.audit_trail.map((entry, idx) => (
                    <div key={idx} className="flex items-start space-x-3 text-sm">
                      <span className="text-xs text-gray-400 shrink-0 w-36">{new Date(entry.timestamp).toLocaleString('zh-CN')}</span>
                      <span className="text-gray-600">{entry.user_id}</span>
                      <span className="text-gray-900">{entry.action}</span>
                      {entry.details && <span className="text-gray-500">{entry.details}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RulesetDetailView;
