import React, { useState, useCallback } from 'react';
import { Upload, X, FileImage, FileText, Loader2 } from 'lucide-react';

interface MaterialUploadProps {
  onUpload: (files: File[]) => void;
  onClassify?: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  showClassifyButton?: boolean;
}

export const MaterialUpload: React.FC<MaterialUploadProps> = ({
  onUpload,
  onClassify,
  multiple = true,
  accept = 'image/*,.pdf',
  maxFiles = 10,
  showClassifyButton = true,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  }, []);

  const handleFiles = (newFiles: File[]) => {
    if (files.length + newFiles.length > maxFiles) {
      alert(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    const validFiles = newFiles.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      return isImage || isPDF;
    });

    if (validFiles.length !== newFiles.length) {
      alert('只支持图片和PDF文件');
    }

    const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
    setFiles(updatedFiles);
    onUpload(updatedFiles);

    // Simulate upload progress
    validFiles.forEach(file => {
      simulateUploadProgress(file.name);
    });
  };

  const simulateUploadProgress = (fileName: string) => {
    setIsUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsUploading(false);
      }
      setUploadProgress(prev => ({ ...prev, [fileName]: progress }));
    }, 500);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onUpload(newFiles);
  };

  const handleClassify = () => {
    if (files.length > 0 && onClassify) {
      onClassify(files);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <FileImage className="w-8 h-8 text-blue-500" />;
    }
    return <FileText className="w-8 h-8 text-orange-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-4">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="space-y-2">
          <Upload className={`w-12 h-12 mx-auto ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-lg font-medium text-gray-700">
            {isDragging ? '松开以上传文件' : '拖拽文件到此处，或点击上传'}
          </p>
          <p className="text-sm text-gray-500">
            支持图片和PDF格式，最多 {maxFiles} 个文件
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">
              已选择 {files.length} 个文件
            </h4>
            {showClassifyButton && (
              <button
                onClick={handleClassify}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    上传中...
                  </>
                ) : (
                  '开始分类'
                )}
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50"
              >
                {getFileIcon(file)}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                  
                  {/* Progress Bar */}
                  {uploadProgress[file.name] !== undefined && uploadProgress[file.name] < 100 && (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[file.name]}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(uploadProgress[file.name])}%
                      </span>
                    </div>
                  )}
                  
                  {uploadProgress[file.name] === 100 && (
                    <span className="text-xs text-green-600">上传完成</span>
                  )}
                </div>

                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialUpload;