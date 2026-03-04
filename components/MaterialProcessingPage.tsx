import React, { useState } from 'react';
import { MaterialUpload } from './MaterialUpload';
import { ClassificationModal } from './ClassificationModal';
import { ExtractResultViewer } from './ExtractResultViewer';
import { ClassificationResult, MaterialAuditConclusion, ClaimsMaterial } from '../types';
import { api } from '../services/api';
import { unifiedMaterialService } from '../services/material/unifiedMaterialService';

interface ProcessingState {
  step: 'upload' | 'classifying' | 'confirm' | 'extracting' | 'result';
  files: File[];
  classification: ClassificationResult | null;
  alternatives: ClassificationResult[];
  auditConclusion: MaterialAuditConclusion | null;
  extractedData: Record<string, any> | null;
  error?: string;
}

export const MaterialProcessingPage: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    step: 'upload',
    files: [],
    classification: null,
    alternatives: [],
    auditConclusion: null,
    extractedData: null,
  });

  const handleUpload = (files: File[]) => {
    setState(prev => ({ ...prev, files }));
  };

  const handleClassify = async (files: File[]) => {
    if (files.length === 0) return;

    setState(prev => ({ ...prev, step: 'classifying' }));

    try {
      // 获取可用材料列表
      const materials = await api.claimsMaterials.list() as ClaimsMaterial[];
      
      // 分类第一个文件
      const file = files[0];
      const result = await unifiedMaterialService.classify(file, materials);

      // 获取备选（从其他材料中找出分数接近的）
      const alternatives = materials
        .filter(m => m.id !== result.materialId)
        .slice(0, 3)
        .map(m => ({
          materialId: m.id,
          materialName: m.name,
          confidence: 0.5, // 简化处理
          category: m.category || 'other',
          isConfident: false,
        }));

      setState(prev => ({
        ...prev,
        step: 'confirm',
        classification: result,
        alternatives,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'upload',
        error: error instanceof Error ? error.message : '分类失败',
      }));
    }
  };

  const handleConfirmMaterial = async (materialId: string) => {
    setState(prev => ({ ...prev, step: 'extracting' }));

    try {
      // 获取材料配置
      const materials = await api.claimsMaterials.list() as ClaimsMaterial[];
      const materialConfig = materials.find(m => m.id === materialId);

      if (!materialConfig) {
        throw new Error('Material config not found');
      }

      // 执行完整处理
      const file = state.files[0];
      const result = await unifiedMaterialService.process(file, materialConfig);

      if (result.success) {
        setState(prev => ({
          ...prev,
          step: 'result',
          auditConclusion: result.auditConclusion || null,
          extractedData: result.extraction?.extractedData || null,
        }));
      } else {
        throw new Error(result.error || '处理失败');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'upload',
        error: error instanceof Error ? error.message : '提取失败',
      }));
    }
  };

  const handleCloseModal = () => {
    setState(prev => ({ ...prev, step: 'upload' }));
  };

  const handleReset = () => {
    setState({
      step: 'upload',
      files: [],
      classification: null,
      alternatives: [],
      auditConclusion: null,
      extractedData: null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">材料智能处理</h1>
          <p className="text-gray-600 mt-2">
            上传材料，系统将自动分类并提取关键信息
          </p>
        </div>

        {/* Error Message */}
        {state.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {state.error}
          </div>
        )}

        {/* Upload Section */}
        {(state.step === 'upload' || state.step === 'classifying') && (
          <div className="bg-white rounded-lg shadow p-6">
            <MaterialUpload
              onUpload={handleUpload}
              onClassify={handleClassify}
              multiple={false}
              showClassifyButton={state.files.length > 0}
            />

            {state.step === 'classifying' && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                  正在识别材料类型...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Classification Modal */}
        <ClassificationModal
          isOpen={state.step === 'confirm'}
          onClose={handleCloseModal}
          classification={state.classification}
          alternatives={state.alternatives}
          onConfirm={handleConfirmMaterial}
          onSelectAlternative={handleConfirmMaterial}
        />

        {/* Extracting */}
        {state.step === 'extracting' && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="inline-flex items-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              正在提取信息...
            </div>
          </div>
        )}

        {/* Result */}
        {state.step === 'result' && (
          <div className="space-y-4">
            <ExtractResultViewer
              conclusion={state.auditConclusion}
              extractedData={state.extractedData || undefined}
            />

            <div className="flex justify-center gap-4">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                处理下一个材料
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialProcessingPage;