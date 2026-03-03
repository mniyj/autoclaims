import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { IntakeField, IntakeFieldType } from '../types';
import { INTAKE_FIELD_TYPE_OPTIONS, INTAKE_VALIDATION_RULE_OPTIONS } from '../constants';

interface IntakeFieldPreset {
  id: string;
  name: string;
  description: string;
  fields: IntakeField[];
}

const NEEDS_OPTIONS_TYPES: IntakeFieldType[] = ['enum', 'enum_with_other', 'multi_select'];

const IntakeFieldPresetsManager: React.FC = () => {
  const [presets, setPresets] = useState<IntakeFieldPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<IntakeFieldPreset | null>(null);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.intakeFieldPresets.list();
      setPresets(data);
    } catch (err) {
      setError('加载预设模板失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreset = async () => {
    if (!selectedPreset) return;
    
    try {
      setSaving(true);
      setError(null);
      await api.intakeFieldPresets.update(selectedPreset.id, selectedPreset);
      setSuccessMessage('保存成功');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadPresets();
    } catch (err) {
      setError('保存失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = () => {
    if (!selectedPreset) return;
    
    const newField: IntakeField = {
      field_id: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
    };
    
    setSelectedPreset({
      ...selectedPreset,
      fields: [...selectedPreset.fields, newField],
    });
    setExpandedFieldId(newField.field_id);
  };

  const handleRemoveField = (fieldId: string) => {
    if (!selectedPreset) return;
    
    setSelectedPreset({
      ...selectedPreset,
      fields: selectedPreset.fields.filter(f => f.field_id !== fieldId),
    });
    if (expandedFieldId === fieldId) setExpandedFieldId(null);
  };

  const handleUpdateField = (fieldId: string, updates: Partial<IntakeField>) => {
    if (!selectedPreset) return;
    
    setSelectedPreset({
      ...selectedPreset,
      fields: selectedPreset.fields.map(f => 
        f.field_id === fieldId ? { ...f, ...updates } : f
      ),
    });
  };

  const handleTypeChange = (fieldId: string, newType: IntakeFieldType) => {
    const field = selectedPreset?.fields.find(f => f.field_id === fieldId);
    if (!field) return;
    
    const updates: Partial<IntakeField> = { type: newType };
    if (!NEEDS_OPTIONS_TYPES.includes(newType)) {
      updates.options = undefined;
    }
    if (newType !== 'boolean') {
      updates.follow_up = undefined;
    }
    if (newType !== 'text_with_search') {
      updates.data_source = undefined;
    }
    handleUpdateField(fieldId, updates);
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (!selectedPreset) return;
    
    const fields = [...selectedPreset.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    
    [fields[index], fields[targetIndex]] = [fields[targetIndex], fields[index]];
    setSelectedPreset({ ...selectedPreset, fields });
  };

  const handleAddOption = (fieldId: string) => {
    const field = selectedPreset?.fields.find(f => f.field_id === fieldId);
    if (!field) return;
    
    handleUpdateField(fieldId, { 
      options: [...(field.options || []), ''] 
    });
  };

  const handleUpdateOption = (fieldId: string, idx: number, value: string) => {
    const field = selectedPreset?.fields.find(f => f.field_id === fieldId);
    if (!field || !field.options) return;
    
    const newOptions = [...field.options];
    newOptions[idx] = value;
    handleUpdateField(fieldId, { options: newOptions });
  };

  const handleRemoveOption = (fieldId: string, idx: number) => {
    const field = selectedPreset?.fields.find(f => f.field_id === fieldId);
    if (!field || !field.options) return;
    
    handleUpdateField(fieldId, { 
      options: field.options.filter((_, i) => i !== idx) 
    });
  };

  const renderFieldEditor = (field: IntakeField, index: number) => {
    const isExpanded = expandedFieldId === field.field_id;
    
    return (
      <div 
        key={field.field_id} 
        className={`border rounded-lg transition-colors ${isExpanded ? 'border-blue-300 bg-white' : 'border-gray-200 bg-gray-50 hover:bg-white'}`}
      >
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
          onClick={() => setExpandedFieldId(isExpanded ? null : field.field_id)}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <span className="text-xs text-gray-400 font-mono w-6 shrink-0">#{index + 1}</span>
            <span className="text-sm font-medium text-gray-900 truncate">{field.label || '(未命名)'}</span>
            <span className="text-xs text-gray-400 font-mono">{field.field_id}</span>
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{INTAKE_FIELD_TYPE_OPTIONS[field.type]}</span>
            {field.required && (
              <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs">必填</span>
            )}
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">字段ID</label>
                <input
                  type="text"
                  value={field.field_id}
                  onChange={(e) => handleUpdateField(field.field_id, { field_id: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  字段标签 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => handleUpdateField(field.field_id, { label: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                  placeholder="如：事故日期"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">字段类型</label>
                <select
                  value={field.type}
                  onChange={(e) => handleTypeChange(field.field_id, e.target.value as IntakeFieldType)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                >
                  {Object.entries(INTAKE_FIELD_TYPE_OPTIONS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center space-x-2 cursor-pointer pb-1.5">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => handleUpdateField(field.field_id, { required: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">必填</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">占位符提示</label>
              <input
                type="text"
                value={field.placeholder || ''}
                onChange={(e) => handleUpdateField(field.field_id, { placeholder: e.target.value || undefined })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                placeholder="如：请选择事故发生日期"
              />
            </div>

            {NEEDS_OPTIONS_TYPES.includes(field.type) && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-600">选项列表</label>
                </div>
                <div className="space-y-1.5">
                  {(field.options || []).map((opt, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleUpdateOption(field.field_id, idx, e.target.value)}
                        placeholder={`选项 ${idx + 1}`}
                        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(field.field_id, idx)}
                        className="text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleAddOption(field.field_id)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  + 添加选项
                </button>
              </div>
            )}

            {field.type === 'text_with_search' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">数据源标识</label>
                <select
                  value={field.data_source || ''}
                  onChange={(e) => handleUpdateField(field.field_id, { data_source: e.target.value || undefined })}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                >
                  <option value="">无数据源（手动输入）</option>
                  <option value="hospital_db">医院信息管理</option>
                  <option value="disease_db">疾病库</option>
                  <option value="claim_items_db">索赔项目库</option>
                  <option value="accident_cause_db">事故原因库</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">验证规则</label>
                <select
                  value={field.validation?.rule || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const selectedRule = INTAKE_VALIDATION_RULE_OPTIONS.find(r => r.value === e.target.value);
                      handleUpdateField(field.field_id, {
                        validation: { rule: e.target.value, error_msg: field.validation?.error_msg || selectedRule?.label || '' },
                      });
                    } else {
                      handleUpdateField(field.field_id, { validation: undefined });
                    }
                  }}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                >
                  <option value="">无</option>
                  {INTAKE_VALIDATION_RULE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {field.validation && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">错误提示</label>
                  <input
                    type="text"
                    value={field.validation.error_msg}
                    onChange={(e) => handleUpdateField(field.field_id, {
                      validation: { ...field.validation, error_msg: e.target.value },
                    })}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                    placeholder="验证失败时的提示信息"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleMoveField(index, 'up')}
                  disabled={index === 0}
                  className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5 inline mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  上移
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveField(index, 'down')}
                  disabled={index === (selectedPreset?.fields.length || 0) - 1}
                  className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5 inline mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  下移
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setExpandedFieldId(null)}
                  className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800"
                >
                  收起
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveField(field.field_id)}
                  className="text-xs px-2 py-1 text-red-600 hover:text-red-800"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">报案字段预设模板管理</h2>
        <p className="text-gray-500 mt-1">管理「加载预设模板」和「一键加载常用字段」功能使用的字段配置</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：预设列表 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">预设模板列表</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedPreset(preset);
                    setExpandedFieldId(null);
                  }}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedPreset?.id === preset.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="font-medium text-gray-800">{preset.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{preset.description}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    ID: {preset.id} · {preset.fields.length} 个字段
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h4 className="font-medium text-blue-800 mb-2">使用说明</h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li><strong>common</strong>: 「一键加载常用字段」按钮使用的通用字段</li>
              <li><strong>ACCIDENT/HEALTH等</strong>: 「加载预设模板」按险种使用的字段</li>
              <li>修改后点击保存即可生效</li>
            </ul>
          </div>
        </div>

        {/* 右侧：编辑区域 */}
        <div className="lg:col-span-2">
          {selectedPreset ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{selectedPreset.name}</h3>
                  <p className="text-sm text-gray-500">{selectedPreset.description}</p>
                </div>
                <button
                  onClick={handleSavePreset}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>保存修改</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">模板名称</label>
                    <input
                      type="text"
                      value={selectedPreset.name}
                      onChange={(e) => setSelectedPreset({ ...selectedPreset, name: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">模板ID</label>
                    <input
                      type="text"
                      value={selectedPreset.id}
                      disabled
                      className="w-full text-sm border border-gray-200 bg-gray-50 rounded px-3 py-2 text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">描述</label>
                  <input
                    type="text"
                    value={selectedPreset.description}
                    onChange={(e) => setSelectedPreset({ ...selectedPreset, description: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                  />
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-800">字段列表 ({selectedPreset.fields.length})</h4>
                    <button
                      onClick={handleAddField}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>添加字段</span>
                    </button>
                  </div>

                  {selectedPreset.fields.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <p className="text-gray-500">暂无字段</p>
                      <p className="text-sm text-gray-400 mt-1">点击上方按钮添加字段</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedPreset.fields.map((field, index) => renderFieldEditor(field, index))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">请从左侧选择一个预设模板进行编辑</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntakeFieldPresetsManager;