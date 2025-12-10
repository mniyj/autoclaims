
import React, { useState } from 'react';
import ExcelImportModal from './ui/ExcelImportModal';
import { type DecisionTable } from '../types';

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

interface StrategyManagementPageProps {
  onEditStrategy?: (strategy: DecisionTable) => void;
}

const StrategyManagementPage: React.FC<StrategyManagementPageProps> = () => {
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    
    const totalPages = Math.ceil(rulesData.length / pageSize);
    const currentData = rulesData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold text-slate-900">保险产品推荐规则表</h1>
      
      <div className="bg-white rounded-md shadow-sm">
        <div className="p-6 flex justify-between items-center">
            <h2 className="text-base font-semibold text-gray-900">保险产品推荐规则表</h2>
            <button
                onClick={() => setIsExcelModalOpen(true)}
                className="h-9 px-4 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition flex items-center"
            >
                Excel导入
            </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">序号</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">年龄</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">性别</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">风险项</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">产品代码</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {currentData.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row[0]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row[1]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row[2]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-slate-200">
            <div className="text-sm text-gray-500">
                显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, rulesData.length)} 条，共 {rulesData.length} 条
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                    上一页
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 border rounded text-sm ${
                            currentPage === page
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        {page}
                    </button>
                ))}
                <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                    下一页
                </button>
            </div>
        </div>
      </div>

       <ExcelImportModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
      />
    </div>
  );
};

export default StrategyManagementPage;
