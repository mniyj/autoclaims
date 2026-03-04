import React from 'react';
import { MaterialViewMode } from '../../types/material-review';

interface ViewSwitcherProps {
  currentView: MaterialViewMode;
  onViewChange: (view: MaterialViewMode) => void;
  materialCount: number;
}

const views: Array<{
  mode: MaterialViewMode;
  label: string;
  icon: string;
}> = [
  { mode: 'category', label: '分类展示', icon: 'M4 6h16M4 12h16M4 18h16' },
  { mode: 'timeline', label: '时间轴', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { mode: 'list', label: '清单列表', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { mode: 'ai_review', label: 'AI审核', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
];

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  onViewChange,
  materialCount,
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {views.map((view) => (
          <button
            key={view.mode}
            onClick={() => onViewChange(view.mode)}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentView === view.mode
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={view.icon}
              />
            </svg>
            {view.label}
            {view.mode === currentView && materialCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                {materialCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ViewSwitcher;
