
import React, { useState, useMemo } from 'react';
import Modal from './ui/Modal';
import { type DecisionTable, type DecisionRule } from '../types';
import Pagination from './ui/Pagination';

// Helper to generate the rules data
const rulesData = [
  ['0', '男', '因病门诊', 'A0202'],
  ['0', '男', '因病住院', 'A0101, A0102'],
  ['0', '男', '意外伤残', 'C0102, C0103'],
  ['0', '男', '重大疾病', 'B0201, B0301'],
  ['0', '男', '因病身故', 'F0101'],
  ['0', '女', '因病门诊', 'A0202'],
  ['0', '女', '因病住院', 'A0101, A0102'],
  ['0', '女', '意外伤残', 'C0102, C0103'],
  ['0', '女', '重大疾病', 'B0201, B0301'],
  ['0', '女', '因病身故', 'F0101'],
  ['1', '男', '因病门诊', 'A0202'],
  ['1', '男', '因病住院', 'A0101, A0102'],
  ['1', '男', '意外伤残', 'C0102, C0103'],
  ['1', '男', '重大疾病', 'B0201, B0301'],
  ['1', '男', '因病身故', 'F0101'],
  ['1', '女', '因病门诊', 'A0202'],
  ['1', '女', '因病住院', 'A0101, A0102'],
  ['1', '女', '意外伤残', 'C0102, C0103'],
  ['1', '女', '重大疾病', 'B0201, B0301'],
  ['1', '女', '因病身故', 'F0101'],
  ['2', '男', '因病门诊', 'A0202'],
  ['2', '男', '因病住院', 'A0101, A0102'],
  ['2', '男', '意外伤残', 'C0102, C0103'],
  ['2', '男', '重大疾病', 'B0201, B0301'],
  ['2', '男', '因病身故', 'F0101'],
  ['2', '女', '因病门诊', 'A0202'],
  ['2', '女', '因病住院', 'A0101, A0102'],
  ['2', '女', '意外伤残', 'C0102, C0103'],
];

const generatedRules: DecisionRule[] = rulesData.map((row, index) => ({
    id: index + 1,
    ageOperator: '=',
    ageValue: row[0],
    genderOperator: '=',
    genderValue: row[1],
    riskTypeOperator: '=',
    riskTypeValue: row[2],
    prodCodeList: row[3]
}));

const mockDecisionTables: DecisionTable[] = [
  { 
      code: 'TB_BX000100000813', 
      category: '保险', 
      scene: '保前', 
      name: '推品决策表', 
      primaryKey: '年龄-性别-风险项', 
      metricLibrary: '产品库', 
      deployed: true, 
      rules: generatedRules
  }
];

interface StrategyManagementPageProps {
  onEditStrategy: (strategy: DecisionTable) => void;
}

const StrategyManagementPage: React.FC<StrategyManagementPageProps> = ({ onEditStrategy }) => {
    const [decisionTables, setDecisionTables] = useState(mockDecisionTables);
    const [currentPage, setCurrentPage] = useState(1);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const ITEMS_PER_PAGE = 10;

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return decisionTables.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [decisionTables, currentPage]);

    const totalPages = Math.ceil(decisionTables.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold text-slate-900">策略管理</h1>
      <div className="bg-white p-6 rounded-md shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div>
            <label htmlFor="tableName" className="block text-sm font-medium text-gray-700 mb-1">决策表名称:</label>
            <input type="text" id="tableName" placeholder="请输入" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="tableCode" className="block text-sm font-medium text-gray-700 mb-1">决策表CODE:</label>
            <input type="text" id="tableCode" placeholder="请输入" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 sm:text-sm" />
          </div>
          <div className="flex items-center space-x-3 justify-start">
            <button className="h-9 px-5 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition">重置</button>
            <button className="h-9 px-5 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition">查询</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm">
        <div className="p-6 flex justify-between items-center">
            <h2 className="text-base font-semibold text-gray-900">决策表列表</h2>
            <button
                onClick={() => setIsPermissionModalOpen(true)}
                className="h-9 px-4 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition flex items-center"
            >
                新增决策表
            </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">决策表CODE</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">分类</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">场景</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">名称</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedData.map((table) => (
                <tr key={table.code} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{table.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{table.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{table.scene}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{table.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-4">
                    <button onClick={() => onEditStrategy(table)} className="text-blue-500 hover:text-blue-700">编辑</button>
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
                totalItems={decisionTables.length}
                itemsPerPage={ITEMS_PER_PAGE}
            />
        </div>
      </div>

       <Modal
          isOpen={isPermissionModalOpen}
          onClose={() => setIsPermissionModalOpen(false)}
          title="权限不足"
      >
          <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">操作受限</h3>
              <div className="mt-2 text-sm text-gray-500">
                  <p>抱歉，您没有新增策略表权限，请联系管理员。</p>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default StrategyManagementPage;
