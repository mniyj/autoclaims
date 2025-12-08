import React from 'react';
import Input from '../ui/Input';

interface TagEditorProps {
  items: string[];
  tagStyles?: Record<string, 'gold' | 'green' | 'red' | 'gray'>;
  onChange: (items: string[]) => void;
  onStyleChange?: (styles: Record<string, 'gold' | 'green' | 'red' | 'gray'>) => void;
}

const TagEditor: React.FC<TagEditorProps> = ({ items, tagStyles = {}, onChange, onStyleChange }) => {
  const handleItemChange = (index: number, value: string) => {
    const oldTag = items[index];
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);

    // Preserve style for the new tag name if it was just a rename
    if (onStyleChange && oldTag && tagStyles[oldTag]) {
        const newStyles = { ...tagStyles };
        newStyles[value] = newStyles[oldTag];
        // Optional: delete old key if we want to clean up, but might be risky if duplicate names exist temporarily
        // delete newStyles[oldTag]; 
        onStyleChange(newStyles);
    }
  };

  const handleStyleChange = (tag: string, style: 'gold' | 'green' | 'red' | 'gray') => {
      if (onStyleChange) {
          onStyleChange({
              ...tagStyles,
              [tag]: style
          });
      }
  }

  const handleAddItem = () => {
    onChange([...items, '']);
  };

  const handleRemoveItem = (index: number) => {
    const tagToRemove = items[index];
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    
    if (onStyleChange && tagToRemove) {
        const newStyles = { ...tagStyles };
        delete newStyles[tagToRemove];
        onStyleChange(newStyles);
    }
  };

  return (
    <div className="space-y-4 rounded-md border border-gray-200 p-4">
      <h4 className="text-md font-medium text-gray-800">产品标签配置 <span className="text-red-500">*</span></h4>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="flex-grow grid grid-cols-3 gap-2">
               <div className="col-span-2">
                  <Input
                    label={`标签 ${index + 1}`}
                    id={`tag-${index}`}
                    value={item}
                    onChange={e => handleItemChange(index, e.target.value)}
                    placeholder="例如：安心赔"
                    required
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">样式</label>
                  <select
                    className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                    value={tagStyles[item] || 'gray'}
                    onChange={(e) => handleStyleChange(item, e.target.value as any)}
                  >
                      <option value="gray">灰标 (默认)</option>
                      <option value="gold">金标</option>
                      <option value="green">绿标</option>
                      <option value="red">红标</option>
                  </select>
               </div>
            </div>
            <div className="flex-shrink-0 pt-6">
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition"
                aria-label="删除此标签"
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
        + 添加标签
      </button>
    </div>
  );
};

export default TagEditor;
