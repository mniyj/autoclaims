import React, { useState, useCallback } from 'react';
import { OCRFieldValue, ParsedSchemaField, SourceAnchor } from '../../types';
import { validateField, inferValidations } from '../../utils/validation';

interface DynamicFieldInputProps {
  field: ParsedSchemaField;
  value: OCRFieldValue;
  threshold: number;
  onChange: (value: OCRFieldValue) => void;
  onJumpTo?: (anchor: SourceAnchor) => void;
  onApprove?: () => void;
  error?: string;
}

const getConfidenceColor = (confidence: number, threshold: number): string => {
  if (confidence >= 0.9) return 'text-green-600';
  if (confidence >= threshold) return 'text-blue-600';
  return 'text-yellow-600';
};

const getConfidenceBgColor = (confidence: number, threshold: number): string => {
  if (confidence >= 0.9) return 'bg-green-50 border-green-200';
  if (confidence >= threshold) return 'bg-blue-50 border-blue-200';
  return 'bg-yellow-50 border-yellow-400';
};

export const DynamicFieldInput: React.FC<DynamicFieldInputProps> = ({
  field,
  value,
  threshold,
  onChange,
  onJumpTo,
  onApprove,
  error,
}) => {
  const [localValue, setLocalValue] = useState(
    value?.value != null ? String(value.value) : ''
  );

  const confidence = value?.confidence ?? 0;
  const isLowConfidence = confidence < threshold;
  const isApproved = value?.approved ?? false;
  const anchor = value?.anchor;

  const validationRules = inferValidations(field.key, field.required);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);

      const typedValue =
        field.type === 'number'
          ? newValue === ''
            ? null
            : parseFloat(newValue)
          : field.type === 'boolean'
          ? newValue === 'true'
          : newValue;

      const validationError = validateField(typedValue, validationRules);

      onChange({
        ...value,
        value: typedValue,
        approved: false,
      });
    },
    [field.type, value, onChange, validationRules]
  );

  const handleBlur = () => {
    const typedValue =
      field.type === 'number'
        ? localValue === ''
          ? null
          : parseFloat(localValue)
        : field.type === 'boolean'
        ? localValue === 'true'
        : localValue;

    onChange({
      ...value,
      value: typedValue,
    });
  };

  const renderInput = () => {
    const baseClassName = `
      w-full px-3 py-2 border rounded-md text-sm
      focus:outline-none focus:ring-2 focus:ring-blue-500
      ${error ? 'border-red-500' : 'border-gray-300'}
      ${isLowConfidence && !isApproved ? getConfidenceBgColor(confidence, threshold) : 'bg-white'}
    `;

    switch (field.type) {
      case 'boolean':
        return (
          <select
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            className={baseClassName}
            disabled={isApproved}
          >
            <option value="">请选择</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className={baseClassName}
            disabled={isApproved}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className={baseClassName}
            placeholder={field.description}
            disabled={isApproved}
          />
        );

      default:
        return (
          <input
            type="text"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className={baseClassName}
            placeholder={field.description}
            disabled={isApproved}
          />
        );
    }
  };

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all duration-200
        ${isLowConfidence && !isApproved ? 'border-yellow-400 bg-yellow-50/30' : 'border-gray-200'}
        ${isApproved ? 'bg-green-50/50' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`
              inline-block w-2 h-2 rounded-full
              ${confidence >= 0.9 ? 'bg-green-500' : confidence >= threshold ? 'bg-blue-500' : 'bg-yellow-500'}
            `}
          />
          <label className="text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {isLowConfidence && !isApproved && (
            <span className="text-xs text-yellow-600 font-medium">低置信度</span>
          )}
          {isApproved && (
            <span className="text-xs text-green-600 font-medium">已确认</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span
            className={`
              text-xs font-medium
              ${getConfidenceColor(confidence, threshold)}
            `}
          >
            {Math.round(confidence * 100)}%
          </span>

          {anchor && onJumpTo && (
            <button
              onClick={() => onJumpTo(anchor)}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="查看源文件"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          )}

          {onApprove && !isApproved && (
            <button
              onClick={onApprove}
              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
              title="标记为已审核"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="relative">{renderInput()}</div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {field.description && !error && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
};

export default DynamicFieldInput;
