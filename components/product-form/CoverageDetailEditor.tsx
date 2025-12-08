import React from 'react';
import { type CoverageItem } from '../../types';
import Input from '../ui/Input';

interface CoverageDetailEditorProps {
  items: CoverageItem[];
  onChange: (items: CoverageItem[]) => void;
}

const CoverageDetailEditor: React.FC<CoverageDetailEditorProps> = ({ items, onChange }) => {
  const handleItemChange = (id: string, field: keyof Omit<CoverageItem, 'id'>, value: string) => {
    const newItems = items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onChange(newItems);
  };

  const handleAddItem = () => {
    const newItem: CoverageItem = {
      id: Date.now().toString(),
      name: '',
      amount: '',
      details: '',
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    onChange(newItems);
  };

  return (
    <div className="space-y-4 rounded-md border border-gray-200 p-4">
      <h4 className="text-md font-medium text-gray-800">保障详情配置 <span className="text-red-500">*</span></h4>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-1 md:grid-cols-7 gap-3 p-3 bg-gray-50 rounded-lg relative">
            <div className="md:col-span-2">
              <Input
                label={`保障名称 ${index + 1}`}
                id={`name-${item.id}`}
                value={item.name}
                onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                placeholder="例如：意外身故"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="保障额度"
                id={`amount-${item.id}`}
                value={item.amount}
                onChange={e => handleItemChange(item.id, 'amount', e.target.value)}
                placeholder="例如：20万"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="保障详情"
                id={`details-${item.id}`}
                value={item.details}
                onChange={e => handleItemChange(item.id, 'details', e.target.value)}
                placeholder="可选的详细说明"
              />
            </div>
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => handleRemoveItem(item.id)}
                className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition"
                aria-label="删除此行"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full mt-2 px-4 py-2 border-2 border-dashed border-gray-300 text-sm font-medium rounded-lg text-gray-600 hover:text-brand-blue-600 hover:border-brand-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition"
      >
        + 添加保障项目
      </button>
    </div>
  );
};

export default CoverageDetailEditor;
