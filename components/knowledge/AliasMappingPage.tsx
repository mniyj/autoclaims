import React, { useState, useEffect, useMemo } from 'react';
import Pagination from '../ui/Pagination';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

interface AliasMapping {
  alias_id: string;
  alias_text: string;
  entity_type: 'drug' | 'service_item' | 'disease' | 'hospital';
  entity_id: string;
  entity_name?: string;
  source: string;
  confidence: number;
  status: 'pending' | 'active' | 'rejected';
  created_by?: string;
  created_at: string;
}

const ENTITY_TYPE_OPTIONS = [
  { value: 'drug', label: '药品', icon: '💊' },
  { value: 'service_item', label: '诊疗项目', icon: '🩺' },
  { value: 'disease', label: '疾病', icon: '🏥' },
  { value: 'hospital', label: '医院', icon: '🏨' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'active', label: '已通过', color: 'bg-green-100 text-green-800' },
  { value: 'rejected', label: '已驳回', color: 'bg-red-100 text-red-800' },
];

const AliasMappingPage: React.FC = () => {
  const [aliases, setAliases] = useState<AliasMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<Partial<AliasMapping> | null>(null);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    loadAliases();
  }, []);

  const loadAliases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (filterEntityType) params.append('entityType', filterEntityType);
      if (filterStatus) params.append('status', filterStatus);
      
      const response = await fetch(`/api/knowledge/alias/mappings?${params}`);
      const data = await response.json();
      if (data.success) {
        setAliases(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load aliases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAliases = useMemo(() => {
    let result = [...aliases];
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(alias =>
        alias.alias_text.toLowerCase().includes(lowerQuery) ||
        alias.entity_name?.toLowerCase().includes(lowerQuery)
      );
    }

    if (filterEntityType) {
      result = result.filter(alias => alias.entity_type === filterEntityType);
    }

    if (filterStatus) {
      result = result.filter(alias => alias.status === filterStatus);
    }

    return result;
  }, [aliases, searchQuery, filterEntityType, filterStatus]);

  const totalPages = Math.ceil(filteredAliases.length / itemsPerPage);
  const paginatedAliases = filteredAliases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAdd = () => {
    setEditingAlias({
      alias_id: '',
      alias_text: '',
      entity_type: 'drug',
      entity_id: '',
      source: 'manual',
      confidence: 0.9,
      status: 'pending',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (alias: AliasMapping) => {
    setEditingAlias({ ...alias });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingAlias) return;
    
    try {
      const url = editingAlias.alias_id 
        ? `/api/knowledge/aliases/${editingAlias.alias_id}`
        : '/api/knowledge/aliases';
      const method = editingAlias.alias_id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAlias),
      });

      if (response.ok) {
        setIsModalOpen(false);
        loadAliases();
      }
    } catch (error) {
      console.error('Failed to save alias:', error);
    }
  };

  const handleApprove = async (aliasId: string) => {
    try {
      await fetch(`/api/knowledge/aliases/${aliasId}/approve`, { method: 'POST' });
      loadAliases();
    } catch (error) {
      console.error('Failed to approve alias:', error);
    }
  };

  const handleReject = async (aliasId: string) => {
    try {
      await fetch(`/api/knowledge/aliases/${aliasId}/reject`, { method: 'POST' });
      loadAliases();
    } catch (error) {
      console.error('Failed to reject alias:', error);
    }
  };

  const handleDelete = async (aliasId: string) => {
    if (!confirm('确定要删除此别名映射吗？')) return;
    
    try {
      await fetch(`/api/knowledge/aliases/${aliasId}`, { method: 'DELETE' });
      loadAliases();
    } catch (error) {
      console.error('Failed to delete alias:', error);
    }
  };

  const handleTestNormalize = async () => {
    if (!testText.trim()) return;
    
    try {
      const response = await fetch('/api/knowledge/alias/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawName: testText }),
      });
      const data = await response.json();
      setTestResult(data.data);
    } catch (error) {
      console.error('Failed to test normalize:', error);
    }
  };

  const getEntityTypeLabel = (type?: string) => {
    return ENTITY_TYPE_OPTIONS.find(o => o.value === type)?.label || type || '-';
  };

  const getStatusBadge = (status?: string) => {
    const config = STATUS_OPTIONS.find(o => o.value === status);
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${config?.color || 'bg-gray-100 text-gray-800'}`}>
        {config?.label || status || '-'}
      </span>
    );
  };

  const pendingCount = aliases.filter(a => a.status === 'pending').length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">别名映射管理</h1>
            <p className="text-gray-600 mt-1">管理理赔材料原始名称到标准实体的映射关系</p>
          </div>
          {pendingCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
              <span className="text-yellow-800 font-medium">待审核: {pendingCount} 条</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">标准化测试</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="输入测试文本，如：阿莫仙"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestNormalize()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleTestNormalize}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              测试
            </button>
          </div>
          {testResult && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm">
              <div className="flex gap-4">
                <span><strong>原始:</strong> {testText}</span>
                <span><strong>标准化:</strong> {testResult.normalized || '未找到'}</span>
                <span><strong>置信度:</strong> {testResult.confidence ? `${Math.round(testResult.confidence * 100)}%` : '-'}</span>
                <span><strong>来源:</strong> {testResult.source || '-'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              placeholder="搜索别名、标准实体名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">实体类型</label>
            <select
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部</option>
              {ENTITY_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部</option>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新增映射
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">别名文本</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">实体类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标准实体</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">置信度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">加载中...</td></tr>
              ) : paginatedAliases.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">暂无数据</td></tr>
              ) : (
                paginatedAliases.map((alias) => (
                  <tr key={alias.alias_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{alias.alias_text}</td>
                    <td className="px-4 py-3 text-sm">{getEntityTypeLabel(alias.entity_type)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{alias.entity_name || alias.entity_id}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${alias.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(alias.confidence * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{alias.source}</td>
                    <td className="px-4 py-3">{getStatusBadge(alias.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {alias.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleApprove(alias.alias_id)} 
                              className="text-green-600 hover:text-green-800 text-xs px-2 py-1 bg-green-50 rounded"
                            >
                              通过
                            </button>
                            <button 
                              onClick={() => handleReject(alias.alias_id)} 
                              className="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-red-50 rounded"
                            >
                              驳回
                            </button>
                          </>
                        )}
                        <button onClick={() => handleEdit(alias)} className="text-blue-600 hover:text-blue-800">编辑</button>
                        <button onClick={() => handleDelete(alias.alias_id)} className="text-red-600 hover:text-red-800">删除</button>
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
            totalItems={filteredAliases.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAlias?.alias_id ? '编辑别名映射' : '新增别名映射'}
        width="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
          </div>
        }
      >
        {editingAlias && (
          <div className="space-y-4">
            <Input 
              label="别名文本" 
              id="alias_text" 
              value={editingAlias.alias_text || ''} 
              onChange={(e) => setEditingAlias({ ...editingAlias, alias_text: e.target.value })} 
              required 
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">实体类型</label>
              <select 
                value={editingAlias.entity_type || ''} 
                onChange={(e) => setEditingAlias({ ...editingAlias, entity_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {ENTITY_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="实体ID" 
                id="entity_id" 
                value={editingAlias.entity_id || ''} 
                onChange={(e) => setEditingAlias({ ...editingAlias, entity_id: e.target.value })} 
                required 
              />
              <Input 
                label="实体名称（可选）" 
                id="entity_name" 
                value={editingAlias.entity_name || ''} 
                onChange={(e) => setEditingAlias({ ...editingAlias, entity_name: e.target.value })} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="置信度 (0-1)" 
                id="confidence" 
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={editingAlias.confidence || ''} 
                onChange={(e) => setEditingAlias({ ...editingAlias, confidence: Number(e.target.value) })} 
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
                <select 
                  value={editingAlias.source || 'manual'} 
                  onChange={(e) => setEditingAlias({ ...editingAlias, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="manual">人工录入</option>
                  <option value="auto">自动识别</option>
                  <option value="import">批量导入</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select 
                value={editingAlias.status || 'pending'} 
                onChange={(e) => setEditingAlias({ ...editingAlias, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AliasMappingPage;
