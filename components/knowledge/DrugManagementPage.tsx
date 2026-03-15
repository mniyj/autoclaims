import React, { useState, useEffect, useMemo } from 'react';
import Pagination from '../ui/Pagination';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

interface Drug {
  drug_id: string;
  generic_name: string;
  brand_name?: string;
  aliases: string[];
  dosage_form?: string;
  spec?: string;
  package?: string;
  manufacturer?: string;
  nhsa_code?: string;
  nmpa_approval_no?: string;
  reimbursement_flag?: '甲类' | '乙类' | '丙类' | '自费';
  reimbursement_restriction?: string;
  indications?: string;
  dose_min?: number;
  dose_max?: number;
  course_min?: number;
  course_max?: number;
  route?: string;
  status: 'active' | 'inactive';
}

const REIMBURSEMENT_OPTIONS = [
  { value: '甲类', label: '甲类', color: 'bg-green-100 text-green-800' },
  { value: '乙类', label: '乙类', color: 'bg-blue-100 text-blue-800' },
  { value: '丙类', label: '丙类', color: 'bg-orange-100 text-orange-800' },
  { value: '自费', label: '自费', color: 'bg-red-100 text-red-800' },
];

const DrugManagementPage: React.FC = () => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReimbursement, setFilterReimbursement] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState<Partial<Drug> | null>(null);
  const [aliasesText, setAliasesText] = useState('');

  useEffect(() => {
    loadDrugs();
  }, []);

  const loadDrugs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge/entity/search?type=drug');
      const data = await response.json();
      if (data.success) {
        setDrugs(data.data?.drugs || []);
      }
    } catch (error) {
      console.error('Failed to load drugs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDrugs = useMemo(() => {
    let result = [...drugs];
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(drug =>
        drug.generic_name.toLowerCase().includes(lowerQuery) ||
        drug.brand_name?.toLowerCase().includes(lowerQuery) ||
        drug.aliases.some(alias => alias.toLowerCase().includes(lowerQuery)) ||
        drug.nhsa_code?.toLowerCase().includes(lowerQuery)
      );
    }

    if (filterReimbursement) {
      result = result.filter(drug => drug.reimbursement_flag === filterReimbursement);
    }

    return result;
  }, [drugs, searchQuery, filterReimbursement]);

  const totalPages = Math.ceil(filteredDrugs.length / itemsPerPage);
  const paginatedDrugs = filteredDrugs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAdd = () => {
    setEditingDrug({
      drug_id: '',
      generic_name: '',
      brand_name: '',
      aliases: [],
      dosage_form: '',
      spec: '',
      manufacturer: '',
      reimbursement_flag: '甲类',
      status: 'active',
    });
    setAliasesText('');
    setIsModalOpen(true);
  };

  const handleEdit = (drug: Drug) => {
    setEditingDrug({ ...drug });
    setAliasesText(drug.aliases.join(', '));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingDrug) return;
    
    const drugData = {
      ...editingDrug,
      aliases: aliasesText.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      const url = drugData.drug_id 
        ? `/api/knowledge/drugs/${drugData.drug_id}`
        : '/api/knowledge/drugs';
      const method = drugData.drug_id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drugData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        loadDrugs();
      }
    } catch (error) {
      console.error('Failed to save drug:', error);
    }
  };

  const handleDelete = async (drugId: string) => {
    if (!confirm('确定要删除此药品吗？')) return;
    
    try {
      await fetch(`/api/knowledge/drugs/${drugId}`, { method: 'DELETE' });
      loadDrugs();
    } catch (error) {
      console.error('Failed to delete drug:', error);
    }
  };

  const getReimbursementBadge = (flag?: string) => {
    const config = REIMBURSEMENT_OPTIONS.find(o => o.value === flag);
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${config?.color || 'bg-gray-100 text-gray-800'}`}>
        {config?.label || flag || '-'}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">药品管理</h1>
        <p className="text-gray-600 mt-1">管理药品主数据，包括通用名、剂型、规格、剂量范围等</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              placeholder="搜索药品名称、别名、编码..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">医保类别</label>
            <select
              value={filterReimbursement}
              onChange={(e) => setFilterReimbursement(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部</option>
              {REIMBURSEMENT_OPTIONS.map(o => (
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
              新增药品
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">药品ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">通用名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">剂型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规格</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">医保类别</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">剂量范围</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">加载中...</td>
                </tr>
              ) : paginatedDrugs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">暂无数据</td>
                </tr>
              ) : (
                paginatedDrugs.map((drug) => (
                  <tr key={drug.drug_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{drug.drug_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{drug.generic_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{drug.brand_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{drug.dosage_form || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{drug.spec || '-'}</td>
                    <td className="px-4 py-3">{getReimbursementBadge(drug.reimbursement_flag)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {drug.dose_min && drug.dose_max 
                        ? `${drug.dose_min}-${drug.dose_max}` 
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        drug.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {drug.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(drug)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(drug.drug_id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          删除
                        </button>
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
            totalItems={filteredDrugs.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDrug?.drug_id ? '编辑药品' : '新增药品'}
        width="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        }
      >
        {editingDrug && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="药品ID"
                id="drug_id"
                value={editingDrug.drug_id || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, drug_id: e.target.value })}
                required
              />
              <Input
                label="通用名"
                id="generic_name"
                value={editingDrug.generic_name || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, generic_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="商品名"
                id="brand_name"
                value={editingDrug.brand_name || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, brand_name: e.target.value })}
              />
              <Input
                label="别名（用逗号分隔）"
                id="aliases"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder="如：阿莫仙，阿莫灵"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="剂型"
                id="dosage_form"
                value={editingDrug.dosage_form || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, dosage_form: e.target.value })}
                placeholder="如：片剂、胶囊"
              />
              <Input
                label="规格"
                id="spec"
                value={editingDrug.spec || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, spec: e.target.value })}
                placeholder="如：0.25g×24粒"
              />
              <Input
                label="包装"
                id="package"
                value={editingDrug.package || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, package: e.target.value })}
                placeholder="如：盒、瓶"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="生产厂家"
                id="manufacturer"
                value={editingDrug.manufacturer || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, manufacturer: e.target.value })}
              />
              <Input
                label="给药途径"
                id="route"
                value={editingDrug.route || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, route: e.target.value })}
                placeholder="如：口服、静脉注射"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="医保编码"
                id="nhsa_code"
                value={editingDrug.nhsa_code || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, nhsa_code: e.target.value })}
              />
              <Input
                label="批准文号"
                id="nmpa_approval_no"
                value={editingDrug.nmpa_approval_no || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, nmpa_approval_no: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">医保类别</label>
                <select
                  value={editingDrug.reimbursement_flag || '甲类'}
                  onChange={(e) => setEditingDrug({ ...editingDrug, reimbursement_flag: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {REIMBURSEMENT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  value={editingDrug.status || 'active'}
                  onChange={(e) => setEditingDrug({ ...editingDrug, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <Input
                label="最小剂量"
                id="dose_min"
                type="number"
                value={editingDrug.dose_min || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, dose_min: Number(e.target.value) })}
                placeholder="mg"
              />
              <Input
                label="最大剂量"
                id="dose_max"
                type="number"
                value={editingDrug.dose_max || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, dose_max: Number(e.target.value) })}
                placeholder="mg"
              />
              <Input
                label="最短疗程"
                id="course_min"
                type="number"
                value={editingDrug.course_min || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, course_min: Number(e.target.value) })}
                placeholder="天"
              />
              <Input
                label="最长疗程"
                id="course_max"
                type="number"
                value={editingDrug.course_max || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, course_max: Number(e.target.value) })}
                placeholder="天"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">适应症</label>
              <textarea
                value={editingDrug.indications || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, indications: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="描述药品的适应症..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">限制支付条件</label>
              <textarea
                value={editingDrug.reimbursement_restriction || ''}
                onChange={(e) => setEditingDrug({ ...editingDrug, reimbursement_restriction: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="描述医保限制支付条件..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DrugManagementPage;
