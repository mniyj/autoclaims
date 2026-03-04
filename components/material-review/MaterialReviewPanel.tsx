import React, { useState, useMemo } from 'react';
import { MaterialViewItem, MaterialViewMode, toMaterialViewItem } from '../../types/material-review';
import { ClaimCase } from '../../types';
import ViewSwitcher from './ViewSwitcher';
import CategoryView from './CategoryView';
import TimelineView from './TimelineView';
import ListView from './ListView';
import MaterialReviewDrawer from './MaterialReviewDrawer';

interface MaterialReviewPanelProps {
  materials: MaterialViewItem[];
  claimCase: ClaimCase;
  onMaterialReviewed?: (materialId: string) => void;
}

const MaterialReviewPanel: React.FC<MaterialReviewPanelProps> = ({
  materials,
  claimCase,
  onMaterialReviewed,
}) => {
  const [currentView, setCurrentView] = useState<MaterialViewMode>('category');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialViewItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSelectMaterial = (material: MaterialViewItem) => {
    setSelectedMaterial(material);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedMaterial(null);
  };

  const handleSaveCorrections = async (corrections: any[]) => {
    if (selectedMaterial && onMaterialReviewed) {
      onMaterialReviewed(selectedMaterial.documentId);
    }
  };

  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">暂无材料</p>
        <p className="text-xs mt-1">点击右下角按钮批量导入案件材料</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ViewSwitcher
        currentView={currentView}
        onViewChange={setCurrentView}
        materialCount={materials.length}
      />

      <div className="mt-4">
        {currentView === 'category' && (
          <CategoryView
            materials={materials}
            onSelect={handleSelectMaterial}
            selectedId={selectedMaterial?.documentId}
          />
        )}

        {currentView === 'timeline' && (
          <TimelineView
            materials={materials}
            onSelect={handleSelectMaterial}
            selectedId={selectedMaterial?.documentId}
          />
        )}

        {currentView === 'list' && (
          <ListView
            materials={materials}
            onSelect={handleSelectMaterial}
            selectedId={selectedMaterial?.documentId}
          />
        )}

        {currentView === 'ai_review' && (
          <div className="p-8 text-center text-gray-500">
            <p>AI审核视图（双栏布局）将在此处显示</p>
            <p className="text-sm mt-2">请使用现有的材料审核功能</p>
          </div>
        )}
      </div>

      <MaterialReviewDrawer
        isOpen={isDrawerOpen}
        material={selectedMaterial}
        claimCase={claimCase}
        onClose={handleCloseDrawer}
        onSaveCorrections={handleSaveCorrections}
      />
    </div>
  );
};

export default MaterialReviewPanel;
