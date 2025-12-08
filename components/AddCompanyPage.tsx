import React from 'react';
import Input from './ui/Input';
import Textarea from './ui/Textarea';

const AddCompanyPage: React.FC<{ onBack: () => void; }> = ({ onBack }) => {

    const handleSave = () => {
        alert('保险公司信息已保存！ (Company Info Saved!)');
        onBack();
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
                           <Input label="公司名称" id="companyName" required />
                           <Input label="保险公司类型 (逗号分隔)" id="companyType" placeholder="寿险公司, 中外合资" required />
                           <Input label="注册资本 (亿)" id="registeredCapital" type="number" required />
                           <Input label="公司官网地址" id="website" type="url" required />
                        </div>
                        <Textarea label="公司地址和经营场所" id="address" required />
                    </fieldset>

                     <fieldset className="space-y-4">
                        <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">偿付能力</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="偿付能力评价" id="solvencyRating" required />
                            <Input label="综合偿付能力充足率 (%)" id="comprehensiveSolvencyRatio" type="number" step="0.01" required />
                            <Input label="核心偿付能力充足率 (%)" id="coreSolvencyRatio" type="number" step="0.01" required />
                            <Input label="风险评级" id="riskRating" required />
                            <Input label="总资产 (亿元)" id="totalAssets" type="number" step="0.1" required />
                            <Input label="最新一期偿付能力报告时间" id="reportDate" type="text" placeholder="例如: 2025年第2季度" required />
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">服务能力</legend>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="服务评级质量指数" id="qualityIndex" type="number" step="0.01" required />
                            <Input label="万张保单投诉量" id="complaintsPer10kPolicies" type="number" step="0.001" required />
                            <Input label="亿元保单投诉量" id="complaintsPer100mPremium" type="number" step="0.001" required />
                            <Input label="万人次投诉量" id="complaintsPer10kCustomers" type="number" step="0.001" required />
                             <Input label="服务能力评级时间" id="ratingDate" type="text" placeholder="例如: 2022年第四季度" required />
                            <Input label="投诉量更新时间" id="complaintDataUpdateDate" type="text" placeholder="例如: 2023年第四季度" required />
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
