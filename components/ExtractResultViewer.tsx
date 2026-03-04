import React from 'react';
import { CheckCircle, AlertCircle, XCircle, AlertTriangle } from 'lucide-react';
import { MaterialAuditConclusion, AuditChecklistItem, AuditIssue } from '../types';

interface ExtractResultViewerProps {
  conclusion: MaterialAuditConclusion | null;
  extractedData?: Record<string, any>;
  onEdit?: (field: string, value: any) => void;
}

export const ExtractResultViewer: React.FC<ExtractResultViewerProps> = ({
  conclusion,
  extractedData,
  onEdit,
}) => {
  if (!conclusion) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无提取结果
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'suspicious':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'incomplete':
        return <AlertCircle className="w-6 h-6 text-orange-500" />;
      default:
        return <HelpCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'suspicious':
        return 'bg-yellow-50 border-yellow-200';
      case 'incomplete':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getChecklistIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skip':
        return <span className="text-gray-400 text-xs">跳过</span>;
      default:
        return null;
    }
  };

  const getIssueIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* Conclusion Header */}
      <div className={`p-4 rounded-lg border ${getStatusColor(conclusion.conclusion)}`}>
        <div className="flex items-start gap-3">
          {getStatusIcon(conclusion.conclusion)}
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">
              {conclusion.conclusionLabel}
            </h4>
            <p className="text-sm text-gray-600 mt-1">{conclusion.details}</p>
            {conclusion.recommendation && (
              <p className="text-sm text-gray-700 mt-2 font-medium">
                建议：{conclusion.recommendation}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Checklist */}
      {conclusion.checklist.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h5 className="font-medium text-gray-900 mb-3">检查清单</h5>
          <div className="space-y-2">
            {conclusion.checklist.map((item: AuditChecklistItem, index: number) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm"
              >
                {getChecklistIcon(item.status)}
                <span className="flex-1 text-gray-700">{item.item}</span>
                {item.message && (
                  <span className="text-gray-500 text-xs">{item.message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {conclusion.issues && conclusion.issues.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h5 className="font-medium text-gray-900 mb-3">发现的问题</h5>
          <div className="space-y-3">
            {conclusion.issues.map((issue: AuditIssue, index: number) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-gray-50 rounded"
              >
                {getIssueIcon(issue.severity)}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {issue.field && <span className="text-gray-500">[{issue.field}] </span>}
                    {issue.message}
                  </p>
                  {issue.suggestion && (
                    <p className="text-xs text-gray-600 mt-1">
                      建议：{issue.suggestion}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Data */}
      {extractedData && Object.keys(extractedData).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h5 className="font-medium text-gray-900 mb-3">提取的字段</h5>
          <div className="space-y-2">
            {Object.entries(extractedData).map(([key, value]) => (
              <div
                key={key}
                className="flex items-start gap-2 py-2 border-b last:border-0"
              >
                <span className="text-sm font-medium text-gray-600 min-w-[120px]">{key}</span>
                <span className="text-sm text-gray-900 flex-1 break-all">{formatValue(value)}</span>
                {onEdit && (
                  <button
                    onClick={() => onEdit(key, value)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    编辑
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Missing imports
import { HelpCircle, Info } from 'lucide-react';

export default ExtractResultViewer;