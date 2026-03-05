import React, { useState, useRef, useCallback, useEffect } from 'react';
import { type ProcessedFile, type CompletenessResult } from '../types';

interface OfflineMaterialImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  claimCaseId: string;
  productCode: string;
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
];

const OfflineMaterialImportDialog: React.FC<OfflineMaterialImportDialogProps> = ({
  isOpen,
  onClose,
  claimCaseId,
  productCode,
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
    if (importing && taskStatus !== 'completed' && taskStatus !== 'failed' && taskStatus !== 'partial_success') return;
    setFiles([]);
    setCompleteness(null);
    setError(null);
    setTaskId(null);
    setTaskStatus('pending');
    setTaskProgress({ total: 0, completed: 0, failed: 0 });
    onClose();
  }, [importing, taskStatus, onClose]);

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
      ACCEPTED_TYPES.includes(f.type) || f.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|pdf)$/i)
    );

    if (validFiles.length === 0) {
      setError('不支持的文件格式，请上传图片或PDF文件');
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
      const fileList = uploadingFiles.map(uf => ({ name: uf.file.name, type: uf.file.type }));
      const credsResponse = await fetch('/api/batch-upload-oss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileList }),
      });

      if (!credsResponse.ok) {
        throw new Error('获取上传凭证失败');
      }

      const credsData = await credsResponse.json();
      const credentials = credsData.files;

      const uploadPromises = uploadingFiles.map(async (uf, index) => {
        const cred = credentials[index];
        if (!cred) {
          setFiles(prev => prev.map(f =>
            f.id === uf.id ? { ...f, status: 'failed' as const, errorMessage: '无上传凭证' } : f
          ));
          return;
        }

        setFiles(prev => prev.map(f =>
          f.id === uf.id ? { ...f, status: 'uploading' as const } : f
        ));

        try {
          const formData = new FormData();
          formData.append('key', cred.key);
          formData.append('policy', cred.policy);
          formData.append('OSSAccessKeyId', cred.accessid);
          formData.append('signature', cred.signature);
          formData.append('success_action_status', '200');
          formData.append('file', uf.file);

          const xhr = new XMLHttpRequest();
          await new Promise<void>((resolve, reject) => {
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                setFiles(prev => prev.map(f =>
                  f.id === uf.id ? { ...f, uploadProgress: progress } : f
                ));
              }
            });

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                console.error('[OfflineImport] Upload failed:', xhr.status, xhr.responseText);
                reject(new Error(`上传失败: ${xhr.status}`));
              }
            });

            xhr.addEventListener('error', () => {
              console.error('[OfflineImport] Upload error:', xhr.statusText);
              reject(new Error('上传错误'));
            });

            xhr.addEventListener('abort', () => {
              console.error('[OfflineImport] Upload aborted');
              reject(new Error('上传被取消'));
            });

            xhr.open('POST', cred.host);
            xhr.send(formData);
          });

          setFiles(prev => prev.map(f =>
            f.id === uf.id ? { ...f, status: 'processing' as const, ossKey: cred.key } : f
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

      const processedFiles: UploadingFile[] = [];
      uploadingFiles.forEach(uf => {
        const current = files.find(f => f.id === uf.id);
        if (current?.status === 'processing' && current?.ossKey) {
          processedFiles.push(current);
        }
      });

      if (processedFiles.length > 0) {
        await batchClassify(processedFiles);
      }
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

  const batchClassify = async (filesToClassify: UploadingFile[]) => {
    const ossKeys = filesToClassify.map(f => f.ossKey!).filter(Boolean);
    const mimeTypes = filesToClassify.map(f => f.file.type);

    try {
      const response = await fetch('/api/batch-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ossKeys, mimeTypes }),
      });

      if (!response.ok) {
        throw new Error('批量分类失败');
      }

      const result = await response.json();
      const classifications = result.data?.results || [];

      classifications.forEach((item: any, index: number) => {
        const fileId = filesToClassify[index]?.id;
        if (fileId) {
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? { ...f, status: 'classified' as const, classification: item.classification }
              : f
          ));
        }
      });
    } catch (err) {
      console.error('[OfflineImport] Batch classify error:', err);
      filesToClassify.forEach(uf => {
        setFiles(prev => prev.map(f =>
          f.id === uf.id ? { ...f, status: 'failed' as const, errorMessage: '分类失败' } : f
        ));
      });
    }
  };

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
      if (!response.ok) return;
      
      const result = await response.json();
      if (!result.success) return;

      const task = result.data;
      setTaskStatus(task.status);
      setTaskProgress(task.progress);

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'partial_success') {
        onImportComplete?.({
          documents: task.files?.map((f: any) => ({
            documentId: `${id}-${f.index}`,
            fileName: f.fileName,
            fileType: f.mimeType,
            status: f.status,
            classification: f.result?.classification || { materialId: 'unknown', materialName: '未识别', confidence: 0 },
            extractedText: f.result?.extractedText || '',
            structuredData: f.result?.extractedData || {},
          })) || [],
          completeness: {
            isComplete: true,
            score: task.progress.completed / (task.progress.total || 1),
            requiredMaterials: [],
            providedMaterials: [],
            missingMaterials: [],
            warnings: [],
          },
        });
        setImporting(false);
        setTimeout(() => handleClose(), 1500);
      }
    } catch {}
  }, [onImportComplete, handleClose]);

  useEffect(() => {
    if (!taskId) return;

    pollTaskStatus(taskId);
    const interval = setInterval(() => pollTaskStatus(taskId), 2000);
    return () => clearInterval(interval);
  }, [taskId, pollTaskStatus]);

  const handleImport = async () => {
    const classifiedFiles = files.filter(f => f.status === 'classified' && f.ossKey);
    if (classifiedFiles.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const ossKeys = classifiedFiles.map(f => f.ossKey!);
      const mimeTypes = classifiedFiles.map(f => f.file.type);
      const classifications = classifiedFiles.map(f => f.classification);

      const response = await fetch('/api/import-offline-materials-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimCaseId,
          productCode,
          ossKeys,
          mimeTypes,
          classifications,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '导入失败');
      }

      if (result.success && result.taskId) {
        setTaskId(result.taskId);
        setTaskStatus('pending');
      }
    } catch (err) {
      setImporting(false);
      setError(err instanceof Error ? err.message : '导入失败');
    }
  };

  if (!isOpen) return null;

  const classifiedCount = files.filter(f => f.status === 'classified').length;
  const failedCount = files.filter(f => f.status === 'failed').length;
  const processingCount = files.filter(f => f.status === 'processing' || f.status === 'uploading').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">离线材料导入</h3>
          <button
            onClick={handleClose}
            disabled={importing && taskStatus === 'processing'}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
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
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf"
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
            <p className="text-sm text-gray-400 mt-2">支持图片和PDF格式</p>
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
                      {file.status === 'processing' && '识别中...'}
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
          {classifiedCount > 0 && !importing && (
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
            {classifiedCount > 0 && `${classifiedCount} 个文件已识别`}
            {failedCount > 0 && `, ${failedCount} 个失败`}
            {processingCount > 0 && `, ${processingCount} 个处理中`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={importing && taskStatus === 'processing'}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={classifiedCount === 0 || importing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? '导入中...' : `导入 ${classifiedCount} 个文件`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineMaterialImportDialog;
