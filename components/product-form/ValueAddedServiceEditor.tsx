import React from 'react';
import { type ValueAddedServiceItem } from '../../types';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';

interface ValueAddedServiceEditorProps {
  items: ValueAddedServiceItem[];
  onChange: (items: ValueAddedServiceItem[]) => void;
}

const ValueAddedServiceEditor: React.FC<ValueAddedServiceEditorProps> = ({ items, onChange }) => {
  const handleItemChange = (id: string, field: keyof Omit<ValueAddedServiceItem, 'id'>, value: string) => {
    const newItems = items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onChange(newItems);
  };

  const handleAddItem = () => {
    const newItem: ValueAddedServiceItem = {
      id: Date.now().toString(),
      name: '',
      description: '',
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium text-gray-800">附赠服务配置 <span className="text-red-500">*</span></h4>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="p-4 bg-gray-50 rounded-lg relative border border-gray-200">
            <div className="absolute top-2 right-2">
              <button
                type="button"
                onClick={() => handleRemoveItem(item.id)}
                className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition"
                aria-label="删除此服务"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 pr-8">
              <Input
                label={`服务名称 ${index + 1}`}
                id={`name-${item.id}`}
                value={item.name}
                onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                placeholder="例如：图文咨询服务"
                required
              />
              <Textarea
                label="服务详细描述"
                id={`description-${item.id}`}
                value={item.description}
                onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                placeholder="详细描述该项服务的内容、范围、使用方式等"
                rows={4}
                required
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full mt-2 px-4 py-2 border-2 border-dashed border-gray-300 text-sm font-medium rounded-lg text-gray-600 hover:text-brand-blue-600 hover:border-brand-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition"
      >
        + 添加附赠服务
      </button>
    </div>
  );
};

export default ValueAddedServiceEditor;
