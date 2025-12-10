
import React, { useState, useMemo, useEffect } from 'react';
import { type IndustryData, type CitySalaryData, type CriticalIllnessRateData, type AccidentRateData, type DeathRateData, type HospitalizationRateData, type OutpatientRateData } from '../types';
import { MOCK_CITY_SALARY_DATA, MOCK_CRITICAL_ILLNESS_DATA, MOCK_ACCIDENT_RATE_DATA, MOCK_DEATH_RATE_DATA, MOCK_HOSPITALIZATION_RATE_DATA, MOCK_OUTPATIENT_RATE_DATA } from '../constants';
import Pagination from './ui/Pagination';
import ExcelImportModal from './ui/ExcelImportModal';

interface EditIndustryDataPageProps {
  industryData: IndustryData;
  onBack: () => void;
}

const EditIndustryDataPage: React.FC<EditIndustryDataPageProps> = ({ industryData, onBack }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const ITEMS_PER_PAGE = 10;
  
  // State to hold the data list. Type can be city salary, critical illness rate, or accident rate.
  const [dataList, setDataList] = useState<any[]>([]);

  useEffect(() => {
    if (industryData.code === 'ID_INS001') {
      setDataList(MOCK_CITY_SALARY_DATA);
    } else if (industryData.code === 'ID_INS002') {
      setDataList(MOCK_CRITICAL_ILLNESS_DATA);
    } else if (industryData.code === 'ID_INS003') {
      setDataList(MOCK_ACCIDENT_RATE_DATA);
    } else if (industryData.code === 'ID_INS004') {
      setDataList(MOCK_DEATH_RATE_DATA);
    } else if (industryData.code === 'ID_INS005') {
      setDataList(MOCK_HOSPITALIZATION_RATE_DATA);
    } else if (industryData.code === 'ID_INS006') {
      setDataList(MOCK_OUTPATIENT_RATE_DATA);
    } else {
      setDataList([]);
    }
    setCurrentPage(1);
  }, [industryData.code]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return dataList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [dataList, currentPage]);

  const totalPages = Math.ceil(dataList.length / ITEMS_PER_PAGE);

  const renderTable = () => {
    const commonTableClass = "min-w-full divide-y divide-gray-200";
    const commonHeaderClass = "px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap sticky top-0 bg-gray-50 z-10 shadow-sm";
    const commonCellClass = "px-6 py-4 whitespace-nowrap text-sm text-gray-900";
    const commonCellSecondaryClass = "px-6 py-4 whitespace-nowrap text-sm text-gray-600";

    if (industryData.code === 'ID_INS001') {
      return (
        <table className={commonTableClass}>
          <thead className="bg-gray-50">
              <tr>
                  <th className={commonHeaderClass}>省、直辖市名称</th>
                  <th className={commonHeaderClass}>城市名称</th>
                  <th className={commonHeaderClass}>省 GB 码</th>
                  <th className={commonHeaderClass}>市 GB 码</th>
                  <th className={commonHeaderClass}>2024 年社会平均工资（年）</th>
                  <th className={commonHeaderClass}>2024 年社会平均工资（月）</th>
                  <th className={commonHeaderClass}>每月护理费用</th>
                  <th className={commonHeaderClass}>每月生活支出</th>
              </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.map((item: CitySalaryData, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className={commonCellClass}>{item.provinceName}</td>
                      <td className={commonCellClass}>{item.cityName}</td>
                      <td className={commonCellSecondaryClass}>{item.provinceGbCode}</td>
                      <td className={commonCellSecondaryClass}>{item.cityGbCode}</td>
                      <td className={commonCellSecondaryClass}>{item.avgAnnualSalary}</td>
                      <td className={commonCellSecondaryClass}>{item.avgMonthlySalary}</td>
                      <td className={commonCellSecondaryClass}>{item.monthlyNursingCost}</td>
                      <td className={commonCellSecondaryClass}>{item.monthly_living_expense}</td>
                  </tr>
              ))}
          </tbody>
      </table>
      );
    } else if (industryData.code === 'ID_INS002') {
      return (
        <table className={commonTableClass}>
          <thead className="bg-gray-50">
              <tr>
                  <th className={commonHeaderClass}>年龄</th>
                  <th className={commonHeaderClass}>性别</th>
                  <th className={commonHeaderClass}>重疾发生概率</th>
              </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.map((item: CriticalIllnessRateData, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className={commonCellClass}>{item.age}</td>
                      <td className={commonCellClass}>{item.gender}</td>
                      <td className={commonCellSecondaryClass}>{item.rate}</td>
                  </tr>
              ))}
          </tbody>
        </table>
      );
    } else if (industryData.code === 'ID_INS003') {
        return (
          <table className={commonTableClass}>
            <thead className="bg-gray-50">
                <tr>
                    <th className={commonHeaderClass}>年龄</th>
                    <th className={commonHeaderClass}>性别</th>
                    <th className={commonHeaderClass}>意外险发生概率</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((item: AccidentRateData, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className={commonCellClass}>{item.age}</td>
                        <td className={commonCellClass}>{item.gender}</td>
                        <td className={commonCellSecondaryClass}>{item.rate}</td>
                    </tr>
                ))}
            </tbody>
          </table>
        );
      } else if (industryData.code === 'ID_INS004') {
        return (
          <table className={commonTableClass}>
            <thead className="bg-gray-50">
                <tr>
                    <th className={commonHeaderClass}>年龄</th>
                    <th className={commonHeaderClass}>死亡率</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((item: DeathRateData, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className={commonCellClass}>{item.age}</td>
                        <td className={commonCellSecondaryClass}>{item.rate}</td>
                    </tr>
                ))}
            </tbody>
          </table>
        );
      } else if (industryData.code === 'ID_INS005') {
        return (
          <table className={commonTableClass}>
            <thead className="bg-gray-50">
                <tr>
                    <th className={commonHeaderClass}>年龄</th>
                    <th className={commonHeaderClass}>性别</th>
                    <th className={commonHeaderClass}>住院概率</th>
                    <th className={commonHeaderClass}>高发大病治疗花费</th>
                    <th className={commonHeaderClass}>花费最高可达</th>
                    <th className={commonHeaderClass}>配齐规则（向上取百万）</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((item: HospitalizationRateData, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className={commonCellClass}>{item.age}</td>
                        <td className={commonCellClass}>{item.gender}</td>
                        <td className={commonCellSecondaryClass}>{item.rate}</td>
                        <td className={commonCellSecondaryClass}>{item.treatmentCost}</td>
                        <td className={commonCellSecondaryClass}>{item.maxCost}</td>
                        <td className={commonCellSecondaryClass}>{item.roundingRule}</td>
                    </tr>
                ))}
            </tbody>
          </table>
        );
      } else if (industryData.code === 'ID_INS006') {
        return (
          <table className={commonTableClass}>
            <thead className="bg-gray-50">
                <tr>
                    <th className={commonHeaderClass}>年龄</th>
                    <th className={commonHeaderClass}>发生概率</th>
                    <th className={commonHeaderClass}>年均门诊次数</th>
                    <th className={commonHeaderClass}>次均花费金额（元）</th>
                    <th className={commonHeaderClass}>年均花费金额（元）</th>
                    <th className={commonHeaderClass}>建议保额（元）</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((item: OutpatientRateData, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className={commonCellClass}>{item.age}</td>
                        <td className={commonCellSecondaryClass}>{item.rate}</td>
                        <td className={commonCellSecondaryClass}>{item.avgAnnualVisits}</td>
                        <td className={commonCellSecondaryClass}>{item.avgCostPerVisit}</td>
                        <td className={commonCellSecondaryClass}>{item.avgAnnualCost}</td>
                        <td className={commonCellSecondaryClass}>{item.suggestedSumAssured}</td>
                    </tr>
                ))}
            </tbody>
          </table>
        );
      }
    return (
      <div className="p-8 text-center text-gray-500">
        暂无数据展示
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div className="flex items-center">
             <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                返回列表
            </button>
          </div>
          <button 
                onClick={() => setIsExcelModalOpen(true)}
                className="px-4 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500"
          >
              Excel 导入
          </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
             <h2 className="text-xl font-bold text-gray-800">编辑：{industryData.name}</h2>
        </div>
        
        <div className="flex-1 overflow-auto">
            {renderTable()}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-white">
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={dataList.length}
                itemsPerPage={ITEMS_PER_PAGE}
            />
        </div>
      </div>
      
      <ExcelImportModal isOpen={isExcelModalOpen} onClose={() => setIsExcelModalOpen(false)} />
    </div>
  );
};

export default EditIndustryDataPage;
