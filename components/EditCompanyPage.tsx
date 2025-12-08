import React, { useState, useEffect } from 'react';
import { MOCK_COMPANY_PROFILES } from '../constants';
import { type InsuranceCompanyProfile, type CompanyShareholder } from '../types';
import Input from './ui/Input';
import Textarea from './ui/Textarea';

interface EditCompanyPageProps {
  companyCode: string;
  onBack: () => void;
}

const EditCompanyPage: React.FC<EditCompanyPageProps> = ({ companyCode, onBack }) => {
  const [profile, setProfile] = useState<InsuranceCompanyProfile | null>(null);
  
  useEffect(() => {
    const company = MOCK_COMPANY_PROFILES[companyCode];
    if (company) {
      setProfile(JSON.parse(JSON.stringify(company)));
    }
  }, [companyCode]);

  if (!profile) {
    return (
        <div className="text-center p-8">
            <p className="text-gray-500">正在加载保险公司信息...</p>
        </div>
    );
  }

  const handleSimpleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setProfile(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleNestedChange = <T extends keyof InsuranceCompanyProfile>(section: T, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => {
        if (!prev) return null;
        const sectionValue = prev[section];
        // FIX: Spread types may only be created from object types. Added a type guard to ensure `sectionValue` is an object before spreading.
        if (typeof sectionValue === 'object' && sectionValue !== null) {
          return {
            ...prev,
            [section]: {
              ...sectionValue,
              [name]: value
            }
          };
        }
        return prev;
    });
  };

  const handleObjectPropChange = <T extends keyof InsuranceCompanyProfile, U extends keyof InsuranceCompanyProfile[T]>(section: T, subSection: U, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
     setProfile(prev => {
        if (!prev) return null;
        const sectionValue = prev[section];
        // FIX: Spread types may only be created from object types. Added a type guard to ensure `sectionValue` is an object before spreading.
        if (typeof sectionValue === 'object' && sectionValue !== null) {
          const currentSubSection = (sectionValue as any)[subSection];
          if (typeof currentSubSection === 'object' && currentSubSection !== null) {
              return {
                  ...prev,
                  [section]: {
                      ...sectionValue,
                      [subSection]: {
                          ...(currentSubSection as object),
                          [name]: finalValue
                      }
                  }
              };
          }
        }
        return prev;
    });
  };
  
  const handleShareholderChange = (index: number, field: keyof CompanyShareholder, value: string | number) => {
    if (!profile) return;
    const updatedShareholders = [...profile.shareholders.list];
    updatedShareholders[index] = { ...updatedShareholders[index], [field]: value };
    setProfile({
      ...profile,
      shareholders: { ...profile.shareholders, list: updatedShareholders },
    });
  };

  const addShareholder = () => {
    if (!profile) return;
    const newShareholder: CompanyShareholder = { name: '', stakePercentage: 0, type: '' };
    setProfile({
      ...profile,
      shareholders: {
        ...profile.shareholders,
        list: [...profile.shareholders.list, newShareholder],
      },
    });
  };

  const removeShareholder = (index: number) => {
    if (!profile) return;
    const updatedShareholders = profile.shareholders.list.filter((_, i) => i !== index);
    setProfile({
      ...profile,
      shareholders: { ...profile.shareholders, list: updatedShareholders },
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Saving updated info for', companyCode, profile);
    alert('保险公司信息已更新！');
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
        <form className="space-y-10" onSubmit={handleSave}>
          <h2 className="text-2xl font-bold text-gray-800">修改保险公司: {profile.basicInfo.companyName}</h2>
          
          <fieldset className="space-y-4">
              <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">公司档案</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="保司简称" id="shortName" name="shortName" value={profile.shortName} onChange={handleSimpleChange} required />
                <Input label="客服电话" id="hotline" name="hotline" value={profile.hotline} onChange={handleSimpleChange} required />
              </div>
          </fieldset>
          
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">基本信息</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="公司名称" id="companyName" name="companyName" value={profile.basicInfo.companyName} onChange={(e) => handleNestedChange('basicInfo', e)} required />
              <Input label="保险公司类型 (逗号分隔)" id="companyType" name="companyType" value={profile.basicInfo.companyType.join(', ')} onChange={(e) => setProfile(p => p ? {...p, basicInfo: {...p.basicInfo, companyType: e.target.value.split(',').map(s => s.trim())}} : null)} required />
              <Input label="注册资本 (亿)" id="registeredCapitalValue" name="value" type="number" step="0.01" value={profile.basicInfo.registeredCapital.value} onChange={(e) => handleObjectPropChange('basicInfo', 'registeredCapital', e)} required />
              <Input label="公司官网地址" id="website" name="website" type="url" value={profile.basicInfo.website} onChange={(e) => handleNestedChange('basicInfo', e)} required />
            </div>
            <Textarea label="公司地址和经营场所" id="address" name="address" value={profile.basicInfo.address} onChange={(e) => handleNestedChange('basicInfo', e)} required rows={3} />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">偿付能力</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="偿付能力评价" id="rating" name="rating" value={profile.solvency.rating} onChange={(e) => handleNestedChange('solvency', e)} required />
                <Input label="分红实现率范围" id="dividendRealizationRate" name="dividendRealizationRate" value={profile.solvency.dividendRealizationRate || ''} onChange={(e) => handleNestedChange('solvency', e)} />
                <Input label="综合偿付能力充足率 (%)" id="comprehensiveSolvencyRatio" name="comprehensiveSolvencyRatio" type="number" step="0.01" value={profile.solvency.comprehensiveSolvencyRatio} onChange={(e) => handleNestedChange('solvency', e)} required />
                <Input label="核心偿付能力充足率 (%)" id="coreSolvencyRatio" name="coreSolvencyRatio" type="number" step="0.01" value={profile.solvency.coreSolvencyRatio} onChange={(e) => handleNestedChange('solvency', e)} required />
                <Input label="风险评级" id="riskRating" name="riskRating" value={profile.solvency.riskRating} onChange={(e) => handleNestedChange('solvency', e)} required />
                <Input label="SARMRA评估得分" id="sarmraScore" name="sarmraScore" type="number" step="0.01" value={profile.solvency.sarmraScore || ''} onChange={(e) => handleNestedChange('solvency', e)} />
                <Input label="总资产 (亿元)" id="totalAssetsValue" name="value" type="number" step="0.1" value={profile.solvency.totalAssets.value} onChange={(e) => handleObjectPropChange('solvency', 'totalAssets', e)} required />
                <Input label="最新报告时间" id="reportDate" name="reportDate" value={profile.solvency.reportDate} onChange={(e) => handleNestedChange('solvency', e)} required />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">服务能力</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="服务评级质量指数" id="qualityIndex" name="qualityIndex" type="number" step="0.01" value={profile.serviceCapability.qualityIndex} onChange={(e) => handleNestedChange('serviceCapability', e)} required />
                <Input label="万张保单投诉量" id="complaintsPer10kPolicies" name="complaintsPer10kPolicies" type="number" step="0.001" value={profile.serviceCapability.complaintsPer10kPolicies} onChange={(e) => handleNestedChange('serviceCapability', e)} required />
                <Input label="亿元保单投诉量" id="complaintsPer100mPremium" name="complaintsPer100mPremium" type="number" step="0.001" value={profile.serviceCapability.complaintsPer100mPremium} onChange={(e) => handleNestedChange('serviceCapability', e)} required />
                <Input label="万人次投诉量" id="complaintsPer10kCustomers" name="complaintsPer10kCustomers" type="number" step="0.001" value={profile.serviceCapability.complaintsPer10kCustomers} onChange={(e) => handleNestedChange('serviceCapability', e)} required />
                <Input label="服务能力评级时间" id="ratingDate" name="ratingDate" value={profile.serviceCapability.ratingDate} onChange={(e) => handleNestedChange('serviceCapability', e)} required />
                <Input label="投诉量更新时间" id="complaintDataUpdateDate" name="complaintDataUpdateDate" value={profile.serviceCapability.complaintDataUpdateDate} onChange={(e) => handleNestedChange('serviceCapability', e)} required />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">分公司分布</legend>
            <Textarea label="省份和直辖市列表 (逗号分隔)" id="provinces" name="provinces" value={profile.branchDistribution.provinces.join(', ')} onChange={(e) => setProfile(p => p ? {...p, branchDistribution: { provinces: e.target.value.split(',').map(s => s.trim()) }} : null)} required rows={4} />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-900 pb-2 border-b w-full">股东明细</legend>
            <Input label="说明" id="note" name="note" value={profile.shareholders.note || ''} onChange={(e) => handleNestedChange('shareholders', e)} />
            <div className="space-y-4">
                {profile.shareholders.list.map((shareholder, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-3 p-3 bg-gray-50 rounded-lg relative">
                        <div className="md:col-span-3"><Input label={`股东名称 ${index + 1}`} id={`shareholder-name-${index}`} value={shareholder.name} onChange={(e) => handleShareholderChange(index, 'name', e.target.value)} required /></div>
                        <div className="md:col-span-1"><Input label="股权比例(%)" id={`shareholder-stake-${index}`} type="number" step="0.01" value={shareholder.stakePercentage} onChange={(e) => handleShareholderChange(index, 'stakePercentage', parseFloat(e.target.value) || 0)} required /></div>
                        <div className="md:col-span-2"><Input label="股东性质" id={`shareholder-type-${index}`} value={shareholder.type} onChange={(e) => handleShareholderChange(index, 'type', e.target.value)} required /></div>
                        <div className="flex items-end justify-end">
                            <button type="button" onClick={() => removeShareholder(index)} className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition" aria-label="删除此股东"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                        </div>
                    </div>
                ))}
            </div>
             <button type="button" onClick={addShareholder} className="w-full mt-2 px-4 py-2 border-2 border-dashed border-gray-300 text-sm font-medium rounded-lg text-gray-600 hover:text-brand-blue-600 hover:border-brand-blue-500 transition">+ 添加股东</button>
          </fieldset>

          <div className="pt-6 border-t border-gray-200 flex justify-end space-x-3">
            <button type="button" onClick={onBack} className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">取消</button>
            <button type="submit" className="px-5 py-2 bg-brand-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">保存修改</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCompanyPage;