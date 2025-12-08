
import React, { useState, useMemo } from 'react';
import { MOCK_COMPANY_LIST } from '../constants';
import { type CompanyListItem } from '../types';
import Pagination from './ui/Pagination';

interface CompanyManagementPageProps {
  onAddCompany: () => void;
  onViewCompany: (code: string) => void;
  onEditCompany: (code: string) => void;
  companyCode?: string;
}

const CompanyManagementPage: React.FC<CompanyManagementPageProps> = ({ onAddCompany, onViewCompany, onEditCompany, companyCode }) => {
  const [companies, setCompanies] = useState<CompanyListItem[]>(MOCK_COMPANY_LIST);
  
  // Search State
  const [nameQuery, setNameQuery] = useState('');
  const [activeNameQuery, setActiveNameQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleSearch = () => {
    setActiveNameQuery(nameQuery);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setNameQuery('');
    setActiveNameQuery('');
    setCurrentPage(1);
  };

  const filteredCompanies = useMemo(() => {
    const byCompany = companyCode ? companies.filter(c => c.code === companyCode) : companies;
    if (!activeNameQuery) return byCompany;
    const lowerQuery = activeNameQuery.toLowerCase();
    return byCompany.filter(company => 
      company.fullName.toLowerCase().includes(lowerQuery) || 
      company.shortName.toLowerCase().includes(lowerQuery)
    );
  }, [companies, activeNameQuery, companyCode]);

  const paginatedCompanies = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCompanies.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCompanies, currentPage]);

  const totalPages = Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold text-slate-900">保险公司管理</h1>

       {/* Search Module */}
       <div className="bg-white p-6 rounded-md shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
             <div className="md:col-span-1">
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">保司名称</label>
                <input 
                    id="companyName"
                    type="text" 
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="请输入保司全称或简称" 
                    className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                />
             </div>
             <div className="flex items-center space-x-3">
                <button onClick={handleReset} className="h-9 px-5 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition">重置</button>
                <button onClick={handleSearch} className="h-9 px-5 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition">查询</button>
             </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-base font-semibold text-gray-900">保险公司列表</h2>
            <button
              onClick={onAddCompany}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500"
            >
              新增保司
            </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">保司全称</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">保司简称</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">保司代码</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">客服电话</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">官网</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">注册资本</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCompanies.length > 0 ? (
                paginatedCompanies.map((company) => (
                    <tr key={company.code} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{company.fullName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{company.shortName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{company.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{company.hotline}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-brand-blue-600 hover:text-brand-blue-800 hover:underline">
                            {company.website}
                        </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{company.registeredCapital}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                        <button 
                            onClick={() => onViewCompany(company.code)} 
                            className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                        >
                            查看
                        </button>
                        <button 
                            onClick={() => onEditCompany(company.code)} 
                            className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                        >
                            修改
                        </button>
                    </td>
                    </tr>
                ))
              ) : (
                <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                        暂无符合条件的保司数据
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
                totalItems={filteredCompanies.length}
                itemsPerPage={ITEMS_PER_PAGE}
            />
        </div>
      </div>
    </div>
  );
};

export default CompanyManagementPage;
