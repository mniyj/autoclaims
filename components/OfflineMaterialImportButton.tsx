import React from 'react';

interface OfflineMaterialImportButtonProps {
  onClick: () => void;
}

/**
 * 离线材料导入浮动按钮
 * 固定在页面右下角，点击打开导入对话框
 */
const OfflineMaterialImportButton: React.FC<OfflineMaterialImportButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center space-x-2 z-40 transition-all hover:scale-105"
      title="离线材料导入"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      <span>离线材料导入</span>
    </button>
  );
};

export default OfflineMaterialImportButton;
