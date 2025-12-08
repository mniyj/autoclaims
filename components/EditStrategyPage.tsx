

import React, { useState, useMemo } from 'react';
import { type DecisionTable, type DecisionRule } from '../types';
import ExcelImportModal from './ui/ExcelImportModal';
import Pagination from './ui/Pagination';

interface EditStrategyPageProps {
  strategy: DecisionTable;
  onBack: () => void;
}

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566z" clipRule="evenodd" />
    </svg>
);

type ColumnType = 'dimension' | 'value';

interface ColumnDefinition {
    label: string;
    type: ColumnType;
    operatorKey?: string;
    valueKey: keyof DecisionRule;
}

const COLUMN_DEFINITIONS: Record<string, Omit<ColumnDefinition, 'valueKey'>> = {
    ageValue: { label: '年龄', type: 'dimension', operatorKey: 'ageOperator' },
    genderValue: { label: '性别', type: 'dimension', operatorKey: 'genderOperator' },
    riskTypeValue: { label: '风险项', type: 'dimension', operatorKey: 'riskTypeOperator' },
    cityCodeValue: { label: '城市', type: 'dimension', operatorKey: 'cityCodeOperator' },
    isNewPolicy: { label: '是否新保', type: 'dimension' },
    paymentFrequency: { label: '缴费频率', type: 'dimension' },
    coverage: { label: '责任', type: 'dimension' },
    sumAssured: { label: '保额(元)', type: 'dimension' },
    prodCodeList: { label: '产品代码', type: 'value' },
    riskRate: { label: 'riskRate', type: 'value' },
    rehabilitationCost: { label: 'rehabilitationCost', type: 'value' },
    premium: { label: '保费(元)', type: 'value' },
    criticalIllnessMonths: { label: '重疾险补偿月份数', type: 'value' },
    criticalIllnessBaseCost: { label: '重疾险基础治疗费用', type: 'value' },
    accidentMonths: { label: '意外险补偿月份数', type: 'value' },
};

const EditStrategyPage: React.FC<EditStrategyPageProps> = ({ strategy, onBack }) => {
  const [tableData, setTableData] = useState<DecisionTable>(strategy);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const tableSchema = useMemo<ColumnDefinition[]>(() => {
    const firstRule = strategy.rules[0];
    if (!firstRule) return [];
    
    return Object.keys(COLUMN_DEFINITIONS)
      .filter(key => firstRule.hasOwnProperty(key))
      .map(key => ({
          ...COLUMN_DEFINITIONS[key],
          valueKey: key as keyof DecisionRule,
      }));
  }, [strategy.rules]);
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => 
    Object.fromEntries(tableSchema.map(col => [col.valueKey, true]))
  );
  
  const activeColumns = useMemo(() => tableSchema.filter(col => visibleColumns[col.valueKey]), [tableSchema, visibleColumns]);

  const totalPages = useMemo(() => {
    return tableData.rules ? Math.ceil(tableData.rules.length / ITEMS_PER_PAGE) : 1;
  }, [tableData.rules]);

  const paginatedRules = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return tableData.rules.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [tableData.rules, currentPage]);

  const totalItems = tableData.rules.length;

  const handleRuleChange = (id: number, field: keyof DecisionRule, value: string) => {
    setTableData(prev => ({
        ...prev,
        rules: prev.rules.map(rule => rule.id === id ? { ...rule, [field]: value } : rule)
    }));
  };

  const addRow = () => {
    const newRule: DecisionRule = { id: Date.now() };

    tableSchema.forEach(col => {
        (newRule as any)[col.valueKey] = '';
        if (col.operatorKey) {
            (newRule as any)[col.operatorKey] = '=';
        }
    });
    
    const newRules = [...tableData.rules, newRule];
    setTableData(prev => ({...prev, rules: newRules}));
    
    const newTotalPages = Math.ceil(newRules.length / ITEMS_PER_PAGE);
    setCurrentPage(newTotalPages);
  };

  const deleteRow = (id: number) => {
    const newRules = tableData.rules.filter(rule => rule.id !== id);
    setTableData(prev => ({...prev, rules: newRules}));
    if (paginatedRules.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleDeleteColumn = (valueKey: string) => {
    setVisibleColumns(prev => ({ ...prev, [valueKey]: false }));
  };
    
  return (
    <div className="space-y-6">
       <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            返回决策表列表
        </button>

      {/* Basic Info */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4">基础信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="text-red-500 mr-1">*</span>决策表名称:
            </label>
             <div className="relative">
                <input type="text" value={tableData.name} className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm" />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <InfoIcon />
                </div>
             </div>
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="text-red-500 mr-1">*</span>决策表分类:
            </label>
             <select className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm">
                <option>{tableData.category}</option>
            </select>
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="text-red-500 mr-1">*</span>应用场景:
            </label>
             <select className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm">
                <option>{tableData.scene}</option>
            </select>
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">维度主键:</label>
             <select className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm">
                <option>请选择</option>
                 <option selected>{tableData.primaryKey}</option>
            </select>
          </div>
        </div>
      </div>

       {/* Conditions */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">条件配置</h2>
                <div className="flex items-center space-x-2">
                    <button onClick={() => setIsExcelModalOpen(true)} className="px-4 py-1.5 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 transition">EXCEL 导入</button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            {activeColumns.map(col => (
                                <th key={col.valueKey} className={`px-2 py-2 text-left text-sm font-medium text-gray-600 ${col.type === 'value' ? 'bg-yellow-50' : ''}`}>
                                    <div className="flex items-center">
                                        <input type="checkbox" className="h-4 w-4 mr-2" />
                                        {col.label}
                                        {col.type === 'dimension' && (
                                            <button onClick={() => handleDeleteColumn(col.valueKey)} className="ml-1 p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full"><TrashIcon /></button>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="px-2 py-2 text-left text-sm font-medium text-gray-600">操作</th>
                        </tr>
                    </thead>
                     <tbody className="divide-y divide-gray-200">
                       {paginatedRules.map(rule => (
                           <tr key={rule.id}>
                               {activeColumns.map(col => (
                                    <td key={col.valueKey} className="p-1.5">
                                        <div className="flex space-x-1 items-center">
                                            <input 
                                                type="text" 
                                                value={(rule as any)[col.valueKey] || ''}
                                                onChange={e => handleRuleChange(rule.id, col.valueKey, e.target.value)} 
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-md sm:text-sm"
                                            />
                                            {col.type === 'value' && <RefreshIcon />}
                                        </div>
                                    </td>
                               ))}
                               <td className="p-1.5 text-center">
                                   <button onClick={() => deleteRow(rule.id)} className="text-brand-blue-600 hover:text-brand-blue-800 text-sm">删除</button>
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
                    totalItems={totalItems}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            </div>
            
            <button onClick={addRow} className="w-full mt-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-brand-blue-500 hover:text-brand-blue-600">
                添加一行数据
            </button>
        </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 transition">存草稿</button>
        <button onClick={onBack} className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 transition">取消</button>
        <button className="px-5 py-2 bg-brand-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-blue-700 transition">发布决策表</button>
      </div>
      
      <ExcelImportModal isOpen={isExcelModalOpen} onClose={() => setIsExcelModalOpen(false)} />
    </div>
  );
};

export default EditStrategyPage;