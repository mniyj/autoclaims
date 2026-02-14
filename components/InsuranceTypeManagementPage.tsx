import React, { useState, useEffect } from 'react';
import { type CategoryDefinition, type TreeNode, type InsuranceCategoryMapping } from '../types';
import { MAPPING_DATA, LEVEL_1_DATA, LEVEL_2_DATA, LEVEL_3_DATA, REGULATORY_OPTIONS } from '../constants';
import { api } from '../services/api';

const InsuranceTypeManagementPage: React.FC<{ tool?: '智能体' | '省心配' }> = ({ tool }) => {
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState<Partial<CategoryDefinition & InsuranceCategoryMapping>>({});
    const [parentPath, setParentPath] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any>(null); // To store valid raw data for reference if needed
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newLevel, setNewLevel] = useState<1 | 2 | 3>(1);
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newParentKey, setNewParentKey] = useState('');

    useEffect(() => {
        const loadData = async () => {
            let l1Data = LEVEL_1_DATA;
            let l2Data = LEVEL_2_DATA;
            let l3Data = LEVEL_3_DATA;
            let mappingData = MAPPING_DATA;

            try {
                const apiData = await api.insuranceTypes.list() as any;
                const isStructuredData = apiData && apiData.level1 && Array.isArray(apiData.level1) && apiData.level1.length > 0;
                if (isStructuredData) {
                    l1Data = apiData.level1;
                    l2Data = apiData.level2;
                    l3Data = apiData.level3;
                    mappingData = apiData.mappings;
                    setRawData(apiData);
                } else if (Array.isArray(apiData) && apiData.length > 0) {
                    l1Data = apiData.filter(item => String(item.code || '').length === 1);
                    l2Data = apiData.filter(item => String(item.code || '').length === 3);
                    l3Data = apiData.filter(item => String(item.code || '').length >= 5);
                    const migratedData = { level1: l1Data, level2: l2Data, level3: l3Data, mappings: mappingData };
                    await api.insuranceTypes.saveAll(migratedData as any);
                    setRawData(migratedData);
                } else {
                    const initialData = { level1: l1Data, level2: l2Data, level3: l3Data, mappings: mappingData };
                    await api.insuranceTypes.saveAll(initialData as any);
                    setRawData(initialData);
                }
            } catch (e) {
                console.error("Failed to load insurance types from API, falling back to constants", e);
                // Fallback to constants (already set variables)
                // Also try to save? Maybe connection error, so don't try to save immediately to avoid overwrite risk if read failed but write works?
                // But for local fs, read fail usually means file not found or empty.
            }

            const tree: TreeNode[] = [];

            // 1. Process Level 1 (keyed by L1 code)
            const level1Map = new Map<string, TreeNode>();
            l1Data.forEach((l1: any) => {
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
            l2Data.forEach((l2: any) => {
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
            l3Data.forEach((l3: any) => {
                const parentCode = l3.code.slice(0, 3);
                const parentNode = level2Map.get(parentCode);
                if (parentNode) {
                    const mapping = mappingData.find((m: any) => m.antLevel3Code === l3.code);
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

            setTreeData(tree);

            if (tree.length > 0) {
                // handleSelectNode logic needs access to state setting functions, which are in scope
                // We can't call handleSelectNode directly if definitions are inside useEffect or below.
                // But handleSelectNode is defined below.
                // We should select first node after render or here?
                // setSelectedNode(tree[0]); setFormData(tree[0].data); etc.
                // Let's just set the expanded key.
                setExpandedKeys(new Set([tree[0].key]));
            }
        };
        loadData();
    }, []);

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

    const handleSelectNode = (node: TreeNode) => {
        updateParentPath(node);
        setSelectedNode(node);
        setFormData(node.data);
    };

    const updateParentPath = (node: TreeNode, nodes: TreeNode[] = treeData) => {
        const path: string[] = [node.title];

        let currentKey = node.parentKey;

        while (currentKey) {
            const parent = findNodeByKey(nodes, currentKey);
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

    const buildFullData = (nodes: TreeNode[]) => {
        const l1: any[] = [];
        const l2: any[] = [];
        const l3: any[] = [];
        const mappings: any[] = [];

        nodes.forEach(nodeL1 => {
            l1.push({ ...nodeL1.data, code: nodeL1.data.code || nodeL1.key, name: nodeL1.data.name || nodeL1.title });
            if (nodeL1.children) {
                nodeL1.children.forEach(nodeL2 => {
                    l2.push({ ...nodeL2.data, code: nodeL2.data.code || nodeL2.key, name: nodeL2.data.name || nodeL2.title });
                    if (nodeL2.children) {
                        nodeL2.children.forEach(nodeL3 => {
                            l3.push({ ...nodeL3.data, code: nodeL3.data.code || nodeL3.key, name: nodeL3.data.name || nodeL3.title });
                            mappings.push({
                                antLevel3Code: nodeL3.data.code || nodeL3.key,
                                antLevel1Name: nodeL3.data.antLevel1Name || nodeL1.title,
                                antLevel2Name: nodeL3.data.antLevel2Name || nodeL2.title,
                                antLevel3Name: nodeL3.data.antLevel3Name || nodeL3.data.name || nodeL3.title,
                                regLevel1Code: nodeL2.data.regLevel1Code,
                                regLevel1Name: nodeL2.data.regLevel1Name,
                                regLevel2Code: nodeL2.data.regLevel2Code,
                                regLevel2Name: nodeL2.data.regLevel2Name,
                                functionCategory: nodeL2.data.functionCategory || nodeL3.data.functionCategory || '保障'
                            });
                        });
                    }
                });
            }
        });

        return {
            level1: l1,
            level2: l2,
            level3: l3,
            mappings
        };
    };

    const handleSave = async () => {
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

        const newTreeData = updateNodeData([...treeData]);
        setTreeData(newTreeData);

        const fullData = buildFullData(newTreeData);
        try {
            await api.insuranceTypes.saveAll(fullData as any);
            alert('保存成功！');
            setRawData(fullData);
        } catch (e) {
            console.error('Failed to save insurance types:', e);
            alert('保存失败');
        }
    };

    const collectAllCodes = (nodes: TreeNode[], set: Set<string>) => {
        nodes.forEach(node => {
            set.add(node.key);
            if (node.children) collectAllCodes(node.children, set);
        });
    };

    const openAddModal = () => {
        if (selectedNode) {
            if (selectedNode.level === 1) {
                setNewLevel(2);
                setNewParentKey(selectedNode.key);
            } else if (selectedNode.level === 2) {
                setNewLevel(3);
                setNewParentKey(selectedNode.key);
            } else {
                setNewLevel(3);
                setNewParentKey(selectedNode.parentKey || '');
            }
        } else {
            setNewLevel(1);
            setNewParentKey('');
        }
        setNewCode('');
        setNewName('');
        setIsAddModalOpen(true);
    };

    const handleAddConfirm = async () => {
        const code = newCode.trim();
        const name = newName.trim();
        if (!code || !name) {
            alert('请填写编码和名称');
            return;
        }
        const existingCodes = new Set<string>();
        collectAllCodes(treeData, existingCodes);
        if (existingCodes.has(code)) {
            alert('该编码已存在，请使用其他编码');
            return;
        }

        const updatedTree = [...treeData];
        let createdNode: TreeNode | null = null;

        if (newLevel === 1) {
            createdNode = {
                key: code,
                title: name,
                level: 1,
                children: [],
                data: {
                    code,
                    name,
                    definition: '',
                    features: '',
                    function: '',
                    audience: '',
                    selectionPoints: '',
                    coreMetrics: ''
                }
            };
            updatedTree.push(createdNode);
            setExpandedKeys(prev => new Set([...prev, code]));
        } else if (newLevel === 2) {
            if (!newParentKey) {
                alert('请选择所属一级分类');
                return;
            }
            const parent = findNodeByKey(updatedTree, newParentKey);
            if (!parent) {
                alert('未找到所属一级分类');
                return;
            }
            createdNode = {
                key: code,
                title: name,
                level: 2,
                children: [],
                parentKey: parent.key,
                data: {
                    code,
                    name,
                    antLevel1Name: parent.title,
                    definition: '',
                    features: '',
                    function: '',
                    audience: '',
                    selectionPoints: '',
                    coreMetrics: ''
                }
            };
            parent.children = parent.children || [];
            parent.children.push(createdNode);
            setExpandedKeys(prev => new Set([...prev, parent.key]));
        } else {
            if (!newParentKey) {
                alert('请选择所属二级分类');
                return;
            }
            const parent = findNodeByKey(updatedTree, newParentKey);
            if (!parent) {
                alert('未找到所属二级分类');
                return;
            }
            const parentL1 = parent.parentKey ? findNodeByKey(updatedTree, parent.parentKey) : undefined;
            createdNode = {
                key: code,
                title: name,
                level: 3,
                children: [],
                parentKey: parent.key,
                data: {
                    code,
                    name,
                    antLevel1Name: parentL1?.title || '',
                    antLevel2Name: parent.title,
                    antLevel3Name: name,
                    functionCategory: parent.data.functionCategory,
                    regLevel1Code: parent.data.regLevel1Code,
                    regLevel1Name: parent.data.regLevel1Name,
                    regLevel2Code: parent.data.regLevel2Code,
                    regLevel2Name: parent.data.regLevel2Name,
                    definition: '',
                    features: '',
                    function: '',
                    audience: '',
                    selectionPoints: '',
                    coreMetrics: ''
                }
            };
            parent.children = parent.children || [];
            parent.children.push(createdNode);
            const keysToExpand = new Set(expandedKeys);
            keysToExpand.add(parent.key);
            if (parent.parentKey) keysToExpand.add(parent.parentKey);
            setExpandedKeys(keysToExpand);
        }

        setTreeData(updatedTree);
        setIsAddModalOpen(false);

        if (createdNode) {
            setSelectedNode(createdNode);
            setFormData(createdNode.data);
            updateParentPath(createdNode, updatedTree);
        }

        try {
            const fullData = buildFullData(updatedTree);
            await api.insuranceTypes.saveAll(fullData as any);
            setRawData(fullData);
        } catch (e) {
            console.error('Failed to save insurance types:', e);
            alert('保存失败');
        }
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
                <button onClick={openAddModal} className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-brand-blue-700 transition">新增分类</button>
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

                                {/* FAQ Configuration Module (Level 2 Only) */}
                                {selectedNode.level === 2 && (
                                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mt-6">
                                        <div className="flex justify-between items-center mb-4 border-l-4 border-purple-500 pl-3">
                                            <div className="flex items-center">
                                                <h3 className="text-base font-bold text-gray-800 mr-2">FAQ（常见问题）配置</h3>
                                                <div className="relative group">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-3 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed font-normal text-left">
                                                        配置后，智能体端将展示此预设的常见问题，方便用户点击操作。系统会直接将对应的详细问题发到聊天框，大模型将根据问题检索。请同时配置好 FAQ 问答库。
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const currentList = formData.faqList || [];
                                                    if (currentList.length >= 10) {
                                                        alert('最多只能添加 10 个常见问题');
                                                        return;
                                                    }
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        faqList: [...currentList, { question: '', answer: '', isFocus: false }]
                                                    }));
                                                }}
                                                className="text-sm px-3 py-1 bg-blue-50 text-brand-blue-600 rounded hover:bg-blue-100 transition"
                                            >
                                                + 添加问题
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {(formData.faqList || []).map((faq, index) => (
                                                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative group">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newList = [...(formData.faqList || [])];
                                                            newList.splice(index, 1);
                                                            setFormData(prev => ({ ...prev, faqList: newList }));
                                                        }}
                                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                                        title="删除"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>

                                                    <div className="flex gap-4 items-start">
                                                        <div className="w-1/3 min-w-[200px]">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <label className="block text-xs font-medium text-gray-500">问题简称</label>
                                                                <label className="flex items-center space-x-1 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={faq.isFocus}
                                                                        onChange={e => {
                                                                            const newList = [...(formData.faqList || [])];
                                                                            newList[index] = { ...newList[index], isFocus: e.target.checked };
                                                                            setFormData(prev => ({ ...prev, faqList: newList }));
                                                                        }}
                                                                        className="rounded text-brand-blue-600 focus:ring-brand-blue-500"
                                                                    />
                                                                    <span className="text-xs text-gray-600">重点关注</span>
                                                                </label>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={faq.question}
                                                                onChange={e => {
                                                                    const newList = [...(formData.faqList || [])];
                                                                    newList[index] = { ...newList[index], question: e.target.value };
                                                                    setFormData(prev => ({ ...prev, faqList: newList }));
                                                                }}
                                                                placeholder="例如：保什么"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">问题详细</label>
                                                            <textarea
                                                                rows={1}
                                                                value={faq.answer}
                                                                onChange={e => {
                                                                    const newList = [...(formData.faqList || [])];
                                                                    newList[index] = { ...newList[index], answer: e.target.value };
                                                                    setFormData(prev => ({ ...prev, faqList: newList }));
                                                                }}
                                                                placeholder="例如：给我讲下这款产品的保障范围和保障特色"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none resize-none"
                                                                style={{ minHeight: '38px' }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!formData.faqList || formData.faqList.length === 0) && (
                                                <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                                    暂无常见问题配置
                                                </div>
                                            )}
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
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">新增险种分类</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">新增层级</label>
                                <select
                                    value={newLevel}
                                    onChange={e => setNewLevel(Number(e.target.value) as 1 | 2 | 3)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none bg-white"
                                >
                                    <option value={1}>L1 - 一级分类</option>
                                    <option value={2}>L2 - 二级分类</option>
                                    <option value={3}>L3 - 三级分类</option>
                                </select>
                            </div>
                            {newLevel === 2 && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">所属一级分类</label>
                                    <select
                                        value={newParentKey}
                                        onChange={e => setNewParentKey(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none bg-white"
                                    >
                                        <option value="">请选择...</option>
                                        {treeData.map(node => (
                                            <option key={node.key} value={node.key}>{node.title} ({node.key})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {newLevel === 3 && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">所属二级分类</label>
                                    <select
                                        value={newParentKey}
                                        onChange={e => setNewParentKey(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none bg-white"
                                    >
                                        <option value="">请选择...</option>
                                        {treeData.flatMap(node => (node.children || []).map(child => (
                                            <option key={child.key} value={child.key}>{child.title} ({child.key})</option>
                                        )))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">分类编码</label>
                                <input
                                    type="text"
                                    value={newCode}
                                    onChange={e => setNewCode(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                    placeholder="例如：A04 或 A0401"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">分类名称</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                    placeholder="请输入分类名称"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                                取消
                            </button>
                            <button onClick={handleAddConfirm} className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors">
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InsuranceTypeManagementPage;
