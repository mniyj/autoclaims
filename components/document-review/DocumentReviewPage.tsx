import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  OCRResult,
  OCRFieldValue,
  SourceAnchor,
  CorrectionRecord,
  ClaimsMaterial,
  ClaimCase,
} from '../../types';
import { parseJsonSchema, groupFields } from '../../utils/schemaParser';
import { validateField, inferValidations } from '../../utils/validation';
import DynamicFieldInput from './DynamicFieldInput';
import FieldGroupPanel from './FieldGroupPanel';
import DocumentPreviewPanel from './DocumentPreviewPanel';

interface DocumentReviewPageProps {
  claimCase: ClaimCase;
  documentId: string;
  imageUrl: string;
  ocrResult: OCRResult;
  materialConfig: ClaimsMaterial;
  onSaveCorrections: (corrections: Partial<CorrectionRecord>[]) => Promise<void>;
  onApproveAll?: (fieldKeys: string[]) => Promise<void>;
}

export const DocumentReviewPage: React.FC<DocumentReviewPageProps> = ({
  claimCase,
  documentId,
  imageUrl,
  ocrResult,
  materialConfig,
  onSaveCorrections,
  onApproveAll,
}) => {
  const [formData, setFormData] = useState<Record<string, OCRFieldValue>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeAnchor, setActiveAnchor] = useState<SourceAnchor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const parsedFields = useMemo(() => {
    try {
      const schema = JSON.parse(materialConfig.jsonSchema || '{}');
      return parseJsonSchema(schema);
    } catch (e) {
      console.error('Failed to parse schema:', e);
      return [];
    }
  }, [materialConfig.jsonSchema]);

  const groupedFields: Record<string, typeof parsedFields> = useMemo(() => groupFields(parsedFields), [parsedFields]);
  const confidenceThreshold = materialConfig.confidenceThreshold ?? 0.9;

  useEffect(() => {
    if (ocrResult?.extractedData) {
      const initialData: Record<string, OCRFieldValue> = {};
      parsedFields.forEach((field) => {
        const ocrValue = ocrResult.extractedData[field.key];
        if (ocrValue) {
          initialData[field.key] = ocrValue;
        } else {
          initialData[field.key] = { value: '', confidence: 0 };
        }
      });
      setFormData(initialData);
      validateAllFields(initialData);
    }
  }, [ocrResult, parsedFields]);

  const validateAllFields = useCallback(
    (data: Record<string, OCRFieldValue>) => {
      const errors: Record<string, string> = {};
      parsedFields.forEach((field) => {
        const value = data[field.key]?.value;
        const rules = inferValidations(field.key, field.required);
        const error = validateField(value, rules);
        if (error) errors[field.key] = error;
      });
      setValidationErrors(errors);
      return errors;
    },
    [parsedFields]
  );

  const handleFieldChange = useCallback(
    (fieldKey: string, value: OCRFieldValue) => {
      setFormData((prev) => ({ ...prev, [fieldKey]: value }));
      setHasChanges(true);
      const field = parsedFields.find((f) => f.key === fieldKey);
      if (field) {
        const rules = inferValidations(fieldKey, field.required);
        const error = validateField(value.value, rules);
        setValidationErrors((prev) => ({ ...prev, [fieldKey]: error || '' }));
      }
    },
    [parsedFields]
  );

  const handleJumpTo = useCallback((anchor: SourceAnchor) => {
    setActiveAnchor(anchor);
  }, []);

  const handleApproveField = useCallback((fieldKey: string) => {
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], approved: true },
    }));
    setHasChanges(true);
  }, []);

  const handleApproveAll = useCallback(async () => {
    if (!onApproveAll) return;
    const highConfidenceFields = parsedFields
      .filter((field) => {
        const value = formData[field.key];
        return value && value.confidence >= confidenceThreshold && !value.approved;
      })
      .map((field) => field.key);

    if (highConfidenceFields.length === 0) {
      alert('没有可批量通过的高置信度字段');
      return;
    }
    if (!confirm(`确定要批量通过 ${highConfidenceFields.length} 个高置信度字段吗？`)) return;

    try {
      await onApproveAll(highConfidenceFields);
      setFormData((prev) => {
        const updated = { ...prev };
        highConfidenceFields.forEach((key: string) => {
          if (updated[key]) updated[key] = { ...updated[key], approved: true };
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to approve all:', error);
      alert('批量通过失败');
    }
  }, [formData, parsedFields, confidenceThreshold, onApproveAll]);

  const handleSave = useCallback(async () => {
    const errors = validateAllFields(formData);
    if (Object.keys(errors).length > 0) {
      alert('请修正所有错误后再保存');
      return;
    }

    const corrections: Partial<CorrectionRecord>[] = [];
    parsedFields.forEach((field) => {
      const currentValue = formData[field.key];
      const originalValue = ocrResult.extractedData[field.key];
      if (currentValue && originalValue && String(currentValue.value) !== String(originalValue.value)) {
        corrections.push({
          documentId,
          fieldKey: field.key,
          originalValue: String(originalValue.value ?? ''),
          correctedValue: String(currentValue.value ?? ''),
          originalConfidence: originalValue.confidence,
        });
      }
    });

    if (corrections.length === 0 && !hasChanges) {
      alert('没有需要保存的更改');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveCorrections(corrections);
      setHasChanges(false);
      alert('保存成功');
    } catch (error) {
      console.error('Failed to save corrections:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, ocrResult, parsedFields, documentId, hasChanges, validateAllFields, onSaveCorrections]);

  const stats = useMemo(() => {
    const total = parsedFields.length;
    const lowConfidence = parsedFields.filter((field) => {
      const value = formData[field.key];
      return value && value.confidence < confidenceThreshold && !value.approved;
    }).length;
    const approved = parsedFields.filter((field) => formData[field.key]?.approved).length;
    const errors = Object.keys(validationErrors).filter((key) => validationErrors[key]).length;
    return { total, lowConfidence, approved, errors };
  }, [parsedFields, formData, confidenceThreshold, validationErrors]);

  return (
    <div className="flex h-[calc(100vh-100px)] bg-gray-50">
      <div className="w-1/2 min-w-[500px] p-4">
        <DocumentPreviewPanel imageUrl={imageUrl} activeAnchor={activeAnchor} />
      </div>

      <div className="flex-1 flex flex-col min-w-[500px] border-l border-gray-200">
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{materialConfig.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{materialConfig.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4">
                <p className="text-sm text-gray-600">
                  整体置信度:{' '}
                  <span className={`font-semibold ${ocrResult.overallConfidence >= confidenceThreshold ? 'text-green-600' : 'text-yellow-600'}`}>
                    {Math.round(ocrResult.overallConfidence * 100)}%
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {stats.lowConfidence} 个字段需关注 | {stats.approved} 个已确认 | {stats.errors} 个错误
                </p>
              </div>
              <button
                onClick={handleApproveAll}
                disabled={stats.lowConfidence === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                全部通过
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {Object.entries(groupedFields).map(([groupName, fields]) => {
            const lowConfidenceCount = fields.filter((field) => {
              const value = formData[field.key];
              return value && value.confidence < confidenceThreshold && !value.approved;
            }).length;

            return (
              <FieldGroupPanel
                key={groupName}
                title={groupName}
                fields={fields}
                lowConfidenceCount={lowConfidenceCount}
                defaultExpanded={lowConfidenceCount > 0}
              >
                <div className="grid grid-cols-1 gap-4">
                  {fields.map((field) => (
                    <DynamicFieldInput
                      key={field.key}
                      field={field}
                      value={formData[field.key]}
                      threshold={confidenceThreshold}
                      onChange={(value) => handleFieldChange(field.key, value)}
                      onJumpTo={handleJumpTo}
                      onApprove={() => handleApproveField(field.key)}
                      error={validationErrors[field.key]}
                    />
                  ))}
                </div>
              </FieldGroupPanel>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {hasChanges && <span className="text-yellow-600">有未保存的更改</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              重置
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '保存中...' : '保存修正'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentReviewPage;
