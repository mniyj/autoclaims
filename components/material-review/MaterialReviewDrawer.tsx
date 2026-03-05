import React, { useState, useEffect } from 'react';
import { MaterialViewItem } from '../../types/material-review';
import Modal from '../ui/Modal';
import { ClaimCase, ClaimsMaterial } from '../../types';
import { getSignedUrl } from '../../services/ossService';

// 递归显示结构化数据组件
interface StructuredDataViewerProps {
  data: any;
  level?: number;
}

const StructuredDataViewer: React.FC<StructuredDataViewerProps> = ({ data, level = 0 }) => {
  if (data === null || data === undefined) return null;

  // 处理数组
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">空数组</span>;
    return (
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="pl-3 border-l-2 border-gray-200">
            <span className="text-xs text-gray-400">[{index}]</span>
            <div className="mt-1">
              <StructuredDataViewer data={item} level={level + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 处理对象
  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="text-gray-400">空对象</span>;
    
    return (
      <div className={`space-y-2 ${level > 0 ? 'pl-3 border-l-2 border-gray-200' : ''}`}>
        {entries.map(([key, value]) => {
          if (value === undefined || value === null) return null;
          
          // 如果值是基本类型，直接显示
          if (typeof value !== 'object') {
            return (
              <div key={key} className="flex justify-between items-start py-1">
                <span className="text-sm text-gray-500 capitalize shrink-0">{key}：</span>
                <span className="text-sm font-medium text-gray-900 text-right break-all ml-2">
                  {String(value)}
                </span>
              </div>
            );
          }
          
          // 如果值是对象或数组，递归显示
          return (
            <div key={key} className="py-1">
              <span className="text-sm text-gray-500 capitalize">{key}：</span>
              <div className="mt-1">
                <StructuredDataViewer data={value} level={level + 1} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 处理基本类型
  return <span className="text-sm font-medium text-gray-900">{String(data)}</span>;
};

interface MaterialReviewDrawerProps {
  isOpen: boolean;
  material: MaterialViewItem | null;
  claimCase: ClaimCase | null;
  onClose: () => void;
  onSaveCorrections?: (corrections: any[]) => Promise<void>;
  onApproveAll?: (fieldKeys: string[]) => Promise<void>;
  onClassificationChange?: (materialId: string, newClassification: { materialId: string; materialName: string }) => Promise<void>;
}

const MaterialReviewDrawer: React.FC<MaterialReviewDrawerProps> = ({
  isOpen,
  material,
  claimCase,
  onClose,
  onSaveCorrections,
  onApproveAll,
  onClassificationChange,
}) => {
  const [availableMaterials, setAvailableMaterials] = useState<ClaimsMaterial[]>([]);
  const [isEditingClassification, setIsEditingClassification] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/claims-materials')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAvailableMaterials(data);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (material?.classification?.materialId) {
      setSelectedMaterialId(material.classification.materialId);
    }
  }, [material]);

  // 获取实时签名 URL
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!isOpen || !material) {
        setImageUrl('');
        setImageError('');
        return;
      }

      setIsLoadingImage(true);
      setImageError('');
      const timeoutId = setTimeout(() => {
        console.warn('[MaterialReviewDrawer] Fetch signed URL timeout');
        setImageError('获取签名URL超时');
        setImageUrl(material.ossUrl || '');
        setIsLoadingImage(false);
      }, 10000);

      try {
        if (material.ossKey) {
          const signedUrl = await getSignedUrl(material.ossKey, 3600);
          clearTimeout(timeoutId);
          setImageUrl(signedUrl);
        } else if (material.ossUrl) {
          clearTimeout(timeoutId);
          setImageUrl(material.ossUrl);
        } else {
          clearTimeout(timeoutId);
          setImageError('没有可用的图片链接');
          setImageUrl('');
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('[MaterialReviewDrawer] Failed to get signed URL:', error);
        setImageError('获取签名URL失败');
        setImageUrl(material.ossUrl || '');
      } finally {
        setIsLoadingImage(false);
      }
    };

    fetchSignedUrl();

    return () => {
      setImageUrl('');
      setImageError('');
    };
  }, [isOpen, material?.documentId]);

  if (!material || !claimCase) return null;

  const hasDocumentSummary = !!material.documentSummary;
  const confidence = material.documentSummary?.confidence || 0;

  const handleClassificationChange = async () => {
    if (!selectedMaterialId || !onClassificationChange) return;
    
    const selectedMaterial = availableMaterials.find(m => m.id === selectedMaterialId);
    if (!selectedMaterial) return;

    await onClassificationChange(material.documentId, {
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.name,
    });
    
    setIsEditingClassification(false);
  };

  const handleParse = async () => {
    if (!material.classification?.materialId || material.classification.materialId === 'unknown') {
      alert('请先选择材料类型');
      return;
    }

    setIsParsing(true);
    try {
      const response = await fetch(`/api/materials/${material.classification.materialId}/schema`);
      const schemaData = await response.json();
      
      if (!schemaData.success) {
        throw new Error('获取 Schema 失败');
      }

      // TODO: 调用 AI 解析 API
      console.log('Schema:', schemaData.data);
      setParseResult({ schema: schemaData.data, status: 'ready' });
    } catch (error) {
      console.error('解析失败:', error);
      alert('解析失败: ' + (error as Error).message);
    } finally {
      setIsParsing(false);
    }
  };

  const getClassificationSourceLabel = () => {
    if (!material.classification) return null;
    if (material.classification.materialId === 'unknown') return null;
    return material.classification.source === 'manual' ? ' (手动)' : ' (AI)';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${material.fileName} - 详细审核`}
      width="max-w-6xl"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      }
    >
      <div className="flex h-[60vh]">
        <div className="w-1/2 border-r border-gray-200 p-4">
          <div className="h-full bg-gray-100 rounded-lg flex items-center justify-center">
            {isLoadingImage ? (
              <div className="text-gray-400 text-center">
                <svg className="w-16 h-16 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p>加载中...</p>
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={material.fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => {
                  console.error('[MaterialReviewDrawer] Image load error:', e);
                  setImageError('图片加载失败，链接可能已过期');
                }}
              />
            ) : imageError ? (
              <div className="text-red-400 text-center p-4">
                <svg className="w-16 h-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{imageError}</p>
                {material.ossKey && (
                  <button
                    onClick={() => {
                      setImageError('');
                      setIsLoadingImage(true);
                      getSignedUrl(material.ossKey!, 3600)
                        .then(url => setImageUrl(url))
                        .catch(() => setImageError('重试失败'))
                        .finally(() => setIsLoadingImage(false));
                    }}
                    className="mt-2 px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    重试
                  </button>
                )}
              </div>
            ) : (material as any).ocrText ? (
              /* 离线导入的材料没有图片，显示 OCR 文本 */
              <div className="h-full w-full overflow-auto bg-white p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">OCR 识别文本</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded">
                  {(material as any).ocrText}
                </pre>
              </div>
            ) : (
              <div className="text-gray-400 text-center">
                <svg className="w-16 h-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>文件预览</p>
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 p-4 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">材料信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">文件名：</span>
                <span className="text-gray-900">{material.fileName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">材料类型：</span>
                {isEditingClassification ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedMaterialId}
                      onChange={(e) => setSelectedMaterialId(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">选择材料类型</option>
                      {availableMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleClassificationChange}
                      className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditingClassification(false)}
                      className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">
                      {material.classification?.materialName || '未识别'}
                      {getClassificationSourceLabel()}
                    </span>
                    <button
                      onClick={() => setIsEditingClassification(true)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                    >
                      修改
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">识别状态：</span>
                <span className={`font-medium ${
                  material.status === 'completed'
                    ? material.classification?.materialId === 'unknown'
                      ? 'text-gray-600'
                      : 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {material.status === 'completed'
                    ? material.classification?.materialId === 'unknown'
                      ? '未识别'
                      : '已识别'
                    : '处理失败'}
                </span>
              </div>
              {material.classification?.confidence !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">分类置信度：</span>
                  <span className={`font-medium ${
                    material.classification.confidence >= 0.9
                      ? 'text-green-600'
                      : material.classification.confidence >= 0.7
                      ? 'text-blue-600'
                      : 'text-yellow-600'
                  }`}>
                    {Math.round(material.classification.confidence * 100)}%
                  </span>
                </div>
              )}
              {hasDocumentSummary && (
                <div className="flex justify-between">
                  <span className="text-gray-500">解析置信度：</span>
                  <span className={`font-medium ${
                    confidence >= 0.9
                      ? 'text-green-600'
                      : confidence >= 0.7
                      ? 'text-blue-600'
                      : 'text-yellow-600'
                  }`}>
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* 解析按钮 */}
            <div className="mt-4">
              <button
                onClick={handleParse}
                disabled={isParsing || material.classification?.materialId === 'unknown'}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  isParsing || material.classification?.materialId === 'unknown'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isParsing ? '解析中...' : '开始解析'}
              </button>
              {material.classification?.materialId === 'unknown' && (
                <p className="text-xs text-yellow-600 mt-1">
                  请先选择材料类型再进行解析
                </p>
              )}
            </div>
          </div>

          {hasDocumentSummary && material.documentSummary?.sourceAnchors && (
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI提取结果</h3>
              <div className="space-y-2">
                {Object.entries(material.documentSummary.sourceAnchors).map(([key, anchor]) => {
                  const value = (material.documentSummary as any)?.[key];
                  if (value === undefined) return null;
                  
                  return (
                    <div key={key} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-gray-500 capitalize">{key}：</span>
                        <span className="text-sm font-medium text-gray-900 text-right">
                          {String(value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>            
            </div>
          )}

          {/* 从案件信息页解析的简单结果（没有 documentSummary 但有 structuredData） */}
          {!hasDocumentSummary && material.structuredData && Object.keys(material.structuredData).length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI提取结果</h3>
              <div className="space-y-2">
                <StructuredDataViewer data={material.structuredData} />
              </div>
            </div>
          )}

          {!hasDocumentSummary && (!material.structuredData || Object.keys(material.structuredData).length === 0) && (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">
                该材料暂无AI提取结果，可能还在处理中或识别失败。
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MaterialReviewDrawer;
