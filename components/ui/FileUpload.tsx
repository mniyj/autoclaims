import React from 'react';

interface FileUploadProps {
  label: string;
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  helpText?: string;
  accept?: string;
  required?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, id, value, onChange, helpText, accept, required }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = React.useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const { uploadToOSS } = await import('../../services/ossService');
        const url = await uploadToOSS(file);
        console.log('[DEBUG] Uploaded to OSS, URL:', url);
        alert('上传成功！URL: ' + url);
        onChange(url);
      } catch (error) {
        console.error('Upload to OSS failed:', error);
        alert('文件上传失败，请重试');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div
        onClick={handleClick}
        className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-brand-blue-400"
      >
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue-600 mb-2"></div>
              <p className="text-xs text-gray-500">正在上传到资源库...</p>
            </div>
          ) : value ? (
            <div className="w-full flex flex-col items-center">
              {(accept?.includes('image') || value.match(/\.(jpeg|jpg|gif|png|webp)$/i) || value.startsWith('http')) ? (
                <div className="relative w-full h-32 mb-2 group flex justify-center bg-gray-50 rounded-md overflow-hidden">
                  <img
                    src={value}
                    alt="Preview"
                    className="h-full w-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('bg-red-50');
                      const errDiv = document.createElement('div');
                      errDiv.className = 'absolute inset-0 flex items-center justify-center text-xs text-red-400 p-2 text-center';
                      errDiv.innerText = '图片加载失败';
                      e.currentTarget.parentElement?.appendChild(errDiv);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center w-full mb-2 px-2">
                  <svg className="h-8 w-8 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-brand-blue-600 truncate max-w-full text-xs" title={value}>{value}</span>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 shadow-sm transition-colors"
                >
                  更换
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs bg-red-50 border border-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-100 shadow-sm transition-colors"
                >
                  移除
                </button>
              </div>
              {/* Hidden input for "Change" action */}
              <input ref={fileInputRef} id={id} name={id} type="file" className="sr-only" onChange={handleFileChange} accept={accept} required={required} />
            </div>
          ) : (
            <div className="flex text-sm text-gray-600">
              <p className="relative bg-white rounded-md font-medium text-brand-blue-600 hover:text-brand-blue-500 focus-within:outline-none">
                <span>上传文件</span>
                <input ref={fileInputRef} id={id} name={id} type="file" className="sr-only" onChange={handleFileChange} accept={accept} required={required} />
              </p>
              <p className="pl-1">或拖拽到此处</p>
            </div>
          )}
          {helpText && !value && <p className="text-xs text-gray-500">{helpText}</p>}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
