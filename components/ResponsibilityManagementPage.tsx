import React, { useMemo, useState } from 'react';
import { type ResponsibilityItem } from '../types';
import { MOCK_RESPONSIBILITIES, LEVEL_1_DATA } from '../constants';

const ResponsibilityManagementPage: React.FC<{ responsibilities?: ResponsibilityItem[]; onSave?: (list: ResponsibilityItem[]) => void; }> = ({ responsibilities, onSave }) => {
  const [query, setQuery] = useState('');
  const [list, setList] = useState<ResponsibilityItem[]>(() => responsibilities && responsibilities.length > 0 ? responsibilities : MOCK_RESPONSIBILITIES);
  const [detailItem, setDetailItem] = useState<ResponsibilityItem | null>(null);
  const [editItem, setEditItem] = useState<ResponsibilityItem | null>(null);
  const l1Names = useMemo(() => LEVEL_1_DATA.map(l => l.name), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(i => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [query, list]);

  const closeDetail = () => setDetailItem(null);
  const closeEdit = () => setEditItem(null);

  const handleEditSave = () => {
    if (!editItem) return;
    if (!editItem.code || !editItem.name || !editItem.category) return;
    setList(prev => {
      const exists = prev.findIndex(i => i.id === editItem.id);
      const next = exists >= 0 ? prev.map(i => i.id === editItem.id ? editItem : i) : [{ ...editItem, id: `resp-${Date.now()}` }, ...prev];
      onSave && onSave(next);
      return next;
    });
    setEditItem(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定删除该数据吗')) return;
    setList(prev => {
      const next = prev.filter(i => i.id !== id);
      onSave && onSave(next);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">责任管理</h1>
      <div className="bg-white p-6 rounded-md shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 w-full max-w-md">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="责任代码、责任名称模糊搜索" className="flex-1 h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm" />
            <button onClick={() => setQuery(query)} className="h-9 px-4 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm">搜索</button>
          </div>
          <button onClick={() => setEditItem({ id: '', code: '', name: '', category: '', description: '' })} className="h-9 px-4 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm">添加责任</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">序号</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">责任代码</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">责任名称</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">责任分类</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">责任描述</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filtered.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm text-gray-700">{idx + 1}</td>
                  <td className="px-6 py-3 text-sm text-gray-800 font-mono">{item.code}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{item.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{item.category}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 truncate max-w-xs" title={item.description}>{item.description}</td>
                  <td className="px-6 py-3 text-center text-sm font-medium space-x-3">
                    <button onClick={() => setDetailItem(item)} className="text-blue-500 hover:text-blue-700">详情</button>
                    <button onClick={() => setEditItem(item)} className="text-blue-500 hover:text-blue-700">编辑</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailItem && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4">责任详情</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div>责任代码：<span className="font-mono text-gray-900">{detailItem.code}</span></div>
              <div>责任名称：{detailItem.name}</div>
              <div>责任分类：{detailItem.category}</div>
              <div>责任描述：{detailItem.description}</div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={closeDetail} className="px-4 py-2 border border-gray-300 rounded-md text-sm">关闭</button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-xl rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{editItem.id ? '编辑责任' : '新增责任'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">责任代码 <span className="text-red-500">*</span></label>
                <input value={editItem.code} onChange={e => setEditItem({ ...editItem, code: e.target.value })} disabled={!!editItem.id} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">责任名称 <span className="text-red-500">*</span></label>
                <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">责任分类 <span className="text-red-500">*</span></label>
                <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                  <option value="">-- 请选择一级分类 --</option>
                  {l1Names.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">责任描述</label>
                <textarea value={editItem.description} onChange={e => setEditItem({ ...editItem, description: e.target.value })} className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={closeEdit} className="px-4 py-2 border border-gray-300 rounded-md text-sm">取消</button>
              <button onClick={handleEditSave} disabled={!editItem.code || !editItem.name || !editItem.category} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:bg-blue-300 disabled:cursor-not-allowed">确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsibilityManagementPage;
