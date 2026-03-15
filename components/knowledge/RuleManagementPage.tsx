import React, { useState, useEffect } from 'react';
import Pagination from '../ui/Pagination';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

interface ReasonabilityRule {
  rule_id: string;
  subject_type: 'disease';
  subject_id: string;
  subject_name?: string;
  object_type: 'drug' | 'service_item';
  object_id?: string;
  object_name?: string;
  rule_type: 'diagnosis_drug_match' | 'diagnosis_service_match' | 'dosage_reasonability' | 'frequency_reasonability' | 'hospitalization_necessity';
  condition_expr?: string;
  threshold?: number;
  action: 'approve' | 'manual_review' | 'reject' | 'warning';
  reason_code: string;
  priority: number;
  status: 'active' | 'inactive';
}

const RULE_TYPE_OPTIONS = [
  { value: 'diagnosis_drug_match', label: '诊断-药品匹配', icon: '💊' },
  { value: 'diagnosis_service_match', label: '诊断-项目匹配', icon: '🩺' },
  { value: 'dosage_reasonability', label: '剂量/疗程合理性', icon: '💉' },
  { value: 'frequency_reasonability', label: '项目频次合理性', icon: '📊' },
  { value: 'hospitalization_necessity', label: '住院必要性', icon: '🏥' },
];

const ACTION_OPTIONS = [
  { value: 'approve', label: '通过', color: 'bg-green-100 text-green-800' },
  { value: 'manual_review', label: '转人工审核', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'reject', label: '拒绝', color: 'bg-red-100 text-red-800' },
  { value: 'warning', label: '警告', color: 'bg-orange-100 text-orange-800' },
];

const RuleManagementPage: React.FC = () => {
  const [rules, setRules] = useState<ReasonabilityRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRuleType, setSelectedRuleType] = useState<string>('diagnosis_drug_match');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ReasonabilityRule> | null>(null);

  useEffect(() => {
    loadRules();
  }, [selectedRuleType]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge/rules?ruleType=${selectedRuleType}`);
      const data = await response.json();
      if (data.success) {
        setRules(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = rules.filter(r => r.rule_type === selectedRuleType);
  const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
  const paginatedRules = filteredRules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAdd = () => {
    setEditingRule({
      rule_id: '',
      subject_type: 'disease',
      rule_type: selectedRuleType as any,
      action: 'manual_review',
      priority: 100,
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (rule: ReasonabilityRule) => {
    setEditingRule({ ...rule });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingRule) return;
    
    try {
      const url = editingRule.rule_id 
        ? `/api/knowledge/rules/${editingRule.rule_id}`
        : '/api/knowledge/rules';
      const method = editingRule.rule_id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      });

      if (response.ok) {
        setIsModalOpen(false);
        loadRules();
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('确定要删除此规则吗？')) return;
    
    try {
      await fetch(`/api/knowledge/rules/${ruleId}`, { method: 'DELETE' });
      loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const getRuleTypeLabel = (type?: string) => {
    return RULE_TYPE_OPTIONS.find(o => o.value === type)?.label || type || '-';
  };

  const getActionBadge = (action?: string) => {
    const config = ACTION_OPTIONS.find(o => o.value === action);
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${config?.color || 'bg-gray-100 text-gray-800'}`}>
        {config?.label || action || '-'}
      </span>
    );
  };

  const getRuleTypeDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      diagnosis_drug_match: '判断药品与诊断是否匹配，如不匹配则触发相应动作',
      diagnosis_service_match: '判断检查项目与诊断是否匹配，如过度检查则标记',
      dosage_reasonability: '评估用药剂量是否在合理范围内',
      frequency_reasonability: '评估检查频次是否合理，防止重复检查',
      hospitalization_necessity: '评估疾病是否需要住院，防止轻症住院',
    };
    return descriptions[type] || '';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">规则管理</h1>
        <p className="text-gray-600 mt-1">管理医学合理性评估规则，包括诊断匹配、剂量检查、频次限制等</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {RULE_TYPE_OPTIONS.map(ruleType => (
          <button
            key={ruleType.value}
            onClick={() => {
              setSelectedRuleType(ruleType.value);
              setCurrentPage(1);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedRuleType === ruleType.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{ruleType.icon}</span>
              <span className={`font-medium ${
                selectedRuleType === ruleType.value ? 'text-blue-900' : 'text-gray-900'
              }`}>
                {ruleType.label}
              </span>
            </div>
            <p className="text-xs text-gray-500">{getRuleTypeDescription(ruleType.value)}</p>
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {getRuleTypeLabel(selectedRuleType)}规则
            </h2>
            <p className="text-sm text-gray-500 mt-1">{getRuleTypeDescription(selectedRuleType)}</p>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增规则
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">规则ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">诊断/疾病</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">对象</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">条件</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">动作</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">优先级</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">加载中...</td></tr>
              ) : paginatedRules.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">暂无规则，请点击"新增规则"创建</td></tr>
              ) : (
                paginatedRules.map((rule) => (
                  <tr key={rule.rule_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{rule.rule_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{rule.subject_name || rule.subject_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{rule.object_name || rule.object_id || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{rule.condition_expr || '-'}</td>
                    <td className="px-4 py-3">{getActionBadge(rule.action)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{rule.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        rule.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {rule.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(rule)} className="text-blue-600 hover:text-blue-800">编辑</button>
                        <button onClick={() => handleDelete(rule.rule_id)} className="text-red-600 hover:text-red-800">删除</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredRules.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule?.rule_id ? '编辑规则' : '新增规则'}
        width="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
          </div>
        }
      >
        {editingRule && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="规则ID" id="rule_id" value={editingRule.rule_id || ''} onChange={(e) => setEditingRule({ ...editingRule, rule_id: e.target.value })} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则类型</label>
                <select 
                  value={editingRule.rule_type || ''} 
                  onChange={(e) => setEditingRule({ ...editingRule, rule_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={!!editingRule.rule_id}
                >
                  {RULE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="诊断/疾病ID" 
                id="subject_id" 
                value={editingRule.subject_id || ''} 
                onChange={(e) => setEditingRule({ ...editingRule, subject_id: e.target.value })} 
                required 
              />
              <Input 
                label="诊断/疾病名称" 
                id="subject_name" 
                value={editingRule.subject_name || ''} 
                onChange={(e) => setEditingRule({ ...editingRule, subject_name: e.target.value })} 
              />
            </div>

            {(editingRule.rule_type === 'diagnosis_drug_match' || editingRule.rule_type === 'diagnosis_service_match') && (
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="对象ID（药品/项目）" 
                  id="object_id" 
                  value={editingRule.object_id || ''} 
                  onChange={(e) => setEditingRule({ ...editingRule, object_id: e.target.value })} 
                />
                <Input 
                  label="对象名称" 
                  id="object_name" 
                  value={editingRule.object_name || ''} 
                  onChange={(e) => setEditingRule({ ...editingRule, object_name: e.target.value })} 
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">条件表达式</label>
              <input
                type="text"
                value={editingRule.condition_expr || ''}
                onChange={(e) => setEditingRule({ ...editingRule, condition_expr: e.target.value })}
                placeholder="如：dose > 1000 && frequency > 3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">支持变量：dose, frequency, days, amount 等</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">动作</label>
                <select 
                  value={editingRule.action || ''} 
                  onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {ACTION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Input 
                label="原因代码" 
                id="reason_code" 
                value={editingRule.reason_code || ''} 
                onChange={(e) => setEditingRule({ ...editingRule, reason_code: e.target.value })} 
                placeholder="如：DX_DRUG_MISMATCH"
              />
              <Input 
                label="优先级" 
                id="priority" 
                type="number"
                value={editingRule.priority || ''} 
                onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })} 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select 
                value={editingRule.status || 'active'} 
                onChange={(e) => setEditingRule({ ...editingRule, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RuleManagementPage;
