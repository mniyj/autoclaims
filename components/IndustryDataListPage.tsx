import React, { useState, useMemo, useEffect } from 'react';
import { type IndustryData } from '../types';
import Pagination from './ui/Pagination';
import { api } from '../services/api';

interface IndustryDataListPageProps {
    onEdit: (data: IndustryData) => void;
}

const IndustryDataListPage: React.FC<IndustryDataListPageProps> = ({ onEdit }) => {
    const [industryData, setIndustryData] = useState<IndustryData[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await api.industryData.list();
                setIndustryData(data);
            } catch (error) {
                console.error('Failed to fetch industry data:', error);
            }
        };
        fetchData();
    }, []);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return industryData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [industryData, currentPage]);

    const totalPages = Math.ceil(industryData.length / ITEMS_PER_PAGE);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">行业基础数据</h1>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-base font-semibold text-gray-900">行业基础数据清单</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">行业数据code</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">行业数据名称</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">最新操作人</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">最新操作时间</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{item.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.operator}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.operationTime}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <button
                                            onClick={() => onEdit(item)}
                                            className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                                        >
                                            编辑
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-gray-200">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={industryData.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                </div>
            </div>
        </div>
    )
}

export default IndustryDataListPage;
