

import React, { useState } from 'react';
import { type InsuranceProduct, type Clause, ProductStatus } from '../types';
import ProductForm from './product-form/ProductForm';
import ProductPreview from './product-preview/ProductPreview';
import { MOCK_CLAUSES, MOCK_COMPANY_LIST } from '../constants';
import Select from './ui/Select';


const getCategoryAbbr = (cat: InsuranceProduct['primaryCategory']): string => {
  const map: Record<string, string> = {
    '健康保险': 'HL',
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

  return {
    ...clause,
    // Generate a new, unique product code for the market-facing product
    productCode: generateProductCodeFromClause(clause),
    // Set a default marketing name
    marketingName: `${clause.regulatoryName} - 市场版`,
    salesUrl: '',
    productAttachments: Array.from(attachments),
    // This spread is necessary to satisfy the union type.
    ...(clause as any),
    productHeroImage: clause.productHeroImage || 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productCardImage: clause.productCardImage || 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productLongImage: (clause.productLongImage && clause.productLongImage.length > 0) ? clause.productLongImage : ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
  };
};

// This is needed for the preview sorter on the right panel
const productListForPreview: InsuranceProduct[] = MOCK_CLAUSES.map(clause => ({
    ...clause,
    marketingName: `${clause.regulatoryName} - 市场版`,
    salesUrl: '',
    ...(clause as any),
}));


const AddProductPage: React.FC<{ onBack: () => void; onSave: (product: InsuranceProduct) => void; }> = ({ onBack, onSave }) => {
  const [selectedClauseCode, setSelectedClauseCode] = useState<string>('');
  const [productConfig, setProductConfig] = useState<InsuranceProduct | null>(null);

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
                        {MOCK_CLAUSES.map(clause => (
                          <option key={clause.productCode} value={clause.productCode}>
                            {`${clause.regulatoryName} (${clause.productCode}) - ${clause.companyName}`}
                          </option>
                        ))}
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
      <div className="flex items-center mb-6">
        <button onClick={() => { setSelectedClauseCode(''); setProductConfig(null); }} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          重新选择条款
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <h2 className="text-xl font-bold text-gray-800 mb-1">新建配置: {productConfig.regulatoryName}</h2>
           <p className="text-sm text-gray-500 mb-6">基于所选条款进行配置，右侧将实时预览产品效果。</p>
           <ProductForm product={productConfig} onFormChange={handleFormChange} onActivate={() => productConfig && onSave({ ...productConfig, status: ProductStatus.ACTIVE })} />
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
        
        <div className="sticky top-8">
          <ProductPreview 
            product={productConfig} 
            productList={productListForPreview} 
            onSaveSort={(sortedList) => console.log('Sorted list saved:', sortedList)} 
          />
        </div>
      </div>
    </div>
  );
};

export default AddProductPage;
