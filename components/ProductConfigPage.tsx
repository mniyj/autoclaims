

import React, { useState, useEffect } from 'react';
import { type InsuranceProduct, ProductStatus } from '../types';
import ProductForm from './product-form/ProductForm';
import ProductPreview from './product-preview/ProductPreview';
import { MOCK_CLAUSES } from '../constants';

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
    // This spread is to satisfy the union type, ensuring all possible fields are considered.
    // In a real app, you might have more robust logic to determine the exact subtype.
    ...(clause as any),
  };
};

// Converts the array of Clause objects to an array of full InsuranceProduct objects for the preview sorter.
const productListForPreview: InsuranceProduct[] = MOCK_CLAUSES.map(clause => ({
  ...clause,
  marketingName: `${clause.regulatoryName} - 市场版`,
  salesUrl: '',
  productHeroImage: clause.productHeroImage || 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
  productCardImage: clause.productCardImage || 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
  productLongImage: (clause.productLongImage && clause.productLongImage.length > 0) ? clause.productLongImage : ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
  ...(clause as any),
}));


const ProductConfigPage: React.FC<{ product: InsuranceProduct; onBack: () => void; onSave: (product: InsuranceProduct) => void; }> = ({ product, onBack, onSave }) => {
  // State to hold the editable product configuration. Initialized from the selected product.
  const [productConfig, setProductConfig] = useState<InsuranceProduct>(() => product);
  
  // Effect to update the form state if the selected product prop changes.
  useEffect(() => {
    setProductConfig(product);
  }, [product]);
  
  // Handler to update the productConfig state when any form field changes.
  const handleFormChange = (field: keyof InsuranceProduct, value: any) => {
    setProductConfig(prev => ({ ...prev, [field]: value }));
  };
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-md transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          返回产品列表
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left Column: Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <h2 className="text-xl font-bold text-gray-800 mb-1">配置: {product.regulatoryName}</h2>
           <p className="text-sm text-gray-500 mb-6">修改以下表单，右侧将实时预览产品效果。</p>
           <ProductForm product={productConfig} onFormChange={handleFormChange} onActivate={() => onSave({ ...productConfig, status: ProductStatus.ACTIVE })} />
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

export default ProductConfigPage;
