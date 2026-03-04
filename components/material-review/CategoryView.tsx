import React, { useState } from 'react';
import { MaterialViewItem, groupMaterialsByCategory, MaterialCategoryLabels } from '../../types/material-review';
import MaterialCard from './MaterialCard';

interface CategoryViewProps {
  materials: MaterialViewItem[];
  onSelect: (material: MaterialViewItem) => void;
  selectedId?: string;
}

const CategoryView: React.FC<CategoryViewProps> = ({
  materials,
  onSelect,
  selectedId,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const grouped = groupMaterialsByCategory(materials);
  
  const toggleGroup = (category: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">暂无材料</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {grouped.map(group => (
        <div key={group.category} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup(group.category)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedGroups.has(group.category) ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                {group.label}
              </span>
              <span className="text-xs text-gray-500">
                ({group.count})
              </span>
            </div>
          </button>
          
          {expandedGroups.has(group.category) && (
            <div className="p-4 space-y-3">
              {group.materials.map(material => (
                <MaterialCard
                  key={material.documentId}
                  material={material}
                  isSelected={selectedId === material.documentId}
                  onClick={() => onSelect(material)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CategoryView;
