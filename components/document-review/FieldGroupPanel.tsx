import React, { useState, useMemo } from 'react';
import { ParsedSchemaField } from '../../types';

interface FieldGroupPanelProps {
  title: string;
  fields: ParsedSchemaField[];
  children: React.ReactNode;
  defaultExpanded?: boolean;
  lowConfidenceCount?: number;
}

export const FieldGroupPanel: React.FC<FieldGroupPanelProps> = ({
  title,
  fields,
  children,
  defaultExpanded = true,
  lowConfidenceCount = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const fieldCount = fields.length;
  const requiredCount = useMemo(
    () => fields.filter((f) => f.required).length,
    [fields]
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 bg-white">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button
            className="text-gray-500 hover:text-gray-700 transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <div>
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">
              共 {fieldCount} 个字段
              {requiredCount > 0 && `，${requiredCount} 个必填`}
            </p>
          </div>

          {lowConfidenceCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">
              {lowConfidenceCount} 个低置信度
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lowConfidenceCount > 0 && (
            <span className="text-xs text-yellow-600">
              需关注
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

export default FieldGroupPanel;
