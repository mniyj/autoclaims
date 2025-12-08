import React from 'react';
import { type InsuranceProduct } from '../../types';

interface ProductCardProps {
  product: InsuranceProduct;
}

const Metric: React.FC<{ value?: string; label?: string }> = ({ value, label }) => {
    if (!value && !label) return null;
    return (
        <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{value || '-'}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">{label || ''}</div>
        </div>
    )
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {

    const getPrice = () => {
        if ('annualPremium' in product && product.annualPremium > 0) {
            return product.annualPremium;
        }
        if ('basicSumAssured' in product) {
            // This is a placeholder logic. Real premium calculation is complex.
            return Math.round(product.basicSumAssured / 1000);
        }
        return null;
    }
    const price = getPrice();

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-4">
      <div className="flex space-x-3">
        {/* Left: Image */}
        <div className="flex-shrink-0">
          {product.productCardImage || product.productHeroImage ? (
            <div className="relative">
              <img className="h-20 w-20 rounded-lg object-cover" src={product.productCardImage || product.productHeroImage} alt={product.marketingName} referrerPolicy="no-referrer" />
              {product.promoTag && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] bg-black/50 text-white rounded">{product.promoTag}</span>
              )}
            </div>
          ) : (
             <div className="h-20 w-20 rounded-lg bg-gray-200 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
             </div>
          )}
        </div>

        {/* Right: Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-[16px] font-bold text-gray-900 truncate">{product.marketingName}</h3>
          </div>
          
          <div className="mt-2 grid grid-cols-3 gap-3 items-center">
            <Metric value={product.cardMetric1Value} label={product.cardMetric1Label} />
            <Metric value={product.cardMetric2Value} label={product.cardMetric2Label} />
            <Metric value={product.cardMetric3Value} label={product.cardMetric3Label} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.tags?.map((tag, index) => {
                const style = product.tagStyles?.[tag] || 'gray';
                let chipCls = 'bg-gray-100 text-gray-800 border border-gray-200';
                
                if (style === 'gold') {
                    chipCls = 'bg-orange-100 text-orange-800 border border-orange-200';
                } else if (style === 'green') {
                    chipCls = 'bg-green-100 text-green-800 border border-green-200';
                } else if (style === 'red') {
                    chipCls = 'bg-red-100 text-red-800 border border-red-200';
                }

                return (
                  <span key={index} className={`text-[11px] font-medium px-2 py-0.5 rounded ${chipCls}`}>
                    {tag}
                  </span>
                );
            })}
          </div>

        </div>
      </div>
      <div className="mt-3 flex justify-between items-center">
        {price !== null ? (
            <p className="text-gray-800">
                <span className="text-2xl font-extrabold text-red-600">{typeof price === 'number' ? price.toFixed(2) : price}</span>
                <span className="text-sm ml-1">元起</span>
            </p>
        ) : <div />}

        {product.promoTag && (
            <div className="flex items-center text-[11px] text-amber-700 bg-amber-100 px-2 py-1 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1 text-amber-500">
                  <path d="M10 2l2.39 4.84L18 7.27l-4 3.9.94 5.48L10 14.77 5.06 16.65l.94-5.48-4-3.9 5.61-1.43L10 2z" />
                </svg>
                {product.promoTag}
            </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
