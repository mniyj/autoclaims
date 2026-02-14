import React, { useState, useMemo } from 'react';
import { MOCK_CLAIMS_MATERIALS } from '../constants';
import { type ClaimsMaterial } from '../types';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Textarea from './ui/Textarea';
import FileUpload from './ui/FileUpload';

const ClaimsMaterialManagementPage: React.FC = () => {
  const [materials, setMaterials] = useState<ClaimsMaterial[]>(MOCK_CLAIMS_MATERIALS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Partial<ClaimsMaterial> | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredMaterials = useMemo(() => {
    if (!searchQuery) return materials;
    const lowerQuery = searchQuery.toLowerCase();
    return materials.filter(m => 
      m.name.toLowerCase().includes(lowerQuery) || 
      m.description.toLowerCase().includes(lowerQuery)
    );
  }, [materials, searchQuery]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMaterials.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMaterials, currentPage]);

  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE);

  const handleAdd = () => {
    setEditingMaterial({
      id: `mat-${Date.now()}`,
      name: '',
      description: '',
      sampleUrl: '',
      jsonSchema: '{\n  "type": "object",\n  "properties": {}\n}',
      required: true,
      aiAuditPrompt: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (material: ClaimsMaterial) => {
    setEditingMaterial({ ...material });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这个理赔材料吗？')) {
      setMaterials(materials.filter(m => m.id !== id));
    }
  };

  const handleSave = () => {
    if (!editingMaterial?.name) {
      alert('请输入材料名称');
      return;
    }

    try {
        JSON.parse(editingMaterial.jsonSchema || '{}');
    } catch (e) {
        alert('JSON Schema 格式错误');
        return;
    }

    if (materials.find(m => m.id === editingMaterial.id)) {
      setMaterials(materials.map(m => m.id === editingMaterial.id ? editingMaterial as ClaimsMaterial : m));
    } else {
      setMaterials([...materials, editingMaterial as ClaimsMaterial]);
    }
    setIsModalOpen(false);
    setEditingMaterial(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">理赔材料管理</h1>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 transition-colors"
        >
          新增材料
        </button>
      </div>

      {/* Search Module */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="max-w-md">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">搜索材料</label>
          <div className="flex space-x-2">
            <input 
              id="search"
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索材料名称或说明" 
              className="flex-1 h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
            />
            <button 
                onClick={() => setSearchQuery('')}
                className="h-9 px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-200 transition"
            >
                重置
            </button>
          </div>
        </div>
      </div>

      {/* Table Module */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">材料名称</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">必传</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">说明</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">样例</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedMaterials.length > 0 ? (
                paginatedMaterials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{material.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {material.required ? (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full border border-red-100">是</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full border border-gray-100">否</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{material.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {material.sampleUrl ? (
                        <a href={material.sampleUrl} target="_blank" rel="noopener noreferrer" className="text-brand-blue-600 hover:underline">查看样例</a>
                      ) : (
                        <span className="text-gray-400">无</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                      <button 
                        onClick={() => handleEdit(material)} 
                        className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                      >
                        修改
                      </button>
                      <button 
                        onClick={() => handleDelete(material.id)} 
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                    暂无符合条件的材料数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredMaterials.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMaterial?.id?.startsWith('mat-') && !materials.find(m => m.id === editingMaterial.id) ? '新增理赔材料' : '修改理赔材料'}
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex justify-between items-start space-x-4">
            <div className="flex-1">
              <Input
                label="材料名称"
                value={editingMaterial?.name || ''}
                onChange={(e) => setEditingMaterial(prev => ({ ...prev!, name: e.target.value }))}
                placeholder="请输入材料名称"
                required
              />
            </div>
            <div className="pt-7">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingMaterial?.required || false}
                  onChange={(e) => setEditingMaterial(prev => ({ ...prev!, required: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">是否必传</span>
              </label>
            </div>
          </div>
          <Textarea
            label="材料说明"
            value={editingMaterial?.description || ''}
            onChange={(e) => setEditingMaterial(prev => ({ ...prev!, description: e.target.value }))}
            placeholder="请输入材料说明"
            rows={3}
          />
          <FileUpload
            label="材料样例"
            id="sample-upload"
            value={editingMaterial?.sampleUrl}
            onChange={(val) => setEditingMaterial(prev => ({ ...prev!, sampleUrl: val }))}
            accept="image/*"
            helpText="上传材料样例图片，支持 jpg, png, webp 等格式"
          />
          <Textarea
            label="AI 审核 Prompt"
            value={editingMaterial?.aiAuditPrompt || ''}
            onChange={(e) => setEditingMaterial(prev => ({ ...prev!, aiAuditPrompt: e.target.value }))}
            placeholder="用于指示 AI 审核该材料的规则、要点和输出格式"
            rows={8}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">JSON Schema</label>
            <textarea
              className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm font-mono"
              value={editingMaterial?.jsonSchema || ''}
              onChange={(e) => setEditingMaterial(prev => ({ ...prev!, jsonSchema: e.target.value }))}
              placeholder='{ "type": "object", ... }'
            />
            <p className="text-xs text-gray-500">用于 OCR 提取信息的 JSON Schema 结构</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClaimsMaterialManagementPage;
