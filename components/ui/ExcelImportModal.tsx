
import React, { useState, useCallback } from 'react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const UploadIcon = () => (
    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);


const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleRemoveFile = () => {
    setFile(null);
  }

  const handleImport = () => {
    if(file) {
        alert(`开始导入文件: ${file.name}`);
        // Here you would typically handle the file upload logic
        onClose();
    } else {
        alert('请先选择一个文件。');
    }
  };


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">EXCEL 导入</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 text-gray-700 space-y-6">
            <div>
                <h3 className="text-md font-semibold text-gray-800 mb-2">下载导入模板</h3>
                <p className="text-sm text-gray-500 mb-3">请按照模板格式准备您的数据，以确保顺利导入。点击下方按钮下载模板文件。</p>
                <button className="px-4 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 transition flex items-center">
                    <DownloadIcon />
                    下载模板
                </button>
            </div>
            <div className="border-t border-gray-200"></div>
            <div>
                <h3 className="text-md font-semibold text-gray-800 mb-3">上传文件</h3>
                 <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={`mt-1 flex flex-col items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md transition-colors ${isDragging ? 'border-brand-blue-400 bg-brand-blue-50' : ''}`}
                >
                {file ? (
                    <div className="text-center">
                         <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                        <button onClick={handleRemoveFile} className="mt-3 text-sm font-medium text-red-600 hover:text-red-800">
                            移除文件
                        </button>
                    </div>
                ) : (
                    <div className="space-y-1 text-center">
                        <UploadIcon />
                        <div className="flex text-sm text-gray-600">
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-blue-600 hover:text-brand-blue-500 focus-within:outline-none">
                                <span>点击上传</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xls,.xlsx" />
                            </label>
                            <p className="pl-1">或将文件拖到此处</p>
                        </div>
                        <p className="text-xs text-gray-500">支持 XLS, XLSX 格式</p>
                    </div>
                )}
                 </div>
            </div>
        </div>
        <div className="flex justify-end p-4 space-x-3 bg-gray-50 rounded-b-lg">
           <button
            onClick={onClose}
            className="px-5 py-2 bg-white text-gray-800 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!file}
            className="px-5 py-2 bg-brand-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
