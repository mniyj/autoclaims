import React, { useState, useMemo, useEffect } from 'react';
import { type QuoteRequest, type QuoteListItem, QuoteStatus, QuoteType } from '../types';
import Pagination from './ui/Pagination';
import Select from './ui/Select';
import Input from './ui/Input';
import { api } from '../services/api';

interface QuoteListPageProps {
  onViewDetail: (quote: QuoteRequest) => void;
  onCreateQuote: () => void;
  onConvertToPolicy: (quote: QuoteRequest) => void;
}

const QuoteListPage: React.FC<QuoteListPageProps> = ({ onViewDetail, onCreateQuote, onConvertToPolicy }) => {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const data = await api.quotes.list();
        setQuotes(data as QuoteRequest[]);
      } catch (error) {
        console.error('Failed to fetch quotes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
  }, []);

  // Filter States
  const [quoteNumber, setQuoteNumber] = useState('');
  const [policyholder, setPolicyholder] = useState('');
  const [status, setStatus] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Active Filters
  const [activeFilters, setActiveFilters] = useState({
    quoteNumber: '',
    policyholder: '',
    status: '',
    type: '',
    dateStart: '',
    dateEnd: ''
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleSearch = () => {
    setActiveFilters({
      quoteNumber,
      policyholder,
      status,
      type,
      dateStart,
      dateEnd
    });
    setCurrentPage(1);
  };

  const handleReset = () => {
    setQuoteNumber('');
    setPolicyholder('');
    setStatus('');
    setType('');
    setDateStart('');
    setDateEnd('');
    setActiveFilters({
      quoteNumber: '',
      policyholder: '',
      status: '',
      type: '',
      dateStart: '',
      dateEnd: ''
    });
    setCurrentPage(1);
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchQuoteNum = !activeFilters.quoteNumber || q.quoteNumber.toLowerCase().includes(activeFilters.quoteNumber.toLowerCase());
      const matchPolicyholder = !activeFilters.policyholder || q.policyholder.name.toLowerCase().includes(activeFilters.policyholder.toLowerCase());
      const matchStatus = !activeFilters.status || q.status === activeFilters.status;
      const matchType = !activeFilters.type || q.type === activeFilters.type;

      const quoteDate = q.createdAt.split('T')[0];
      const matchDate = (!activeFilters.dateStart || quoteDate >= activeFilters.dateStart) &&
                        (!activeFilters.dateEnd || quoteDate <= activeFilters.dateEnd);

      return matchQuoteNum && matchPolicyholder && matchStatus && matchType && matchDate;
    });
  }, [quotes, activeFilters]);

  const paginatedQuotes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredQuotes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredQuotes, currentPage]);

  const totalPages = Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE);

  const getStatusStyle = (status: QuoteStatus) => {
    switch (status) {
      case QuoteStatus.DRAFT: return 'bg-gray-50 text-gray-700 border-gray-100';
      case QuoteStatus.PENDING: return 'bg-blue-50 text-blue-700 border-blue-100';
      case QuoteStatus.QUOTED: return 'bg-purple-50 text-purple-700 border-purple-100';
      case QuoteStatus.ACCEPTED: return 'bg-green-50 text-green-700 border-green-100';
      case QuoteStatus.REJECTED: return 'bg-red-50 text-red-700 border-red-100';
      case QuoteStatus.EXPIRED: return 'bg-orange-50 text-orange-700 border-orange-100';
      case QuoteStatus.CONVERTED: return 'bg-teal-50 text-teal-700 border-teal-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const handleConvert = (quote: QuoteRequest) => {
    if (window.confirm(`确定要将询价单 ${quote.quoteNumber} 转换为保单吗？`)) {
      onConvertToPolicy(quote);
    }
  };

  const canConvertToPolicy = (quote: QuoteRequest) => {
    return quote.status === QuoteStatus.QUOTED || quote.status === QuoteStatus.ACCEPTED;
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
        <h1 className="text-2xl font-bold text-slate-900">询价单管理</h1>
        <button
          onClick={onCreateQuote}
          className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700 transition"
        >
          + 新建询价单
        </button>
      </div>

      {/* Filter Module */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="询价单号"
            value={quoteNumber}
            onChange={e => setQuoteNumber(e.target.value)}
            placeholder="请输入询价单号"
          />
          <Input
            label="投保人"
            value={policyholder}
            onChange={e => setPolicyholder(e.target.value)}
            placeholder="请输入投保人姓名"
          />
          <Select
            label="询价类型"
            value={type}
            onChange={setType}
            options={Object.values(QuoteType).map(t => ({ label: t, value: t }))}
            placeholder="请选择类型"
          />
          <Select
            label="状态"
            value={status}
            onChange={setStatus}
            options={Object.values(QuoteStatus).map(s => ({ label: s, value: s }))}
            placeholder="请选择状态"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">创建时间范围</label>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="flex-1 h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">询价单号</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">询价类型</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">投保人</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">被保险人数</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">方案数</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">有效期至</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedQuotes.length > 0 ? paginatedQuotes.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm font-mono text-brand-blue-600 cursor-pointer hover:underline"
                    onClick={() => onViewDetail(q)}
                  >
                    {q.quoteNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{q.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{q.policyholder.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{q.insureds.length}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{q.plans.length}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{q.createdAt.split('T')[0]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{q.validUntil?.split('T')[0] || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusStyle(q.status)}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                    <button onClick={() => onViewDetail(q)} className="text-brand-blue-600 hover:text-brand-blue-900">查看</button>
                    {canConvertToPolicy(q) && (
                      <button onClick={() => handleConvert(q)} className="text-green-600 hover:text-green-900">转保单</button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">暂无符合条件的询价单数据</td>
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
            totalItems={filteredQuotes.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>
    </div>
  );
};

export default QuoteListPage;
