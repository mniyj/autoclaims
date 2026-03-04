import React from 'react';
import { X, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { ClassificationResult } from '../types';

interface ClassificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  classification: ClassificationResult | null;
  alternatives: ClassificationResult[];
  onConfirm: (materialId: string) => void;
  onSelectAlternative: (materialId: string) => void;
}

export const ClassificationModal: React.FC<ClassificationModalProps> = ({
  isOpen,
  onClose,
  classification,
  alternatives,
  onConfirm,
  onSelectAlternative,
}) => {
  if (!isOpen || !classification) return null;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.85) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (confidence >= 0.6) return <HelpCircle className="w-5 h-5 text-yellow-600" />;
    return <AlertCircle className="w-5 h-5 text-red-600" />;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      identity: '身份材料',
      medical: '医疗材料',
      accident: '事故材料',
      income: '收入材料',
      other: '其他材料',
    };
    return labels[category] || category;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            材料分类确认
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Primary Classification */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">系统识别结果</span>
              <div className="flex items-center gap-1">
                {getConfidenceIcon(classification.confidence)}
                <span className={`text-sm font-medium ${getConfidenceColor(classification.confidence)}`}>
                  {Math.round(classification.confidence * 100)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {classification.materialName}
                </span>
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  {getCategoryLabel(classification.category)}
                </span>
              </div>

              {!classification.isConfident && (
                <p className="text-sm text-yellow-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  置信度较低，请确认或选择其他类型
                </p>
              )}
            </div>
          </div>

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">其他可能的类型：</p>
              <div className="space-y-2">
                {alternatives.map((alt) => (
                  <button
                    key={alt.materialId}
                    onClick={() => onSelectAlternative(alt.materialId)}
                    className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{alt.materialName}</span>
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {getCategoryLabel(alt.category)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {Math.round(alt.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(classification.materialId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            确认此类型
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassificationModal;