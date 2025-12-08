
import React, { useState, useRef, useMemo } from 'react';
import { type InsuranceProduct, PrimaryCategory } from '../../types';
import ProductCard from './ProductCard';

interface ProductSortingPageProps {
  products: InsuranceProduct[];
  onSaveSort: (sortedList: InsuranceProduct[]) => void;
}

const CATEGORY_ORDER: PrimaryCategory[] = [
    PrimaryCategory.HEALTH,
    PrimaryCategory.CRITICAL_ILLNESS,
    PrimaryCategory.ACCIDENT,
    PrimaryCategory.ANNUITY,
    PrimaryCategory.TERM_LIFE,
    PrimaryCategory.WHOLE_LIFE,
]

const ProductSortingPage: React.FC<ProductSortingPageProps> = ({ products, onSaveSort }) => {
  const [list, setList] = useState<InsuranceProduct[]>(products);
  const [activeCategory, setActiveCategory] = useState<PrimaryCategory>(PrimaryCategory.CRITICAL_ILLNESS);
  const [dragging, setDragging] = useState(false);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  const filteredList = useMemo(() => {
    return list.filter(p => p.primaryCategory === activeCategory);
  }, [list, activeCategory]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, productCode: string) => {
    dragItem.current = productCode;
    setDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, productCode: string) => {
    e.preventDefault();
    dragOverItem.current = productCode;
  };

  const handleDragEnd = () => {
    if (dragItem.current && dragOverItem.current && dragItem.current !== dragOverItem.current) {
      const dragItemIndex = list.findIndex(item => item.productCode === dragItem.current);
      const dragOverItemIndex = list.findIndex(item => item.productCode === dragOverItem.current);

      if (dragItemIndex !== -1 && dragOverItemIndex !== -1) {
        const newList = [...list];
        const [draggedItem] = newList.splice(dragItemIndex, 1);
        newList.splice(dragOverItemIndex, 0, draggedItem);
        setList(newList);
      }
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
  };
  
  const handleSave = () => {
    onSaveSort(list);
  };

  const getShortCategoryName = (category: PrimaryCategory) => {
    const map: Record<PrimaryCategory, string> = {
      [PrimaryCategory.HEALTH]: '医疗',
      [PrimaryCategory.CRITICAL_ILLNESS]: '重疾',
      [PrimaryCategory.ACCIDENT]: '意外',
      [PrimaryCategory.ANNUITY]: '养老金',
      [PrimaryCategory.TERM_LIFE]: '储蓄型', // Mapped to a more common term from image
      [PrimaryCategory.WHOLE_LIFE]: '旅行', // Mapped to a more common term from image
    };
    return map[category] || category;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-brand-blue-700 text-white p-3 flex items-center justify-between">
         <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <h1 className="text-lg font-semibold ml-2">产品</h1>
         </div>
         <div className="flex items-center space-x-2">
            <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center p-0.5">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
             <div className="w-5 h-5 border-2 border-white rounded-full"></div>
         </div>
      </header>

      {/* Category Tabs */}
      <nav className="flex-shrink-0 bg-brand-blue-700 text-white flex justify-around px-2">
        {CATEGORY_ORDER.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)}
            className={`py-2 px-2 text-sm font-semibold relative ${activeCategory === cat ? 'text-white' : 'text-blue-200'}`}
          >
            {getShortCategoryName(cat)}
            {activeCategory === cat && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-white rounded-full"></div>}
          </button>
        ))}
      </nav>

      <div className="p-3 bg-white border-b border-gray-200">
        <p className="text-sm font-medium text-gray-800">选出适合你的保险产品</p>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Sub-tabs */}
        <div className="bg-white p-3 rounded-lg shadow-sm">
           <div className="flex items-center justify-between">
                <div className="flex space-x-4">
                    <button className="text-sm font-bold text-brand-blue-600 relative">
                        综合推荐
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-brand-blue-600 rounded-full"></div>
                    </button>
                    <button className="text-sm font-medium text-gray-600">热销排序</button>
                </div>
                 <button className="text-xs font-medium text-blue-600 flex items-center">
                    <span className="text-xs font-bold text-white bg-blue-600 rounded-sm px-0.5 mr-1">VS</span>
                    去对比
                 </button>
           </div>
        </div>

        {/* Product List */}
        {filteredList.map((product) => (
          <div
            key={product.productCode}
            draggable
            onDragStart={(e) => handleDragStart(e, product.productCode)}
            onDragEnter={(e) => handleDragEnter(e, product.productCode)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`cursor-move transition-opacity ${dragging && dragItem.current === product.productCode ? 'opacity-50' : 'opacity-100'}`}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </main>

      {/* Sticky Footer Button */}
      <div className="flex-shrink-0 bg-white p-3 border-t border-gray-200 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleSave}
          className="w-full block text-center bg-brand-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-blue-700 transition-colors"
        >
          保存排序
        </button>
      </div>
    </div>
  );
};

export default ProductSortingPage;
