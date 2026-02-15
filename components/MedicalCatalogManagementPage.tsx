import React, { useState, useMemo, useEffect } from 'react';
import { type MedicalInsuranceCatalogItem } from '../types';
import Pagination from './ui/Pagination';
import Input from './ui/Input';
import Select from './ui/Select';
import { api } from '../services/api';

// Province code to Chinese name mapping
const PROVINCE_MAP: Record<string, string> = {
  national: '国家目录',
  beijing: '北京',
  shanghai: '上海',
  guangdong: '广东',
  zhejiang: '浙江',
  jiangsu: '江苏',
  sichuan: '四川',
  hubei: '湖北',
  hunan: '湖南',
  fujian: '福建',
  anhui: '安徽',
  shandong: '山东',
  henan: '河南',
  hebei: '河北',
  liaoning: '辽宁',
  heilongjiang: '黑龙江',
  jilin: '吉林',
  shaanxi: '陕西',
  chongqing: '重庆',
  yunnan: '云南',
  guizhou: '贵州',
  guangxi: '广西',
  jiangxi: '江西',
  shanxi: '山西',
  gansu: '甘肃',
  inner_mongolia: '内蒙古',
  xinjiang: '新疆',
  tibet: '西藏',
  hainan: '海南',
  ningxia: '宁夏',
  qinghai: '青海',
  tianjin: '天津',
};

// Province options for dropdowns (sorted: national first, then alphabetical)
const PROVINCE_OPTIONS = Object.entries(PROVINCE_MAP).sort(([keyA], [keyB]) => {
  if (keyA === 'national') return -1;
  if (keyB === 'national') return 1;
  return keyA.localeCompare(keyB);
});

// Catalog type display config
const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  A: { label: '甲类', className: 'bg-green-50 text-green-700 border border-green-200' },
  B: { label: '乙类', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  C: { label: '丙类', className: 'bg-orange-50 text-orange-700 border border-orange-200' },
  excluded: { label: '目录外', className: 'bg-red-50 text-red-700 border border-red-200' },
};

// Tab definitions
const TABS: { key: MedicalInsuranceCatalogItem['category']; label: string }[] = [
  { key: 'drug', label: '药品目录' },
  { key: 'treatment', label: '诊疗项目目录' },
  { key: 'material', label: '医疗服务设施目录' },
];

// Helper to render type badge
const TypeBadge: React.FC<{ type: MedicalInsuranceCatalogItem['type'] }> = ({ type }) => {
  const config = TYPE_CONFIG[type];
  if (!config) return <span className="text-gray-400">-</span>;
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
};

// Helper to get province display name
const getProvinceName = (code: string): string => PROVINCE_MAP[code] || code;

// Create empty form data for a new item
const createEmptyItem = (category: MedicalInsuranceCatalogItem['category']): Partial<MedicalInsuranceCatalogItem> => ({
  id: `catalog-${Date.now()}`,
  province: 'national',
  category,
  code: '',
  name: '',
  type: 'A',
  reimbursementRatio: 100,
  restrictions: '',
  effectiveDate: new Date().toISOString().split('T')[0],
  expiryDate: '',
  aliases: [],
  genericName: '',
  specifications: '',
  dosageForm: '',
  manufacturer: '',
});

const MedicalCatalogManagementPage: React.FC = () => {
  // Data state
  const [items, setItems] = useState<MedicalInsuranceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<MedicalInsuranceCatalogItem['category']>('drug');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MedicalInsuranceCatalogItem> | null>(null);
  const [aliasesText, setAliasesText] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await api.medicalInsuranceCatalog.list() as MedicalInsuranceCatalogItem[];
        setItems(data || []);
      } catch (error) {
        console.error('Failed to fetch medical insurance catalog:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Reset page when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, filterProvince, filterType]);

  // Filtered items based on active tab and filters
  const filteredItems = useMemo(() => {
    let result = items.filter(item => item.category === activeTab);

    if (filterProvince) {
      result = result.filter(item => item.province === filterProvince);
    }

    if (filterType) {
      result = result.filter(item => item.type === filterType);
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(lowerQuery);
        const aliasMatch = item.aliases
          ? item.aliases.join(',').toLowerCase().includes(lowerQuery)
          : false;
        return nameMatch || aliasMatch;
      });
    }

    return result;
  }, [items, activeTab, searchQuery, filterProvince, filterType]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  // Handle add new item
  const handleAdd = () => {
    const newItem = createEmptyItem(activeTab);
    setEditingItem(newItem);
    setAliasesText('');
    setIsModalOpen(true);
  };

  // Handle edit existing item
  const handleEdit = (item: MedicalInsuranceCatalogItem) => {
    setEditingItem({ ...item });
    setAliasesText(item.aliases ? item.aliases.join('、') : '');
    setIsModalOpen(true);
  };

  // Handle delete item
  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这条目录数据吗？')) return;

    try {
      const newItems = items.filter(item => item.id !== id);
      await api.medicalInsuranceCatalog.saveAll(newItems);
      setItems(newItems);
    } catch (error) {
      console.error('Failed to delete catalog item:', error);
      alert('删除失败，请重试');
    }
  };

  // Handle save (add or edit)
  const handleSave = async () => {
    if (!editingItem) return;

    // Validation
    if (!editingItem.code?.trim()) {
      alert('请输入医保编码');
      return;
    }
    if (!editingItem.name?.trim()) {
      alert('请输入名称');
      return;
    }
    if (!editingItem.effectiveDate) {
      alert('请选择生效日期');
      return;
    }

    // Parse aliases from comma-separated text
    const parsedAliases = aliasesText
      .split(/[,、，]/)
      .map(s => s.trim())
      .filter(Boolean);

    const itemToSave: MedicalInsuranceCatalogItem = {
      id: editingItem.id!,
      province: editingItem.province || 'national',
      category: editingItem.category || activeTab,
      code: editingItem.code!.trim(),
      name: editingItem.name!.trim(),
      type: editingItem.type || 'A',
      reimbursementRatio: editingItem.reimbursementRatio,
      restrictions: editingItem.restrictions || '',
      effectiveDate: editingItem.effectiveDate!,
      expiryDate: editingItem.expiryDate || undefined,
      aliases: parsedAliases.length > 0 ? parsedAliases : undefined,
      genericName: editingItem.genericName || undefined,
      specifications: editingItem.specifications || undefined,
      dosageForm: editingItem.dosageForm || undefined,
      manufacturer: editingItem.manufacturer || undefined,
    };

    setSaving(true);
    try {
      let newItems: MedicalInsuranceCatalogItem[];
      const existingIndex = items.findIndex(item => item.id === itemToSave.id);
      if (existingIndex >= 0) {
        // Update existing
        newItems = items.map(item => item.id === itemToSave.id ? itemToSave : item);
      } else {
        // Add new
        newItems = [...items, itemToSave];
      }

      await api.medicalInsuranceCatalog.saveAll(newItems);
      setItems(newItems);
      setIsModalOpen(false);
      setEditingItem(null);
      setAliasesText('');
    } catch (error) {
      console.error('Failed to save catalog item:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setAliasesText('');
  };

  // Determine modal title
  const isNewItem = editingItem ? !items.find(item => item.id === editingItem.id) : false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">医保目录管理</h1>
      </div>

      {/* Tab bar */}
      <div className="flex space-x-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#4f46e5] text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">省份</label>
            <select
              value={filterProvince}
              onChange={(e) => setFilterProvince(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-[#4f46e5] focus:border-[#4f46e5] sm:text-sm"
            >
              <option value="">全部省份</option>
              {PROVINCE_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-[#4f46e5] focus:border-[#4f46e5] sm:text-sm"
            >
              <option value="">全部类型</option>
              <option value="A">甲类</option>
              <option value="B">乙类</option>
              <option value="C">丙类</option>
              <option value="excluded">目录外</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索名称或别名"
              className="w-full h-[38px] px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#4f46e5] text-sm"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterProvince('');
                setFilterType('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              重置
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-[#4f46e5] text-white rounded-md text-sm font-medium hover:bg-[#4338ca]"
            >
              新增
            </button>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center space-y-3">
              <svg className="animate-spin h-8 w-8 text-[#4f46e5]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-gray-500">加载中...</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">编码</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">别名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">通用名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">规格</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">剂型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">省份</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">报销比例</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">使用限制</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">有效期</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] sticky right-0 bg-gray-50 shadow-sm z-10">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap font-mono">{item.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate" title={item.aliases?.join('、')}>
                        {item.aliases && item.aliases.length > 0 ? item.aliases.join('、') : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {item.genericName || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {item.specifications || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {item.dosageForm || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{getProvinceName(item.province)}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap"><TypeBadge type={item.type} /></td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {item.reimbursementRatio != null ? `${item.reimbursementRatio}%` : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate" title={item.restrictions}>
                        {item.restrictions || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {item.effectiveDate}
                        {item.expiryDate ? ` ~ ${item.expiryDate}` : ' 起'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2 sticky right-0 bg-white shadow-sm z-10">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-[#4f46e5] hover:text-[#4338ca] bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-6 py-12 text-center text-sm text-gray-500">
                      暂无符合条件的目录数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredItems.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && editingItem && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start pt-10 overflow-y-auto"
          onClick={handleCloseModal}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 mb-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {isNewItem ? '新增目录条目' : '编辑目录条目'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Row 1: Category (locked) + Province */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目录分类</label>
                  <input
                    type="text"
                    value={TABS.find(t => t.key === editingItem.category)?.label || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-sm text-gray-500"
                  />
                </div>
                <Select
                  label="省份"
                  id="modal-province"
                  value={editingItem.province || 'national'}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, province: e.target.value }))}
                  required
                >
                  {PROVINCE_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </div>

              {/* Row 2: Code + Name */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="医保编码"
                  id="modal-code"
                  value={editingItem.code || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, code: e.target.value }))}
                  placeholder="请输入医保编码"
                  required
                />
                <Input
                  label="名称"
                  id="modal-name"
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, name: e.target.value }))}
                  placeholder="请输入标准名称"
                  required
                />
              </div>

              {/* Row 3: Type + Reimbursement ratio */}
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="类型"
                  id="modal-type"
                  value={editingItem.type || 'A'}
                  onChange={(e) => setEditingItem(prev => ({
                    ...prev!,
                    type: e.target.value as MedicalInsuranceCatalogItem['type'],
                  }))}
                  required
                >
                  <option value="A">甲类</option>
                  <option value="B">乙类</option>
                  <option value="C">丙类</option>
                  <option value="excluded">目录外</option>
                </Select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">报销比例</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editingItem.reimbursementRatio ?? ''}
                      onChange={(e) => setEditingItem(prev => ({
                        ...prev!,
                        reimbursementRatio: e.target.value === '' ? undefined : Number(e.target.value),
                      }))}
                      placeholder="0-100"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#4f46e5] focus:border-[#4f46e5] sm:text-sm"
                    />
                    <span className="text-sm text-gray-500 font-medium">%</span>
                  </div>
                </div>
              </div>

              {/* Row 4: Generic name + Dosage form */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="通用名"
                  id="modal-genericName"
                  value={editingItem.genericName || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, genericName: e.target.value }))}
                  placeholder="药品通用名"
                />
                <Input
                  label="剂型"
                  id="modal-dosageForm"
                  value={editingItem.dosageForm || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, dosageForm: e.target.value }))}
                  placeholder="如：片剂、胶囊、注射液"
                />
              </div>

              {/* Row 5: Specifications + Manufacturer */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="规格"
                  id="modal-specifications"
                  value={editingItem.specifications || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, specifications: e.target.value }))}
                  placeholder="如：0.25g×12片/盒"
                />
                <Input
                  label="生产厂家"
                  id="modal-manufacturer"
                  value={editingItem.manufacturer || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, manufacturer: e.target.value }))}
                  placeholder="常见生产厂家"
                />
              </div>

              {/* Row 6: Aliases */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">别名</label>
                <input
                  type="text"
                  value={aliasesText}
                  onChange={(e) => setAliasesText(e.target.value)}
                  placeholder="多个别名用逗号（,）或顿号（、）分隔"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#4f46e5] focus:border-[#4f46e5] sm:text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">商品名、曾用名、常见缩写等，用逗号或顿号分隔</p>
              </div>

              {/* Row 7: Restrictions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">使用限制</label>
                <textarea
                  value={editingItem.restrictions || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, restrictions: e.target.value }))}
                  placeholder="使用限制说明（如限定适应症、限二线用药等）"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#4f46e5] focus:border-[#4f46e5] sm:text-sm"
                />
              </div>

              {/* Row 8: Effective date + Expiry date */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="生效日期"
                  id="modal-effectiveDate"
                  type="date"
                  value={editingItem.effectiveDate || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, effectiveDate: e.target.value }))}
                  required
                />
                <Input
                  label="失效日期"
                  id="modal-expiryDate"
                  type="date"
                  value={editingItem.expiryDate || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev!, expiryDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#4f46e5] text-white text-sm font-medium rounded-md hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalCatalogManagementPage;
