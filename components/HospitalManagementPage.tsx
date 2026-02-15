import React, { useState, useMemo, useEffect } from 'react';
import { type HospitalInfo } from '../types';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import Input from './ui/Input';
import { api } from '../services/api';

// 省份选项
const PROVINCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'beijing', label: '北京' },
  { value: 'tianjin', label: '天津' },
  { value: 'hebei', label: '河北' },
  { value: 'shanxi', label: '山西' },
  { value: 'neimenggu', label: '内蒙古' },
  { value: 'liaoning', label: '辽宁' },
  { value: 'jilin', label: '吉林' },
  { value: 'heilongjiang', label: '黑龙江' },
  { value: 'shanghai', label: '上海' },
  { value: 'jiangsu', label: '江苏' },
  { value: 'zhejiang', label: '浙江' },
  { value: 'anhui', label: '安徽' },
  { value: 'fujian', label: '福建' },
  { value: 'jiangxi', label: '江西' },
  { value: 'shandong', label: '山东' },
  { value: 'henan', label: '河南' },
  { value: 'hubei', label: '湖北' },
  { value: 'hunan', label: '湖南' },
  { value: 'guangdong', label: '广东' },
  { value: 'guangxi', label: '广西' },
  { value: 'hainan', label: '海南' },
  { value: 'chongqing', label: '重庆' },
  { value: 'sichuan', label: '四川' },
  { value: 'guizhou', label: '贵州' },
  { value: 'yunnan', label: '云南' },
  { value: 'xizang', label: '西藏' },
  { value: 'shaanxi', label: '陕西' },
  { value: 'gansu', label: '甘肃' },
  { value: 'qinghai', label: '青海' },
  { value: 'ningxia', label: '宁夏' },
  { value: 'xinjiang', label: '新疆' },
];

const PROVINCE_MAP = Object.fromEntries(PROVINCE_OPTIONS.map(p => [p.value, p.label]));

// 等级选项
const LEVEL_OPTIONS: HospitalInfo['level'][] = [
  '三级甲等', '三级乙等', '二级甲等', '二级乙等', '一级', '未定级', '民营'
];

// 类型选项
const TYPE_OPTIONS: HospitalInfo['type'][] = ['公立', '民营'];

// 理赔合规判断
const QUALIFIED_LEVELS = ['三级甲等', '三级乙等', '二级甲等', '二级乙等'];
const isQualified = (level: string, type: string): boolean =>
  type === '公立' && QUALIFIED_LEVELS.includes(level);

const HospitalManagementPage: React.FC = () => {
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Partial<HospitalInfo> | null>(null);

  // Filter State
  const [filterProvince, setFilterProvince] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const data = await api.hospitalInfo.list() as HospitalInfo[];
        setHospitals(data || []);
      } catch (error) {
        console.error('Failed to fetch hospital info:', error);
        setHospitals([]);
      }
    };
    fetchHospitals();
  }, []);

  // 筛选过滤
  const filteredHospitals = useMemo(() => {
    let result = hospitals;
    if (filterProvince) {
      result = result.filter(h => h.province === filterProvince);
    }
    if (filterLevel) {
      result = result.filter(h => h.level === filterLevel);
    }
    if (filterType) {
      result = result.filter(h => h.type === filterType);
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(h =>
        h.name.toLowerCase().includes(lowerQuery) ||
        h.city.toLowerCase().includes(lowerQuery) ||
        (h.address && h.address.toLowerCase().includes(lowerQuery))
      );
    }
    return result;
  }, [hospitals, filterProvince, filterLevel, filterType, searchQuery]);

  // 分页
  const paginatedHospitals = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHospitals.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredHospitals, currentPage]);

  const totalPages = Math.ceil(filteredHospitals.length / ITEMS_PER_PAGE);

  // 筛选变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [filterProvince, filterLevel, filterType, searchQuery]);

  const handleAdd = () => {
    setEditingHospital({
      id: `hosp-${Date.now()}`,
      name: '',
      province: '',
      city: '',
      level: '三级甲等',
      type: '公立',
      address: '',
      qualifiedForInsurance: true,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (hospital: HospitalInfo) => {
    setEditingHospital({ ...hospital });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这条医院信息吗？')) {
      const newHospitals = hospitals.filter(h => h.id !== id);
      try {
        await api.hospitalInfo.saveAll(newHospitals);
        setHospitals(newHospitals);
      } catch (error) {
        console.error('Failed to delete hospital:', error);
        alert('删除失败');
      }
    }
  };

  const handleSave = async () => {
    if (!editingHospital?.name) {
      alert('请输入医院名称');
      return;
    }
    if (!editingHospital.province) {
      alert('请选择省份');
      return;
    }
    if (!editingHospital.city) {
      alert('请输入城市');
      return;
    }

    // 自动计算合规状态
    const hospitalToSave: HospitalInfo = {
      ...editingHospital as HospitalInfo,
      qualifiedForInsurance: isQualified(editingHospital.level || '', editingHospital.type || ''),
    };

    let newHospitals = [...hospitals];
    if (hospitals.find(h => h.id === hospitalToSave.id)) {
      newHospitals = hospitals.map(h => h.id === hospitalToSave.id ? hospitalToSave : h);
    } else {
      newHospitals = [...hospitals, hospitalToSave];
    }

    try {
      await api.hospitalInfo.saveAll(newHospitals);
      setHospitals(newHospitals);
      setIsModalOpen(false);
      setEditingHospital(null);
    } catch (error) {
      console.error('Failed to save hospital:', error);
      alert('保存失败');
    }
  };

  // 编辑时自动更新合规状态
  const updateEditingField = (field: keyof HospitalInfo, value: string | boolean) => {
    setEditingHospital(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      // 当等级或类型变化时自动计算合规状态
      if (field === 'level' || field === 'type') {
        updated.qualifiedForInsurance = isQualified(
          updated.level || '',
          updated.type || ''
        );
      }
      return updated;
    });
  };

  const isEditing = editingHospital?.id && hospitals.some(h => h.id === editingHospital.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">医院信息管理</h1>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 transition-colors"
        >
          新增
        </button>
      </div>

      {/* Filter Module */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="filter-province" className="block text-sm font-medium text-gray-700 mb-1">省份</label>
            <select
              id="filter-province"
              value={filterProvince}
              onChange={(e) => setFilterProvince(e.target.value)}
              className="w-full h-9 px-3 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">全部省份</option>
              {PROVINCE_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-level" className="block text-sm font-medium text-gray-700 mb-1">等级</label>
            <select
              id="filter-level"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full h-9 px-3 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">全部等级</option>
              {LEVEL_OPTIONS.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700 mb-1">类型</label>
            <select
              id="filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full h-9 px-3 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">全部类型</option>
              {TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              id="search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索医院名称、城市、地址"
              className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterProvince('');
                setFilterLevel('');
                setFilterType('');
                setSearchQuery('');
              }}
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">医院名称</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">省份</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">城市</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">等级</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">理赔合规</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">地址</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedHospitals.length > 0 ? (
                paginatedHospitals.map((hospital) => (
                  <tr key={hospital.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{hospital.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {PROVINCE_MAP[hospital.province] || hospital.province}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{hospital.city}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{hospital.level}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{hospital.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {hospital.qualifiedForInsurance ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          合规
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                          不合规
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{hospital.address || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                      <button
                        onClick={() => handleEdit(hospital)}
                        className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(hospital.id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    暂无符合条件的医院数据
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
            totalItems={filteredHospitals.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? '编辑医院信息' : '新增医院信息'}
      >
        <div className="space-y-4">
          <Input
            label="医院名称"
            id="hospital-name"
            value={editingHospital?.name || ''}
            onChange={(e) => updateEditingField('name', e.target.value)}
            placeholder="请输入医院名称"
            required
          />

          <div>
            <label htmlFor="hospital-province" className="block text-sm font-medium text-gray-700 mb-1">
              省份 <span className="text-red-500">*</span>
            </label>
            <select
              id="hospital-province"
              value={editingHospital?.province || ''}
              onChange={(e) => updateEditingField('province', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm bg-white"
            >
              <option value="">请选择省份</option>
              {PROVINCE_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="城市"
            id="hospital-city"
            value={editingHospital?.city || ''}
            onChange={(e) => updateEditingField('city', e.target.value)}
            placeholder="请输入城市"
            required
          />

          <div>
            <label htmlFor="hospital-level" className="block text-sm font-medium text-gray-700 mb-1">
              等级 <span className="text-red-500">*</span>
            </label>
            <select
              id="hospital-level"
              value={editingHospital?.level || '三级甲等'}
              onChange={(e) => updateEditingField('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm bg-white"
            >
              {LEVEL_OPTIONS.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="hospital-type" className="block text-sm font-medium text-gray-700 mb-1">
              类型 <span className="text-red-500">*</span>
            </label>
            <select
              id="hospital-type"
              value={editingHospital?.type || '公立'}
              onChange={(e) => updateEditingField('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm bg-white"
            >
              {TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <Input
            label="地址"
            id="hospital-address"
            value={editingHospital?.address || ''}
            onChange={(e) => updateEditingField('address', e.target.value)}
            placeholder="请输入医院地址"
          />

          {/* 理赔合规状态 - 自动计算，仅展示 */}
          <div className="rounded-md border border-gray-200 p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">理赔合规状态</label>
            {editingHospital?.qualifiedForInsurance ? (
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  合规
                </span>
                <span className="text-sm text-gray-500">公立二级及以上医院，符合保险理赔要求</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                  不合规
                </span>
                <span className="text-sm text-gray-500">不满足"公立二级及以上"条件，不符合理赔要求</span>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">此状态根据医院等级和类型自动计算，无需手动设置</p>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
        </div>
      </Modal>
    </div>
  );
};

export default HospitalManagementPage;
