
import React, { useState, useMemo, useEffect } from 'react';
import { PRIMARY_CATEGORIES, CLAUSE_TYPES, MOCK_COMPANY_LIST } from '../constants';
import { type Clause, ProductStatus } from '../types';
import Pagination from './ui/Pagination';
import { api } from '../services/api';

interface ClauseManagementPageProps {
  onAddClause: () => void;
  onViewClause: (clause: Clause) => void;
  onEditClause: (clause: Clause) => void;
  companyCode?: string;
}

const ClauseManagementPage: React.FC<ClauseManagementPageProps> = ({ onAddClause, onViewClause, onEditClause, companyCode }) => {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchClauses = async () => {
      try {
        const data = await api.clauses.list();
        setClauses(data);
      } catch (error) {
        console.error('Failed to fetch clauses:', error);
      }
    };
    fetchClauses();
  }, []);

  // Filter States
  const [nameQuery, setNameQuery] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [typeQuery, setTypeQuery] = useState('');

  // Active Filters (applied on search)
  const [activeFilters, setActiveFilters] = useState({
    name: '',
    category: '',
    type: ''
  });

  const handleSearch = () => {
    setActiveFilters({
      name: nameQuery,
      category: categoryQuery,
      type: typeQuery
    });
    setCurrentPage(1);
  };

  const handleReset = () => {
    setNameQuery('');
    setCategoryQuery('');
    setTypeQuery('');
    setActiveFilters({ name: '', category: '', type: '' });
    setCurrentPage(1);
  };

  const handleStatusToggle = async (productCode: string) => {
    const updatedClauses = clauses.map(clause => {
      if (clause.productCode === productCode) {
        const newStatus =
          clause.status === ProductStatus.ACTIVE
            ? ProductStatus.INACTIVE
            : ProductStatus.ACTIVE;
        return { ...clause, status: newStatus };
      }
      return clause;
    });

    try {
      await api.clauses.saveAll(updatedClauses);
      setClauses(updatedClauses);
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('状态更新失败');
    }
  };

  const filteredClauses = useMemo(() => {
    return clauses.filter(clause => {
      const matchName = clause.regulatoryName.toLowerCase().includes(activeFilters.name.toLowerCase());
      const matchCategory = activeFilters.category ? clause.primaryCategory === activeFilters.category : true;
      const matchType = activeFilters.type ? clause.clauseType === activeFilters.type : true;
      const targetCompany = companyCode ? MOCK_COMPANY_LIST.find(c => c.code === companyCode)?.shortName : undefined;
      const matchCompany = targetCompany ? clause.companyName === targetCompany : true;
      return matchName && matchCategory && matchType && matchCompany;
    });
  }, [clauses, activeFilters, companyCode]);

  const paginatedClauses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClauses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredClauses, currentPage]);

  const totalPages = Math.ceil(filteredClauses.length / ITEMS_PER_PAGE);

  const StatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
    const statusMap = {
      [ProductStatus.ACTIVE]: { text: '生效', bg: 'bg-green-100', text_color: 'text-green-800' },
      [ProductStatus.INACTIVE]: { text: '失效', bg: 'bg-red-100', text_color: 'text-red-800' },
      [ProductStatus.DRAFT]: { text: '草稿', bg: 'bg-yellow-100', text_color: 'text-yellow-800' },
    };
    const { text, bg, text_color } = statusMap[status] || { text: '未知', bg: 'bg-gray-100', text_color: 'text-gray-800' };
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bg} ${text_color}`}>
        {text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">条款管理</h1>

      {/* Filter Section */}
      <div className="bg-white p-6 rounded-md shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label htmlFor="clauseName" className="block text-sm font-medium text-gray-700 mb-1">条款名称</label>
            <input
              id="clauseName"
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="请输入条款名称"
              className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">险种</label>
            <select
              id="category"
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="">全部</option>
              {PRIMARY_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">类型</label>
            <select
              id="type"
              value={typeQuery}
              onChange={(e) => setTypeQuery(e.target.value)}
              className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="">全部</option>
              {CLAUSE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleReset} className="h-9 px-5 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition">重置</button>
            <button onClick={handleSearch} className="h-9 px-5 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition">查询</button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-md">
        <div className="p-6 flex justify-between items-center">
          <h2 className="text-base font-semibold text-gray-900">条款列表</h2>
          <button
            onClick={onAddClause}
            className="h-9 px-4 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition-colors"
          >
            新增条款
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">条款代码</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">条款名称</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">险种</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">类型</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">状态</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">操作人</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedClauses.map((clause) => (
                <tr key={clause.productCode} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{clause.productCode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{clause.regulatoryName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{clause.primaryCategory}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{clause.clauseType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <StatusBadge status={clause.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{clause.operator || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-4">
                    <button onClick={() => onViewClause(clause)} className="text-blue-500 hover:text-blue-700">查看</button>
                    {(clause.status === ProductStatus.INACTIVE || clause.status === ProductStatus.DRAFT) && (
                      <button onClick={() => onEditClause(clause)} className="text-blue-500 hover:text-blue-700">修改</button>
                    )}
                    <button
                      onClick={() => handleStatusToggle(clause.productCode)}
                      className={clause.status === ProductStatus.ACTIVE ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-800"}
                    >
                      {clause.status === ProductStatus.ACTIVE ? '失效' : '生效'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredClauses.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>
    </div>
  );
};

export default ClauseManagementPage;
