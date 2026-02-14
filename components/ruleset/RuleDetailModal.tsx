import React, { useState, useEffect } from 'react';
import { type RulesetRule, type FieldDefinition, RuleStatus, RuleActionType, ExecutionDomain } from '../../types';
import { RULE_STATUS_LABELS, ACTION_TYPE_LABELS, DOMAIN_LABELS, SOURCE_TYPE_LABELS, PRIORITY_LEVEL_LABELS, CATEGORY_LABELS } from '../../constants';
import ConditionTreeBuilder from './ConditionTreeBuilder';
import ActionParamsEditor from './ActionParamsEditor';

interface RuleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule: RulesetRule | null;
  fieldDictionary: Record<string, FieldDefinition>;
  onSave: (rule: RulesetRule) => void;
}

const RuleDetailModal: React.FC<RuleDetailModalProps> = ({ isOpen, onClose, rule, fieldDictionary, onSave }) => {
  const [editingRule, setEditingRule] = useState<RulesetRule | null>(null);
  const [activeSection, setActiveSection] = useState('basic');

  useEffect(() => {
    if (rule) {
      setEditingRule(JSON.parse(JSON.stringify(rule)));
      setActiveSection('basic');
    }
  }, [rule]);

  if (!isOpen || !editingRule) return null;

  const sections = [
    { id: 'basic', label: '基本信息' },
    { id: 'execution', label: '执行上下文' },
    { id: 'source', label: '来源信息' },
    { id: 'priority', label: '优先级' },
    { id: 'conditions', label: '触发条件' },
    { id: 'action', label: '执行动作' },
    { id: 'confidence', label: '解析置信度' },
  ];

  const handleSave = () => {
    if (editingRule) {
      onSave(editingRule);
      onClose();
    }
  };

  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';
  const inputClass = 'text-sm border border-gray-300 rounded-md px-3 py-1.5 w-full';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{editingRule.rule_name}</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{editingRule.rule_id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content with sidebar tabs */}
        <div className="flex flex-1 overflow-hidden">
          {/* Section tabs */}
          <div className="w-36 bg-gray-50 border-r border-gray-200 py-2 shrink-0 overflow-y-auto">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                  activeSection === section.id
                    ? 'bg-white text-blue-600 font-medium border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>规则ID</label>
                  <input type="text" value={editingRule.rule_id} disabled className={`${inputClass} bg-gray-100`} />
                </div>
                <div>
                  <label className={labelClass}>规则名称</label>
                  <input type="text" value={editingRule.rule_name}
                    onChange={(e) => setEditingRule({ ...editingRule, rule_name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>描述</label>
                  <textarea value={editingRule.description || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                    className={inputClass} rows={3}
                  />
                </div>
                <div>
                  <label className={labelClass}>状态</label>
                  <select value={editingRule.status}
                    onChange={(e) => setEditingRule({ ...editingRule, status: e.target.value as RuleStatus })}
                    className={inputClass}
                  >
                    {Object.entries(RULE_STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>类别</label>
                  <input type="text" value={CATEGORY_LABELS[editingRule.category] || editingRule.category} disabled className={`${inputClass} bg-gray-100`} />
                </div>
                <div>
                  <label className={labelClass}>标签</label>
                  <input type="text" value={(editingRule.tags || []).join(', ')}
                    onChange={(e) => setEditingRule({ ...editingRule, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                    className={inputClass} placeholder="逗号分隔多个标签"
                  />
                </div>
              </div>
            )}

            {activeSection === 'execution' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>执行域</label>
                  <select value={editingRule.execution.domain}
                    onChange={(e) => setEditingRule({ ...editingRule, execution: { ...editingRule.execution, domain: e.target.value as ExecutionDomain } })}
                    className={inputClass}
                  >
                    {Object.entries(DOMAIN_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>循环对象</label>
                  <input type="text" value={editingRule.execution.loop_over || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, execution: { ...editingRule.execution, loop_over: e.target.value || null } })}
                    className={inputClass} placeholder="如 claim.expense_items"
                  />
                </div>
                <div>
                  <label className={labelClass}>循环变量别名</label>
                  <input type="text" value={editingRule.execution.item_alias || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, execution: { ...editingRule.execution, item_alias: e.target.value || null } })}
                    className={inputClass} placeholder="如 expense_item"
                  />
                </div>
                <div>
                  <label className={labelClass}>明细拒绝处理方式</label>
                  <select value={editingRule.execution.item_action_on_reject || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, execution: { ...editingRule.execution, item_action_on_reject: (e.target.value || null) as 'ZERO_AMOUNT' | 'SKIP_ITEM' | 'FLAG_ITEM' | null } })}
                    className={inputClass}
                  >
                    <option value="">无</option>
                    <option value="ZERO_AMOUNT">金额置零</option>
                    <option value="SKIP_ITEM">跳过明细</option>
                    <option value="FLAG_ITEM">标记明细</option>
                  </select>
                </div>
              </div>
            )}

            {activeSection === 'source' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>来源类型</label>
                  <select value={editingRule.source.source_type}
                    onChange={(e) => setEditingRule({ ...editingRule, source: { ...editingRule.source, source_type: e.target.value as RulesetRule['source']['source_type'] } })}
                    className={inputClass}
                  >
                    {Object.entries(SOURCE_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>来源引用</label>
                  <input type="text" value={editingRule.source.source_ref}
                    onChange={(e) => setEditingRule({ ...editingRule, source: { ...editingRule.source, source_ref: e.target.value } })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>条款代码</label>
                  <input type="text" value={editingRule.source.clause_code || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, source: { ...editingRule.source, clause_code: e.target.value || null } })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>原文内容</label>
                  <textarea value={editingRule.source.source_text}
                    onChange={(e) => setEditingRule({ ...editingRule, source: { ...editingRule.source, source_text: e.target.value } })}
                    className={inputClass} rows={4}
                  />
                </div>
              </div>
            )}

            {activeSection === 'priority' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>优先级等级</label>
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((level) => (
                      <label key={level} className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" name="priority_level" value={level}
                          checked={editingRule.priority.level === level}
                          onChange={() => setEditingRule({ ...editingRule, priority: { ...editingRule.priority, level: level as 1 | 2 | 3 | 4 } })}
                          className="text-blue-600"
                        />
                        <span className="text-sm text-gray-700">级别 {level} - {PRIORITY_LEVEL_LABELS[level]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>排序权重</label>
                  <input type="number" value={editingRule.priority.rank}
                    onChange={(e) => setEditingRule({ ...editingRule, priority: { ...editingRule.priority, rank: Number(e.target.value) } })}
                    className={inputClass} min={0}
                  />
                  <p className="text-xs text-gray-400 mt-1">同级别内的排序权重，数值越小越先执行</p>
                </div>
              </div>
            )}

            {activeSection === 'conditions' && (
              <ConditionTreeBuilder
                conditions={editingRule.conditions}
                onChange={(conditions) => setEditingRule({ ...editingRule, conditions })}
                fieldDictionary={fieldDictionary}
                currentDomain={editingRule.execution.domain}
              />
            )}

            {activeSection === 'action' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>动作类型</label>
                  <select value={editingRule.action.action_type}
                    onChange={(e) => setEditingRule({ ...editingRule, action: { ...editingRule.action, action_type: e.target.value as RuleActionType } })}
                    className={inputClass}
                  >
                    <optgroup label="案件级 (ELIGIBILITY)">
                      {[RuleActionType.APPROVE_CLAIM, RuleActionType.REJECT_CLAIM, RuleActionType.SET_CLAIM_RATIO, RuleActionType.ROUTE_CLAIM_MANUAL, RuleActionType.FLAG_FRAUD, RuleActionType.TERMINATE_CONTRACT].map((t) => (
                        <option key={t} value={t}>{ACTION_TYPE_LABELS[t]}</option>
                      ))}
                    </optgroup>
                    <optgroup label="明细级 (ASSESSMENT)">
                      {[RuleActionType.APPROVE_ITEM, RuleActionType.REJECT_ITEM, RuleActionType.ADJUST_ITEM_AMOUNT, RuleActionType.SET_ITEM_RATIO, RuleActionType.FLAG_ITEM].map((t) => (
                        <option key={t} value={t}>{ACTION_TYPE_LABELS[t]}</option>
                      ))}
                    </optgroup>
                    <optgroup label="汇总级 (POST_PROCESS)">
                      {[RuleActionType.APPLY_FORMULA, RuleActionType.APPLY_CAP, RuleActionType.APPLY_DEDUCTIBLE, RuleActionType.SUM_COVERAGES, RuleActionType.DEDUCT_PRIOR_BENEFIT, RuleActionType.ADD_REMARK].map((t) => (
                        <option key={t} value={t}>{ACTION_TYPE_LABELS[t]}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>动作参数</label>
                  <ActionParamsEditor
                    actionType={editingRule.action.action_type}
                    params={editingRule.action.params}
                    onChange={(params) => setEditingRule({ ...editingRule, action: { ...editingRule.action, params } })}
                  />
                </div>
              </div>
            )}

            {activeSection === 'confidence' && (
              <div className="space-y-4">
                {editingRule.parsing_confidence ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: '总体置信度', value: editingRule.parsing_confidence.overall },
                        { label: '条件置信度', value: editingRule.parsing_confidence.condition_confidence },
                        { label: '动作置信度', value: editingRule.parsing_confidence.action_confidence },
                      ].map((item) => (
                        <div key={item.label} className="text-center">
                          <p className="text-xs text-gray-500 mb-2">{item.label}</p>
                          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${item.value >= 0.8 ? 'bg-green-500' : item.value >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${item.value * 100}%` }}
                            ></div>
                          </div>
                          <p className={`text-sm font-semibold mt-1 ${item.value >= 0.8 ? 'text-green-600' : item.value >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {(item.value * 100).toFixed(0)}%
                          </p>
                        </div>
                      ))}
                    </div>

                    {editingRule.parsing_confidence.needs_human_review && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-700 font-medium mb-2">
                          <svg className="inline w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                          需要人工审核
                        </p>
                        {editingRule.parsing_confidence.review_hints && editingRule.parsing_confidence.review_hints.length > 0 && (
                          <ul className="space-y-1">
                            {editingRule.parsing_confidence.review_hints.map((hint, idx) => (
                              <li key={idx} className="text-xs text-yellow-600 flex items-start">
                                <span className="mr-2 mt-0.5">-</span>
                                <span>{hint}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">该规则没有解析置信度信息</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">保存</button>
        </div>
      </div>
    </div>
  );
};

export default RuleDetailModal;
