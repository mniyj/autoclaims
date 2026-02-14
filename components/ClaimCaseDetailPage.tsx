import React, { useState } from 'react';
import { type ClaimCase, ClaimStatus } from '../types';

interface ClaimCaseDetailPageProps {
  claim: ClaimCase;
  onBack: () => void;
}

const ClaimCaseDetailPage: React.FC<ClaimCaseDetailPageProps> = ({ claim, onBack }) => {
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({ '医疗费用': true });

  const toggleFileCategory = (name: string) => {
    setOpenFiles(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[#2d3a8c]">索赔向导</h1>
        </div>
        <div className="flex items-center space-x-3">
          <span className="bg-[#eef2ff] text-[#4338ca] px-4 py-1.5 rounded-full text-sm font-medium border border-[#e0e7ff]">
            索赔编号: {claim.reportNumber}
          </span>
          <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            操作日志
          </button>
          <button className="flex items-center px-4 py-2 bg-[#4f46e5] text-white rounded-md text-sm font-medium hover:bg-[#4338ca] shadow-sm">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            处理索赔
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">索赔概览</h2>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-sm text-gray-500 mb-1">状态</p>
                <div className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
                  <span className="text-sm font-bold text-gray-900">{claim.status}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">索赔金额</p>
                <p className="text-lg font-bold text-gray-900">¥{claim.claimAmount?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">核准金额</p>
                <p className="text-lg font-bold text-blue-600">¥{claim.approvedAmount?.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Policy Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">保单信息</h2>
              <button className="text-blue-600 text-sm font-medium hover:underline">查看完整保单</button>
            </div>
            <div className="grid grid-cols-2 gap-y-6 gap-x-12">
              <div>
                <p className="text-sm text-gray-500 mb-1">投保人</p>
                <p className="text-sm font-bold text-gray-900">{claim.policyholder || '张伟'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">被保险人</p>
                <p className="text-sm font-bold text-gray-900">{claim.insured || '李娜'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">保险期间</p>
                <p className="text-sm font-bold text-gray-900">{claim.policyPeriod || '2024年1月1日 - 2024年12月31日'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">保单号</p>
                <p className="text-sm font-bold text-gray-900">{claim.policyNumber || 'POL-2024-7890'}</p>
              </div>
            </div>
          </div>

          {/* Accident Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">事故详情</h2>
            <div className="grid grid-cols-2 gap-y-6 gap-x-12 border-b border-gray-100 pb-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">报案人</p>
                <p className="text-sm font-bold text-gray-900">{claim.reporter}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">报案时间</p>
                <p className="text-sm font-bold text-gray-900">{claim.reportTime}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">事故时间</p>
                <p className="text-sm font-bold text-gray-900">{claim.accidentTime}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">索赔金额</p>
                <p className="text-sm font-bold text-gray-900">¥{claim.claimAmount?.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-1">事故地点</p>
              <p className="text-sm font-bold text-gray-900">{claim.accidentLocation || '中国北京市朝阳区主街123号'}</p>
            </div>
          </div>

          {/* Claim Calculation Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">理赔计算</h2>
              <button className="flex items-center px-4 py-2 bg-[#4f46e5] text-white rounded-md text-sm font-medium hover:bg-[#4338ca]">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑表格
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">责任类型</th>
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">文件名</th>
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">日期</th>
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">项目</th>
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">金额 (¥)</th>
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">理赔 (¥)</th>
                    <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">依据</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {/* Group 1: 医疗费用 */}
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">医疗费用</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">发票1.jpg</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">2025-1-1</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">色甘酸钠</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">17</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">17</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">乙类药，保险覆盖，100%报销</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">急诊诊疗</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">25</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">25</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">甲类药，保险覆盖，100%报销</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">氯胆乳膏</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">30</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">24</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">丙类药，不属保险范围，80%报销</td>
                  </tr>
                  <tr className="bg-gray-50/50 font-bold">
                    <td colSpan={3}></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">小计</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">72</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">66</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">单日限额¥200，总限额¥10,000</td>
                  </tr>

                  {/* Group 2: Medical */}
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">Medical</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Invoice 2.jpg</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">2025-1-2</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Sodium Cromoglicate</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">17</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">17</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Class B, covered by insurance, 100% reimbursement</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Emergency Consultation</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">25</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">25</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Class A, covered by insurance, 100% reimbursement</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Hydroquinone Cream</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">30</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">24</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Class C, not covered by insurance, 80% reimbursement</td>
                  </tr>
                  <tr className="bg-gray-50/50 font-bold">
                    <td colSpan={3}></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Subtotal</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">72</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">66</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">Daily limit within ¥200, total limit within ¥10,000</td>
                  </tr>

                  {/* Grand Total */}
                  <tr className="bg-[#f8f9fc] font-bold">
                    <td colSpan={3}></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2d3a8c]">总计</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2d3a8c]">144</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2d3a8c]">132</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Claim Files Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">索赔文件</h2>
            <div className="space-y-2">
              {[
                { name: '医疗费用', count: 3 },
                { name: '伤残费用', count: 0 },
                { name: '误工费', count: 1 }
              ].map((cat, i) => (
                <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                  <button 
                    onClick={() => toggleFileCategory(cat.name)}
                    className="w-full flex justify-between items-center px-4 py-3 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                  >
                    <span>{cat.name} ({cat.count}个文件)</span>
                    <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${openFiles[cat.name] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFiles[cat.name] && cat.count > 0 && (
                    <div className="px-4 py-2 space-y-2 bg-gray-50/30">
                      {Array.from({ length: cat.count }).map((_, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-xs text-blue-600 hover:underline cursor-pointer">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 00-2 2z" />
                          </svg>
                          <span>{cat.name === '医疗费用' ? `发票${idx + 1}.jpg` : '请假条.jpg'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Risk Indicators Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">风险指标</h2>
            <div className="space-y-4">
              <div className="flex space-x-3 p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">高欺诈概率</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">基于图像分析，发票1.jpg显示可能被篡改的迹象。</p>
                </div>
              </div>
              <div className="flex space-x-3 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">文件不完整</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">雇主证明缺少公章。</p>
                </div>
              </div>
            </div>
          </div>

          {/* Claim Actions Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">索赔操作</h2>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-center py-2.5 bg-[#10b981] text-white rounded-md text-sm font-bold hover:bg-[#059669] transition-colors shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                批准索赔
              </button>
              <button className="w-full flex items-center justify-center py-2.5 bg-[#ef4444] text-white rounded-md text-sm font-bold hover:bg-[#dc2626] transition-colors shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                拒绝索赔
              </button>
              <button className="w-full flex items-center justify-center py-2.5 border border-gray-300 text-gray-700 bg-white rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                请求补充材料
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimCaseDetailPage;
