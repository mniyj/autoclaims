import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_RESPONSIBILITIES, PRIMARY_CATEGORIES } from '../constants';
import { ResponsibilityItem } from '../types';
import { api } from '../services/api';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    {children}
                </div>
                {footer && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

const ResponsibilityManagementPage: React.FC = () => {
    // Start with empty, load from API, fallback to Mock if empty? Or just empty.
    // For seamless transition, if API return empty (first run), we could load MOCK and save it?
    const [responsibilities, setResponsibilities] = useState<ResponsibilityItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<ResponsibilityItem>>({});

    useEffect(() => {
        const fetchResponsibilities = async () => {
            try {
                const data = await api.responsibilities.list();
                if (data && data.length > 0) {
                    setResponsibilities(data);
                } else {
                    // Auto-seed: persist MOCK data on first load
                    await api.responsibilities.saveAll(MOCK_RESPONSIBILITIES);
                    setResponsibilities(MOCK_RESPONSIBILITIES);
                }
            } catch (error) {
                console.error('Failed to fetch responsibilities:', error);
                setResponsibilities(MOCK_RESPONSIBILITIES);
            }
        };
        fetchResponsibilities();
    }, []);

    // Filter Logic
    const filteredData = useMemo(() => {
        if (!searchQuery) return responsibilities;
        const lowerQuery = searchQuery.toLowerCase();
        return responsibilities.filter(item =>
            item.code.toLowerCase().includes(lowerQuery) ||
            item.name.toLowerCase().includes(lowerQuery) ||
            item.category.toLowerCase().includes(lowerQuery)
        );
    }, [responsibilities, searchQuery]);

    // Handlers
    const handleAdd = () => {
        setCurrentItem({
            code: '',
            name: '',
            category: PRIMARY_CATEGORIES[0],
            description: ''
        });
        setIsEditModalOpen(true);
    };

    const handleEdit = (item: ResponsibilityItem) => {
        setCurrentItem({ ...item });
        setIsEditModalOpen(true);
    };

    const handleDeleteClick = (item: ResponsibilityItem) => {
        setCurrentItem(item);
        setIsDeleteModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentItem.code?.trim() || !currentItem.name?.trim() || !currentItem.category) {
            alert('请完善必填信息');
            return;
        }

        let newResponsibilities = [...responsibilities];

        if (currentItem.id) {
            // Update
            newResponsibilities = newResponsibilities.map(item => item.id === currentItem.id ? currentItem as ResponsibilityItem : item);
        } else {
            // Create
            const newItem = {
                ...currentItem,
                id: `resp-${Date.now()}`,
            } as ResponsibilityItem;
            newResponsibilities = [newItem, ...newResponsibilities];
        }

        try {
            await api.responsibilities.saveAll(newResponsibilities);
            setResponsibilities(newResponsibilities);
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Failed to save responsibility:', error);
            alert('保存失败');
        }
    };

    const handleConfirmDelete = async () => {
        if (currentItem.id) {
            const newResponsibilities = responsibilities.filter(item => item.id !== currentItem.id);
            try {
                await api.responsibilities.saveAll(newResponsibilities);
                setResponsibilities(newResponsibilities);
                setIsDeleteModalOpen(false);
            } catch (error) {
                console.error('Failed to delete responsibility:', error);
                alert('删除失败');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">责任库管理</h1>
                <button
                    onClick={handleAdd}
                    className="inline-flex items-center px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors"
                >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    新增责任
                </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-blue-500 focus:border-brand-blue-500 sm:text-sm transition-shadow"
                        placeholder="搜索责任代码、名称或分类..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">责任代码</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">责任名称</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">适用险种</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">责任描述</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.length > 0 ? (
                                filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-brand-blue-600 font-medium">
                                            {item.code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={item.description}>
                                            {item.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="text-brand-blue-600 hover:text-brand-blue-900 mr-4 transition-colors"
                                            >
                                                编辑
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(item)}
                                                className="text-red-600 hover:text-red-900 transition-colors"
                                            >
                                                删除
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <svg className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p>暂无符合条件的责任数据</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        共 {filteredData.length} 条记录
                    </div>
                </div>
            </div>

            {/* Edit/Create Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={currentItem.id ? "编辑责任" : "新增责任"}
                footer={
                    <>
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors"
                        >
                            保存
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">责任代码 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={currentItem.code || ''}
                            onChange={e => setCurrentItem(prev => ({ ...prev, code: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-blue-500 focus:border-brand-blue-500 outline-none transition-shadow"
                            placeholder="例如：ACCIDENT_DEATH"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">责任名称 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={currentItem.name || ''}
                            onChange={e => setCurrentItem(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-blue-500 focus:border-brand-blue-500 outline-none transition-shadow"
                            placeholder="例如：意外身故"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">适用险种 <span className="text-red-500">*</span></label>
                        <select
                            value={currentItem.category || ''}
                            onChange={e => setCurrentItem(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-blue-500 focus:border-brand-blue-500 outline-none bg-white transition-shadow"
                        >
                            {PRIMARY_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">责任描述</label>
                        <textarea
                            rows={4}
                            value={currentItem.description || ''}
                            onChange={e => setCurrentItem(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-blue-500 focus:border-brand-blue-500 outline-none transition-shadow resize-none"
                            placeholder="请输入该责任的详细描述..."
                        />
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="确认删除"
                footer={
                    <>
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleConfirmDelete}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                            删除
                        </button>
                    </>
                }
            >
                <div className="text-center py-4">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                        <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p className="text-sm text-gray-500">
                        确定要删除责任 <span className="font-bold text-gray-900">{currentItem.name}</span> 吗？此操作无法撤销。
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default ResponsibilityManagementPage;
