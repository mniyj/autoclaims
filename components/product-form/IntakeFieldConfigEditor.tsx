import React, { useState } from 'react';
import { type IntakeConfig, type IntakeField, type IntakeFieldType } from '../../types';
import { INTAKE_FIELD_TYPE_OPTIONS, INTAKE_VALIDATION_RULE_OPTIONS, INTAKE_FIELD_PRESETS } from '../../constants';

interface IntakeFieldConfigEditorProps {
  config?: IntakeConfig;
  onChange: (config: IntakeConfig) => void;
  productCategory?: string;
}

const DEFAULT_CONFIG: IntakeConfig = {
  fields: [],
  voice_input: { enabled: false, mode: 'realtime_or_record' },
};

const NEEDS_OPTIONS_TYPES: IntakeFieldType[] = ['enum', 'enum_with_other', 'multi_select'];

const IntakeFieldConfigEditor: React.FC<IntakeFieldConfigEditorProps> = ({ config, onChange, productCategory }) => {
  const currentConfig = config || DEFAULT_CONFIG;
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);

  const updateFields = (fields: IntakeField[]) => {
    onChange({ ...currentConfig, fields });
  };

  const handleAddField = () => {
    const newField: IntakeField = {
      field_id: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
    };
    updateFields([...currentConfig.fields, newField]);
    setExpandedFieldId(newField.field_id);
  };

  const handleRemoveField = (fieldId: string) => {
    updateFields(currentConfig.fields.filter(f => f.field_id !== fieldId));
    if (expandedFieldId === fieldId) setExpandedFieldId(null);
  };

  const handleUpdateField = (fieldId: string, updates: Partial<IntakeField>) => {
    updateFields(
      currentConfig.fields.map(f => f.field_id === fieldId ? { ...f, ...updates } : f)
    );
  };

  const handleTypeChange = (fieldId: string, newType: IntakeFieldType) => {
    const field = currentConfig.fields.find(f => f.field_id === fieldId);
    if (!field) return;
    const updates: Partial<IntakeField> = { type: newType };
    // Clear irrelevant properties when type changes
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
    const fields = [...currentConfig.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    [fields[index], fields[targetIndex]] = [fields[targetIndex], fields[index]];
    updateFields(fields);
  };

  const handleLoadPreset = () => {
    if (!productCategory) return;
    const preset = INTAKE_FIELD_PRESETS[productCategory];
    if (!preset) return;
    if (currentConfig.fields.length > 0) {
      if (!confirm('加载预设模板将覆盖当前配置的字段，是否继续？')) return;
    }
    updateFields(preset.map(f => ({ ...f })));
  };

  const handleVoiceToggle = (enabled: boolean) => {
    onChange({
      ...currentConfig,
      voice_input: { ...currentConfig.voice_input, enabled },
    });
  };

  const handleVoicePromptChange = (prompt: string) => {
    onChange({
      ...currentConfig,
      voice_input: { ...currentConfig.voice_input, slot_filling_prompt: prompt },
    });
  };

  // Options editor for enum types
  const renderOptionsEditor = (field: IntakeField) => {
    const options = field.options || [];

    const addOption = () => {
      handleUpdateField(field.field_id, { options: [...options, ''] });
    };

    const updateOption = (idx: number, value: string) => {
      const newOptions = [...options];
      newOptions[idx] = value;
      handleUpdateField(field.field_id, { options: newOptions });
    };

    const removeOption = (idx: number) => {
      handleUpdateField(field.field_id, { options: options.filter((_, i) => i !== idx) });
    };

    return (
      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
        <label className="block text-xs font-medium text-gray-600 mb-2">选项列表</label>
        <div className="space-y-1.5">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`选项 ${idx + 1}`}
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
              />
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="text-gray-400 hover:text-red-500 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800"
        >
          + 添加选项
        </button>
      </div>
    );
  };

  // Follow-up config for boolean type
  const renderFollowUpEditor = (field: IntakeField) => {
    const followUp = field.follow_up || { condition: 'true', extra_fields: [] };

    const updateFollowUp = (updates: Partial<typeof followUp>) => {
      handleUpdateField(field.field_id, {
        follow_up: { ...followUp, ...updates },
      });
    };

    const addExtraField = () => {
      updateFollowUp({ extra_fields: [...followUp.extra_fields, ''] });
    };

    const updateExtraField = (idx: number, value: string) => {
      const newFields = [...followUp.extra_fields];
      newFields[idx] = value;
      updateFollowUp({ extra_fields: newFields });
    };

    const removeExtraField = (idx: number) => {
      updateFollowUp({ extra_fields: followUp.extra_fields.filter((_, i) => i !== idx) });
    };

    return (
      <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
        <label className="block text-xs font-medium text-gray-600 mb-2">条件展示配置</label>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">触发条件</label>
            <select
              value={followUp.condition}
              onChange={(e) => updateFollowUp({ condition: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="true">选择"是"时显示</option>
              <option value="false">选择"否"时显示</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">需展示的字段ID</label>
            {followUp.extra_fields.map((ef, idx) => (
              <div key={idx} className="flex items-center space-x-2 mb-1">
                <input
                  type="text"
                  value={ef}
                  onChange={(e) => updateExtraField(idx, e.target.value)}
                  placeholder="字段ID"
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 font-mono"
                />
                <button type="button" onClick={() => removeExtraField(idx)} className="text-gray-400 hover:text-red-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={addExtraField} className="text-xs text-blue-600 hover:text-blue-800">+ 添加关联字段</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Field list */}
      <div className="space-y-4 rounded-md border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium text-gray-800">报案信息字段配置</h4>
          {productCategory && INTAKE_FIELD_PRESETS[productCategory] && (
            <button
              type="button"
              onClick={handleLoadPreset}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <span>加载预设模板</span>
            </button>
          )}
        </div>

        {currentConfig.fields.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 mb-2">暂未配置报案字段</p>
            <p className="text-xs text-gray-400">点击下方按钮添加字段，或加载预设模板快速配置</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentConfig.fields.map((field, index) => {
              const isExpanded = expandedFieldId === field.field_id;
              return (
                <div key={field.field_id} className={`border rounded-lg transition-colors ${isExpanded ? 'border-blue-300 bg-white' : 'border-gray-200 bg-gray-50 hover:bg-white'}`}>
                  {/* Collapsed header */}
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

                  {/* Expanded content */}
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

                      {/* Options editor for enum types */}
                      {NEEDS_OPTIONS_TYPES.includes(field.type) && renderOptionsEditor(field)}

                      {/* Follow-up config for boolean type */}
                      {field.type === 'boolean' && renderFollowUpEditor(field)}

                      {/* Data source for text_with_search */}
                      {field.type === 'text_with_search' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">数据源标识</label>
                          <input
                            type="text"
                            value={field.data_source || ''}
                            onChange={(e) => handleUpdateField(field.field_id, { data_source: e.target.value || undefined })}
                            className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 font-mono"
                            placeholder="如：hospital_db"
                          />
                        </div>
                      )}

                      {/* Validation */}
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
                                validation: { ...field.validation!, error_msg: e.target.value },
                              })}
                              className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                              placeholder="验证失败时的提示信息"
                            />
                          </div>
                        )}
                      </div>

                      {/* Voice slot */}
                      <div>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.voice_slot_enabled || false}
                            onChange={(e) => handleUpdateField(field.field_id, { voice_slot_enabled: e.target.checked || undefined })}
                            className="rounded text-blue-600"
                          />
                          <span className="text-sm text-gray-700">支持语音填充</span>
                        </label>
                      </div>

                      {/* Action buttons */}
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
                            disabled={index === currentConfig.fields.length - 1}
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
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleAddField}
          className="w-full mt-2 px-4 py-2 border-2 border-dashed border-gray-300 text-sm font-medium rounded-lg text-gray-600 hover:text-brand-blue-600 hover:border-brand-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition"
        >
          + 添加报案字段
        </button>
      </div>

      {/* Voice input config */}
      <div className="rounded-md border border-gray-200 p-4 space-y-3">
        <h4 className="text-md font-medium text-gray-800">语音输入配置</h4>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={currentConfig.voice_input.enabled}
            onChange={(e) => handleVoiceToggle(e.target.checked)}
            className="rounded text-blue-600"
          />
          <span className="text-sm text-gray-700">启用语音报案</span>
        </label>

        {currentConfig.voice_input.enabled && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Slot Filling 提示词</label>
            <textarea
              value={currentConfig.voice_input.slot_filling_prompt || ''}
              onChange={(e) => handleVoicePromptChange(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
              rows={4}
              placeholder="请输入引导语音识别填充字段的提示词模板..."
            />
            <p className="text-xs text-gray-400 mt-1">
              提示词用于引导AI从用户的语音描述中提取结构化信息并自动填充对应字段
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntakeFieldConfigEditor;
