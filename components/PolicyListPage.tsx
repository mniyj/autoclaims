import React, { useState, useMemo, useEffect } from 'react';
import { type InsurancePolicy, PolicyStatus } from '../types';
import Pagination from './ui/Pagination';
import Select from './ui/Select';
import Input from './ui/Input';
import { api } from '../services/api';

interface PolicyListPageProps {
  onViewDetail: (policy: InsurancePolicy) => void;
  onCreatePolicy: () => void;
  onInitiateClaim: (policy: InsurancePolicy) => void;
}

const PolicyListPage: React.FC<PolicyListPageProps> = ({ onViewDetail, onCreatePolicy, onInitiateClaim }) => {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const data = await api.policies.list();
        setPolicies(data as InsurancePolicy[]);
      } catch (error) {
        console.error('Failed to fetch policies:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  // Filter States
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyholder, setPolicyholder] = useState('');
  const [status, setStatus] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [effectiveDateStart, setEffectiveDateStart] = useState('');
  const [effectiveDateEnd, setEffectiveDateEnd] = useState('');

  // Active Filters
  const [activeFilters, setActiveFilters] = useState({
    policyNumber: '',
    policyholder: '',
    status: '',
    productName: '',
    effectiveDateStart: '',
    effectiveDateEnd: ''
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleSearch = () => {
    setActiveFilters({
      policyNumber,
      policyholder,
      status,
      productName,
      effectiveDateStart,
      effectiveDateEnd
    });
    setCurrentPage(1);
  };

  const handleReset = () => {
    setPolicyNumber('');
    setPolicyholder('');
    setStatus('');
    setProductName('');
    setEffectiveDateStart('');
    setEffectiveDateEnd('');
    setActiveFilters({
      policyNumber: '',
      policyholder: '',
      status: '',
      productName: '',
      effectiveDateStart: '',
      effectiveDateEnd: ''
    });
    setCurrentPage(1);
  };

  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      const matchPolicyNum = !activeFilters.policyNumber || p.policyNumber.toLowerCase().includes(activeFilters.policyNumber.toLowerCase());
      const matchPolicyholder = !activeFilters.policyholder || p.policyholder.name.toLowerCase().includes(activeFilters.policyholder.toLowerCase());
      const matchStatus = !activeFilters.status || p.status === activeFilters.status;
      const matchProduct = !activeFilters.productName || p.productName.toLowerCase().includes(activeFilters.productName.toLowerCase());

      const effectiveDate = p.effectiveDate.split('T')[0];
      const matchDate = (!activeFilters.effectiveDateStart || effectiveDate >= activeFilters.effectiveDateStart) &&
                       (!activeFilters.effectiveDateEnd || effectiveDate <= activeFilters.effectiveDateEnd);

      return matchPolicyNum && matchPolicyholder && matchStatus && matchProduct && matchDate;
    });
  }, [policies, activeFilters]);

  const paginatedPolicies = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPolicies.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPolicies, currentPage]);

  const totalPages = Math.ceil(filteredPolicies.length / ITEMS_PER_PAGE);

  const getStatusStyle = (status: PolicyStatus) => {
    switch (status) {
      case PolicyStatus.DRAFT: return 'bg-gray-50 text-gray-700 border-gray-100';
      case PolicyStatus.PENDING_PAYMENT: return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case PolicyStatus.EFFECTIVE: return 'bg-green-50 text-green-700 border-green-100';
      case PolicyStatus.LAPSED: return 'bg-orange-50 text-orange-700 border-orange-100';
      case PolicyStatus.SURRENDERED: return 'bg-red-50 text-red-700 border-red-100';
      case PolicyStatus.EXPIRED: return 'bg-blue-50 text-blue-700 border-blue-100';
      case PolicyStatus.CANCELLED: return 'bg-gray-100 text-gray-500 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">保单管理</h1>
        <button
          onClick={onCreatePolicy}
          className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700 transition"
        >
          + 新建保单
        </button>
      </div>

      {/* Filter Module */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="保单号"
            value={policyNumber}
            onChange={e => setPolicyNumber(e.target.value)}
            placeholder="请输入保单号"
          />
          <Input
            label="投保人"
            value={policyholder}
            onChange={e => setPolicyholder(e.target.value)}
            placeholder="请输入投保人姓名"
          />
          <Input
            label="产品名称"
            value={productName}
            onChange={e => setProductName(e.target.value)}
            placeholder="请输入产品名称"
          />
          <Select
            label="保单状态"
            value={status}
            onChange={setStatus}
            options={Object.values(PolicyStatus).map(s => ({ label: s, value: s }))}
            placeholder="请选择状态"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">生效日期范围</label>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={effectiveDateStart}
                onChange={e => setEffectiveDateStart(e.target.value)}
                className="flex-1 h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={effectiveDateEnd}
                onChange={e => setEffectiveDateEnd(e.target.value)}
                className="flex-1 h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="lg:col-span-3 flex items-end justify-end space-x-3">
            <button
              onClick={handleReset}
              className="h-9 px-5 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition"
            >
              重置
            </button>
            <button
              onClick={handleSearch}
              className="h-9 px-5 bg-brand-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-brand-blue-700 transition"
            >
              查询
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">保单号</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">投保人</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">产品名称</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">保险公司</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">生效日期</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">失效日期</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">保费</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">理赔次数</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPolicies.length > 0 ? paginatedPolicies.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm font-mono text-brand-blue-600 cursor-pointer hover:underline"
                    onClick={() => onViewDetail(p)}
                  >
                    {p.policyNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.policyholder.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.productName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.companyName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.effectiveDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.expiryDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    ¥{p.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                    {p.claimCount} 次
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusStyle(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                    <button onClick={() => onViewDetail(p)} className="text-brand-blue-600 hover:text-brand-blue-900">查看</button>
                    {p.status === PolicyStatus.EFFECTIVE && (
                      <button onClick={() => onInitiateClaim(p)} className="text-green-600 hover:text-green-900">发起理赔</button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-500">暂无符合条件的保单数据</td>
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
            totalItems={filteredPolicies.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>
    </div>
  );
};

export default PolicyListPage;
