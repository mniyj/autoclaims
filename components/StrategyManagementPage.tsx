
import React, { useState, useEffect } from 'react';
import { type DecisionTable, type DecisionRule } from '../types';
import Pagination from './ui/Pagination';
import { api } from '../services/api';

interface StrategyManagementPageProps {
  onEditStrategy?: (strategy: DecisionTable) => void;
}

const StrategyManagementPage: React.FC<StrategyManagementPageProps> = ({ onEditStrategy }) => {
  const [strategies, setStrategies] = useState<DecisionTable[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const data = await api.strategies.list();
        setStrategies(data);
      } catch (error) {
        console.error('Failed to fetch strategies:', error);
      }
    };
    fetchStrategies();
  }, []);

  const totalPages = Math.ceil(strategies.length / pageSize);
  const currentData = strategies.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleAdd = () => {
    if (onEditStrategy) {
      const newStrategy: DecisionTable = {
        code: `STRAT-${Date.now()}`,
        name: '新决策表',
        category: '医疗险',
        scene: '理赔核赔',
        primaryKey: 'age',
        metricLibrary: 'standard',
        deployed: false,
        rules: []
      };
      onEditStrategy(newStrategy);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">保险产品推荐规则表</h1>

      <div className="bg-white rounded-md shadow-sm">
        <div className="p-6 flex justify-between items-center">
          <h2 className="text-base font-semibold text-gray-900">规则表列表</h2>
          <button
            onClick={handleAdd}
            className="h-9 px-4 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition flex items-center"
          >
            新增决策表
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">编号</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">名称</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">分类</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">场景</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {currentData.length > 0 ? (
                currentData.map((row) => (
                  <tr key={row.code} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{row.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.scene}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.deployed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {row.deployed ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <button
                        onClick={() => { if (onEditStrategy) onEditStrategy(row); }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {strategies.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={strategies.length}
              itemsPerPage={pageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyManagementPage;
