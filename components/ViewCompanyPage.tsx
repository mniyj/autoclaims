
import React from 'react';
import { MOCK_COMPANY_PROFILES } from '../constants';
import InfoCard from './ui/InfoCard';

interface ViewCompanyPageProps {
  companyCode: string;
  onBack: () => void;
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="py-2 grid grid-cols-3 gap-4 border-b border-gray-100 last:border-b-0">
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900 col-span-2">{children}</dd>
  </div>
);


const ViewCompanyPage: React.FC<ViewCompanyPageProps> = ({ companyCode, onBack }) => {
  const company = MOCK_COMPANY_PROFILES[companyCode];

  if (!company) {
    return (
      <div>
        <button onClick={onBack}>返回</button>
        <p>未找到保险公司信息。</p>
      </div>
    );
  }

  const { basicInfo, solvency, serviceCapability, branchDistribution, shareholders } = company;

  return (
    <div className="space-y-6">
        <div className="flex items-center">
            <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                返回列表
            </button>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900">{basicInfo.companyName} - 档案详情</h1>

        <div className="space-y-6">
            <InfoCard title="基本信息">
                <dl>
                    <DetailRow label="公司名称">{basicInfo.companyName}</DetailRow>
                    <DetailRow label="保险公司类型">{basicInfo.companyType.join(', ')}</DetailRow>
                    <DetailRow label="注册资本">{`${basicInfo.registeredCapital.value} ${basicInfo.registeredCapital.unit}`}</DetailRow>
                    <DetailRow label="公司官网地址"><a href={basicInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{basicInfo.website}</a></DetailRow>
                    <DetailRow label="公司地址">{basicInfo.address}</DetailRow>
                </dl>
            </InfoCard>

            <InfoCard title="偿付能力">
                 <dl>
                    <DetailRow label="最新报告时间">{solvency.reportDate}</DetailRow>
                    <DetailRow label="偿付能力评价">{solvency.rating}</DetailRow>
                    <DetailRow label="核心偿付能力充足率">{solvency.coreSolvencyRatio}%</DetailRow>
                    <DetailRow label="综合偿付能力充足率">{solvency.comprehensiveSolvencyRatio}%</DetailRow>
                    <DetailRow label="风险评级">{solvency.riskRating}</DetailRow>
                    <DetailRow label="SARMRA评估得分">{solvency.sarmraScore ?? 'N/A'}</DetailRow>
                    <DetailRow label="总资产">{`${solvency.totalAssets.value} ${solvency.totalAssets.unit}`}</DetailRow>
                </dl>
            </InfoCard>

            <InfoCard title="服务能力">
                <dl>
                    <DetailRow label="服务评级时间">{serviceCapability.ratingDate}</DetailRow>
                    <DetailRow label="投诉数据更新时间">{serviceCapability.complaintDataUpdateDate}</DetailRow>
                    <DetailRow label="服务评级质量指数">{serviceCapability.qualityIndex}</DetailRow>
                    <DetailRow label="万张保单投诉量">{serviceCapability.complaintsPer10kPolicies}</DetailRow>
                    <DetailRow label="亿元保单投诉量">{serviceCapability.complaintsPer100mPremium}</DetailRow>
                    <DetailRow label="万人次投诉量">{serviceCapability.complaintsPer10kCustomers}</DetailRow>
                </dl>
            </InfoCard>
            
            <InfoCard title="分公司分布">
                <div className="flex flex-wrap gap-2">
                    {branchDistribution.provinces.map(province => (
                        <span key={province} className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">{province}</span>
                    ))}
                </div>
            </InfoCard>

            <InfoCard title="股东明细">
                <p className="text-sm text-gray-500 mb-4">{shareholders.note}</p>
                 <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">股东名称</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">股权比例</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">股东性质</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {shareholders.list.map(shareholder => (
                                <tr key={shareholder.name} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shareholder.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{shareholder.stakePercentage.toFixed(2)}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{shareholder.type}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </InfoCard>
        </div>
    </div>
  );
};

export default ViewCompanyPage;
