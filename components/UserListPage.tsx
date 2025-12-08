
import React, { useState, useMemo } from 'react';
import { MOCK_END_USERS } from '../constants';
import { type EndUser } from '../types';
import Pagination from './ui/Pagination';

const UserListPage: React.FC = () => {
    const [users, setUsers] = useState<EndUser[]>(MOCK_END_USERS);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchesSearch = user.name.includes(searchQuery) || 
                                  user.city.includes(searchQuery) ||
                                  user.channel.includes(searchQuery);
            
            const submissionDate = user.submissionTime.split(' ')[0];
            const isAfterStart = startDate ? submissionDate >= startDate : true;
            const isBeforeEnd = endDate ? submissionDate <= endDate : true;

            return matchesSearch && isAfterStart && isBeforeEnd;
        });
    }, [users, searchQuery, startDate, endDate]);

    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredUsers, currentPage]);

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

    const formatCurrency = (amount: number) => {
        if (amount === 0) return '-';
        return `${(amount / 10000).toFixed(0)}万`;
    };

    const handleReset = () => {
        setSearchQuery('');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">用户清单</h1>
            
            {/* Search Filter */}
            <div className="bg-white p-6 rounded-md shadow-sm">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px] max-w-sm">
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
                        <input
                            type="text"
                            id="search"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="搜索姓名、城市或渠道"
                            className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                            className="h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                        <input
                            type="date"
                            id="endDate"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                            className="h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-blue-500 text-sm"
                        />
                    </div>
                    <button 
                        onClick={handleReset}
                        className="h-9 px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-200 transition"
                    >
                        重置
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <h2 className="text-base font-semibold text-gray-900">用户列表</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">用户名称</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">年龄</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">常驻城市</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">月收入(元)</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">家庭成员</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">意外险缺口</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">医疗险缺口</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">重疾险缺口</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">定寿缺口</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">养老金缺口</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">教育金缺口</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">填写时间</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider whitespace-nowrap">渠道</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedUsers.length > 0 ? (
                                paginatedUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{user.age}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{user.city}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{user.monthlyIncome.toLocaleString()}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 max-w-[150px] truncate" title={user.familyMembers}>{user.familyMembers}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 font-medium">{formatCurrency(user.gaps.accident)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 font-medium">{formatCurrency(user.gaps.medical)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 font-medium">{formatCurrency(user.gaps.criticalIllness)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 font-medium">{formatCurrency(user.gaps.termLife)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 font-medium">{formatCurrency(user.gaps.annuity)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600 font-medium">{formatCurrency(user.gaps.education)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{user.submissionTime}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-brand-blue-600 border border-blue-100 text-xs">{user.channel}</span></td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={13} className="px-6 py-8 text-center text-sm text-gray-500">
                                        暂无用户数据
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
                        totalItems={filteredUsers.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                </div>
            </div>
        </div>
    );
};

export default UserListPage;
