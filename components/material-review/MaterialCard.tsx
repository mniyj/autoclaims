import React from 'react';
import { MaterialViewItem, getMaterialStatusInfo, getConfidenceStyle } from '../../types/material-review';

interface MaterialCardProps {
  material: MaterialViewItem;
  isSelected?: boolean;
  onClick?: () => void;
}

const MaterialCard: React.FC<MaterialCardProps> = ({
  material,
  isSelected = false,
  onClick,
}) => {
  const statusInfo = getMaterialStatusInfo(material);
  const docConfidenceStyle = getConfidenceStyle(
    material.documentSummary?.confidence
  );
  const classConfidenceStyle = getConfidenceStyle(
    material.classification?.confidence
  );
  
  const statusColors = {
    green: 'bg-green-100 text-green-700 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {material.fileName}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {material.classification?.materialName || '未识别材料'}
          </p>
          {material.classification?.errorMessage && (
            <p className="text-xs text-red-600 mt-0.5 truncate">
              分类失败: {material.classification.errorMessage}
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[statusInfo.color]}`}>
              {statusInfo.label}
            </span>
            
            {material.classification?.confidence !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded ${classConfidenceStyle.bgClass} ${classConfidenceStyle.colorClass}`}>
                分类 {Math.round(material.classification.confidence * 100)}%
              </span>
            )}
            
            {material.documentSummary?.confidence !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded ${docConfidenceStyle.bgClass} ${docConfidenceStyle.colorClass}`}>
                解析 {Math.round(material.documentSummary.confidence * 100)}%
              </span>
            )}
          </div>
          
          <p className="text-xs text-gray-400 mt-2">
            {formatDate(material.sortTimestamp)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaterialCard;
