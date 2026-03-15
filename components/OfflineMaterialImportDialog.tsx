import React, { useState, useRef, useCallback, useEffect } from 'react';
import { type ProcessedFile, type CompletenessResult } from '../types';

interface OfflineMaterialImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  claimCaseId: string;
  productCode: string;
  suggestedMaterials?: string[];
  onImportComplete?: (result: { documents: ProcessedFile[]; completeness: CompletenessResult }) => void;
}

interface UploadingFile {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'processing' | 'classified' | 'failed';
  uploadProgress?: number;
  ossKey?: string;
  classification?: {
    materialId: string;
    materialName: string;
    confidence: number;
  };
  errorMessage?: string;
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska',
];

const OfflineMaterialImportDialog: React.FC<OfflineMaterialImportDialogProps> = ({
  isOpen,
  onClose,
  claimCaseId,
  productCode,
  suggestedMaterials = [],
  onImportComplete,
}) => {
  // State definitions - MUST be at the top
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | 'partial_success'>('pending');
  const [taskProgress, setTaskProgress] = useState({ total: 0, completed: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // handleClose defined AFTER all state hooks
  const handleClose = useCallback(() => {
    setFiles([]);
    setCompleteness(null);
    setError(null);
    setTaskId(null);
    setImporting(false);
    setTaskStatus('pending');
    setTaskProgress({ total: 0, completed: 0, failed: 0 });
    onClose();
  }, [onClose]);

  const handleCancel = useCallback(() => {
    setImporting(false);
    handleClose();
  }, [handleClose]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(f =>
      ACCEPTED_TYPES.includes(f.type) || f.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|pdf|doc|docx|xls|xlsx|mp4|mov|avi|mkv|webm)$/i)
    );

    if (validFiles.length === 0) {
      setError('不支持的文件格式，请上传图片、PDF、Word、Excel 或视频文件');
      return;
    }

    const uploadingFiles: UploadingFile[] = validFiles.map(f => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      status: 'pending' as const,
      uploadProgress: 0,
    }));

    setFiles(prev => [...prev, ...uploadingFiles]);
    setError(null);

    try {
      const uploadPromises = uploadingFiles.map(async (uf) => {
        setFiles(prev => prev.map(f =>
          f.id === uf.id ? { ...f, status: 'uploading' as const } : f
        ));

        try {
          const base64Data = await readFileAsBase64(uf.file);
          
          setFiles(prev => prev.map(f =>
            f.id === uf.id ? { ...f, uploadProgress: 50 } : f
          ));

          const response = await fetch('/api/upload-to-oss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: uf.file.name,
              fileType: uf.file.type,
              base64Data,
            }),
          });

          if (!response.ok) {
            throw new Error('上传失败');
          }

          const result = await response.json();
          
          setFiles(prev => prev.map(f =>
            f.id === uf.id ? { ...f, status: 'processing' as const, ossKey: result.ossKey, uploadProgress: 100 } : f
          ));
        } catch (err) {
          console.error('[OfflineImport] Upload error:', err);
          setFiles(prev => prev.map(f =>
            f.id === uf.id
              ? { ...f, status: 'failed' as const, errorMessage: err instanceof Error ? err.message : '上传失败' }
              : f
          ));
        }
      });

      await Promise.all(uploadPromises);

    } catch (err) {
      console.error('[OfflineImport] Batch upload error:', err);
      setError(err instanceof Error ? err.message : '批量上传失败，使用备用方式');
      
      for (const uf of uploadingFiles) {
        try {
          setFiles(prev => prev.map(f =>
            f.id === uf.id ? { ...f, status: 'uploading' as const } : f
          ));
          
          const base64Data = await readFileAsBase64(uf.file);
          
          setFiles(prev => prev.map(f =>
            f.id === uf.id ? { ...f, status: 'processing' as const } : f
          ));

          const response = await fetch('/api/materials/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileSource: base64Data,
              mimeType: uf.file.type,
            }),
          });

          if (!response.ok) {
            throw new Error(`分类失败: ${response.statusText}`);
          }

          const result = await response.json();
          const classification = result?.data || {
            materialId: 'unknown',
            materialName: '未识别',
            confidence: 0,
          };

          setFiles(prev => prev.map(f =>
            f.id === uf.id
              ? { ...f, status: 'classified' as const, classification }
              : f
          ));
        } catch (innerErr) {
          console.error('[OfflineImport] Fallback upload error:', innerErr);
          setFiles(prev => prev.map(f =>
            f.id === uf.id
              ? { ...f, status: 'failed' as const, errorMessage: '上传失败' }
              : f
          ));
        }
      }
    }
  }, [files]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const removed = prev.find(f => f.id === fileId);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleCheckCompleteness = async () => {
    const classifiedFiles = files.filter(f => f.status === 'classified');
    if (classifiedFiles.length === 0) return;

    try {
      const documents = classifiedFiles.map(f => ({
        fileName: f.file.name,
        documentType: f.classification?.materialName || '未识别',
        materialId: f.classification?.materialId || 'unknown',
      }));

      const response = await fetch('/api/analyze-multi-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimCaseId,
          productCode,
          documents,
          options: { skipOCR: true, skipAI: true },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setCompleteness({
          isComplete: result.completeness?.isComplete ?? false,
          score: result.completeness?.completenessScore ?? 0,
          requiredMaterials: result.completeness?.requiredMaterials ?? [],
          providedMaterials: result.completeness?.providedMaterials ?? [],
          missingMaterials: result.completeness?.missingMaterials ?? [],
          warnings: result.completeness?.warnings ?? [],
        });
      }
    } catch (err) {
      console.error('Completeness check failed:', err);
    }
  };

  const pollTaskStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/tasks/${id}`);
      if (!response.ok) {
        console.error('[OfflineImport] Failed to fetch task status:', response.status);
        return;
      }
      
      const result = await response.json();
      if (!result.success) {
        console.error('[OfflineImport] Task status query failed:', result.error);
        return;
      }

      const task = result.data;
      console.log('[OfflineImport] Task status:', task.status, 'Progress:', task.progress);
      
      setTaskStatus(task.status);
      setTaskProgress(task.progress || { total: 0, completed: 0, failed: 0 });

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'partial_success') {
        // 收集失败的文件错误信息
        const failedFiles = task.files?.filter((f: any) => f.status === 'failed') || [];
        if (failedFiles.length > 0) {
          const errorMessages = failedFiles.map((f: any) => `${f.fileName}: ${f.errorMessage || '未知错误'}`).join(', ');
          console.error('[OfflineImport] Failed files:', errorMessages);
        }
        
        onImportComplete?.({
          documents: task.files?.map((f: any) => ({
            documentId: `${id}-${f.index}`,
            fileName: f.fileName,
            fileType: f.mimeType,
            status: f.status,
            classification: f.result?.classification || { materialId: 'unknown', materialName: '未识别', confidence: 0 },
            extractedText: f.result?.extractedText || '',
            structuredData: f.result?.extractedData || {},
            errorMessage: f.errorMessage || f.result?.classification?.errorMessage || undefined,
          })) || [],
          completeness: {
            isComplete: true,
            score: task.progress?.completed / (task.progress?.total || 1) || 0,
            requiredMaterials: [],
            providedMaterials: [],
            missingMaterials: [],
            warnings: [],
          },
        });
        setImporting(false);
      }
    } catch (err) {
      console.error('[OfflineImport] Error polling task status:', err);
    }
  }, [onImportComplete]);

  useEffect(() => {
    if (!taskId) return;

    pollTaskStatus(taskId);
    const interval = setInterval(() => pollTaskStatus(taskId), 2000);
    return () => clearInterval(interval);
  }, [taskId, pollTaskStatus]);

  const handleImport = async () => {
    const uploadedFiles = files.filter(f => f.status === 'processing' && f.ossKey);
    console.log('[OfflineImport] Starting import with files:', uploadedFiles.length);
    
    if (uploadedFiles.length === 0) {
      console.warn('[OfflineImport] No files to import');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const filesData = uploadedFiles.map(f => ({
        fileName: f.file.name,
        mimeType: f.file.type,
        ossKey: f.ossKey!,
      }));

      console.log('[OfflineImport] Calling quick import API...');
      const response = await fetch('/api/offline-import/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimCaseId,
          productCode,
          files: filesData,
        }),
      });

      console.log('[OfflineImport] API response status:', response.status);
      const result = await response.json();
      console.log('[OfflineImport] API result:', result);

      if (!response.ok) {
        throw new Error(result.error || '导入失败');
      }

      if (result.success && result.taskId) {
        console.log('[OfflineImport] Import successful, taskId:', result.taskId);
        setTaskId(result.taskId);
        setTaskStatus('pending');
        setError(null);
        // 导入成功后立即重置 importing 状态，因为后台会异步处理
        setImporting(false);
      } else {
        throw new Error(result.error || '导入失败：未返回任务ID');
      }
    } catch (err) {
      console.error('[OfflineImport] Import error:', err);
      setImporting(false);
      setError(err instanceof Error ? err.message : '导入失败');
    }
  };

  if (!isOpen) return null;

  const uploadedCount = files.filter(f => f.status === 'processing' && f.ossKey).length;
  const failedCount = files.filter(f => f.status === 'failed').length;
  const processingCount = files.filter(f => f.status === 'processing' || f.status === 'uploading' || f.status === 'pending').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">离线材料导入</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {suggestedMaterials.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm font-medium text-amber-800">建议优先补充以下材料</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestedMaterials.map((material, index) => (
                  <span
                    key={`${material}-${index}`}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-800"
                  >
                    {material}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov,.avi,.mkv,.webm"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-gray-600 mb-2">拖拽文件到此处，或</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              点击选择文件
            </button>
            <p className="text-sm text-gray-400 mt-2">支持图片、PDF、Word、Excel 和视频格式</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium">已选择文件 ({files.length})</h4>
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-3 p-3 border rounded">
                  {file.preview ? (
                    <img src={file.preview} alt="" className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400">📄</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    <div className="text-xs text-gray-500">
                      {file.status === 'pending' && '等待上传...'}
                      {file.status === 'uploading' && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-20">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${file.uploadProgress || 0}%` }}
                            />
                          </div>
                          <span>{file.uploadProgress || 0}%</span>
                        </div>
                      )}
                      {file.status === 'processing' && <span className="text-green-600">已上传 ✓</span>}
                      {file.status === 'classified' && (
                        <span className={file.classification?.confidence! > 0.7 ? 'text-green-600' : 'text-yellow-600'}>
                          识别为: {file.classification?.materialName} ({Math.round((file.classification?.confidence || 0) * 100)}%)
                        </span>
                      )}
                      {file.status === 'failed' && <span className="text-red-600">{file.errorMessage || '处理失败'}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    disabled={importing}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Completeness Check */}
          {uploadedCount > 0 && !importing && (
            <div className="mt-4">
              <button
                onClick={handleCheckCompleteness}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                检查材料完整性
              </button>
              {completeness && (
                <div className={`mt-2 p-3 rounded ${completeness.isComplete ? 'bg-green-50' : 'bg-yellow-50'}`}>
                  <p className={completeness.isComplete ? 'text-green-700' : 'text-yellow-700'}>
                    完整性评分: {Math.round(completeness.score * 100)}%
                    {completeness.isComplete ? ' ✓' : ' ⚠'}
                  </p>
                  {completeness.missingMaterials.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      缺少: {completeness.missingMaterials.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Task Progress */}
          {taskId && (
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <p className="text-sm font-medium text-blue-900">导入进度</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${taskProgress.total > 0 ? (taskProgress.completed / taskProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-blue-700">
                  {taskProgress.completed}/{taskProgress.total}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {taskStatus === 'pending' && '等待处理...'}
                {taskStatus === 'processing' && '处理中...'}
                {taskStatus === 'completed' && '处理完成 ✓'}
                {taskStatus === 'failed' && '处理失败 ✗'}
                {taskStatus === 'partial_success' && '部分成功 ⚠'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <div className="text-sm text-gray-500">
            {uploadedCount > 0 && `${uploadedCount} 个文件已上传`}
            {failedCount > 0 && `, ${failedCount} 个失败`}
            {processingCount > 0 && `, ${processingCount} 个处理中`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
            >
              {importing ? '取消导入' : '关闭'}
            </button>
            <button
              onClick={handleImport}
              disabled={uploadedCount === 0 || importing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? '导入中...' : `导入 ${uploadedCount} 个文件`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineMaterialImportDialog;
