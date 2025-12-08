
import React, { useState, useMemo } from 'react';
import { PRIMARY_CATEGORIES, MOCK_COMPANY_LIST } from '../constants';
import { type InsuranceProduct, ProductStatus } from '../types';
import Pagination from './ui/Pagination';

const ProductListPage: React.FC<{ products: InsuranceProduct[]; onSelectConfig: (product: InsuranceProduct) => void; onAddProduct: () => void; onUpdateStatus: (productCode: string, status: ProductStatus) => void; companyCode?: string; }> = ({ products, onSelectConfig, onAddProduct, onUpdateStatus, companyCode }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Filter states
    const [nameQuery, setNameQuery] = useState('');
    const [categoryQuery, setCategoryQuery] = useState('');
    const [creatorQuery, setCreatorQuery] = useState('');

    const [activeFilters, setActiveFilters] = useState({
        name: '',
        category: '',
        creator: ''
    });

    const handleSearch = () => {
        setActiveFilters({
            name: nameQuery,
            category: categoryQuery,
            creator: creatorQuery
        });
        setCurrentPage(1);
    };

    const handleReset = () => {
        setNameQuery('');
        setCategoryQuery('');
        setCreatorQuery('');
        setActiveFilters({ name: '', category: '', creator: '' });
        setCurrentPage(1);
    };

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchName = product.regulatoryName.toLowerCase().includes(activeFilters.name.toLowerCase());
            const matchCategory = activeFilters.category ? product.primaryCategory === activeFilters.category : true;
            const matchCreator = activeFilters.creator ? product.operator === activeFilters.creator : true;
            const targetCompany = companyCode ? MOCK_COMPANY_LIST.find(c => c.code === companyCode)?.shortName : undefined;
            const matchCompany = targetCompany ? product.companyName === targetCompany : true;
            return matchName && matchCategory && matchCreator && matchCompany;
        });
    }, [products, activeFilters, companyCode]);

    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const handleStatusChange = (productCode: string, newStatus: ProductStatus) => {
        onUpdateStatus(productCode, newStatus);
    };

    const StatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
      const statusMap = {
        [ProductStatus.ACTIVE]: { text: '生效', bg: 'bg-green-100', text_color: 'text-green-800' },
        [ProductStatus.INACTIVE]: { text: '失效', bg: 'bg-red-100', text_color: 'text-red-800' },
        [ProductStatus.DRAFT]: { text: '草稿', bg: 'bg-yellow-100', text_color: 'text-yellow-800' },
      };
      const { text, bg, text_color } = statusMap[status] || { text: '未知', bg: 'bg-gray-100', text_color: 'text-gray-800' };
      return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bg} ${text_color}`}>
          {text}
        </span>
      );
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">产品管理</h1>
            
            {/* Filter Card */}
            <div className="bg-white p-6 rounded-md shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                     <div>
                        <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">产品名称:</label>
                        <input
                            type="text"
                            id="productName"
                            value={nameQuery}
                            onChange={(e) => setNameQuery(e.target.value)}
                            placeholder="请输入产品名称"
                            className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="product_category" className="block text-sm font-medium text-gray-700 mb-1">产品大类:</label>
                        <select 
                            id="product_category" 
                            value={categoryQuery}
                            onChange={(e) => setCategoryQuery(e.target.value)}
                            className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500 text-sm"
                        >
                           <option value="">全部</option>
                           {PRIMARY_CATEGORIES.map(cat => (
                               <option key={cat} value={cat}>{cat}</option>
                           ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="creator" className="block text-sm font-medium text-gray-700 mb-1">创建人:</label>
                        <select 
                            id="creator" 
                            value={creatorQuery}
                            onChange={(e) => setCreatorQuery(e.target.value)}
                            className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500 text-sm"
                        >
                           <option value="">全部</option>
                           <option value="张三">张三</option>
                           <option value="李四">李四</option>
                           <option value="王五">王五</option>
                           <option value="赵六">赵六</option>
                           <option value="系统管理员">系统管理员</option>
                        </select>
                    </div>
                    <div className="flex items-center space-x-3 justify-start">
                        <button onClick={handleReset} className="h-9 px-5 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition">重置</button>
                        <button onClick={handleSearch} className="h-9 px-5 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition">查询</button>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-md shadow-sm">
                 <div className="p-6 flex justify-between items-center">
                    <h2 className="text-base font-semibold text-gray-900">产品列表</h2>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onAddProduct}
                            className="h-9 px-4 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 transition flex-shrink-0"
                        >
                            新增产品
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-[#fafafa]">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">产品代码</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">产品名称</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">保险公司</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">产品大类</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">状态</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider">操作人</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {paginatedProducts.map((product) => (
                                <tr key={product.productCode} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{product.productCode}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.regulatoryName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.companyName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.primaryCategory}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={product.status} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.operator || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                        <button 
                                            onClick={() => onSelectConfig(product)} 
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            查看
                                        </button>
                                        
                                        {(product.status === ProductStatus.INACTIVE || product.status === ProductStatus.DRAFT) && (
                                            <button 
                                                onClick={() => onSelectConfig(product)} 
                                                className="text-blue-500 hover:text-blue-700"
                                            >
                                                修改
                                            </button>
                                        )}
                                        
                                        {product.status === ProductStatus.INACTIVE && (
                                            <button 
                                                onClick={() => handleStatusChange(product.productCode, ProductStatus.ACTIVE)} 
                                                className="text-green-600 hover:text-green-800"
                                            >
                                                生效
                                            </button>
                                        )}

                                        {product.status === ProductStatus.ACTIVE && (
                                            <button 
                                                onClick={() => handleStatusChange(product.productCode, ProductStatus.INACTIVE)} 
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                失效
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-slate-200">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredProducts.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                </div>
            </div>
        </div>
    )
}

export default ProductListPage;
