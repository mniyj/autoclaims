

import React from 'react';
import { type Clause, PrimaryCategory } from '../types';
import Input from './ui/Input';
import FileDisplay from './ui/FileDisplay';

const ViewClausePage: React.FC<{ clause: Clause; onBack: () => void; }> = ({ clause, onBack }) => {
    
    const CASH_VALUE_CATEGORIES: PrimaryCategory[] = [
        PrimaryCategory.ANNUITY,
        PrimaryCategory.WHOLE_LIFE,
        PrimaryCategory.TERM_LIFE,
        PrimaryCategory.CRITICAL_ILLNESS
    ];

    const showCashValueTable = clause.primaryCategory && CASH_VALUE_CATEGORIES.includes(clause.primaryCategory);

    const BASIC_SUM_INSURED_CATEGORIES: PrimaryCategory[] = [
        PrimaryCategory.ANNUITY,
        PrimaryCategory.WHOLE_LIFE,
    ];
    const showBasicSumInsuredTable = clause.primaryCategory && BASIC_SUM_INSURED_CATEGORIES.includes(clause.primaryCategory);

    return (
        <div className="max-w-4xl mx-auto">
             <div className="flex items-center mb-6">
                <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    返回条款列表
                </button>
            </div>
            <div className="bg_white p-8 rounded-lg shadow-sm border border-gray-200">
                <div className="space-y-8">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">查看条款详情: {clause.regulatoryName}</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="险种" id="primaryCategory" name="primaryCategory" value={clause.primaryCategory} disabled />
                        <Input label="条款类型" id="clauseType" name="clauseType" value={clause.clauseType} disabled />
                        <Input label="条款代码" id="productCode" name="productCode" value={clause.productCode} disabled />
                        <Input label="条款名称" id="regulatoryName" name="regulatoryName" value={clause.regulatoryName} disabled />
                        <Input label="保险公司名称" id="companyName" name="companyName" value={clause.companyName} disabled />
                        <Input label="状态" id="status" name="status" value={clause.status} disabled />
                        <Input label="生效日期" id="effectiveDate" name="effectiveDate" type="date" value={clause.effectiveDate} disabled />
                        <Input label="失效日期" id="discontinuationDate" name="discontinuationDate" type="date" value={clause.discontinuationDate} disabled />
                    </div>

                    <div className="space-y-6 pt-6 border-t border-gray-200">
                         <h3 className="text-lg font_medium text-gray-900">已上传文件</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FileDisplay label="条款原文" fileName={clause.clauseTextFile} />
                            <FileDisplay label="费率表" fileName={clause.rateTableFile} />
                            <FileDisplay label="产品说明" fileName={clause.productDescriptionFile} />
                            {showCashValueTable && (
                                 <FileDisplay label="现金价值表" fileName={clause.cashValueTableFile} />
                            )}
                            {showBasicSumInsuredTable && (
                                 <FileDisplay label="基本保险金额表" fileName={clause.basicSumInsuredTableFile} />
                            )}
                            {clause.productAttachments && clause.productAttachments.length > 0 && (
                                <div className="md:col-span-2">
                                     <label className="block text-sm font-medium text-gray-700 mb-1">其他产品附件</label>
                                     <div className="space-y-2 mt-1">
                                         {clause.productAttachments.map((file, index) => (
                                            <div key={index} className="flex items-center p-3 h-11 w-full border border-gray-200 rounded-md bg-gray-50 text-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span className="text-gray-800 truncate flex-grow">{file}</span>
                                                <a href="#" className="ml-4 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-800 flex-shrink-0">下载</a>
                                            </div>
                                         ))}
                                     </div>
                                </div>
                            )}
                         </div>
                    </div>

                    {Array.isArray((clause as any).selectedResponsibilities) && (clause as any).selectedResponsibilities.length > 0 && (
                      <div className="space-y-3 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">已选择责任</h3>
                        <div className="space-y-2">
                          {(clause as any).selectedResponsibilities.map((r: any) => (
                            <div key={r.code} className="flex items-start p-3 border border-gray-200 rounded-md">
                              <div className="flex-1 text-sm">
                                <div className="font-medium text-gray-800">{r.name} <span className="ml-2 font-mono text-gray-500">{r.code}</span></div>
                                <div className="text-xs text-gray-500">分类：{r.category}</div>
                                <div className="text-gray-600 mt-1">{r.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                     <div className="pt-6 border-t border-gray-200 flex justify-end">
                        <button
                            onClick={onBack}
                            className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                            返回
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewClausePage;
