import React, { useState, useEffect, useMemo } from 'react';
import Pagination from '../ui/Pagination';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

interface Disease {
  disease_id: string;
  standard_name: string;
  aliases: string[];
  icd_code?: string;
  severity_level?: '轻微' | '一般' | '严重' | '危重';
  common_tests?: string[];
  common_treatments?: string[];
  common_drugs?: string[];
  typical_los_min?: number;
  typical_los_max?: number;
  inpatient_necessity_flag?: boolean;
  status: 'active' | 'inactive';
}

const SEVERITY_OPTIONS = [
  { value: '轻微', label: '轻微', color: 'bg-green-100 text-green-800' },
  { value: '一般', label: '一般', color: 'bg-blue-100 text-blue-800' },
  { value: '严重', label: '严重', color: 'bg-orange-100 text-orange-800' },
  { value: '危重', label: '危重', color: 'bg-red-100 text-red-800' },
];

const DiseaseManagementPage: React.FC = () => {
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisease, setEditingDisease] = useState<Partial<Disease> | null>(null);
  const [aliasesText, setAliasesText] = useState('');
  const [testsText, setTestsText] = useState('');
  const [treatmentsText, setTreatmentsText] = useState('');
  const [drugsText, setDrugsText] = useState('');

  useEffect(() => {
    loadDiseases();
  }, []);

  const loadDiseases = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge/entity/search?type=disease');
      const data = await response.json();
      if (data.success) {
        setDiseases(data.data?.diseases || []);
      }
    } catch (error) {
      console.error('Failed to load diseases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDiseases = useMemo(() => {
    let result = [...diseases];
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(disease =>
        disease.standard_name.toLowerCase().includes(lowerQuery) ||
        disease.aliases.some(alias => alias.toLowerCase().includes(lowerQuery)) ||
        disease.icd_code?.toLowerCase().includes(lowerQuery)
      );
    }

    if (filterSeverity) {
      result = result.filter(disease => disease.severity_level === filterSeverity);
    }

    return result;
  }, [diseases, searchQuery, filterSeverity]);

  const totalPages = Math.ceil(filteredDiseases.length / itemsPerPage);
  const paginatedDiseases = filteredDiseases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAdd = () => {
    setEditingDisease({
      disease_id: '',
      standard_name: '',
      aliases: [],
      severity_level: '一般',
      inpatient_necessity_flag: false,
      status: 'active',
    });
    setAliasesText('');
    setTestsText('');
    setTreatmentsText('');
    setDrugsText('');
    setIsModalOpen(true);
  };

  const handleEdit = (disease: Disease) => {
    setEditingDisease({ ...disease });
    setAliasesText(disease.aliases.join(', '));
    setTestsText(disease.common_tests?.join(', ') || '');
    setTreatmentsText(disease.common_treatments?.join(', ') || '');
    setDrugsText(disease.common_drugs?.join(', ') || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingDisease) return;
    
    const diseaseData = {
      ...editingDisease,
      aliases: aliasesText.split(',').map(s => s.trim()).filter(Boolean),
      common_tests: testsText.split(',').map(s => s.trim()).filter(Boolean),
      common_treatments: treatmentsText.split(',').map(s => s.trim()).filter(Boolean),
      common_drugs: drugsText.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      const url = diseaseData.disease_id 
        ? `/api/knowledge/diseases/${diseaseData.disease_id}`
        : '/api/knowledge/diseases';
      const method = diseaseData.disease_id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diseaseData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        loadDiseases();
      }
    } catch (error) {
      console.error('Failed to save disease:', error);
    }
  };

  const handleDelete = async (diseaseId: string) => {
    if (!confirm('确定要删除此疾病吗？')) return;
    
    try {
      await fetch(`/api/knowledge/diseases/${diseaseId}`, { method: 'DELETE' });
      loadDiseases();
    } catch (error) {
      console.error('Failed to delete disease:', error);
    }
  };

  const getSeverityBadge = (level?: string) => {
    const config = SEVERITY_OPTIONS.find(o => o.value === level);
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${config?.color || 'bg-gray-100 text-gray-800'}`}>
        {config?.label || level || '-'}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">疾病管理</h1>
        <p className="text-gray-600 mt-1">管理疾病主数据，包括ICD编码、严重程度、住院必要性、典型住院天数等</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              placeholder="搜索疾病名称、别名、ICD编码..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部</option>
              {SEVERITY_OPTIONS.map(o => (
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
              新增疾病
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">疾病ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标准名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ICD编码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">严重程度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">典型住院天数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">住院必要性</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">加载中...</td></tr>
              ) : paginatedDiseases.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">暂无数据</td></tr>
              ) : (
                paginatedDiseases.map((disease) => (
                  <tr key={disease.disease_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{disease.disease_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{disease.standard_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{disease.icd_code || '-'}</td>
                    <td className="px-4 py-3">{getSeverityBadge(disease.severity_level)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {disease.typical_los_min && disease.typical_los_max 
                        ? `${disease.typical_los_min}-${disease.typical_los_max}天` 
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        disease.inpatient_necessity_flag 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {disease.inpatient_necessity_flag ? '通常需要' : '通常不需要'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        disease.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {disease.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(disease)} className="text-blue-600 hover:text-blue-800">编辑</button>
                        <button onClick={() => handleDelete(disease.disease_id)} className="text-red-600 hover:text-red-800">删除</button>
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
            totalItems={filteredDiseases.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDisease?.disease_id ? '编辑疾病' : '新增疾病'}
        width="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
          </div>
        }
      >
        {editingDisease && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="疾病ID" id="disease_id" value={editingDisease.disease_id || ''} onChange={(e) => setEditingDisease({ ...editingDisease, disease_id: e.target.value })} required />
              <Input label="标准名称" id="standard_name" value={editingDisease.standard_name || ''} onChange={(e) => setEditingDisease({ ...editingDisease, standard_name: e.target.value })} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="ICD编码" id="icd_code" value={editingDisease.icd_code || ''} onChange={(e) => setEditingDisease({ ...editingDisease, icd_code: e.target.value })} placeholder="如：J06.9" />
              <Input label="别名（逗号分隔）" id="aliases" value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
                <select value={editingDisease.severity_level || ''} onChange={(e) => setEditingDisease({ ...editingDisease, severity_level: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">请选择</option>
                  {SEVERITY_OPTIONS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <Input label="最短住院天数" id="typical_los_min" type="number" value={editingDisease.typical_los_min || ''} onChange={(e) => setEditingDisease({ ...editingDisease, typical_los_min: Number(e.target.value) })} />
              <Input label="最长住院天数" id="typical_los_max" type="number" value={editingDisease.typical_los_max || ''} onChange={(e) => setEditingDisease({ ...editingDisease, typical_los_max: Number(e.target.value) })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingDisease.inpatient_necessity_flag} onChange={(e) => setEditingDisease({ ...editingDisease, inpatient_necessity_flag: e.target.checked })} className="rounded" />
                  <span className="text-sm">通常需要住院</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select value={editingDisease.status || 'active'} onChange={(e) => setEditingDisease({ ...editingDisease, status: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">常见检查（逗号分隔）</label>
              <textarea value={testsText} onChange={(e) => setTestsText(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="如：血常规、胸片、CT" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">常见治疗（逗号分隔）</label>
              <textarea value={treatmentsText} onChange={(e) => setTreatmentsText(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">常见药品（逗号分隔）</label>
              <textarea value={drugsText} onChange={(e) => setDrugsText(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DiseaseManagementPage;
