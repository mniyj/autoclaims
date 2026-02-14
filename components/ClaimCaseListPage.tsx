import React, { useState, useMemo } from 'react';
import { MOCK_CLAIM_CASES } from '../constants';
import { type ClaimCase, ClaimStatus } from '../types';
import Pagination from './ui/Pagination';
import Select from './ui/Select';
import Input from './ui/Input';

interface ClaimCaseListPageProps {
  onViewDetail: (claim: ClaimCase) => void;
}

const ClaimCaseListPage: React.FC<ClaimCaseListPageProps> = ({ onViewDetail }) => {
  const [cases, setCases] = useState<ClaimCase[]>(MOCK_CLAIM_CASES);
  
  // Filter States
  const [reportNumber, setReportNumber] = useState('');
  const [reporter, setReporter] = useState('');
  const [reportDateStart, setReportDateStart] = useState('');
  const [reportDateEnd, setReportDateEnd] = useState('');
  const [accidentDateStart, setAccidentDateStart] = useState('');
  const [accidentDateEnd, setAccidentDateEnd] = useState('');
  const [status, setStatus] = useState<string>('');

  // Active Filters (for search button)
  const [activeFilters, setActiveFilters] = useState({
    reportNumber: '',
    reporter: '',
    reportDateStart: '',
    reportDateEnd: '',
    accidentDateStart: '',
    accidentDateEnd: '',
    status: ''
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleSearch = () => {
    setActiveFilters({
      reportNumber,
      reporter,
      reportDateStart,
      reportDateEnd,
      accidentDateStart,
      accidentDateEnd,
      status
    });
    setCurrentPage(1);
  };

  const handleReset = () => {
    setReportNumber('');
    setReporter('');
    setReportDateStart('');
    setReportDateEnd('');
    setAccidentDateStart('');
    setAccidentDateEnd('');
    setStatus('');
    setActiveFilters({
      reportNumber: '',
      reporter: '',
      reportDateStart: '',
      reportDateEnd: '',
      accidentDateStart: '',
      accidentDateEnd: '',
      status: ''
    });
    setCurrentPage(1);
  };

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchReportNum = !activeFilters.reportNumber || c.reportNumber.toLowerCase().includes(activeFilters.reportNumber.toLowerCase());
      const matchReporter = !activeFilters.reporter || c.reporter.toLowerCase().includes(activeFilters.reporter.toLowerCase());
      const matchStatus = !activeFilters.status || c.status === activeFilters.status;
      
      const cReportDate = c.reportTime.split(' ')[0];
      const matchReportDate = (!activeFilters.reportDateStart || cReportDate >= activeFilters.reportDateStart) &&
                              (!activeFilters.reportDateEnd || cReportDate <= activeFilters.reportDateEnd);
      
      const cAccidentDate = c.accidentTime.split(' ')[0];
      const matchAccidentDate = (!activeFilters.accidentDateStart || cAccidentDate >= activeFilters.accidentDateStart) &&
                                (!activeFilters.accidentDateEnd || cAccidentDate <= activeFilters.accidentDateEnd);

      return matchReportNum && matchReporter && matchStatus && matchReportDate && matchAccidentDate;
    });
  }, [cases, activeFilters]);

  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCases, currentPage]);

  const totalPages = Math.ceil(filteredCases.length / ITEMS_PER_PAGE);

  const getStatusStyle = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.REPORTED: return 'bg-blue-50 text-blue-700 border-blue-100';
      case ClaimStatus.PROCESSING: return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case ClaimStatus.PENDING_INFO: return 'bg-orange-50 text-orange-700 border-orange-100';
      case ClaimStatus.APPROVED: return 'bg-green-50 text-green-700 border-green-100';
      case ClaimStatus.REJECTED: return 'bg-red-50 text-red-700 border-red-100';
      case ClaimStatus.CANCELLED: return 'bg-gray-50 text-gray-500 border-gray-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">赔案清单</h1>

      {/* Filter Module */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input 
            label="报案号" 
            value={reportNumber} 
            onChange={e => setReportNumber(e.target.value)} 
            placeholder="请输入报案号" 
          />
          <Input 
            label="报案人" 
            value={reporter} 
            onChange={e => setReporter(e.target.value)} 
            placeholder="请输入报案人姓名" 
          />
          <Select 
            label="案件状态" 
            value={status} 
            onChange={setStatus} 
            options={Object.values(ClaimStatus).map(s => ({ label: s, value: s }))} 
            placeholder="请选择状态"
          />
          <div className="space-y-1">
             <label className="block text-sm font-medium text-gray-700">报案时间范围</label>
             <div className="flex items-center space-x-2">
                <input 
                    type="date" 
                    value={reportDateStart} 
                    onChange={e => setReportDateStart(e.target.value)}
                    className="flex-1 h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input 
                    type="date" 
                    value={reportDateEnd} 
                    onChange={e => setReportDateEnd(e.target.value)}
                    className="flex-1 h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
                />
             </div>
          </div>
          <div className="space-y-1">
             <label className="block text-sm font-medium text-gray-700">事故时间范围</label>
             <div className="flex items-center space-x-2">
                <input 
                    type="date" 
                    value={accidentDateStart} 
                    onChange={e => setAccidentDateStart(e.target.value)}
                    className="flex-1 h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input 
                    type="date" 
                    value={accidentDateEnd} 
                    onChange={e => setAccidentDateEnd(e.target.value)}
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">报案号</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">报案人</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">报案时间</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">事故时间</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">事故原因</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">索赔金额</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">保险产品</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">操作人</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCases.length > 0 ? paginatedCases.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-brand-blue-600 cursor-pointer hover:underline" onClick={() => onViewDetail(c)}>{c.reportNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.reporter}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.reportTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.accidentTime}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.accidentReason}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">¥{c.claimAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.productName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusStyle(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.operator}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                    <button onClick={() => onViewDetail(c)} className="text-brand-blue-600 hover:text-brand-blue-900">查看</button>
                    <button onClick={() => onViewDetail(c)} className="text-brand-blue-600 hover:text-brand-blue-900">处理</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-500">暂无符合条件的赔案数据</td>
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
            totalItems={filteredCases.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>
    </div>
  );
};

export default ClaimCaseListPage;
