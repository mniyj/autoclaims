
import React, { useState, useEffect } from 'react';
import { type CategoryDefinition, type TreeNode, type InsuranceCategoryMapping } from '../types';
import { MAPPING_DATA, LEVEL_1_DATA, LEVEL_2_DATA, LEVEL_3_DATA, REGULATORY_OPTIONS } from '../constants';

const InsuranceTypeManagementPage: React.FC<{ tool?: '智能体' | '省心配' }> = ({ tool }) => {
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState<Partial<CategoryDefinition & InsuranceCategoryMapping>>({});
    const [parentPath, setParentPath] = useState<string[]>([]);

    useEffect(() => {
        const buildTree = () => {
            const tree: TreeNode[] = [];
            
            // 1. Process Level 1 (keyed by L1 code)
            const level1Map = new Map<string, TreeNode>();
            LEVEL_1_DATA.forEach(l1 => {
                const node: TreeNode = {
                    key: l1.code,
                    title: l1.name,
                    level: 1,
                    children: [],
                    data: l1
                };
                level1Map.set(l1.code, node);
                tree.push(node);
            });

            // 2. Process Level 2 (attach by code: first char of L2 code)
            const level2Map = new Map<string, TreeNode>();
            LEVEL_2_DATA.forEach(l2 => {
                const parentKey = l2.code.charAt(0);
                const parentNode = level1Map.get(parentKey);
                if (parentNode) {
                    const node: TreeNode = {
                        key: l2.code,
                        title: l2.name,
                        level: 2,
                        children: [],
                        data: { ...l2, antLevel1Name: parentNode.title },
                        parentKey: parentNode.key
                    };
                    if (!parentNode.children?.find(c => c.key === node.key)) {
                        parentNode.children = parentNode.children || [];
                        parentNode.children.push(node);
                        level2Map.set(l2.code, node);
                    }
                }
            });

            // 3. Process Level 3 (attach by code: first 3 chars of L3 code)
            LEVEL_3_DATA.forEach(l3 => {
                const parentCode = l3.code.slice(0, 3);
                const parentNode = level2Map.get(parentCode);
                if (parentNode) {
                    const mapping = MAPPING_DATA.find(m => m.antLevel3Code === l3.code);
                    const node: TreeNode = {
                        key: l3.code,
                        title: l3.name,
                        level: 3,
                        children: [],
                        data: mapping ? { ...l3, ...mapping } : l3,
                        parentKey: parentNode.key
                    };
                    parentNode.children = parentNode.children || [];
                    parentNode.children.push(node);
                }
            });
            
            return tree;
        };

        const tree = buildTree();
        setTreeData(tree);
        
        if (tree.length > 0) {
            handleSelectNode(tree[0]);
            setExpandedKeys(new Set([tree[0].key]));
        }
    }, []);

    const handleSelectNode = (node: TreeNode) => {
        updateParentPath(node);
        setSelectedNode(node);
        setFormData(node.data);
    };

    const updateParentPath = (node: TreeNode) => {
        const path: string[] = [node.title];
        
        let currentKey = node.parentKey;
        
        const findNodeByKey = (nodes: TreeNode[], key: string): TreeNode | undefined => {
            for (const n of nodes) {
                if (n.key === key) return n;
                if (n.children) {
                    const found = findNodeByKey(n.children, key);
                    if (found) return found;
                }
            }
            return undefined;
        };

        while(currentKey) {
            const parent = findNodeByKey(treeData, currentKey);
            if (parent) {
                path.unshift(parent.title);
                currentKey = parent.parentKey;
            } else {
                break;
            }
        }
        setParentPath(path);
    };

    const toggleExpand = (key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedKeys);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedKeys(newExpanded);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value.toLowerCase();
        setSearchQuery(term);
        
        if (!term) return;

        const keysToExpand = new Set<string>();
        const traverse = (nodes: TreeNode[]) => {
            let hasMatch = false;
            for (const node of nodes) {
                const match = node.title.toLowerCase().includes(term) || node.key.toLowerCase().includes(term);
                const childMatch = node.children ? traverse(node.children) : false;
                
                if (match || childMatch) {
                    hasMatch = true;
                    if (node.children && node.children.length > 0) {
                        keysToExpand.add(node.key);
                    }
                }
            }
            return hasMatch;
        };
        traverse(treeData);
        setExpandedKeys(keysToExpand);
    };
    
    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        if (!selectedNode) return;

        const updateNodeData = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(node => {
                if (node.key === selectedNode.key) {
                    node.data = { ...node.data, ...formData };
                    if (formData.name) node.title = formData.name;
                    return node;
                }
                if (node.children) {
                    node.children = updateNodeData(node.children);
                }
                return node;
            });
        };
        
        setTreeData(prev => updateNodeData([...prev]));
        alert('保存成功！');
    };
    
    const handleReset = () => {
        if (selectedNode) {
            setFormData(selectedNode.data);
        }
    };

    const renderTreeNodes = (nodes: TreeNode[]) => {
        if (!nodes || nodes.length === 0) return null;

        return (
            <ul className="pl-4 space-y-0.5">
                {nodes.map(node => {
                    const isExpanded = expandedKeys.has(node.key);
                    const isSelected = selectedNode?.key === node.key;
                    const isLeaf = !node.children || node.children.length === 0;

                    return (
                        <li key={node.key}>
                            <div 
                                className={`flex items-center py-1.5 px-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-brand-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
                                onClick={() => handleSelectNode(node)}
                            >
                                <span 
                                    className={`mr-1.5 p-0.5 rounded hover:bg-gray-200 text-gray-400 ${isLeaf ? 'invisible' : ''}`}
                                    onClick={(e) => toggleExpand(node.key, e)}
                                >
                                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                                <span className="mr-2 text-xs text-gray-500">
                                    {node.level === 1 ? '[L1]' : node.level === 2 ? '[L2]' : '[L3]'}
                                </span>
                                <span className={`text-sm truncate ${searchQuery && node.title.toLowerCase().includes(searchQuery) ? 'bg-yellow-100' : ''}`}>
                                    {node.title} <span className="text-gray-400 text-xs ml-1">({node.key})</span>
                                </span>
                            </div>
                            {isExpanded && node.children && (
                                renderTreeNodes(node.children)
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
             <div className="flex justify-between items-center mb-4 px-1">
                <h1 className="text-2xl font-bold text-slate-900">产品分类管理</h1>
             </div>

            <div className="flex-1 flex border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {/* Left Sidebar: Tree */}
                <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-gray-200 flex flex-col bg-gray-50/30">
                    <div className="p-4 border-b border-gray-200 bg-white">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="🔍 搜索分类名称或编码..."
                                className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
                                value={searchQuery}
                                onChange={handleSearch}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 bg-white">
                        <div className="pl-0">
                             {renderTreeNodes(treeData)}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Detail & Edit */}
                <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
                    {/* Header */}
                    <div className="h-14 px-6 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
                        <div className="text-sm text-gray-500 flex items-center">
                            <span>当前位置：</span>
                            {parentPath.map((path, idx) => (
                                <React.Fragment key={idx}>
                                    <span className="font-medium text-gray-800 mx-1">{path}</span>
                                    <span className="mx-1">/</span>
                                </React.Fragment>
                            ))}
                            {selectedNode && <span className="font-bold text-brand-blue-600 mx-1">{selectedNode.title}</span>}
                        </div>
                        <div className="space-x-3">
                             <button onClick={handleReset} className="px-4 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition">重置</button>
                             <button onClick={handleSave} className="px-4 py-1.5 bg-brand-blue-600 text-white rounded text-sm hover:bg-brand-blue-700 shadow-sm transition">保存修改</button>
                        </div>
                    </div>

                    {/* Content Scrollable Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {selectedNode ? (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Basic Info Card */}
                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                                    <h3 className="text-base font-bold text-gray-800 mb-4 border-l-4 border-brand-blue-500 pl-3">基本信息</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">分类编码 (Code)</label>
                                            <input type="text" value={formData.code || ''} disabled className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded text-sm text-gray-600 cursor-not-allowed" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">分类名称 (Name)</label>
                                            <input type="text" value={formData.name || ''} onChange={e => handleInputChange('name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">当前层级 (Level)</label>
                                            <div className="px-3 py-2 text-sm text-gray-700 flex items-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedNode.level === 1 ? 'bg-purple-100 text-purple-700' : selectedNode.level === 2 ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                                                    {selectedNode.level === 1 ? 'L1 - 一级分类' : selectedNode.level === 2 ? 'L2 - 二级分类' : 'L3 - 三级分类'}
                                                </span>
                                            </div>
                                        </div>
                                         {selectedNode.level === 2 && (
                                            <div>
                                                 <label className="block text-xs font-medium text-gray-500 mb-1">所属一级分类</label>
                                                 <input type="text" value={formData.antLevel1Name || ''} disabled className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded text-sm text-gray-600 cursor-not-allowed" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Regulatory Mapping Card (Moved to Level 2) */}
                                {selectedNode.level === 2 && (
                                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                                        <h3 className="text-base font-bold text-gray-800 mb-4 border-l-4 border-orange-500 pl-3">监管与分类配置 (L2 专属)</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">监管一级分类</label>
                                                <select 
                                                    value={formData.regLevel1Code || ''} 
                                                    onChange={e => {
                                                        const code = e.target.value;
                                                        const name = REGULATORY_OPTIONS.find(r => r.code === code)?.name || '';
                                                        setFormData(prev => ({ 
                                                            ...prev, 
                                                            regLevel1Code: code, 
                                                            regLevel1Name: name, 
                                                            regLevel2Code: '', 
                                                            regLevel2Name: '' 
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none bg-white"
                                                >
                                                    <option value="">请选择...</option>
                                                    {REGULATORY_OPTIONS.map(option => (
                                                        <option key={option.code} value={option.code}>
                                                            {option.code} - {option.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">监管二级分类</label>
                                                <select 
                                                    value={formData.regLevel2Code || ''} 
                                                    onChange={e => {
                                                        const code = e.target.value;
                                                        const level1 = REGULATORY_OPTIONS.find(r => r.code === formData.regLevel1Code);
                                                        const level2 = level1?.children.find(c => c.code === code);
                                                        setFormData(prev => ({ 
                                                            ...prev, 
                                                            regLevel2Code: code, 
                                                            regLevel2Name: level2?.name || '' 
                                                        }));
                                                    }}
                                                    disabled={!formData.regLevel1Code}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                >
                                                    <option value="">请选择...</option>
                                                    {formData.regLevel1Code && REGULATORY_OPTIONS.find(r => r.code === formData.regLevel1Code)?.children.map(child => (
                                                        <option key={child.code} value={child.code}>
                                                            {child.code} - {child.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">功能分类</label>
                                                <div className="flex space-x-6 mt-2">
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="functionCategory" 
                                                            value="保障" 
                                                            checked={formData.functionCategory === '保障'} 
                                                            onChange={e => handleInputChange('functionCategory', e.target.value)}
                                                            className="text-brand-blue-600 focus:ring-brand-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-700">保障</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="functionCategory" 
                                                            value="储蓄" 
                                                            checked={formData.functionCategory === '储蓄'} 
                                                            onChange={e => handleInputChange('functionCategory', e.target.value)}
                                                            className="text-brand-blue-600 focus:ring-brand-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-700">储蓄</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Detail Content Card */}
                                {tool !== '省心配' && (
                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                                     <h3 className="text-base font-bold text-gray-800 mb-4 border-l-4 border-green-500 pl-3">详细定义与话术</h3>
                                     
                                     <div className="space-y-4">
                                         <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">定义 (Definition)</label>
                                            <textarea 
                                                rows={3} 
                                                value={formData.definition || ''}
                                                onChange={e => handleInputChange('definition', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                                placeholder="简要描述该产品的核心定义..."
                                            />
                                         </div>

                                         <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">产品特色 (Features)</label>
                                            <textarea 
                                                rows={3} 
                                                value={formData.features || ''}
                                                onChange={e => handleInputChange('features', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                            />
                                         </div>

                                          <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">功能/作用 (Function)</label>
                                            <textarea 
                                                rows={3} 
                                                value={formData.function || ''}
                                                onChange={e => handleInputChange('function', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                            />
                                         </div>

                                         <div className="grid grid-cols-2 gap-6">
                                             <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">适用人群 (Audience)</label>
                                                <textarea 
                                                    rows={4} 
                                                    value={formData.audience || ''}
                                                    onChange={e => handleInputChange('audience', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">选购要点 (Selection Points)</label>
                                                <textarea 
                                                    rows={4} 
                                                    value={formData.selectionPoints || ''}
                                                    onChange={e => handleInputChange('selectionPoints', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                                />
                                            </div>
                                         </div>
                                         
                                         <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">核心指标 (Core Metrics)</label>
                                            <textarea 
                                                rows={2} 
                                                value={formData.coreMetrics || ''}
                                                onChange={e => handleInputChange('coreMetrics', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                                placeholder="如：保额，免赔额，续保条件..."
                                            />
                                         </div>
                                    </div>
                                </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <p>请在左侧选择一个分类进行管理</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InsuranceTypeManagementPage;
