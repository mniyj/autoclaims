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
  status: 'uploading' | 'processing' | 'classified' | 'failed';
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

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.doc,.docx,.xls,.xlsx';

const OfflineMaterialImportDialog: React.FC<OfflineMaterialImportDialogProps> = ({
  isOpen,
  onClose,
  claimCaseId,
  productCode,
  onImportComplete,
}) => {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (importing && taskStatus !== 'completed' && taskStatus !== 'failed' && taskStatus !== 'partial_success') return;
    setFiles([]);
    setCompleteness(null);
    setError(null);
    setTaskId(null);
    setTaskStatus('pending');
    setTaskProgress({ total: 0, completed: 0, failed: 0 });
    onClose();
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g. "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(f =>
      ACCEPTED_TYPES.includes(f.type) || f.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|pdf|doc|docx|xls|xlsx)$/i)
    );

    if (validFiles.length === 0) {
      setError('不支持的文件格式，请上传图片、PDF、Word或Excel文件');
      return;
    }

    const uploadingFiles: UploadingFile[] = validFiles.map(f => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      status: 'uploading' as const,
    }));

    setFiles(prev => [...prev, ...uploadingFiles]);
    setError(null);

    // Process each file
    for (const uf of uploadingFiles) {
      try {
        const base64Data = await readFileAsBase64(uf.file);

        setFiles(prev => prev.map(f =>
          f.id === uf.id ? { ...f, status: 'processing' as const } : f
        ));

        const response = await fetch('/api/process-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: uf.file.name,
            mimeType: uf.file.type,
            base64Data,
            options: { extractText: true, classify: true },
          }),
        });

        if (!response.ok) {
          throw new Error(`处理失败: ${response.statusText}`);
        }

        const result = await response.json();

        setFiles(prev => prev.map(f =>
          f.id === uf.id
            ? {
                ...f,
                status: 'classified' as const,
                classification: result.classification || {
                  materialId: result.documentType?.id || 'unknown',
                  materialName: result.documentType?.name || '未识别',
                  confidence: result.documentType?.confidence || 0,
                },
              }
            : f
        ));
      } catch (err) {
        setFiles(prev => prev.map(f =>
          f.id === uf.id
            ? { ...f, status: 'failed' as const, errorMessage: err instanceof Error ? err.message : '处理失败' }
            : f
        ));
      }
    }
  }, []);

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

  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | 'partial_success'>('pending');
  const [taskProgress, setTaskProgress] = useState({ total: 0, completed: 0, failed: 0 });

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
            structuredData: f.result?.structuredData || {},
          })) || [],
          completeness: {
            isComplete: task.status === 'completed',
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
  }, [onImportComplete]);

  useEffect(() => {
    if (!taskId) return;

    pollTaskStatus(taskId);
    const interval = setInterval(() => pollTaskStatus(taskId), 2000);
    return () => clearInterval(interval);
  }, [taskId, pollTaskStatus]);

  const handleImport = async () => {
    const classifiedFiles = files.filter(f => f.status === 'classified');
    if (classifiedFiles.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const fileDataPromises = classifiedFiles.map(async f => ({
        fileName: f.file.name,
        mimeType: f.file.type,
        base64Data: await readFileAsBase64(f.file),
      }));
      const fileData = await Promise.all(fileDataPromises);

      const response = await fetch('/api/import-offline-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimCaseId,
          productCode,
          files: fileData,
        }),
      });

      if (!response.ok) {
        throw new Error(`导入失败: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.taskId) {
        setTaskId(result.taskId);
        setTaskProgress({ total: result.totalFiles || 0, completed: 0, failed: 0 });
        setTaskStatus('pending');
      } else {
        throw new Error('创建任务失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败，请重试');
      setImporting(false);
    }
  };

  // Determine stats
  const classifiedCount = files.filter(f => f.status === 'classified').length;
  const processingCount = files.filter(f => f.status === 'uploading' || f.status === 'processing').length;
  const failedCount = files.filter(f => f.status === 'failed').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900">离线材料导入</h3>
            <p className="text-sm text-gray-500 mt-0.5">上传理赔材料，系统将自动分类并检查完整性</p>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
            }`}
          >
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-700">拖拽文件到此处，或点击选择文件</p>
            <p className="text-xs text-gray-500 mt-1">支持图片、PDF、Word、Excel格式</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-900">
                  已上传文件 ({files.length})
                </h4>
                {processingCount > 0 && (
                  <span className="text-xs text-indigo-600 flex items-center">
                    <div className="w-3 h-3 mr-1.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    {processingCount} 个文件处理中...
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {files.map(f => (
                  <div
                    key={f.id}
                    className={`relative border rounded-lg p-3 ${
                      f.status === 'classified' ? 'border-green-200 bg-green-50/30' :
                      f.status === 'failed' ? 'border-red-200 bg-red-50/30' :
                      'border-gray-200 bg-gray-50/30'
                    }`}
                  >
                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-500 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* File preview or icon */}
                    <div className="mb-2">
                      {f.preview ? (
                        <img src={f.preview} alt={f.file.name} className="w-full h-16 object-cover rounded" />
                      ) : (
                        <div className="w-full h-16 bg-gray-100 rounded flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* File name */}
                    <p className="text-xs font-medium text-gray-700 truncate" title={f.file.name}>
                      {f.file.name}
                    </p>

                    {/* Status */}
                    <div className="mt-1.5">
                      {(f.status === 'uploading' || f.status === 'processing') && (
                        <div className="flex items-center text-xs text-indigo-600">
                          <div className="w-3 h-3 mr-1 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          {f.status === 'uploading' ? '上传中...' : 'OCR识别中...'}
                        </div>
                      )}
                      {f.status === 'classified' && f.classification && (
                        <div className="flex items-center text-xs text-green-700">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f.classification.materialName}
                          {f.classification.confidence > 0 && (
                            <span className="ml-1 text-gray-400">
                              ({Math.round(f.classification.confidence * 100)}%)
                            </span>
                          )}
                        </div>
                      )}
                      {f.status === 'failed' && (
                        <div className="flex items-center text-xs text-red-600">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {f.errorMessage || '处理失败'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completeness Check */}
          {completeness && (
            <div className={`border rounded-lg p-4 ${
              completeness.isComplete ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center">
                  {completeness.isComplete ? (
                    <svg className="w-5 h-5 mr-1.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-1.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  材料完整性检查
                </h4>
                <span className={`text-sm font-bold ${completeness.score >= 80 ? 'text-green-600' : completeness.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {completeness.score}分
                </span>
              </div>

              <div className="space-y-1.5">
                {completeness.providedMaterials.map((m, i) => (
                  <div key={`p-${i}`} className="flex items-center text-xs">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{m}</span>
                  </div>
                ))}
                {completeness.missingMaterials.map((m, i) => (
                  <div key={`m-${i}`} className="flex items-center text-xs">
                    <svg className="w-4 h-4 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-red-600">缺少: {m}</span>
                  </div>
                ))}
              </div>

              {completeness.warnings.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                  {completeness.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {files.length > 0 && (
              <span>
                {classifiedCount} 已分类
                {failedCount > 0 && <span className="text-red-500 ml-2">{failedCount} 失败</span>}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {classifiedCount > 0 && !completeness && (
              <button
                onClick={handleCheckCompleteness}
                disabled={processingCount > 0}
                className="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                检查完整性
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={importing}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            {taskId ? (
              <div className="flex items-center space-x-3">
                <div className="text-sm">
                  {taskStatus === 'pending' && (
                    <span className="text-amber-600">等待处理...</span>
                  )}
                  {taskStatus === 'processing' && (
                    <span className="text-blue-600">
                      处理中 {taskProgress.completed}/{taskProgress.total}
                    </span>
                  )}
                  {taskStatus === 'completed' && (
                    <span className="text-green-600">✓ 处理完成</span>
                  )}
                  {taskStatus === 'partial_success' && (
                    <span className="text-amber-600">
                      部分完成 ({taskProgress.completed}/{taskProgress.total})
                    </span>
                  )}
                  {taskStatus === 'failed' && (
                    <span className="text-red-600">✗ 处理失败</span>
                  )}
                </div>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      taskStatus === 'completed' ? 'bg-green-500' :
                      taskStatus === 'failed' ? 'bg-red-500' :
                      taskStatus === 'partial_success' ? 'bg-amber-500' :
                      'bg-blue-500'
                    }`}
                    style={{ 
                      width: `${taskProgress.total > 0 ? (taskProgress.completed / taskProgress.total) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleImport}
                disabled={classifiedCount === 0 || processingCount > 0 || importing}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-md text-sm font-medium hover:from-indigo-700 hover:to-purple-700 shadow-sm transition-colors disabled:opacity-50 flex items-center"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    创建任务...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    确认导入 ({classifiedCount})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineMaterialImportDialog;
