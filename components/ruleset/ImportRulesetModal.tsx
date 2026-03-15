import React, { useState, useRef } from 'react';
import { type InsuranceRuleset, RulesetProductLine, ExecutionDomain, RuleStatus, RuleActionType, RuleKind, ConditionLogic } from '../../types';

interface ValidationError {
  path: string;
  message: string;
}

interface ImportRulesetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (ruleset: InsuranceRuleset) => void;
}

const VALID_PRODUCT_LINES = Object.values(RulesetProductLine);
const VALID_DOMAINS = Object.values(ExecutionDomain);
const VALID_STATUSES = Object.values(RuleStatus);
const VALID_ACTION_TYPES = Object.values(RuleActionType);
const VALID_RULE_KINDS = Object.values(RuleKind);
const VALID_LOGICS = Object.values(ConditionLogic);

function validateRuleset(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.ruleset_id) errors.push({ path: 'ruleset_id', message: '缺少规则集ID' });
  if (!data.product_line || !VALID_PRODUCT_LINES.includes(data.product_line as RulesetProductLine)) {
    errors.push({ path: 'product_line', message: `产品线无效，可选值: ${VALID_PRODUCT_LINES.join(', ')}` });
  }

  // policy_info
  const pi = data.policy_info as Record<string, unknown> | undefined;
  if (!pi || typeof pi !== 'object') {
    errors.push({ path: 'policy_info', message: '缺少保单信息' });
  } else {
    if (!pi.policy_no) errors.push({ path: 'policy_info.policy_no', message: '缺少保单号' });
    if (!pi.product_code) errors.push({ path: 'policy_info.product_code', message: '缺少产品代码' });
    if (!pi.product_name) errors.push({ path: 'policy_info.product_name', message: '缺少产品名称' });
    if (!pi.insurer) errors.push({ path: 'policy_info.insurer', message: '缺少保险公司' });
    if (!pi.effective_date) errors.push({ path: 'policy_info.effective_date', message: '缺少生效日期' });
    if (!pi.expiry_date) errors.push({ path: 'policy_info.expiry_date', message: '缺少到期日期' });
    if (!Array.isArray(pi.coverages)) errors.push({ path: 'policy_info.coverages', message: '缺少保障明细' });
  }

  // rules
  if (!Array.isArray(data.rules)) {
    errors.push({ path: 'rules', message: '规则必须是数组' });
  } else {
    (data.rules as Record<string, unknown>[]).forEach((rule, idx) => {
      if (!rule.rule_id) errors.push({ path: `rules[${idx}].rule_id`, message: '缺少规则ID' });
      if (!rule.rule_name) errors.push({ path: `rules[${idx}].rule_name`, message: '缺少规则名称' });

      const exec = rule.execution as Record<string, unknown> | undefined;
      if (!exec?.domain || !VALID_DOMAINS.includes(exec.domain as ExecutionDomain)) {
        errors.push({ path: `rules[${idx}].execution.domain`, message: '执行域无效' });
      }

      if (!rule.rule_kind) {
        errors.push({ path: `rules[${idx}].rule_kind`, message: '缺少规则语义' });
      }
      if (rule.rule_kind && !VALID_RULE_KINDS.includes(rule.rule_kind as RuleKind)) {
        errors.push({ path: `rules[${idx}].rule_kind`, message: '规则语义无效' });
      }

      if (!rule.status || !VALID_STATUSES.includes(rule.status as RuleStatus)) {
        errors.push({ path: `rules[${idx}].status`, message: '规则状态无效' });
      }

      const action = rule.action as Record<string, unknown> | undefined;
      if (!action?.action_type || !VALID_ACTION_TYPES.includes(action.action_type as RuleActionType)) {
        errors.push({ path: `rules[${idx}].action.action_type`, message: '动作类型无效' });
      }

      const cond = rule.conditions as Record<string, unknown> | undefined;
      if (!cond?.logic || !VALID_LOGICS.includes(cond.logic as ConditionLogic)) {
        errors.push({ path: `rules[${idx}].conditions.logic`, message: '条件逻辑无效' });
      }
    });
  }

  // execution_pipeline
  if (!data.execution_pipeline || typeof data.execution_pipeline !== 'object') {
    errors.push({ path: 'execution_pipeline', message: '缺少执行管道定义' });
  }

  // override_chains
  if (!Array.isArray(data.override_chains)) {
    errors.push({ path: 'override_chains', message: '覆盖链必须是数组' });
  }

  // field_dictionary
  if (!data.field_dictionary || typeof data.field_dictionary !== 'object') {
    errors.push({ path: 'field_dictionary', message: '缺少字段字典' });
  }

  // metadata
  if (!data.metadata || typeof data.metadata !== 'object') {
    errors.push({ path: 'metadata', message: '缺少元信息' });
  }

  return errors;
}

const ImportRulesetModal: React.FC<ImportRulesetModalProps> = ({ isOpen, onClose, onImport }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedData, setParsedData] = useState<InsuranceRuleset | null>(null);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setParseError(null);
    setValidationErrors([]);
    setParsedData(null);
    setStep('upload');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = (f: File) => {
    setFile(f);
    setParseError(null);
    setValidationErrors([]);
    setParsedData(null);

    if (!f.name.endsWith('.json')) {
      setParseError('请上传 .json 格式的文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const errors = validateRuleset(data);
        if (errors.length > 0) {
          setValidationErrors(errors);
        } else {
          setParsedData(data as InsuranceRuleset);
          setStep('preview');
        }
      } catch {
        setParseError('JSON 解析失败，请检查文件格式是否正确');
      }
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleImport = () => {
    if (parsedData) {
      onImport(parsedData);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">导入规则集</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <>
              {/* Upload area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600 mb-1">拖拽 JSON 文件到此处，或点击选择文件</p>
                <p className="text-xs text-gray-400">支持 insurance_ruleset_schema_v2 格式的 JSON 文件</p>
              </div>

              {/* File info */}
              {file && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); resetState(); }} className="text-sm text-red-500 hover:text-red-700">移除</button>
                </div>
              )}

              {/* Parse error */}
              {parseError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">解析错误</p>
                  <p className="text-sm text-red-600 mt-1">{parseError}</p>
                </div>
              )}

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium mb-2">校验失败 ({validationErrors.length} 个错误)</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {validationErrors.map((err, idx) => (
                      <div key={idx} className="text-xs text-red-600 flex">
                        <span className="font-mono text-red-500 mr-2 shrink-0">{err.path}</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'preview' && parsedData && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium">校验通过，准备导入</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">产品名称</p>
                  <p className="text-sm font-medium text-gray-900">{parsedData.policy_info.product_name}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">产品线</p>
                  <p className="text-sm font-medium text-gray-900">{parsedData.product_line}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">规则总数</p>
                  <p className="text-sm font-medium text-gray-900">{parsedData.metadata.total_rules}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">生成方式</p>
                  <p className="text-sm font-medium text-gray-900">{parsedData.metadata.generated_by === 'AI_PARSING' ? 'AI解析' : parsedData.metadata.generated_by === 'MANUAL_ENTRY' ? '手动录入' : '混合'}</p>
                </div>
              </div>

              {/* Domain distribution */}
              {parsedData.metadata.rules_by_domain && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">规则按域分布</p>
                  <div className="flex space-x-4">
                    <span className="text-xs"><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>定责: {parsedData.metadata.rules_by_domain.eligibility}</span>
                    <span className="text-xs"><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>定损: {parsedData.metadata.rules_by_domain.assessment}</span>
                    <span className="text-xs"><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1"></span>后处理: {parsedData.metadata.rules_by_domain.post_process}</span>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {(parsedData.metadata.low_confidence_rules ?? 0) > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <svg className="inline w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    有 {parsedData.metadata.low_confidence_rules} 条低置信度规则需要人工审核
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          {step === 'preview' && (
            <button onClick={() => { setStep('upload'); setParsedData(null); }} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">返回</button>
          )}
          <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
          {step === 'preview' && (
            <button onClick={handleImport} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">确认导入</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportRulesetModal;
