import React, { useState, useEffect, useMemo } from 'react';
import Pagination from '../ui/Pagination';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

interface ServiceItem {
  item_id: string;
  standard_name: string;
  aliases: string[];
  local_names: string[];
  item_category: string;
  sub_category?: string;
  local_item_code?: string;
  price_low?: number;
  price_high?: number;
  unit?: string;
  frequency_min?: number;
  frequency_max?: number;
  course_min?: number;
  course_max?: number;
  department?: string;
  inpatient_flag: boolean;
  outpatient_flag: boolean;
  status: 'active' | 'inactive';
}

const CATEGORY_OPTIONS = [
  { value: 'examination', label: '检查费' },
  { value: 'treatment', label: '治疗费' },
  { value: 'surgery', label: '手术费' },
  { value: 'nursing', label: '护理费' },
  { value: 'bed', label: '床位费' },
  { value: 'material', label: '材料费' },
  { value: 'other', label: '其他' },
];

const ServiceItemManagementPage: React.FC = () => {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ServiceItem> | null>(null);
  const [aliasesText, setAliasesText] = useState('');
  const [localNamesText, setLocalNamesText] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge/entity/search?type=service_item');
      const data = await response.json();
      if (data.success) {
        setItems(data.data?.services || []);
      }
    } catch (error) {
      console.error('Failed to load service items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let result = [...items];
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.standard_name.toLowerCase().includes(lowerQuery) ||
        item.aliases.some(alias => alias.toLowerCase().includes(lowerQuery)) ||
        item.local_names.some(name => name.toLowerCase().includes(lowerQuery))
      );
    }

    if (filterCategory) {
      result = result.filter(item => item.item_category === filterCategory);
    }

    return result;
  }, [items, searchQuery, filterCategory]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAdd = () => {
    setEditingItem({
      item_id: '',
      standard_name: '',
      aliases: [],
      local_names: [],
      item_category: 'examination',
      inpatient_flag: true,
      outpatient_flag: true,
      status: 'active',
    });
    setAliasesText('');
    setLocalNamesText('');
    setIsModalOpen(true);
  };

  const handleEdit = (item: ServiceItem) => {
    setEditingItem({ ...item });
    setAliasesText(item.aliases.join(', '));
    setLocalNamesText(item.local_names.join(', '));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingItem) return;
    
    const itemData = {
      ...editingItem,
      aliases: aliasesText.split(',').map(s => s.trim()).filter(Boolean),
      local_names: localNamesText.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      const url = itemData.item_id 
        ? `/api/knowledge/service-items/${itemData.item_id}`
        : '/api/knowledge/service-items';
      const method = itemData.item_id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        loadItems();
      }
    } catch (error) {
      console.error('Failed to save service item:', error);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('确定要删除此诊疗项目吗？')) return;
    
    try {
      await fetch(`/api/knowledge/service-items/${itemId}`, { method: 'DELETE' });
      loadItems();
    } catch (error) {
      console.error('Failed to delete service item:', error);
    }
  };

  const getCategoryLabel = (value?: string) => {
    return CATEGORY_OPTIONS.find(o => o.value === value)?.label || value || '-';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">诊疗项目管理</h1>
        <p className="text-gray-600 mt-1">管理诊疗项目主数据，包括类别、价格范围、频次限制等</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              placeholder="搜索标准名称、别名、地方名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">类别</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部</option>
              {CATEGORY_OPTIONS.map(o => (
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
              新增项目
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标准名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类别</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">价格范围</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">频次范围</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">适用场景</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">加载中...</td></tr>
              ) : paginatedItems.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">暂无数据</td></tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.item_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{item.item_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.standard_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                        {getCategoryLabel(item.item_category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.price_low && item.price_high 
                        ? `¥${item.price_low}-¥${item.price_high}` 
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.frequency_min && item.frequency_max 
                        ? `${item.frequency_min}-${item.frequency_max}次` 
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-1">
                        {item.outpatient_flag && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">门诊</span>}
                        {item.inpatient_flag && <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">住院</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">编辑</button>
                        <button onClick={() => handleDelete(item.item_id)} className="text-red-600 hover:text-red-800">删除</button>
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
            totalItems={filteredItems.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem?.item_id ? '编辑诊疗项目' : '新增诊疗项目'}
        width="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
          </div>
        }
      >
        {editingItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="项目ID" id="item_id" value={editingItem.item_id || ''} onChange={(e) => setEditingItem({ ...editingItem, item_id: e.target.value })} required />
              <Input label="标准名称" id="standard_name" value={editingItem.standard_name || ''} onChange={(e) => setEditingItem({ ...editingItem, standard_name: e.target.value })} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="别名（逗号分隔）" id="aliases" value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} />
              <Input label="地方名称（逗号分隔）" id="local_names" value={localNamesText} onChange={(e) => setLocalNamesText(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类别</label>
                <select value={editingItem.item_category || ''} onChange={(e) => setEditingItem({ ...editingItem, item_category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  {CATEGORY_OPTIONS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <Input label="子类别" id="sub_category" value={editingItem.sub_category || ''} onChange={(e) => setEditingItem({ ...editingItem, sub_category: e.target.value })} />
              <Input label="地方项目编码" id="local_item_code" value={editingItem.local_item_code || ''} onChange={(e) => setEditingItem({ ...editingItem, local_item_code: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input label="最低价格" id="price_low" type="number" value={editingItem.price_low || ''} onChange={(e) => setEditingItem({ ...editingItem, price_low: Number(e.target.value) })} />
              <Input label="最高价格" id="price_high" type="number" value={editingItem.price_high || ''} onChange={(e) => setEditingItem({ ...editingItem, price_high: Number(e.target.value) })} />
              <Input label="单位" id="unit" value={editingItem.unit || ''} onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })} placeholder="如：次、项" />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <Input label="最小频次" id="frequency_min" type="number" value={editingItem.frequency_min || ''} onChange={(e) => setEditingItem({ ...editingItem, frequency_min: Number(e.target.value) })} />
              <Input label="最大频次" id="frequency_max" type="number" value={editingItem.frequency_max || ''} onChange={(e) => setEditingItem({ ...editingItem, frequency_max: Number(e.target.value) })} />
              <Input label="最短疗程" id="course_min" type="number" value={editingItem.course_min || ''} onChange={(e) => setEditingItem({ ...editingItem, course_min: Number(e.target.value) })} />
              <Input label="最长疗程" id="course_max" type="number" value={editingItem.course_max || ''} onChange={(e) => setEditingItem({ ...editingItem, course_max: Number(e.target.value) })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input label="适用科室" id="department" value={editingItem.department || ''} onChange={(e) => setEditingItem({ ...editingItem, department: e.target.value })} />
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingItem.outpatient_flag} onChange={(e) => setEditingItem({ ...editingItem, outpatient_flag: e.target.checked })} className="rounded" />
                  <span className="text-sm">门诊可用</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingItem.inpatient_flag} onChange={(e) => setEditingItem({ ...editingItem, inpatient_flag: e.target.checked })} className="rounded" />
                  <span className="text-sm">住院可用</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select value={editingItem.status || 'active'} onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ServiceItemManagementPage;
