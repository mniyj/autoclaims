import React, { useState, useEffect } from 'react';
import Pagination from '../ui/Pagination';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

interface Relationship {
  rel_id: string;
  rel_type: 'disease_drug' | 'disease_service' | 'surgery_combo' | 'policy_coverage';
  subject_id: string;
  subject_name?: string;
  object_id: string;
  object_name?: string;
  relation: 'recommended' | 'optional' | 'not_recommended' | 'contraindicated' | 'required';
  evidence_level?: number;
  confidence?: number;
  status: 'active' | 'inactive';
}

const RELATIONSHIP_TYPES = [
  { value: 'disease_drug', label: '疾病-药品关系', icon: '💊', description: '疾病与药品的关联关系' },
  { value: 'disease_service', label: '疾病-项目关系', icon: '🩺', description: '疾病与诊疗项目的关联关系' },
  { value: 'surgery_combo', label: '手术组合关系', icon: '🔧', description: '手术与配套项目的关系' },
  { value: 'policy_coverage', label: '产品覆盖关系', icon: '📋', description: '产品与费用项目的覆盖关系' },
];

const RELATION_OPTIONS = [
  { value: 'recommended', label: '推荐', color: 'bg-green-100 text-green-800' },
  { value: 'optional', label: '可选', color: 'bg-blue-100 text-blue-800' },
  { value: 'not_recommended', label: '不推荐', color: 'bg-orange-100 text-orange-800' },
  { value: 'contraindicated', label: '禁忌', color: 'bg-red-100 text-red-800' },
  { value: 'required', label: '必需', color: 'bg-purple-100 text-purple-800' },
];

const RelationshipManagementPage: React.FC = () => {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('disease_drug');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRel, setEditingRel] = useState<Partial<Relationship> | null>(null);

  useEffect(() => {
    loadRelationships();
  }, [selectedType]);

  const loadRelationships = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge/relationships?type=${selectedType}`);
      const data = await response.json();
      if (data.success) {
        setRelationships(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load relationships:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRels = relationships.filter(r => r.rel_type === selectedType);
  const totalPages = Math.ceil(filteredRels.length / itemsPerPage);
  const paginatedRels = filteredRels.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAdd = () => {
    setEditingRel({
      rel_id: '',
      rel_type: selectedType as any,
      relation: 'recommended',
      evidence_level: 3,
      confidence: 0.8,
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (rel: Relationship) => {
    setEditingRel({ ...rel });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingRel) return;
    
    try {
      const url = editingRel.rel_id 
        ? `/api/knowledge/relationships/${editingRel.rel_id}`
        : '/api/knowledge/relationships';
      const method = editingRel.rel_id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRel),
      });

      if (response.ok) {
        setIsModalOpen(false);
        loadRelationships();
      }
    } catch (error) {
      console.error('Failed to save relationship:', error);
    }
  };

  const handleDelete = async (relId: string) => {
    if (!confirm('确定要删除此关系吗？')) return;
    
    try {
      await fetch(`/api/knowledge/relationships/${relId}`, { method: 'DELETE' });
      loadRelationships();
    } catch (error) {
      console.error('Failed to delete relationship:', error);
    }
  };

  const getRelationBadge = (relation?: string) => {
    const config = RELATION_OPTIONS.find(o => o.value === relation);
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${config?.color || 'bg-gray-100 text-gray-800'}`}>
        {config?.label || relation || '-'}
      </span>
    );
  };

  const getTypeLabel = (type?: string) => {
    return RELATIONSHIP_TYPES.find(o => o.value === type)?.label || type || '-';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">关系图谱管理</h1>
        <p className="text-gray-600 mt-1">管理疾病、药品、项目之间的关联关系</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {RELATIONSHIP_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => {
              setSelectedType(type.value);
              setCurrentPage(1);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedType === type.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{type.icon}</span>
              <span className={`font-medium ${
                selectedType === type.value ? 'text-blue-900' : 'text-gray-900'
              }`}>
                {type.label}
              </span>
            </div>
            <p className="text-xs text-gray-500">{type.description}</p>
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{getTypeLabel(selectedType)}</h2>
            <p className="text-sm text-gray-500 mt-1">共 {filteredRels.length} 条关系</p>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增关系
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">关系ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">主体</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">对象</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">关系类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">证据等级</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">加载中...</td></tr>
              ) : paginatedRels.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">暂无关系数据</td></tr>
              ) : (
                paginatedRels.map((rel) => (
                  <tr key={rel.rel_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{rel.rel_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{rel.subject_name || rel.subject_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{rel.object_name || rel.object_id}</td>
                    <td className="px-4 py-3">{getRelationBadge(rel.relation)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{rel.evidence_level}/5</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        rel.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {rel.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(rel)} className="text-blue-600 hover:text-blue-800">编辑</button>
                        <button onClick={() => handleDelete(rel.rel_id)} className="text-red-600 hover:text-red-800">删除</button>
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
            totalItems={filteredRels.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRel?.rel_id ? '编辑关系' : '新增关系'}
        width="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
          </div>
        }
      >
        {editingRel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="关系ID" id="rel_id" value={editingRel.rel_id || ''} onChange={(e) => setEditingRel({ ...editingRel, rel_id: e.target.value })} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关系类型</label>
                <select 
                  value={editingRel.rel_type || ''} 
                  onChange={(e) => setEditingRel({ ...editingRel, rel_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={!!editingRel.rel_id}
                >
                  {RELATIONSHIP_TYPES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="主体ID" id="subject_id" value={editingRel.subject_id || ''} onChange={(e) => setEditingRel({ ...editingRel, subject_id: e.target.value })} required />
              <Input label="主体名称" id="subject_name" value={editingRel.subject_name || ''} onChange={(e) => setEditingRel({ ...editingRel, subject_name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="对象ID" id="object_id" value={editingRel.object_id || ''} onChange={(e) => setEditingRel({ ...editingRel, object_id: e.target.value })} required />
              <Input label="对象名称" id="object_name" value={editingRel.object_name || ''} onChange={(e) => setEditingRel({ ...editingRel, object_name: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关系</label>
                <select 
                  value={editingRel.relation || ''} 
                  onChange={(e) => setEditingRel({ ...editingRel, relation: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {RELATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Input label="证据等级 (1-5)" id="evidence_level" type="number" min="1" max="5" value={editingRel.evidence_level || ''} onChange={(e) => setEditingRel({ ...editingRel, evidence_level: Number(e.target.value) })} />
              <Input label="置信度 (0-1)" id="confidence" type="number" step="0.1" min="0" max="1" value={editingRel.confidence || ''} onChange={(e) => setEditingRel({ ...editingRel, confidence: Number(e.target.value) })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select 
                value={editingRel.status || 'active'} 
                onChange={(e) => setEditingRel({ ...editingRel, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RelationshipManagementPage;
