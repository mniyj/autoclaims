
import React, { useState } from 'react';
import Input from './ui/Input';
import Textarea from './ui/Textarea';
import { api } from '../services/api';
import { InsuranceCompanyProfile } from '../types';

const AddCompanyPage: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    // Basic Info State
    const [code, setCode] = useState('');
    const [shortName, setShortName] = useState('');
    const [hotline, setHotline] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyType, setCompanyType] = useState('');
    const [registeredCapital, setRegisteredCapital] = useState('');
    const [website, setWebsite] = useState('');
    const [address, setAddress] = useState('');

    // Solvency State
    const [solvencyRating, setSolvencyRating] = useState('');
    const [comprehensiveSolvencyRatio, setComprehensiveSolvencyRatio] = useState('');
    const [coreSolvencyRatio, setCoreSolvencyRatio] = useState('');
    const [riskRating, setRiskRating] = useState('');
    const [totalAssets, setTotalAssets] = useState('');
    const [reportDate, setReportDate] = useState('');

    // Service Capability State
    const [qualityIndex, setQualityIndex] = useState('');
    const [complaintsPer10kPolicies, setComplaintsPer10kPolicies] = useState('');
    const [complaintsPer100mPremium, setComplaintsPer100mPremium] = useState('');
    const [complaintsPer10kCustomers, setComplaintsPer10kCustomers] = useState('');
    const [ratingDate, setRatingDate] = useState('');
    const [complaintDataUpdateDate, setComplaintDataUpdateDate] = useState('');

    const handleSave = async () => {
        try {
            const newCompany: InsuranceCompanyProfile = {
                code,
                shortName,
                hotline,
                basicInfo: {
                    companyName,
                    companyType: companyType.split(/(?:,|，)+/).map(s => s.trim()).filter(Boolean),
                    registeredCapital: { value: parseFloat(registeredCapital) || 0, unit: '亿' },
                    address,
                    website
                },
                solvency: {
                    rating: solvencyRating,
                    comprehensiveSolvencyRatio: parseFloat(comprehensiveSolvencyRatio) || 0,
                    coreSolvencyRatio: parseFloat(coreSolvencyRatio) || 0,
                    riskRating,
                    totalAssets: { value: parseFloat(totalAssets) || 0, unit: '亿元' },
                    reportDate,
                    dividendRealizationRate: '', // Defaults
                    financialInvestmentYield: { annual: 0, recentThreeYears: 0 },
                    comprehensiveInvestmentYield: { annual: 0, recentThreeYears: 0 },
                    sarmraScore: 0
                },
                serviceCapability: {
                    qualityIndex: parseFloat(qualityIndex) || 0,
                    complaintsPer10kPolicies: parseFloat(complaintsPer10kPolicies) || 0,
                    complaintsPer100mPremium: parseFloat(complaintsPer100mPremium) || 0,
                    complaintsPer10kCustomers: parseFloat(complaintsPer10kCustomers) || 0,
                    ratingDate,
                    complaintDataUpdateDate
                },
                branchDistribution: { provinces: [] }, // Default
                shareholders: { list: [] } // Default
            };

            await api.companies.add(newCompany);
            alert('保险公司信息已保存！');
            onBack();
        } catch (error) {
            console.error('Failed to save company:', error);
            alert('保存失败，请重试');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    返回列表
                </button>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                <form className="space-y-10" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <h2 className="text-2xl font-bold text-gray-800">新增保险公司</h2>

                    <fieldset className="space-y-4">
                        <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">基本信息</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="公司代码 (Code)" id="code" value={code} onChange={e => setCode(e.target.value)} required />
                            <Input label="公司简称" id="shortName" value={shortName} onChange={e => setShortName(e.target.value)} required />
                            <Input label="客服电话" id="hotline" value={hotline} onChange={e => setHotline(e.target.value)} required />
                            <Input label="公司全称" id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                            <Input label="保险公司类型 (逗号分隔)" id="companyType" value={companyType} onChange={e => setCompanyType(e.target.value)} placeholder="寿险公司, 中外合资" required />
                            <Input label="注册资本 (亿)" id="registeredCapital" value={registeredCapital} onChange={e => setRegisteredCapital(e.target.value)} type="number" required />
                            <Input label="公司官网地址" id="website" value={website} onChange={e => setWebsite(e.target.value)} type="url" required />
                        </div>
                        <Textarea label="公司地址和经营场所" id="address" value={address} onChange={e => setAddress(e.target.value)} required />
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">偿付能力</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="偿付能力评价" id="solvencyRating" value={solvencyRating} onChange={e => setSolvencyRating(e.target.value)} required />
                            <Input label="综合偿付能力充足率 (%)" id="comprehensiveSolvencyRatio" value={comprehensiveSolvencyRatio} onChange={e => setComprehensiveSolvencyRatio(e.target.value)} type="number" step="0.01" required />
                            <Input label="核心偿付能力充足率 (%)" id="coreSolvencyRatio" value={coreSolvencyRatio} onChange={e => setCoreSolvencyRatio(e.target.value)} type="number" step="0.01" required />
                            <Input label="风险评级" id="riskRating" value={riskRating} onChange={e => setRiskRating(e.target.value)} required />
                            <Input label="总资产 (亿元)" id="totalAssets" value={totalAssets} onChange={e => setTotalAssets(e.target.value)} type="number" step="0.1" required />
                            <Input label="最新一期偿付能力报告时间" id="reportDate" value={reportDate} onChange={e => setReportDate(e.target.value)} type="text" placeholder="例如: 2025年第2季度" required />
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">服务能力</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="服务评级质量指数" id="qualityIndex" value={qualityIndex} onChange={e => setQualityIndex(e.target.value)} type="number" step="0.01" required />
                            <Input label="万张保单投诉量" id="complaintsPer10kPolicies" value={complaintsPer10kPolicies} onChange={e => setComplaintsPer10kPolicies(e.target.value)} type="number" step="0.001" required />
                            <Input label="亿元保单投诉量" id="complaintsPer100mPremium" value={complaintsPer100mPremium} onChange={e => setComplaintsPer100mPremium(e.target.value)} type="number" step="0.001" required />
                            <Input label="万人次投诉量" id="complaintsPer10kCustomers" value={complaintsPer10kCustomers} onChange={e => setComplaintsPer10kCustomers(e.target.value)} type="number" step="0.001" required />
                            <Input label="服务能力评级时间" id="ratingDate" value={ratingDate} onChange={e => setRatingDate(e.target.value)} type="text" placeholder="例如: 2022年第四季度" required />
                            <Input label="投诉量更新时间" id="complaintDataUpdateDate" value={complaintDataUpdateDate} onChange={e => setComplaintDataUpdateDate(e.target.value)} type="text" placeholder="例如: 2023年第四季度" required />
                        </div>
                    </fieldset>

                    <div className="pt-6 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                            取消
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 bg-brand-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                            保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddCompanyPage;
