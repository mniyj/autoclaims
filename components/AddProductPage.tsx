

import React, { useState } from 'react';
import { type InsuranceProduct, type Clause, ProductStatus, PrimaryCategory } from '../types';
import ProductForm from './product-form/ProductForm';
import ProductPreview from './product-preview/ProductPreview';
import { SANITIZED_MOCK_CLAUSES as MOCK_CLAUSES, MOCK_COMPANY_LIST, MOCK_RESPONSIBILITIES } from '../constants';
import Select from './ui/Select';


const getCategoryAbbr = (cat: InsuranceProduct['primaryCategory']): string => {
  const map: Record<string, string> = {
    '医疗保险': 'HL',
    '意外保险': 'AC',
    '重大疾病保险': 'CI',
    '定期寿险': 'TL',
    '终身寿险': 'WL',
    '年金保险': 'AN',
  };
  return map[cat] || 'OT';
};

const generateProductCodeFromClause = (clause: Clause): string => {
  const companyCode = (MOCK_COMPANY_LIST.find(c => c.shortName === clause.companyName) || MOCK_COMPANY_LIST.find(c => c.fullName === clause.companyName))?.code || 'GEN';
  const year = new Date().getFullYear();
  const abbr = getCategoryAbbr(clause.primaryCategory as any);
  const prefix = `${companyCode}${year}P${abbr}`;
  const existing = [] as string[];
  const maxSeq = existing.reduce((max, code) => {
    const m = code.match(/(\d{3})$/);
    const n = m ? parseInt(m[1], 10) : 0;
    return Math.max(max, n);
  }, 0);
  const next = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${next}`;
}

// Helper to convert a selected Clause into an initial InsuranceProduct for configuration.
const clauseToNewProductConfig = (clause: Clause): InsuranceProduct => {
  const attachments = new Set<string>();
  if (clause.clauseTextFile) attachments.add(clause.clauseTextFile);
  if (clause.rateTableFile) attachments.add(clause.rateTableFile);
  if (clause.productDescriptionFile) attachments.add(clause.productDescriptionFile);
  if (clause.cashValueTableFile) attachments.add(clause.cashValueTableFile);
  if (clause.productAttachments) {
    clause.productAttachments.forEach(att => attachments.add(att));
  }

  const existingPlans = (clause as any).coveragePlans as any[] | undefined;
  const isStructuredCategory = clause.primaryCategory === PrimaryCategory.HEALTH || clause.primaryCategory === PrimaryCategory.ACCIDENT;
  const baseDetails = clause.coverageDetails || [];

  const toNumberFromAmount = (amt?: string): number => {
    if (!amt) return 0;
    const m = amt.match(/([0-9]+)(万|元)?/);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return m[2] === '万' ? n * 10000 : n;
  };

  const healthPlanFromDetails = () => [{
    planType: '标准版',
    annualLimit: baseDetails.reduce((sum, d) => sum + toNumberFromAmount((d as any).amount), 0) || undefined,
    guaranteedRenewalYears: 0,
    coverageDetails: baseDetails.map((d: any) => {
      if (d.item_code) return d; // 已是结构化
      return {
        item_code: (d.name || '').toUpperCase().replace(/\s+/g, '_'),
        item_name: d.name,
        description: d.details,
        details: {
          limit: toNumberFromAmount(d.amount),
          deductible: /一般/.test(d.name || '') ? 10000 : 0,
          reimbursement_ratio: 1,
          hospital_requirements: (clause as any).hospitalScope || '',
          coverage_scope: /一般/.test(d.name || '') ? '住院费用/特殊门诊/外购药' : '重疾相关治疗费用',
        }
      };
    })
  }];

  const simplePlanFromDetails = () => [{ planType: '标准版', coverageDetails: baseDetails }];

  const base: InsuranceProduct = {
    ...clause,
    // Generate a new, unique product code for the market-facing product
    productCode: generateProductCodeFromClause(clause),
    // Set a default marketing name
    marketingName: `${clause.regulatoryName} - 市场版`,
    salesUrl: '',
    productAttachments: Array.from(attachments),
    clausesCode: [clause.productCode as string],
    coveragePlans: existingPlans || (isStructuredCategory ? healthPlanFromDetails() : simplePlanFromDetails()),
    coverageDetails: [],
    selectedResponsibilities: (clause as any).selectedResponsibilities || [],
    productHeroImage: clause.productHeroImage || 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productCardImage: clause.productCardImage || 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productLongImage: (clause.productLongImage && clause.productLongImage.length > 0) ? clause.productLongImage : ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
  } as InsuranceProduct;

  if (base.primaryCategory === PrimaryCategory.HEALTH || base.primaryCategory === PrimaryCategory.ACCIDENT || base.primaryCategory === PrimaryCategory.CRITICAL_ILLNESS) {
    return {
      ...base,
      coverageArea: (base as any).coverageArea || (clause as any).coverageArea || '',
      hospitalScope: (base as any).hospitalScope || (clause as any).hospitalScope || '',
      claimScope: (base as any).claimScope || (clause as any).claimScope || '',
      occupationScope: (base as any).occupationScope || (clause as any).occupationScope || '',
      hesitationPeriod: (base as any).hesitationPeriod || (clause as any).hesitationPeriod || '',
      policyEffectiveDate: (base as any).policyEffectiveDate || (clause as any).policyEffectiveDate || '',
      purchaseLimit: (base as any).purchaseLimit ?? (clause as any).purchaseLimit ?? 0,
      annualPremium: (base as any).annualPremium ?? (clause as any).annualPremium ?? 0,
      valueAddedServices: (base as any).valueAddedServices || (clause as any).valueAddedServices || [],
      deductible: (base as any).deductible || (clause as any).deductible || '',
      renewalWarranty: (base as any).renewalWarranty || (clause as any).renewalWarranty || '',
      outHospitalMedicine: (base as any).outHospitalMedicine || (clause as any).outHospitalMedicine || '',
      healthConditionNotice: (base as any).healthConditionNotice || (clause as any).healthConditionNotice || '',
    } as InsuranceProduct;
  }
  return base;
};

 


const AddProductPage: React.FC<{ onBack: () => void; onSave: (product: InsuranceProduct) => void; companyCode?: string }> = ({ onBack, onSave, companyCode }) => {
  const [selectedClauseCode, setSelectedClauseCode] = useState<string>('');
  const [productConfig, setProductConfig] = useState<InsuranceProduct | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState<boolean>(false);

  const handleClauseSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clauseCode = e.target.value;
    if (clauseCode) {
        const selectedClause = MOCK_CLAUSES.find(c => c.productCode === clauseCode);
        if (selectedClause) {
            setSelectedClauseCode(clauseCode);
            setProductConfig(clauseToNewProductConfig(selectedClause));
        }
    } else {
        setSelectedClauseCode('');
        setProductConfig(null);
    }
  };

  const handleFormChange = (field: keyof InsuranceProduct, value: any) => {
    setProductConfig(prev => (prev ? { ...prev, [field]: value } : null));
  };
  
  if (!selectedClauseCode || !productConfig) {
    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center space-y-6">
                <h2 className="text-xl font-bold text-gray-800">第一步：选择基础条款</h2>
                <p className="text-gray-500">请先选择一个已备案的保险条款作为模板，后续将基于该条款信息创建新的市场产品。</p>
                <div className="max-w-lg mx-auto">
                    <Select label="选择条款" id="clause" name="clause" value={selectedClauseCode} onChange={handleClauseSelect}>
                        <option value="">-- 请选择条款 --</option>
                        {(() => {
                          const filtered = (() => {
                            if (!companyCode) return MOCK_CLAUSES;
                            const company = MOCK_COMPANY_LIST.find(c => c.code === companyCode);
                            if (!company) return [] as typeof MOCK_CLAUSES;
                            const names = new Set([company.shortName, company.fullName]);
                            return MOCK_CLAUSES.filter(clause => names.has(clause.companyName));
                          })();
                          return filtered.map(clause => (
                          <option key={clause.productCode} value={clause.productCode}>
                            {`${clause.regulatoryName} (${clause.productCode}) - ${clause.companyName}`}
                          </option>
                          ));
                        })()}
                    </Select>
                </div>
                <div className="pt-4">
                     <button
                        onClick={onBack}
                        className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                        返回产品列表
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="fixed top-4 right-4 z-50">
        <button onClick={() => setPreviewCollapsed(v => !v)} className="flex items-center text-sm font-semibold px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 shadow hover:bg-gray-50">
          {previewCollapsed ? (
            <>
              <span className="mr-1">展开预览</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
            </>
          ) : (
            <>
              <span className="mr-1">折叠预览</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            </>
          )}
        </button>
      </div>
      <div className="flex items-center mb-6">
        <button onClick={() => { setSelectedClauseCode(''); setProductConfig(null); }} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          重新选择条款
        </button>
      </div>

      <div className={`grid grid-cols-1 ${previewCollapsed ? '' : 'xl:grid-cols-2'} gap-8 items-start`}>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <h2 className="text-xl font-bold text-gray-800 mb-1">新建配置: {productConfig.regulatoryName}</h2>
           <p className="text-sm text-gray-500 mb-6">基于所选条款进行配置，右侧将实时预览产品效果。</p>
          <ProductForm 
            product={productConfig} 
            onFormChange={handleFormChange} 
            onActivate={() => productConfig && onSave({ ...productConfig, status: ProductStatus.ACTIVE })}
            allowedResponsibilities={(() => {
              const selected = (productConfig as any).selectedResponsibilities as any[] | undefined
              if (selected && selected.length > 0) return selected.map(r => ({ code: r.code, name: r.name, description: r.description }))
              if (productConfig.primaryCategory === PrimaryCategory.HEALTH) {
                return MOCK_RESPONSIBILITIES.filter(r => r.category === '医疗险').map(r => ({ code: r.code, name: r.name, description: r.description }))
              }
              if (productConfig.primaryCategory === PrimaryCategory.ACCIDENT) {
                return MOCK_RESPONSIBILITIES.filter(r => r.category === '意外险').map(r => ({ code: r.code, name: r.name, description: r.description }))
              }
              return undefined
            })()}
          />
           <div className="flex justify-end pt-4">
             <button 
               type="button"
               onClick={() => productConfig && onSave({ ...productConfig, status: ProductStatus.DRAFT })}
               className="px-6 py-2 bg-white text-gray-700 font-semibold rounded-lg shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition"
             >
               保存草稿
             </button>
           </div>
        </div>
        {!previewCollapsed && (
          <div className="sticky top-8 transition-transform">
            <ProductPreview product={productConfig} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AddProductPage;
