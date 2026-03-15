import React, { useState, useEffect } from 'react';
import Pagination from '../ui/Pagination';
import Modal from '../ui/Modal';

interface VersionRecord {
  version_id: string;
  entity_type: string;
  entity_id: string;
  version: string;
  data: any;
  change_summary: string;
  created_by: string;
  created_at: string;
  status: 'draft' | 'published' | 'rolled_back';
}

const ENTITY_TYPES = [
  { value: 'drug', label: '药品' },
  { value: 'service_item', label: '诊疗项目' },
  { value: 'disease', label: '疾病' },
  { value: 'hospital', label: '医院' },
  { value: 'alias', label: '别名映射' },
  { value: 'rule', label: '规则' },
  { value: 'relationship', label: '关系' },
];

const VersionManagementPage: React.FC = () => {
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEntityType, setFilterEntityType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[VersionRecord | null, VersionRecord | null]>([null, null]);

  useEffect(() => {
    loadVersions();
  }, [filterEntityType]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEntityType) params.append('entityType', filterEntityType);
      
      const response = await fetch(`/api/knowledge/versions?${params}`);
      const data = await response.json();
      if (data.success) {
        setVersions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVersions = versions;
  const totalPages = Math.ceil(filteredVersions.length / itemsPerPage);
  const paginatedVersions = filteredVersions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePublish = async (versionId: string) => {
    if (!confirm('确定要发布此版本吗？发布后将对系统生效。')) return;
    
    try {
      await fetch(`/api/knowledge/versions/${versionId}/publish`, { method: 'POST' });
      loadVersions();
    } catch (error) {
      console.error('Failed to publish version:', error);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!confirm('确定要回滚到此版本吗？这将撤销后续的所有更改。')) return;
    
    try {
      await fetch(`/api/knowledge/versions/${versionId}/rollback`, { method: 'POST' });
      loadVersions();
    } catch (error) {
      console.error('Failed to rollback version:', error);
    }
  };

  const handleCompare = (v1: VersionRecord, v2: VersionRecord) => {
    setCompareVersions([v1, v2]);
    setIsCompareModalOpen(true);
  };

  const getStatusBadge = (status?: string) => {
    const config: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-green-100 text-green-800',
      rolled_back: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      draft: '草稿',
      published: '已发布',
      rolled_back: '已回滚',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${config[status || ''] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status || ''] || status}
      </span>
    );
  };

  const getEntityTypeLabel = (type?: string) => {
    return ENTITY_TYPES.find(o => o.value === type)?.label || type || '-';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">版本管理</h1>
        <p className="text-gray-600 mt-1">管理知识库数据版本，支持版本比对、发布和回滚</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">实体类型</label>
            <select
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部</option>
              {ENTITY_TYPES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-blue-800"><strong>版本统计:</strong></span>
                <span>草稿: {versions.filter(v => v.status === 'draft').length}</span>
                <span>已发布: {versions.filter(v => v.status === 'published').length}</span>
                <span>已回滚: {versions.filter(v => v.status === 'rolled_back').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">版本ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">实体类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">实体ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">版本号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">变更摘要</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">加载中...</td></tr>
              ) : paginatedVersions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">暂无版本记录</td></tr>
              ) : (
                paginatedVersions.map((version) => (
                  <tr key={version.version_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{version.version_id}</td>
                    <td className="px-4 py-3 text-sm">{getEntityTypeLabel(version.entity_type)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{version.entity_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{version.version}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={version.change_summary}>
                      {version.change_summary}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{version.created_by}</td>
                    <td className="px-4 py-3">{getStatusBadge(version.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {version.status === 'draft' && (
                          <button 
                            onClick={() => handlePublish(version.version_id)} 
                            className="text-green-600 hover:text-green-800 text-xs px-2 py-1 bg-green-50 rounded"
                          >
                            发布
                          </button>
                        )}
                        {version.status === 'published' && (
                          <button 
                            onClick={() => handleRollback(version.version_id)} 
                            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-red-50 rounded"
                          >
                            回滚
                          </button>
                        )}
                        <button className="text-blue-600 hover:text-blue-800">查看</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredVersions.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        title="版本比对"
        width="max-w-4xl"
        footer={
          <div className="flex justify-end">
            <button onClick={() => setIsCompareModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">关闭</button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">版本 A</h3>
            {compareVersions[0] ? (
              <div className="space-y-2 text-sm">
                <div><strong>版本号:</strong> {compareVersions[0].version}</div>
                <div><strong>创建时间:</strong> {formatDate(compareVersions[0].created_at)}</div>
                <div className="mt-4 p-3 bg-gray-50 rounded text-xs font-mono overflow-auto max-h-[300px]">
                  {JSON.stringify(compareVersions[0].data, null, 2)}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">请选择版本A</p>
            )}
          </div>
          
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">版本 B</h3>
            {compareVersions[1] ? (
              <div className="space-y-2 text-sm">
                <div><strong>版本号:</strong> {compareVersions[1].version}</div>
                <div><strong>创建时间:</strong> {formatDate(compareVersions[1].created_at)}</div>
                <div className="mt-4 p-3 bg-gray-50 rounded text-xs font-mono overflow-auto max-h-[300px]">
                  {JSON.stringify(compareVersions[1].data, null, 2)}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">请选择版本B</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VersionManagementPage;
