
import React, { useState } from 'react';
import { type InsuranceProduct } from '../../types';
import ProductCard from './ProductCard';
import ProductDetail from './ProductDetail';
 

interface ProductPreviewProps {
  product: InsuranceProduct | null;
}

type View = 'card' | 'detail';

const ProductPreview: React.FC<ProductPreviewProps> = ({ product }) => {
  const [view, setView] = useState<View>('card');

  if (!product) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">实时预览</h2>
        <p>您配置的产品将在此处预览。</p>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'card':
        return <div className="h-full overflow-y-auto p-4"><ProductCard product={product} /></div>;
      case 'detail':
        return <ProductDetail product={product} />;
      default:
        return null;
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-700">实时预览</h2>
        <p className="text-sm text-gray-500">产品在移动端 H5 页面的展示效果。</p>
      </div>
      <div className="border-b border-gray-200 px-6">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setView('card')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
              view === 'card'
                ? 'border-brand-blue-500 text-brand-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            产品卡片
          </button>
          <button
            onClick={() => setView('detail')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
              view === 'detail'
                ? 'border-brand-blue-500 text-brand-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            产品详情
          </button>
          
        </nav>
      </div>
      <div className="p-6 bg-gray-100 flex justify-center">
        {/* Phone Frame */}
        <div className="w-[375px] h-[667px] bg-gray-800 rounded-[40px] shadow-2xl p-2.5 flex flex-col">
          <div className="bg-white flex-1 rounded-[30px] overflow-hidden flex flex-col">
              {/* Phone Screen (scrollable) */}
      <div className="flex-1 overflow-hidden relative">
        {renderView()}
      </div>
  </div>
</div>
      </div>
    </div>
  );
};

export default ProductPreview;
