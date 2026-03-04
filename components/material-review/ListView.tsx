import React, { useState, useMemo } from 'react';
import { MaterialViewItem, MaterialCategory, MaterialCategoryLabels } from '../../types/material-review';

interface ListViewProps {
  materials: MaterialViewItem[];
  onSelect: (material: MaterialViewItem) => void;
  selectedId?: string;
}

type SortField = 'name' | 'category' | 'time' | 'status';
type SortOrder = 'asc' | 'desc';

const ListView: React.FC<ListViewProps> = ({
  materials,
  onSelect,
  selectedId,
}) => {
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterCategory, setFilterCategory] = useState<MaterialCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'failed' | 'unknown'>('all');
  
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      if (filterCategory !== 'all' && m.category !== filterCategory) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'unknown') return m.classification?.materialId === 'unknown';
        return m.status === filterStatus;
      }
      return true;
    });
  }, [materials, filterCategory, filterStatus]);
  
  const sortedMaterials = useMemo(() => {
    return [...filteredMaterials].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'time':
          comparison = a.sortTimestamp - b.sortTimestamp;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredMaterials, sortField, sortOrder]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  
  const getStatusLabel = (material: MaterialViewItem): string => {
    if (material.status !== 'completed') return '失败';
    if (material.classification?.materialId === 'unknown') return '未识别';
    return '已识别';
  };
  
  const getStatusColor = (material: MaterialViewItem): string => {
    if (material.status !== 'completed') return 'text-red-600';
    if (material.classification?.materialId === 'unknown') return 'text-gray-500';
    return 'text-green-600';
  };
  
  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <p className="text-sm">暂无材料</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="text-xs text-gray-500 block mb-1">类型筛选</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as MaterialCategory | 'all')}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white"
          >
            <option value="all">全部</option>
            {Object.entries(MaterialCategoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">状态筛选</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white"
          >
            <option value="all">全部</option>
            <option value="completed">已识别</option>
            <option value="unknown">未识别</option>
            <option value="failed">失败</option>
          </select>
        </div>
        
        <div className="ml-auto text-sm text-gray-500">
          共 {sortedMaterials.length} 个材料
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">序号</th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                材料名称 {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('category')}
              >
                类型 {sortField === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('time')}
              >
                上传时间 {sortField === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                状态 {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">置信度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedMaterials.map((material, index) => (
              <tr
                key={material.documentId}
                onClick={() => onSelect(material)}
                className={`cursor-pointer hover:bg-gray-50 ${
                  selectedId === material.documentId ? 'bg-indigo-50' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{material.fileName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{MaterialCategoryLabels[material.category]}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(material.sortTimestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className={`px-4 py-3 text-sm font-medium ${getStatusColor(material)}`}>
                  {getStatusLabel(material)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {material.documentSummary?.confidence !== undefined
                    ? `${Math.round(material.documentSummary.confidence * 100)}%`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListView;
