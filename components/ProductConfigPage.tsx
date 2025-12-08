

import React, { useState, useEffect } from 'react';
import { type InsuranceProduct, ProductStatus, PrimaryCategory } from '../types';
import ProductForm from './product-form/ProductForm';
import ProductPreview from './product-preview/ProductPreview';
import { MOCK_CLAUSES, MOCK_RESPONSIBILITIES } from '../constants';

// Helper to convert a Clause object (from the list) into a full InsuranceProduct object required by the form.
// It adds the missing 'marketingName' and 'salesUrl' properties with default values.
const clauseToInsuranceProduct = (clause: InsuranceProduct): InsuranceProduct => {
  const attachments = new Set<string>();
  if (clause.clauseTextFile) attachments.add(clause.clauseTextFile);
  if (clause.rateTableFile) attachments.add(clause.rateTableFile);
  if (clause.productDescriptionFile) attachments.add(clause.productDescriptionFile);
  if (clause.cashValueTableFile) attachments.add(clause.cashValueTableFile);
  if (clause.productAttachments) {
    clause.productAttachments.forEach(att => attachments.add(att));
  }

  // Use a type assertion after adding the missing properties.
  return {
    ...clause,
    marketingName: `${clause.regulatoryName} - 市场版`,
    salesUrl: '',
    productAttachments: Array.from(attachments),
    clausesCode: [clause.productCode as string],
    // This spread is to satisfy the union type, ensuring all possible fields are considered.
    // In a real app, you might have more robust logic to determine the exact subtype.
    ...(clause as any),
  };
};

// Converts the array of Clause objects to an array of full InsuranceProduct objects for the preview sorter.
 


const normalizeProduct = (p: InsuranceProduct): InsuranceProduct => {
  if (p.primaryCategory === PrimaryCategory.HEALTH || p.primaryCategory === PrimaryCategory.ACCIDENT || p.primaryCategory === PrimaryCategory.CRITICAL_ILLNESS || p.primaryCategory === PrimaryCategory.ANNUITY) {
    return {
      ...p,
      coverageArea: (p as any).coverageArea || '',
      hospitalScope: (p as any).hospitalScope || '',
      claimScope: (p as any).claimScope || '',
      occupationScope: (p as any).occupationScope || '',
      hesitationPeriod: (p as any).hesitationPeriod || '',
      policyEffectiveDate: (p as any).policyEffectiveDate || '',
      purchaseLimit: (p as any).purchaseLimit ?? 0,
      annualPremium: (p as any).annualPremium ?? 0,
      valueAddedServices: (p as any).valueAddedServices || [],
      deductible: (p as any).deductible || '',
      renewalWarranty: (p as any).renewalWarranty || '',
      outHospitalMedicine: (p as any).outHospitalMedicine || '',
      healthConditionNotice: (p as any).healthConditionNotice || '',
      coveragePlans: (p as any).coveragePlans && (p as any).coveragePlans.length > 0 
        ? (p as any).coveragePlans 
        : (Array.isArray((p as any).coverageDetails) && (p as any).coverageDetails.length > 0)
          ? [{ planType: '方案一', coverageDetails: (p as any).coverageDetails }]
          : ((p as any).coveragePlans || []),
      coverageDetails: [],
    } as InsuranceProduct;
  }
  return p;
};

const ProductConfigPage: React.FC<{ product: InsuranceProduct; onBack: () => void; onSave: (product: InsuranceProduct) => void; }> = ({ product, onBack, onSave }) => {
  // State to hold the editable product configuration. Initialized from the selected product.
  const [productConfig, setProductConfig] = useState<InsuranceProduct>(() => normalizeProduct(product));
  const [previewCollapsed, setPreviewCollapsed] = useState<boolean>(false);
  
  // Effect to update the form state if the selected product prop changes.
  useEffect(() => {
    setProductConfig(normalizeProduct(product));
  }, [product]);
  
  // Handler to update the productConfig state when any form field changes.
  const handleFormChange = (field: keyof InsuranceProduct, value: any) => {
    setProductConfig(prev => ({ ...prev, [field]: value }));
  };
  
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
        <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          返回产品列表
        </button>
      </div>

      <div className={`grid grid-cols-1 ${previewCollapsed ? '' : 'xl:grid-cols-2'} gap-8 items-start`}>
        {/* Left Column: Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <h2 className="text-xl font-bold text-gray-800 mb-1">配置: {product.regulatoryName}</h2>
           <p className="text-sm text-gray-500 mb-6">修改以下表单，右侧将实时预览产品效果。</p>
           <ProductForm 
            product={productConfig} 
            onFormChange={handleFormChange} 
            onActivate={() => onSave({ ...productConfig, status: ProductStatus.ACTIVE })}
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
               onClick={() => onSave({ ...productConfig, status: ProductStatus.DRAFT })}
               className="px-6 py-2 bg-white text-gray-700 font-semibold rounded-lg shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition"
             >
               保存草稿
             </button>
           </div>
        </div>
        
        {/* Right Column: Preview */}
        {!previewCollapsed && (
          <div className="sticky top-8 transition-transform">
            <ProductPreview product={productConfig} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductConfigPage;
