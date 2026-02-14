import React, { useState, useMemo } from 'react';
import { type RulesetRule, type FieldDefinition, ExecutionDomain, RuleStatus } from '../../types';
import { DOMAIN_LABELS, RULE_STATUS_LABELS, RULE_STATUS_COLORS, CATEGORY_LABELS, ACTION_TYPE_LABELS } from '../../constants';
import RuleDetailModal from './RuleDetailModal';

interface RuleListTabProps {
  rules: RulesetRule[];
  fieldDictionary: Record<string, FieldDefinition>;
  onUpdateRule: (updatedRule: RulesetRule) => void;
  onToggleStatus: (ruleId: string) => void;
}

const DOMAIN_COLORS: Record<string, string> = {
  [ExecutionDomain.ELIGIBILITY]: 'border-blue-200',
  [ExecutionDomain.ASSESSMENT]: 'border-green-200',
  [ExecutionDomain.POST_PROCESS]: 'border-purple-200',
};

const DOMAIN_HEADER_COLORS: Record<string, string> = {
  [ExecutionDomain.ELIGIBILITY]: 'bg-blue-50 text-blue-700',
  [ExecutionDomain.ASSESSMENT]: 'bg-green-50 text-green-700',
  [ExecutionDomain.POST_PROCESS]: 'bg-purple-50 text-purple-700',
};

const RuleListTab: React.FC<RuleListTabProps> = ({ rules, fieldDictionary, onUpdateRule, onToggleStatus }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [editingRule, setEditingRule] = useState<RulesetRule | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const filteredRules = useMemo(() => {
    let result = rules;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.rule_name.toLowerCase().includes(q) || r.rule_id.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    }
    if (statusFilter) result = result.filter(r => r.status === statusFilter);
    if (domainFilter) result = result.filter(r => r.execution.domain === domainFilter);
    if (needsReviewOnly) result = result.filter(r => r.parsing_confidence?.needs_human_review);
    return result;
  }, [rules, searchQuery, statusFilter, domainFilter, needsReviewOnly]);

  // Group by domain then by category
  const groupedRules = useMemo(() => {
    const domains = [ExecutionDomain.ELIGIBILITY, ExecutionDomain.ASSESSMENT, ExecutionDomain.POST_PROCESS];
    return domains.map((domain) => {
      const domainRules = filteredRules.filter(r => r.execution.domain === domain);
      const categories = new Map<string, RulesetRule[]>();
      domainRules.forEach((r) => {
        const cat = r.category;
        if (!categories.has(cat)) categories.set(cat, []);
        categories.get(cat)!.push(r);
      });
      return { domain, categories, count: domainRules.length };
    });
  }, [filteredRules]);

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRuleIds.size === filteredRules.length) {
      setSelectedRuleIds(new Set());
    } else {
      setSelectedRuleIds(new Set(filteredRules.map(r => r.rule_id)));
    }
  };

  const handleBulkToggle = (enable: boolean) => {
    selectedRuleIds.forEach((id) => {
      const rule = rules.find(r => r.rule_id === id);
      if (rule) {
        onUpdateRule({ ...rule, status: enable ? RuleStatus.EFFECTIVE : RuleStatus.DISABLED });
      }
    });
    setSelectedRuleIds(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索规则名称/ID..."
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-64"
        />
        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2">
          <option value="">全部域</option>
          {Object.entries(DOMAIN_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2">
          <option value="">全部状态</option>
          {Object.entries(RULE_STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <label className="flex items-center space-x-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)}
            className="rounded text-yellow-500" />
          <span>仅需审核</span>
        </label>
        <span className="text-xs text-gray-400 ml-auto">{filteredRules.length} / {rules.length} 条规则</span>
      </div>

      {/* Bulk operations */}
      {selectedRuleIds.size > 0 && (
        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-700">已选 {selectedRuleIds.size} 条</span>
          <button onClick={() => handleBulkToggle(true)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">批量启用</button>
          <button onClick={() => handleBulkToggle(false)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">批量禁用</button>
          <button onClick={() => setSelectedRuleIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">取消选择</button>
        </div>
      )}

      {/* Select all */}
      <div className="flex items-center">
        <label className="flex items-center space-x-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox"
            checked={selectedRuleIds.size === filteredRules.length && filteredRules.length > 0}
            onChange={toggleSelectAll}
            className="rounded"
          />
          <span>全选</span>
        </label>
      </div>

      {/* Domain columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {groupedRules.map(({ domain, categories, count }) => (
          <div key={domain} className={`border rounded-lg overflow-hidden ${DOMAIN_COLORS[domain]}`}>
            <div className={`px-3 py-2 ${DOMAIN_HEADER_COLORS[domain]} font-medium text-sm flex justify-between items-center`}>
              <span>{DOMAIN_LABELS[domain]}</span>
              <span className="text-xs opacity-75">{count} 条</span>
            </div>

            <div className="divide-y divide-gray-100">
              {Array.from(categories.entries()).map(([category, catRules]) => {
                const catKey = `${domain}-${category}`;
                const isExpanded = expandedCategories.has(catKey) || expandedCategories.size === 0;
                return (
                  <div key={catKey}>
                    <button
                      onClick={() => toggleCategory(catKey)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-xs text-gray-600"
                    >
                      <span className="font-medium">{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">{catRules.length}</span>
                        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-gray-50">
                        {catRules.map((rule) => (
                          <div key={rule.rule_id} className="px-3 py-2.5 hover:bg-gray-50">
                            {/* Review warning */}
                            {rule.parsing_confidence?.needs_human_review && (
                              <div className="mb-1.5 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-center">
                                <svg className="w-3 h-3 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                                需人工审核 ({((rule.parsing_confidence.overall) * 100).toFixed(0)}%)
                              </div>
                            )}

                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-2 min-w-0">
                                <input type="checkbox"
                                  checked={selectedRuleIds.has(rule.rule_id)}
                                  onChange={(e) => {
                                    const next = new Set(selectedRuleIds);
                                    if (e.target.checked) next.add(rule.rule_id); else next.delete(rule.rule_id);
                                    setSelectedRuleIds(next);
                                  }}
                                  className="mt-0.5 rounded shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{rule.rule_name}</p>
                                  {rule.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rule.description}</p>
                                  )}
                                  <div className="flex items-center space-x-2 mt-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${RULE_STATUS_COLORS[rule.status]}`}>
                                      {RULE_STATUS_LABELS[rule.status]}
                                    </span>
                                    <span className="text-xs text-gray-400">{ACTION_TYPE_LABELS[rule.action.action_type]}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 shrink-0 ml-2">
                                <button
                                  onClick={() => setEditingRule(rule)}
                                  className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5"
                                >编辑</button>
                                <button
                                  onClick={() => onToggleStatus(rule.rule_id)}
                                  className={`text-xs px-1.5 py-0.5 ${rule.status === RuleStatus.EFFECTIVE ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                                >
                                  {rule.status === RuleStatus.EFFECTIVE ? '禁用' : '启用'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {count === 0 && (
                <div className="px-3 py-6 text-center text-xs text-gray-400">暂无规则</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rule detail modal */}
      <RuleDetailModal
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        rule={editingRule}
        fieldDictionary={fieldDictionary}
        onSave={onUpdateRule}
      />
    </div>
  );
};

export default RuleListTab;
