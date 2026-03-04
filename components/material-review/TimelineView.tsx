import React from 'react';
import { MaterialViewItem, groupMaterialsByTime } from '../../types/material-review';
import MaterialCard from './MaterialCard';

interface TimelineViewProps {
  materials: MaterialViewItem[];
  onSelect: (material: MaterialViewItem) => void;
  selectedId?: string;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  materials,
  onSelect,
  selectedId,
}) => {
  const grouped = groupMaterialsByTime(materials);
  
  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">暂无材料</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {grouped.map(group => (
        <div key={group.date} className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm font-medium text-gray-700 px-3 py-1 bg-gray-100 rounded-full">
              {group.label}
            </span>
            <span className="text-xs text-gray-500">
              {group.count} 个材料
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          
          <div className="pl-6 space-y-3">
            {group.materials.map(material => (
              <MaterialCard
                key={material.documentId}
                material={material}
                isSelected={selectedId === material.documentId}
                onClick={() => onSelect(material)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimelineView;
