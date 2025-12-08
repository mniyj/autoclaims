
import React, { useState } from 'react';
import Modal from './ui/Modal';
import Pagination from './ui/Pagination';

interface User {
  id: number;
  username: string;     // 用户名称
  nickname: string;     // 用户昵称
  department: string;   // 部门
  phone: string;        // 手机号码
  status: boolean;      // 状态 (true: 正常, false: 停用)
  creationTime: string; // 创建时间
  companyCode?: string; // 关联保司编码
  tool?: '智能体' | '省心配'; // 关联工具
}

interface DepartmentNode {
    id: string;
    name: string;
    children?: DepartmentNode[];
    isOpen?: boolean;
}

// Mock user data - Only admin and test as requested
const mockUsers: User[] = [
  { 
    id: 1, 
    username: 'admin', 
    nickname: '管理员', 
    department: '研发部门', 
    phone: '15888888888', 
    status: true, 
    creationTime: '2025-05-26 10:07:46',
    tool: '智能体'
  },
  { 
    id: 2, 
    username: 'test', 
    nickname: '测试账号', 
    department: '测试部门', 
    phone: '15666666666', 
    status: true, 
    creationTime: '2025-05-26 10:07:47',
    companyCode: 'xintai',
    tool: '省心配'
  },
  {
    id: 3,
    username: 'gclife',
    nickname: '中意账号',
    department: '渠道部门',
    phone: '13500001234',
    status: true,
    creationTime: '2025-12-02 09:00:00',
    companyCode: 'gclife',
    tool: '智能体'
  },
];

const mockDepartments: DepartmentNode[] = [
    {
        id: '1',
        name: '测试科技',
        isOpen: true,
        children: [
            {
                id: '1-1',
                name: '杭州总公司',
                isOpen: true,
                children: [
                    { id: '1-1-1', name: '研发部门' },
                    { id: '1-1-2', name: '市场部门' },
                    { id: '1-1-3', name: '测试部门' },
                    { id: '1-1-4', name: '财务部门' },
                    { id: '1-1-5', name: '运维部门' },
                ]
            },
            {
                id: '1-2',
                name: '上海分公司',
                isOpen: false,
                children: [
                    { id: '1-2-1', name: '市场部门' },
                    { id: '1-2-2', name: '财务部门' },
                ]
            }
        ]
    }
];

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`${
      checked ? 'bg-brand-blue-500' : 'bg-gray-200'
    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
  >
    <span
      aria-hidden="true"
      className={`${
        checked ? 'translate-x-5' : 'translate-x-0'
      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
    />
  </button>
);

const DepartmentTree: React.FC<{ 
    nodes: DepartmentNode[]; 
    selectedId: string | null; 
    onSelect: (id: string) => void; 
    onToggle: (id: string) => void 
}> = ({ nodes, selectedId, onSelect, onToggle }) => {
    return (
        <ul className="pl-4 space-y-1">
            {nodes.map(node => (
                <li key={node.id}>
                    <div 
                        className={`flex items-center py-1.5 px-2 rounded cursor-pointer transition-colors ${selectedId === node.id ? 'bg-blue-50 text-brand-blue-600 border-r-2 border-brand-blue-600' : 'hover:bg-gray-100 text-gray-700'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(node.id);
                        }}
                    >
                        {node.children && node.children.length > 0 ? (
                            <span 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle(node.id);
                                }}
                                className="mr-1 p-0.5 hover:bg-gray-200 rounded"
                            >
                                <svg className={`w-3 h-3 text-gray-400 transition-transform ${node.isOpen ? 'transform rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                            </span>
                        ) : (
                            <span className="w-4 mr-1"></span>
                        )}
                        <span className="text-sm select-none">{node.name}</span>
                    </div>
                    {node.children && node.isOpen && (
                        <DepartmentTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} />
                    )}
                </li>
            ))}
        </ul>
    );
};

interface SystemSettingsPageProps {
    currentUser?: { username: string; companyCode?: string } | null;
}

const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<User[]>(mockUsers);
    const [departments, setDepartments] = useState<DepartmentNode[]>(mockDepartments);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [permissionMsg, setPermissionMsg] = useState('抱歉，您没有新增账号权限，请联系管理员。');
    
    // Search Filters
    const [searchName, setSearchName] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [searchStatus, setSearchStatus] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Selection
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Dropdown State
    const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

    const handleToggleStatus = (id: number) => {
        setUsers(users.map(user => 
            user.id === id 
            ? { ...user, status: !user.status }
            : user
        ));
    };

    const visibleUsers = currentUser?.username === 'admin' ? users : users.filter(u => u.username === currentUser?.username);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(visibleUsers.map(u => u.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSearch = () => {
       // Implement search logic here
       console.log('Search triggered', { searchName, searchPhone, searchStatus, dateRange, selectedDepartmentId });
    };

    const handleReset = () => {
        setSearchName('');
        setSearchPhone('');
        setSearchStatus('');
        setDateRange({ start: '', end: '' });
    };

    const handleRestrictedAction = () => {
        setPermissionMsg('您暂无权限，请联系管理员');
        setIsPermissionModalOpen(true);
        setActiveDropdownId(null);
    };

    const handleToggleDepartment = (id: string) => {
        const toggleNode = (nodes: DepartmentNode[]): DepartmentNode[] => {
            return nodes.map(node => {
                if (node.id === id) {
                    return { ...node, isOpen: !node.isOpen };
                }
                if (node.children) {
                    return { ...node, children: toggleNode(node.children) };
                }
                return node;
            });
        };
        setDepartments(toggleNode(departments));
    };

    return (
        <div className="flex flex-row items-start gap-4 h-[calc(100vh-100px)]">
            {/* Left Sidebar: Department Tree */}
            <div className="w-64 bg-white rounded-sm shadow-sm flex-shrink-0 h-full overflow-y-auto border border-gray-100">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">组织架构</h3>
                </div>
                <div className="p-2">
                    <div className="mb-3 px-2">
                        <input 
                            type="text" 
                            placeholder="请输入部门名称" 
                            className="w-full h-8 px-3 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="-ml-2">
                        <DepartmentTree 
                            nodes={departments} 
                            selectedId={selectedDepartmentId} 
                            onSelect={setSelectedDepartmentId} 
                            onToggle={handleToggleDepartment} 
                        />
                    </div>
                </div>
            </div>

            {/* Right Content */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-4 h-full overflow-hidden">
                {/* Filter Section */}
                <div className="bg-white p-5 rounded-sm shadow-sm flex-shrink-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 items-center">
                        <div className="flex items-center">
                            <label htmlFor="username" className="w-20 text-sm font-medium text-gray-700">用户名称</label>
                            <input
                                type="text"
                                id="username"
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                placeholder="请输入用户名称"
                                className="flex-1 h-8 px-3 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center">
                            <label htmlFor="phone" className="w-20 text-sm font-medium text-gray-700">手机号码</label>
                            <input
                                type="text"
                                id="phone"
                                value={searchPhone}
                                onChange={(e) => setSearchPhone(e.target.value)}
                                placeholder="请输入手机号码"
                                className="flex-1 h-8 px-3 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                            />
                        </div>
                         <div className="flex items-center">
                            <label htmlFor="status" className="w-20 text-sm font-medium text-gray-700">状态</label>
                            <select
                                id="status"
                                value={searchStatus}
                                onChange={(e) => setSearchStatus(e.target.value)}
                                className="flex-1 h-8 px-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none bg-white"
                            >
                                <option value="">用户状态</option>
                                <option value="normal">正常</option>
                                <option value="inactive">停用</option>
                            </select>
                        </div>
                         <div className="flex items-center md:col-span-2 lg:col-span-2">
                            <label className="w-20 text-sm font-medium text-gray-700">创建时间</label>
                            <div className="flex-1 flex items-center gap-2">
                                 <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                />
                                <span className="text-gray-400">-</span>
                                 <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="w-full h-8 px-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        
                        {/* Buttons Row */}
                        <div className="flex justify-start gap-3">
                             <button onClick={handleSearch} className="px-5 py-1.5 bg-brand-blue-500 text-white text-sm font-medium rounded hover:bg-brand-blue-600 transition flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                                搜索
                             </button>
                             <button onClick={handleReset} className="px-5 py-1.5 bg-white text-gray-600 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                重置
                             </button>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-sm shadow-sm flex-1 flex flex-col min-h-0">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                         <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    setPermissionMsg('抱歉，您没有新增账号权限，请联系管理员。');
                                    setIsPermissionModalOpen(true);
                                }}
                                className="px-4 py-1.5 bg-blue-50 text-brand-blue-600 border border-blue-200 text-sm rounded hover:bg-blue-100 transition flex items-center"
                            >
                                <span className="mr-1 text-lg leading-none">+</span> 新增
                            </button>
                            <button 
                                onClick={() => {
                                    setPermissionMsg('抱歉，您暂时没有权限');
                                    setIsPermissionModalOpen(true);
                                }}
                                className="px-4 py-1.5 bg-white text-gray-600 border border-gray-300 text-sm rounded hover:bg-gray-50 transition flex items-center"
                            >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                导入
                            </button>
                            <button 
                                onClick={() => {
                                    setPermissionMsg('抱歉，您暂时没有权限');
                                    setIsPermissionModalOpen(true);
                                }}
                                className="px-4 py-1.5 bg-white text-orange-600 border border-orange-200 text-sm rounded hover:bg-orange-50 transition flex items-center"
                            >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                导出
                            </button>
                         </div>
                         <div className="flex gap-2 text-gray-500">
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                             <button className="p-1 hover:bg-gray-100 rounded">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </button>
                         </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 relative">
                            <thead className="bg-[#f8f9fb] sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left bg-[#f8f9fb]">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-brand-blue-600 shadow-sm focus:ring-brand-blue-500 h-4 w-4"
                                            checked={visibleUsers.length > 0 && selectedIds.length === visibleUsers.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">用户编号</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">用户名称</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">用户昵称</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">关联保司</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">关联工具</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">部门</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">手机号码</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">状态</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">创建时间</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider bg-[#f8f9fb]">操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {visibleUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-brand-blue-600 shadow-sm focus:ring-brand-blue-500 h-4 w-4"
                                                checked={selectedIds.includes(user.id)}
                                                onChange={() => handleSelectRow(user.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.nickname}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {(() => {
                                                const company = user.companyCode ? MOCK_COMPANY_LIST.find(c => c.code === user.companyCode) : undefined;
                                                return company ? company.shortName : '-';
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.tool || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.department}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{user.phone}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <ToggleSwitch checked={user.status} onChange={() => handleToggleStatus(user.id)} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.creationTime}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium relative">
                                            <div className="relative inline-block text-left">
                                                <button 
                                                    type="button"
                                                    onClick={() => setActiveDropdownId(activeDropdownId === user.id ? null : user.id)}
                                                    className="text-brand-blue-600 hover:text-brand-blue-800 inline-flex items-center focus:outline-none"
                                                >
                                                    <span className="mr-0.5">»</span> 更多
                                                </button>
                                                {activeDropdownId === user.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setActiveDropdownId(null)}></div>
                                                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20 py-1 border border-gray-100">
                                                            <button
                                                                onClick={handleRestrictedAction}
                                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-blue-600"
                                                            >
                                                                重置密码
                                                            </button>
                                                            <button
                                                                onClick={handleRestrictedAction}
                                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-blue-600"
                                                            >
                                                                分配角色
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-200 flex-shrink-0">
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                                共 {visibleUsers.length} 条
                            </div>
                            <div className="flex items-center space-x-2">
                                 <select className="h-8 border border-gray-300 rounded text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-blue-500">
                                    <option>10条/页</option>
                                    <option>20条/页</option>
                                </select>
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={Math.ceil(visibleUsers.length / ITEMS_PER_PAGE)}
                                    onPageChange={setCurrentPage}
                                    totalItems={visibleUsers.length}
                                    itemsPerPage={ITEMS_PER_PAGE}
                                />
                                 <div className="flex items-center text-sm text-gray-600 ml-2">
                                    前往
                                    <input type="text" className="w-10 h-8 mx-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-brand-blue-500" defaultValue="1" />
                                    页
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isPermissionModalOpen}
                onClose={() => setIsPermissionModalOpen(false)}
                title="权限不足"
            >
                <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="mt-2 text-lg font-medium text-gray-900">操作受限</h3>
                    <div className="mt-2 text-sm text-gray-500">
                        <p>{permissionMsg}</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SystemSettingsPage;
import { MOCK_COMPANY_LIST } from '../constants';
