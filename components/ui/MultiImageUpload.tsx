import React from 'react';

interface MultiImageUploadProps {
  label: string;
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  helpText?: string;
  accept?: string;
  required?: boolean;
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({ label, id, values = [], onChange, helpText, accept, required }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newUrls = Array.from(files).map((file: File) => URL.createObjectURL(file));
      onChange([...values, ...newUrls]);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const newValues = [...values];
    newValues.splice(index, 1);
    onChange(newValues);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="space-y-4">
        {/* Image List */}
        {values.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {values.map((url, index) => (
              <div key={index} className="relative group bg-gray-50 rounded-lg overflow-hidden border border-gray-200 h-32">
                <img 
                  src={url} 
                  alt={`Image ${index + 1}`} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('bg-red-50');
                      const errDiv = document.createElement('div');
                      errDiv.className = 'absolute inset-0 flex items-center justify-center text-xs text-red-400 p-2 text-center';
                      errDiv.innerText = '加载失败';
                      e.currentTarget.parentElement?.appendChild(errDiv);
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="移除"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5 text-center truncate">
                    {index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Area */}
        <div 
            onClick={handleClick}
            className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-brand-blue-400 transition-colors"
        >
            <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-gray-600 justify-center">
                    <p className="relative bg-white rounded-md font-medium text-brand-blue-600 hover:text-brand-blue-500 focus-within:outline-none">
                        <span>上传图片</span>
                        <input 
                            ref={fileInputRef} 
                            id={id} 
                            name={id} 
                            type="file" 
                            multiple
                            className="sr-only" 
                            onChange={handleFileChange} 
                            accept={accept} 
                            required={required && values.length === 0} 
                        />
                    </p>
                    <p className="pl-1">或拖拽到此处</p>
                </div>
                <p className="text-xs text-gray-500">支持批量上传，按上传顺序展示</p>
                {helpText && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}
            </div>
        </div>
      </div>
    </div>
  );
};

export default MultiImageUpload;
