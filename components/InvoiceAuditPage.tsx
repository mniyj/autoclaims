import React, { useState, useCallback, useRef, useEffect } from 'react';
import { type InvoiceAuditResult, type InvoiceItemAudit, type ValidationWarning, type StepTiming, type MaterialAuditResult, type ClaimsMaterial } from '../types';
import { performFullAudit, performMaterialAudit, getAuditHistory, type AuditStep, type AuditOptions } from '../services/invoiceAuditService';
import { getSignedUrl } from '../services/ossService';
import { api } from '../services/api';

// ============================================================
// 省份选项
// ============================================================
const PROVINCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'national', label: '全国（国家目录）' },
  { value: 'beijing', label: '北京市' },
  { value: 'shanghai', label: '上海市' },
  { value: 'guangdong', label: '广东省' },
  { value: 'zhejiang', label: '浙江省' },
  { value: 'jiangsu', label: '江苏省' },
  { value: 'sichuan', label: '四川省' },
  { value: 'hubei', label: '湖北省' },
  { value: 'hunan', label: '湖南省' },
  { value: 'shandong', label: '山东省' },
  { value: 'henan', label: '河南省' },
  { value: 'fujian', label: '福建省' },
  { value: 'anhui', label: '安徽省' },
  { value: 'hebei', label: '河北省' },
  { value: 'liaoning', label: '辽宁省' },
  { value: 'jilin', label: '吉林省' },
  { value: 'heilongjiang', label: '黑龙江省' },
  { value: 'shanxi', label: '山西省' },
  { value: 'shaanxi', label: '陕西省' },
  { value: 'gansu', label: '甘肃省' },
  { value: 'yunnan', label: '云南省' },
  { value: 'guizhou', label: '贵州省' },
  { value: 'jiangxi', label: '江西省' },
  { value: 'guangxi', label: '广西壮族自治区' },
  { value: 'hainan', label: '海南省' },
  { value: 'neimenggu', label: '内蒙古自治区' },
  { value: 'xinjiang', label: '新疆维吾尔自治区' },
  { value: 'xizang', label: '西藏自治区' },
  { value: 'ningxia', label: '宁夏回族自治区' },
  { value: 'qinghai', label: '青海省' },
  { value: 'tianjin', label: '天津市' },
  { value: 'chongqing', label: '重庆市' },
];

// ============================================================
// 审核步骤定义（8 个细粒度子步骤）
// ============================================================
const AUDIT_STEPS: { key: AuditStep; label: string; group: string }[] = [
  { key: 'upload',        label: '图片上传',   group: '发票识别' },
  { key: 'ocr',           label: 'OCR 识别',  group: '发票识别' },
  { key: 'hospital',      label: '医院校验',   group: '医院校验' },
  { key: 'catalog_fetch', label: '获取目录',   group: '目录匹配' },
  { key: 'catalog_sync',  label: '快速匹配',   group: '目录匹配' },
  { key: 'catalog_ai',    label: 'AI 匹配',   group: '目录匹配' },
  { key: 'summary',       label: '汇总统计',   group: '汇总统计' },
  { key: 'saving',        label: '保存结果',   group: '保存结果' },
];

/** 发票类材料 ID（仅这些材料走完整 8 步流程） */
const INVOICE_MATERIAL_IDS = ['mat-20', 'mat-21'];

/** 通用材料的简化审核步骤 */
const MATERIAL_AUDIT_STEPS: { key: AuditStep; label: string; group: string }[] = [
  { key: 'upload', label: '图片上传', group: '上传' },
  { key: 'ocr',    label: 'OCR 识别', group: '识别' },
  { key: 'saving', label: '保存结果', group: '保存' },
];

/** 步骤 key → 中文标签映射 */
const STEP_LABELS: Record<string, string> = {};
AUDIT_STEPS.forEach(s => { STEP_LABELS[s.key] = s.label; });
MATERIAL_AUDIT_STEPS.forEach(s => { if (!STEP_LABELS[s.key]) STEP_LABELS[s.key] = s.label; });

/** 格式化毫秒为人类可读 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
};

/** 实时计时器组件 — 每 100ms 刷新一次 */
const ElapsedTimer: React.FC<{ startTime?: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(timer);
  }, [startTime]);
  return <span className="text-[#4f46e5] font-mono animate-pulse">{formatDuration(elapsed)}...</span>;
};

// ============================================================
// 匹配方式中文标签
// ============================================================
const MATCH_METHOD_LABELS: Record<string, string> = {
  exact: '精确匹配',
  alias: '别名匹配',
  fuzzy: '模糊匹配',
  ai: 'AI匹配',
  manual: '手动匹配',
  none: '未匹配',
};

const MATCH_METHOD_COLORS: Record<string, string> = {
  exact: 'bg-green-100 text-green-700',
  alias: 'bg-blue-100 text-blue-700',
  fuzzy: 'bg-yellow-100 text-yellow-700',
  ai: 'bg-purple-100 text-purple-700',
  manual: 'bg-gray-100 text-gray-700',
  none: 'bg-red-100 text-red-700',
};

// 甲乙丙类颜色
const TYPE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-orange-100 text-orange-700',
  excluded: 'bg-red-100 text-red-700',
};

const TYPE_LABELS: Record<string, string> = {
  A: '甲类',
  B: '乙类',
  C: '丙类',
  excluded: '目录外',
};

// ============================================================
// Component
// ============================================================
const InvoiceAuditPage: React.FC = () => {
  // 上传区域状态（支持多图）
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [province, setProvince] = useState('national');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 审核流程状态
  const [currentStep, setCurrentStep] = useState<AuditStep>('idle');
  const [auditResult, setAuditResult] = useState<InvoiceAuditResult | null>(null);
  const [auditError, setAuditError] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'glm-ocr' | 'glm-ocr-structured' | 'paddle-ocr'>('gemini');
  const [enableAiMatch, setEnableAiMatch] = useState(false);
  const [stepDetail, setStepDetail] = useState('');
  const [stepTimings, setStepTimings] = useState<StepTiming[]>([]);

  // 材料类型选择
  const [materialList, setMaterialList] = useState<ClaimsMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [materialAuditResult, setMaterialAuditResult] = useState<MaterialAuditResult | null>(null);

  // 判断是否为发票类材料
  const isInvoiceMaterial = selectedMaterialId === '' || INVOICE_MATERIAL_IDS.includes(selectedMaterialId);

  // 当前使用的审核步骤列表
  const currentAuditSteps = isInvoiceMaterial ? AUDIT_STEPS : MATERIAL_AUDIT_STEPS;

  // 审核历史
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<InvoiceAuditResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyImageUrls, setHistoryImageUrls] = useState<Record<string, string>>({});

  // 图片预览弹窗
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // AI 日志弹窗
  const [showAiLog, setShowAiLog] = useState(false);
  // 步骤日志弹窗
  const [showStepLog, setShowStepLog] = useState(false);

  // ── 加载材料类型列表 ──
  useEffect(() => {
    api.claimsMaterials.list().then((data: any) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setMaterialList(data as ClaimsMaterial[]);
      }
    }).catch(err => {
      console.warn('加载材料类型列表失败:', err);
    });
  }, []);

  // ── 文件选择（支持多选）──
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    const validFiles = files.filter(file => {
      if (!validTypes.includes(file.type)) return false;
      if (file.size > 10 * 1024 * 1024) return false;
      return true;
    });

    if (validFiles.length === 0) {
      alert('没有有效的文件（支持 JPG/PNG/WEBP/PDF，最大 10MB）');
      return;
    }

    // 追加到已选文件列表
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setAuditResult(null);
    setAuditError('');
    setCurrentStep('idle');

    // 为每个新文件生成预览
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrls(prev => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // 重置 input value，允许再次选择相同文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── 拖拽上传 ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (files.length === 0) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    const validFiles = files.filter(file => {
      if (!validTypes.includes(file.type)) return false;
      if (file.size > 10 * 1024 * 1024) return false;
      return true;
    });

    if (validFiles.length === 0) {
      alert('没有有效的文件（支持 JPG/PNG/WEBP/PDF，最大 10MB）');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setAuditResult(null);
    setAuditError('');
    setCurrentStep('idle');

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrls(prev => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // ── 删除指定图片 ──
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setActivePreviewIndex(0);
  }, []);

  // ── 开始审核 ──
  const handleStartAudit = useCallback(async () => {
    if (selectedFiles.length === 0) {
      alert('请先上传图片');
      return;
    }

    setIsAuditing(true);
    setAuditError('');
    setAuditResult(null);
    setMaterialAuditResult(null);
    setCurrentStep('upload');
    setStepDetail('');
    setStepTimings([]);

    // 通用的进度回调
    const progressCallback = (step: AuditStep, detail?: string) => {
      const now = Date.now();
      setStepTimings(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          const last = updated[updated.length - 1];
          if (!last.endTime) {
            last.endTime = now;
            last.duration = now - last.startTime;
          }
        }
        if (step !== 'done' && step !== 'error') {
          updated.push({
            step,
            label: STEP_LABELS[step] || step,
            startTime: now,
            detail: detail || undefined,
          });
        } else {
          if (updated.length > 0) {
            const last = updated[updated.length - 1];
            if (!last.endTime) {
              last.endTime = now;
              last.duration = now - last.startTime;
            }
          }
        }
        return updated;
      });
      setCurrentStep(step);
      setStepDetail(detail || '');
    };

    try {
      if (isInvoiceMaterial) {
        // ── 发票类材料：走完整 8 步流程 ──
        const imageSource = selectedFiles.length === 1 ? selectedFiles[0] : selectedFiles;
        const result = await performFullAudit(
          imageSource,
          province,
          selectedModel,
          undefined,
          progressCallback,
          { enableAiMatch }
        );
        setAuditResult(result);

        if (result.auditStatus === 'failed') {
          setAuditError(result.errorMessage || '发票识别失败，请检查图片是否清晰或重新上传');
          setCurrentStep('error');
        }
      } else {
        // ── 通用材料：走简化 3 步流程 ──
        const mat = materialList.find(m => m.id === selectedMaterialId);
        if (!mat) {
          throw new Error('未找到选中的材料类型定义');
        }
        const matResult = await performMaterialAudit(
          selectedFiles[0],
          selectedModel === 'glm-ocr-structured' ? 'glm-ocr' : selectedModel as 'gemini' | 'glm-ocr' | 'paddle-ocr',
          mat.id,
          mat.name,
          mat.aiAuditPrompt || '请提取图片中的关键信息并进行校验',
          mat.jsonSchema,
          progressCallback
        );
        setMaterialAuditResult(matResult);

        if (matResult.auditStatus === 'failed') {
          setAuditError(matResult.errorMessage || '材料识别失败，请检查图片是否清晰或重新上传');
          setCurrentStep('error');
        }
      }
    } catch (err) {
      console.error('审核失败:', err);
      setAuditError(err instanceof Error ? err.message : '审核过程中发生未知错误');
      setCurrentStep('error');
      // 结束最后一个步骤计时
      setStepTimings(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          const last = updated[updated.length - 1];
          if (!last.endTime) {
            const now = Date.now();
            last.endTime = now;
            last.duration = now - last.startTime;
          }
        }
        return updated;
      });
    } finally {
      setIsAuditing(false);
      setStepDetail('');
    }
  }, [selectedFiles, province, selectedModel, enableAiMatch, isInvoiceMaterial, selectedMaterialId, materialList]);

  // ── 查看审核历史 ──
  const handleShowHistory = useCallback(async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const history = await getAuditHistory();
      setHistoryList(history);

      // Pre-fetch signed URLs for records with ossKey
      const urlMap: Record<string, string> = {};
      const fetchPromises = history
        .filter(record => record.ossKey && record.ossKey !== '')
        .map(async (record) => {
          try {
            const url = await getSignedUrl(record.ossKey);
            urlMap[record.invoiceId || (record as any).auditId] = url;
          } catch {
            // Silently skip failed URL generation
          }
        });
      await Promise.all(fetchPromises);
      setHistoryImageUrls(urlMap);
    } catch (err) {
      console.error('获取审核历史失败:', err);
    }
    setLoadingHistory(false);
    setShowHistory(true);
  }, [showHistory]);

  // ── 从历史记录加载 ──
  const handleLoadFromHistory = useCallback(async (record: InvoiceAuditResult) => {
    setAuditResult(record);
    setAuditError(record.auditStatus === 'failed' ? (record.errorMessage || '该记录审核失败') : '');
    setCurrentStep(record.auditStatus === 'completed' ? 'done' : 'error');
    setShowHistory(false);
    setSelectedFiles([]);

    // 多图模式：为所有图片生成签名 URL
    if (record.imageOcrResults && record.imageOcrResults.length > 0) {
      const urls: string[] = [];
      for (const img of record.imageOcrResults) {
        if (img.ossKey && img.ossKey.trim() !== '') {
          try {
            const url = await getSignedUrl(img.ossKey);
            urls.push(url);
          } catch {
            urls.push(img.ossUrl || '');
          }
        } else {
          urls.push(img.ossUrl || '');
        }
      }
      setPreviewUrls(urls);
      setActivePreviewIndex(0);
    } else {
      // 单图模式（向后兼容）
      if (record.ossKey && record.ossKey.trim() !== '') {
        try {
          const freshUrl = await getSignedUrl(record.ossKey);
          setPreviewUrls([freshUrl]);
        } catch (err) {
          console.warn('Failed to generate signed URL for history image:', err);
          setPreviewUrls(record.ossUrl ? [record.ossUrl] : []);
        }
      } else if (record.ossUrl) {
        setPreviewUrls([record.ossUrl]);
      } else {
        setPreviewUrls([]);
      }
      setActivePreviewIndex(0);
    }
  }, []);

  // ── 重置 ──
  const handleReset = useCallback(() => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    setActivePreviewIndex(0);
    setAuditResult(null);
    setMaterialAuditResult(null);
    setAuditError('');
    setCurrentStep('idle');
    setStepTimings([]);
    setStepDetail('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ── 渲染 AI 日志弹窗 ──
  const renderAiLogModal = () => {
    const log = getAiLogForModal();
    if (!showAiLog || !log) return null;
    const { model, prompt, response, duration, timestamp, usageMetadata, timing } = log;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              AI 交互日志
            </h3>
            <button
              onClick={() => setShowAiLog(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Meta Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">模型 (Model)</div>
                <div className="font-mono text-sm font-medium text-gray-800">{model}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">总耗时 (Total)</div>
                <div className="font-mono text-sm font-medium text-gray-800">{duration} ms</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Token 消耗</div>
                <div className="font-mono text-sm font-medium text-gray-800">
                  {usageMetadata?.parsing?.totalTokenCount || usageMetadata?.totalTokenCount || 'N/A'}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">时间 (Time)</div>
                <div className="font-mono text-sm font-medium text-gray-800">
                  {new Date(timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* 分步耗时（仅当 OCR + 格式化模式时显示） */}
            {timing && (timing.ocrDuration || timing.parsingDuration) && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-100">
                <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-1.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  分步耗时
                </div>
                <div className="flex items-center gap-4">
                  {timing.ocrDuration !== undefined && (
                    <div className="flex-1 bg-white p-3 rounded-lg border border-blue-200">
                      <div className="text-xs text-blue-600 mb-1">OCR 识别</div>
                      <div className="font-mono text-lg font-bold text-blue-700">{timing.ocrDuration} <span className="text-xs font-normal">ms</span></div>
                    </div>
                  )}
                  <div className="text-gray-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                  {timing.parsingDuration !== undefined && (
                    <div className="flex-1 bg-white p-3 rounded-lg border border-purple-200">
                      <div className="text-xs text-purple-600 mb-1">大模型格式化</div>
                      <div className="font-mono text-lg font-bold text-purple-700">{timing.parsingDuration} <span className="text-xs font-normal">ms</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                提示词 (Prompt)
              </h4>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-gray-100 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {prompt}
                </pre>
              </div>
            </div>

            {/* Response */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                模型响应 (Response)
              </h4>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {response}
                </pre>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
            <button
              onClick={() => setShowAiLog(false)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStepLogModal = () => {
    if (!showStepLog || !auditResult?.stepLogs || auditResult.stepLogs.length === 0) return null;

    const stepLabels: Record<string, string> = {
      upload: '图片上传',
      ocr: '发票识别',
      hospital: '医院校验',
      catalog: '目录匹配',
      catalog_fetch: '获取目录',
      catalog_sync: '快速匹配',
      catalog_ai: 'AI 匹配',
      summary: '汇总计算',
      saving: '保存结果',
    };

    const safeStringify = (value: any) => {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              步骤日志
            </h3>
            <button
              onClick={() => setShowStepLog(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {auditResult.stepLogs.map((log, index) => (
              <div key={`${log.step}-${log.timestamp}-${index}`} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                      {stepLabels[log.step] || log.step}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-600 font-medium">耗时 {log.duration} ms</div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">入参</div>
                    <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-gray-100 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                        {safeStringify(log.input)}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">出参</div>
                    <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                        {safeStringify(log.output)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
            <button
              onClick={() => setShowStepLog(false)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── 渲染进度条（竖向 timeline + 实时耗时） ──
  const renderProgressBar = () => {
    if (currentStep === 'idle') return null;

    const stepsToShow = currentAuditSteps;
    const currentStepIndex = stepsToShow.findIndex(s => s.key === currentStep);

    // 找到出错时失败的步骤
    const getErrorStepKey = (): string | null => {
      if (currentStep !== 'error') return null;
      // 最后一个有 timing 记录的步骤就是失败的步骤
      if (stepTimings.length > 0) {
        return stepTimings[stepTimings.length - 1].step;
      }
      return 'upload'; // fallback
    };
    const errorStepKey = getErrorStepKey();

    // 是否全部完成
    const allDone = currentStep === 'done';

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">审核进度</h3>
        <div className="space-y-1">
          {stepsToShow.map((step, index) => {
            const timing = stepTimings.find(t => t.step === step.key);
            const isDone = timing?.endTime != null;
            const isActive = currentStep === step.key;
            const isErrorStep = currentStep === 'error' && step.key === errorStepKey;
            const isPending = !timing && !allDone;
            // AI 匹配跳过的情况
            const isSkipped = step.key === 'catalog_ai' && !enableAiMatch && allDone && !timing;

            return (
              <div key={step.key} className="flex items-center gap-3 py-1.5">
                {/* 状态图标 */}
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${
                  isErrorStep
                    ? 'bg-red-500 text-white'
                    : isDone || allDone
                      ? isSkipped
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-[#4f46e5] text-white animate-pulse'
                        : 'bg-gray-200 text-gray-400'
                }`}>
                  {isErrorStep ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : isDone && !isSkipped ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : allDone && !isSkipped ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <span className="block w-2 h-2 rounded-full bg-white"></span>
                  ) : (
                    <span className="text-[10px]">{index + 1}</span>
                  )}
                </div>

                {/* 步骤名称 + 子进度描述 */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${
                    isErrorStep ? 'text-red-600' :
                    isSkipped ? 'text-gray-400 italic' :
                    isDone || allDone ? 'text-green-700' :
                    isActive ? 'text-[#4f46e5]' :
                    'text-gray-400'
                  }`}>
                    {step.label}
                    {isSkipped && ' (已跳过)'}
                  </span>
                  {isActive && stepDetail && (
                    <span className="ml-2 text-xs text-gray-400">{stepDetail}</span>
                  )}
                  {isErrorStep && auditResult?.errorMessage && (
                    <span className="ml-2 text-xs text-red-500">{auditResult.errorMessage}</span>
                  )}
                </div>

                {/* 耗时 */}
                <div className="text-xs font-mono text-gray-500 flex-shrink-0 w-16 text-right">
                  {isDone && timing?.duration != null ? (
                    <span className={isErrorStep ? 'text-red-500' : 'text-gray-600'}>{formatDuration(timing.duration)}</span>
                  ) : isActive && timing ? (
                    <ElapsedTimer startTime={timing.startTime} />
                  ) : isSkipped ? (
                    <span className="text-gray-300">—</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* 总耗时汇总（完成或出错时显示） */}
        {(allDone || currentStep === 'error') && stepTimings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">总耗时</span>
            <span className="text-sm font-mono font-semibold text-gray-700">
              {formatDuration(stepTimings.reduce((sum, t) => sum + (t.duration || 0), 0))}
            </span>
          </div>
        )}
      </div>
    );
  };

  // ── 渲染患者基本信息 ──
  const renderBasicInfo = () => {
    if (!auditResult?.ocrData?.basicInfo) return null;
    const info = auditResult.ocrData.basicInfo;
    const fields = [
      { label: '患者姓名', value: info.name },
      { label: '性别', value: info.gender },
      { label: '年龄', value: info.age },
      { label: '科室', value: info.department },
      { label: '住院号', value: info.hospitalizationNumber },
      { label: '床号', value: info.bedCode },
      { label: '入院日期', value: info.admissionDate },
      { label: '出院日期', value: info.dischargeDate },
      { label: '出院诊断', value: info.dischargeDiagnosis },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          患者基本信息
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fields.map((field) => (
            field.value ? (
              <div key={field.label}>
                <p className="text-xs text-gray-500 mb-0.5">{field.label}</p>
                <p className="text-sm font-medium text-gray-900">{field.value}</p>
              </div>
            ) : null
          ))}
        </div>
      </div>
    );
  };

  // ── 渲染发票信息 ──
  const renderInvoiceInfo = () => {
    if (!auditResult?.ocrData?.invoiceInfo) return null;
    const info = auditResult.ocrData.invoiceInfo;
    const fields = [
      { label: '医院名称', value: info.hospitalName },
      { label: '医院类型', value: info.hospitalType },
      { label: '发票代码', value: info.invoiceCode },
      { label: '发票号码', value: info.invoiceNumber },
      { label: '校验码', value: info.verificationCode },
      { label: '开票日期', value: info.issueDate },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            发票信息
          </h3>
          
          {/* Action Buttons */}
          <div className="flex space-x-2">
            {/* Step Log Button */}
            {auditResult.stepLogs && auditResult.stepLogs.length > 0 && (
              <button
                onClick={() => setShowStepLog(true)}
                className="flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                查看步骤日志
              </button>
            )}

            {/* AI Log Button */}
            {auditResult.aiLog && (
              <button
                onClick={() => setShowAiLog(true)}
                className="flex items-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors border border-purple-100"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                查看 AI 日志
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fields.map((field) => (
            field.value ? (
              <div key={field.label}>
                <p className="text-xs text-gray-500 mb-0.5">{field.label}</p>
                <p className="text-sm font-medium text-gray-900">{field.value}</p>
              </div>
            ) : null
          ))}
        </div>
      </div>
    );
  };

  // ── 渲染医保信息 ──
  const renderMedicalInsuranceInfo = () => {
    if (!auditResult?.ocrData?.medicalInsurance) return null;
    const info = auditResult.ocrData.medicalInsurance;
    const fields = [
      { label: '医保类型', value: info.insuranceType },
      { label: '医保号', value: info.insuranceNumber },
      { label: '门诊号', value: info.outpatientNumber },
      { label: '就诊日期', value: info.visitDate },
      { label: '业务流水号', value: info.businessSerialNumber },
    ];

    const hasValue = fields.some(f => f.value);
    if (!hasValue) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          医保信息
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fields.map((field) => (
            field.value ? (
              <div key={field.label}>
                <p className="text-xs text-gray-500 mb-0.5">{field.label}</p>
                <p className="text-sm font-medium text-gray-900">{field.value}</p>
              </div>
            ) : null
          ))}
        </div>
      </div>
    );
  };

  // ── 渲染医院校验结果 ──
  const renderHospitalValidation = () => {
    if (!auditResult?.hospitalValidation) return null;
    const hv = auditResult.hospitalValidation;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          医院校验
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">医院名称</span>
            <span className="text-sm font-medium text-gray-900">{hv.hospitalName || '未识别'}</span>
          </div>
          {hv.matchedHospital && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">医院等级</span>
                <span className="text-sm font-medium text-gray-900">{hv.matchedHospital.level}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">医院类型</span>
                <span className="text-sm font-medium text-gray-900">{hv.matchedHospital.type}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">理赔合规</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              hv.isQualified
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {hv.isQualified ? '合规' : '不合规'}
            </span>
          </div>
          {hv.reason && (
            <div className="mt-2 p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-700">{hv.reason}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── 渲染审核汇总 ──
  const renderSummary = () => {
    if (!auditResult?.summary) return null;
    const s = auditResult.summary;
    const ins = auditResult.ocrData?.insurancePayment;

    // 检查是否有 total_mismatch 警告
    const totalMismatchWarning = auditResult.validationWarnings?.find(w => w.type === 'total_mismatch' && w.severity === 'warning');

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          审核汇总
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">发票总金额</span>
            <div className="flex items-center">
              <span className="text-lg font-bold text-gray-900">{s.totalAmount.toFixed(2)}</span>
              {totalMismatchWarning && (
                <span className="ml-2 text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200" title={totalMismatchWarning.message}>
                  明细加总 {totalMismatchWarning.details?.actual?.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">合规金额</span>
            <span className="text-sm font-bold text-green-600">{s.qualifiedAmount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">不合规金额</span>
            <span className="text-sm font-bold text-red-600">{s.unqualifiedAmount.toFixed(2)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">合规项目数</span>
            <span className="text-sm font-medium text-green-600">{s.qualifiedItemCount} 项</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">不合规项目数</span>
            <span className="text-sm font-medium text-red-600">{s.unqualifiedItemCount} 项</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between bg-[#eef2ff] rounded-lg p-3 -mx-1">
            <span className="text-sm font-semibold text-[#4338ca]">预估报销金额</span>
            <span className="text-lg font-bold text-[#4338ca]">{s.estimatedReimbursement.toFixed(2)}</span>
          </div>

          {/* 医保支付分解 — 仅在有医保支付数据时显示 */}
          {ins && (ins.governmentFundPayment || ins.personalSelfPayment || ins.personalSelfExpense || ins.personalAccountPayment || ins.personalCashPayment) ? (
            <>
              <div className="h-px bg-gray-100" />
              <div className="mt-2">
                <p className="text-xs font-semibold text-gray-500 mb-2">票面医保支付分解</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {ins.governmentFundPayment ? (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">统筹支付</span>
                      <span className="text-xs font-medium text-gray-700">{ins.governmentFundPayment.toFixed(2)}</span>
                    </div>
                  ) : null}
                  {ins.personalSelfPayment ? (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">个人自付</span>
                      <span className="text-xs font-medium text-blue-600">{ins.personalSelfPayment.toFixed(2)}</span>
                    </div>
                  ) : null}
                  {ins.personalSelfExpense ? (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">个人自费</span>
                      <span className="text-xs font-medium text-orange-600">{ins.personalSelfExpense.toFixed(2)}</span>
                    </div>
                  ) : null}
                  {ins.personalAccountPayment ? (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">个人账户</span>
                      <span className="text-xs font-medium text-gray-700">{ins.personalAccountPayment.toFixed(2)}</span>
                    </div>
                  ) : null}
                  {ins.personalCashPayment ? (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">个人现金</span>
                      <span className="text-xs font-medium text-gray-700">{ins.personalCashPayment.toFixed(2)}</span>
                    </div>
                  ) : null}
                  {ins.otherPayment ? (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">其他支付</span>
                      <span className="text-xs font-medium text-gray-700">{ins.otherPayment.toFixed(2)}</span>
                    </div>
                  ) : null}
                </div>
                {/* 自付提示 */}
                {ins.personalSelfPayment && ins.personalSelfPayment > 0 && auditResult.ocrData?.medicalInsurance?.insuranceType?.includes('自费') ? (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-100">
                    票面医保类型标注为"自费"，但存在"个人自付"金额，说明部分项目在医保目录范围内
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  // ── 渲染图片分类卡片（多图模式） ──
  const renderImageClassification = () => {
    if (!auditResult?.imageOcrResults || auditResult.imageOcrResults.length <= 1) return null;

    const typeLabels: Record<string, string> = {
      summary_invoice: '汇总发票',
      detail_list: '明细清单',
      single_invoice: '完整发票',
    };
    const typeColors: Record<string, string> = {
      summary_invoice: 'bg-blue-100 text-blue-700',
      detail_list: 'bg-green-100 text-green-700',
      single_invoice: 'bg-gray-100 text-gray-700',
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          图片分类
          <span className="ml-2 text-xs font-normal text-gray-500">({auditResult.imageOcrResults.length} 张)</span>
        </h3>
        <div className="space-y-2">
          {auditResult.imageOcrResults.map((img, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 bg-[#4f46e5] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <span className="text-sm text-gray-700">{img.fileName}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {img.ocrData.chargeItems?.length || 0} 项
                  </span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[img.documentType] || typeColors.single_invoice}`}>
                {typeLabels[img.documentType] || '未识别'}
              </span>
            </div>
          ))}
        </div>
        {/* 交叉验证提示 */}
        {auditResult.crossValidation && !auditResult.crossValidation.isConsistent && (
          <div className="mt-3 p-2.5 bg-yellow-50 rounded-lg text-xs text-yellow-700 border border-yellow-200">
            <span className="font-medium">金额交叉验证：</span>
            汇总发票金额 ({auditResult.crossValidation.summaryTotal.toFixed(2)}) 与明细合计 ({auditResult.crossValidation.detailItemsTotal.toFixed(2)}) 存在 {auditResult.crossValidation.difference.toFixed(2)} 元差异
          </div>
        )}
        {auditResult.crossValidation && auditResult.crossValidation.isConsistent && auditResult.crossValidation.summaryTotal > 0 && (
          <div className="mt-3 p-2.5 bg-green-50 rounded-lg text-xs text-green-700 border border-green-200">
            <span className="font-medium">金额交叉验证通过：</span>
            汇总发票金额 ({auditResult.crossValidation.summaryTotal.toFixed(2)}) 与明细合计 ({auditResult.crossValidation.detailItemsTotal.toFixed(2)}) 一致
          </div>
        )}
      </div>
    );
  };

  // ── 渲染汇总大类项目参考表（多图模式） ──
  const renderSummaryChargeItems = () => {
    if (!auditResult?.summaryChargeItems || auditResult.summaryChargeItems.length === 0) return null;

    const total = auditResult.summaryChargeItems.reduce((s, item) => s + (item.totalPrice || 0), 0);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          汇总发票大类项目
          <span className="ml-2 text-xs font-normal text-gray-400">仅供参考，不参与逐项审核</span>
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="py-2 px-3 font-medium text-gray-600 rounded-tl-lg">项目名称</th>
              <th className="py-2 px-3 font-medium text-gray-600 text-right">数量</th>
              <th className="py-2 px-3 font-medium text-gray-600 text-right rounded-tr-lg">金额</th>
            </tr>
          </thead>
          <tbody>
            {auditResult.summaryChargeItems.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100 last:border-0">
                <td className="py-2 px-3 text-gray-600">{item.itemName}</td>
                <td className="py-2 px-3 text-right text-gray-500">{item.quantity || '-'}</td>
                <td className="py-2 px-3 text-right text-gray-600 font-medium">{item.totalPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="py-2 px-3 font-bold text-gray-700 rounded-bl-lg">合计</td>
              <td className="py-2 px-3"></td>
              <td className="py-2 px-3 text-right font-bold text-gray-700 rounded-br-lg">{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  // ── 渲染数据验证结果 ──
  const renderValidationWarnings = () => {
    if (!auditResult?.validationWarnings || auditResult.validationWarnings.length === 0) return null;

    const severityConfig: Record<string, { bg: string; border: string; icon: string; text: string }> = {
      error: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', text: 'text-red-700' },
      warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500', text: 'text-yellow-700' },
      info: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500', text: 'text-green-700' },
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          数据验证结果
          <span className="ml-2 text-xs font-normal text-gray-500">({auditResult.validationWarnings.length} 条)</span>
        </h3>
        <div className="space-y-2">
          {auditResult.validationWarnings.map((w: ValidationWarning, idx: number) => {
            const config = severityConfig[w.severity] || severityConfig.info;
            return (
              <div key={idx} className={`${config.bg} ${config.border} border rounded-lg px-4 py-2.5 flex items-start`}>
                {w.severity === 'error' ? (
                  <svg className={`w-4 h-4 ${config.icon} mr-2 mt-0.5 flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : w.severity === 'warning' ? (
                  <svg className={`w-4 h-4 ${config.icon} mr-2 mt-0.5 flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                ) : (
                  <svg className={`w-4 h-4 ${config.icon} mr-2 mt-0.5 flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className={`text-xs ${config.text}`}>{w.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 渲染费用明细审核表 ──
  const renderItemAuditsTable = () => {
    if (!auditResult?.itemAudits || auditResult.itemAudits.length === 0) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          费用明细审核
          <span className="ml-2 text-xs font-normal text-gray-500">
            (共 {auditResult.itemAudits.length} 项)
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600 w-8">#</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600 min-w-[120px]">项目名称</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600 w-16">数量</th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-gray-600 w-20">单价</th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-gray-600 w-24">总价</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-600 w-24">医保类型</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-600 w-24">匹配方式</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-gray-600 w-16">合规</th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-gray-600 w-24">预估报销</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600 min-w-[140px]">审核说明</th>
              </tr>
            </thead>
            <tbody>
              {auditResult.itemAudits.map((item: InvoiceItemAudit, index: number) => {
                const matchType = item.catalogMatch?.matchedItem?.type;
                const matchMethod = item.catalogMatch?.matchMethod || 'none';
                return (
                  <tr key={index} className={`border-b border-gray-100 hover:bg-gray-50 ${
                    !item.isQualified ? 'bg-red-50/30' : ''
                  }`}>
                    <td className="py-2.5 px-3 text-gray-400 text-xs">{index + 1}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-gray-900">{item.itemName}</span>
                      {item.catalogMatch?.matchedItem && item.catalogMatch.matchedItem.name !== item.itemName && (
                        <span className="block text-xs text-blue-500 mt-0.5" title={`匹配到: ${item.catalogMatch.matchedItem.name}`}>
                          &rarr; {item.catalogMatch.matchedItem.name}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{item.unitPrice.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-900">{item.totalPrice.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center">
                      {matchType ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[matchType] || 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[matchType] || matchType}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MATCH_METHOD_COLORS[matchMethod] || 'bg-gray-100 text-gray-600'}`}
                        title={`置信度: ${item.catalogMatch?.matchConfidence || 0}%`}>
                        {MATCH_METHOD_LABELS[matchMethod] || matchMethod}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {item.isQualified ? (
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-green-100">
                          <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-red-100">
                          <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[#4338ca]">
                      {item.estimatedReimbursement > 0 ? item.estimatedReimbursement.toFixed(2) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[200px] truncate" title={item.qualificationReason}>
                      {item.qualificationReason}
                      {item.remarks && (
                        <span className="block text-xs text-orange-500 mt-0.5">{item.remarks}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── 渲染通用材料审核结果 ──
  const renderMaterialResult = () => {
    if (!materialAuditResult) return null;

    const { extractedData, auditConclusion, aiLog, stepTimings: matTimings } = materialAuditResult;
    const selectedMat = materialList.find(m => m.id === selectedMaterialId);

    return (
      <>
        {/* 各步骤耗时汇总卡片 */}
        {matTimings && matTimings.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-1.5 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              各步骤耗时
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {matTimings.map(t => (
                <div key={t.step} className="text-center bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-[10px] text-gray-500 mb-0.5 truncate">{t.label}</div>
                  <div className="text-xs font-mono font-semibold text-gray-700">
                    {formatDuration(t.duration || 0)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 text-center">
              <span className="text-xs text-gray-500">总耗时：</span>
              <span className="text-sm font-mono font-semibold text-gray-700">
                {formatDuration(matTimings.reduce((s, t) => s + (t.duration || 0), 0))}
              </span>
            </div>
          </div>
        )}

        {/* 材料信息卡片 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {selectedMat?.name || materialAuditResult.materialName}
            </h3>
            {/* AI Log Button */}
            {aiLog && (
              <button
                onClick={() => setShowAiLog(true)}
                className="flex items-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors border border-purple-100"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                查看 AI 日志
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">材料类型</p>
              <p className="text-sm font-medium text-gray-900">{selectedMat?.name || materialAuditResult.materialName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">审核状态</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                materialAuditResult.auditStatus === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {materialAuditResult.auditStatus === 'completed' ? '审核完成' : '审核失败'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">上传时间</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(materialAuditResult.uploadTime).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </div>

        {/* 格式化提取结果 */}
        {extractedData && Object.keys(extractedData).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              提取结果
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 w-1/3">字段名</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">提取值</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(extractedData).map(([key, value]) => (
                    <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-4 text-gray-600 font-medium">{key}</td>
                      <td className="py-2.5 px-4 text-gray-900">
                        {typeof value === 'object' && value !== null ? (
                          <pre className="text-xs font-mono bg-gray-50 p-2 rounded whitespace-pre-wrap">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          String(value ?? '')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 审核结论 */}
        {auditConclusion && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              审核结论
            </h3>
            <div className={`p-4 rounded-lg border ${
              materialAuditResult.auditStatus === 'completed'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm whitespace-pre-wrap ${
                materialAuditResult.auditStatus === 'completed'
                  ? 'text-green-800'
                  : 'text-red-800'
              }`}>
                {auditConclusion}
              </p>
            </div>
          </div>
        )}
      </>
    );
  };

  // ── 渲染 AI 日志弹窗（通用材料版本） ──
  const getAiLogForModal = () => {
    if (auditResult?.aiLog) return auditResult.aiLog;
    if (materialAuditResult?.aiLog) return materialAuditResult.aiLog;
    return null;
  };

  // ── 渲染审核历史弹窗 ──
  const renderHistoryModal = () => {
    if (!showHistory) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={() => setShowHistory(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center p-5 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">审核历史记录</h2>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5 overflow-y-auto max-h-[calc(80vh-80px)]">
            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4f46e5]"></div>
              </div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm">暂无审核历史记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((record, index) => (
                  <div key={record.invoiceId || (record as any).auditId || index}
                    className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      record.auditStatus === 'failed'
                        ? 'border-red-200 border-l-4 border-l-red-500'
                        : 'border-gray-200'
                    }`}
                    onClick={() => handleLoadFromHistory(record)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {/* Invoice thumbnail — failed records show failure icon */}
                        {record.auditStatus === 'failed' ? (
                          <div className="w-12 h-12 bg-red-50 rounded border border-red-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                        ) : historyImageUrls[record.invoiceId || (record as any).auditId] ? (
                          <img
                            src={historyImageUrls[record.invoiceId || (record as any).auditId]}
                            alt="材料缩略图"
                            className="w-12 h-12 object-cover rounded border border-gray-200 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {(record as any).materialName || '医疗发票'}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              record.auditStatus === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : record.auditStatus === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {record.auditStatus === 'completed' ? '已完成' : record.auditStatus === 'failed' ? '失败' : '处理中'}
                            </span>
                          </div>
                          {record.auditStatus === 'failed' && record.errorMessage ? (
                            <p className="text-xs text-red-500 mt-1 truncate max-w-[360px]" title={record.errorMessage}>
                              失败原因: {record.errorMessage}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500 mt-1">
                              {(record as any).materialName
                                ? ((record as any).auditConclusion
                                    ? `结论: ${(record as any).auditConclusion.slice(0, 30)}${(record as any).auditConclusion.length > 30 ? '...' : ''}`
                                    : '审核完成')
                                : `患者: ${record.ocrData?.basicInfo?.name || '-'} | 总金额: ${record.summary?.totalAmount?.toFixed(2) || '0.00'} | 预估报销: ${record.summary?.estimatedReimbursement?.toFixed(2) || '0.00'}`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {record.auditTime ? new Date(record.auditTime).toLocaleString('zh-CN') : '-'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{record.invoiceId}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── 渲染图片预览弹窗 ──
  const renderImagePreviewModal = () => {
    if (!showImagePreview || previewUrls.length === 0) return null;

    const currentUrl = previewUrls[activePreviewIndex] || previewUrls[0];
    const hasPrev = activePreviewIndex > 0;
    const hasNext = activePreviewIndex < previewUrls.length - 1;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center" onClick={() => setShowImagePreview(false)}>
        <div className="max-w-[90vw] max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
          <img src={currentUrl} alt={`发票 ${activePreviewIndex + 1}`} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
        {/* 图片序号指示器 */}
        {previewUrls.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-medium">
            {activePreviewIndex + 1} / {previewUrls.length}
          </div>
        )}
        {/* 左右导航 */}
        {hasPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); setActivePreviewIndex(i => i - 1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-40 rounded-full p-2"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            onClick={(e) => { e.stopPropagation(); setActivePreviewIndex(i => i + 1); }}
            className="absolute right-14 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-40 rounded-full p-2"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <button
          onClick={() => setShowImagePreview(false)}
          className="absolute top-4 right-4 text-white hover:text-gray-300">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  };

  // ============================================================
  // Main render
  // ============================================================
  return (
    <div className="min-h-screen bg-[#f8f9fc] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-[#2d3a8c]">理赔材料智能审核</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleShowHistory}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            审核历史
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 mt-8">
        {/* 上传区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* 文件上传 */}
            <div className="flex-1">
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  selectedFiles.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#4f46e5] hover:bg-[#f5f3ff] cursor-pointer'
                }`}
                onClick={() => selectedFiles.length === 0 && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {selectedFiles.length > 0 ? (
                  <div className="space-y-3">
                    {/* 缩略图网格 */}
                    <div className="flex flex-wrap gap-3 justify-center">
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="relative group">
                          {previewUrls[index] ? (
                            <img
                              src={previewUrls[index]}
                              alt={`发票 ${index + 1}`}
                              className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:ring-2 hover:ring-[#4f46e5]"
                              onClick={(e) => { e.stopPropagation(); setActivePreviewIndex(index); setShowImagePreview(true); }}
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          {/* 序号角标 */}
                          <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-[#4f46e5] text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                            {index + 1}
                          </span>
                          {/* 悬浮删除按钮 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold shadow-sm"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      {/* 添加更多图片按钮 */}
                      <div
                        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#4f46e5] hover:bg-[#f5f3ff] transition-colors"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        已选择 {selectedFiles.length} 张图片 | 点击缩略图预览
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReset(); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        清空全部
                      </button>
                    </div>
                    {selectedFiles.length > 1 && (
                      <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                        多图模式：系统将自动识别汇总发票和明细清单，仅明细项目参与逐项审核
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">拖拽或点击上传材料图片</p>
                    <p className="text-xs text-gray-500 mt-1">支持 JPG / PNG / WEBP / PDF，最大 10MB{isInvoiceMaterial ? ' | 可多选' : ''}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 参数配置 + 操作按钮 */}
            <div className="w-full md:w-64 flex flex-col justify-between">
              {/* 材料类型下拉框 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">材料类型</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => {
                    setSelectedMaterialId(e.target.value);
                    // 切换材料类型时重置审核结果
                    if (auditResult || materialAuditResult) {
                      setAuditResult(null);
                      setMaterialAuditResult(null);
                      setCurrentStep('idle');
                      setStepTimings([]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent"
                >
                  <option value="">请选择材料类型</option>
                  {materialList.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {selectedMaterialId && !isInvoiceMaterial && (
                  <p className="text-xs text-blue-500 mt-1">通用材料：仅执行上传 + OCR 识别</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">识别模型</label>
                <div className="grid grid-cols-2 gap-1.5 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                  <button
                    onClick={() => setSelectedModel('gemini')}
                    className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all ${
                      selectedModel === 'gemini'
                        ? 'bg-white text-[#4f46e5] shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Gemini
                  </button>
                  <button
                    onClick={() => setSelectedModel('glm-ocr')}
                    className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all ${
                      selectedModel === 'glm-ocr'
                        ? 'bg-white text-[#4f46e5] shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    GLM+Gemini
                  </button>
                  <button
                    onClick={() => setSelectedModel('glm-ocr-structured')}
                    className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all ${
                      selectedModel === 'glm-ocr-structured'
                        ? 'bg-white text-[#4f46e5] shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    GLM+GLM
                  </button>
                  <button
                    onClick={() => setSelectedModel('paddle-ocr')}
                    className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all ${
                      selectedModel === 'paddle-ocr'
                        ? 'bg-white text-[#4f46e5] shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Paddle+Gemini
                  </button>
                </div>
              </div>

              {/* AI 语义匹配 — 仅发票类材料显示 */}
              {isInvoiceMaterial && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">AI 语义匹配</label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setEnableAiMatch(true)}
                      className={`text-xs font-medium py-1.5 rounded-md transition-all ${
                        enableAiMatch
                          ? 'bg-white text-[#4f46e5] shadow-sm ring-1 ring-gray-200'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      开启
                    </button>
                    <button
                      onClick={() => setEnableAiMatch(false)}
                      className={`text-xs font-medium py-1.5 rounded-md transition-all ${
                        !enableAiMatch
                          ? 'bg-white text-[#4f46e5] shadow-sm ring-1 ring-gray-200'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      关闭
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {enableAiMatch ? '精确+别名+模糊+AI，准确度高但较慢' : '仅精确+别名+模糊匹配，速度快'}
                  </p>
                </div>
              )}

              {/* 审核省份 — 仅发票类材料显示 */}
              {isInvoiceMaterial && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">审核省份</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent"
                  >
                    {PROVINCE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">选择发票对应的省份以匹配地方医保目录</p>
                </div>
              )}
              <button
                onClick={handleStartAudit}
                disabled={selectedFiles.length === 0 || isAuditing}
                className={`mt-4 w-full py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors ${
                  selectedFiles.length === 0 || isAuditing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#4f46e5] text-white hover:bg-[#4338ca]'
                }`}
              >
                {isAuditing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    审核中...
                  </span>
                ) : '开始审核'}
              </button>
            </div>
          </div>
        </div>

        {/* 审核进度 */}
        {renderProgressBar()}

        {/* 审核错误 — 详细失败横幅 */}
        {auditError && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-6 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-red-800 mb-1">审核失败</h4>
                <p className="text-sm text-red-700 mb-3">{auditError}</p>
                <div className="bg-red-100/60 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-red-700 mb-1.5">可能原因：</p>
                  <ul className="text-xs text-red-600 space-y-1">
                    <li className="flex items-center"><span className="w-1 h-1 rounded-full bg-red-400 mr-2 flex-shrink-0"></span>图片模糊或分辨率过低</li>
                    <li className="flex items-center"><span className="w-1 h-1 rounded-full bg-red-400 mr-2 flex-shrink-0"></span>上传的图片与所选材料类型不匹配</li>
                    <li className="flex items-center"><span className="w-1 h-1 rounded-full bg-red-400 mr-2 flex-shrink-0"></span>AI 识别服务暂时不可用</li>
                    <li className="flex items-center"><span className="w-1 h-1 rounded-full bg-red-400 mr-2 flex-shrink-0"></span>网络连接异常或超时</li>
                  </ul>
                </div>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  重新上传
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 通用材料审核结果 */}
        {materialAuditResult && !isInvoiceMaterial && (
          <>
            {renderMaterialResult()}

            {/* 材料原图预览 */}
            {previewUrls.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  材料原图
                </h3>
                <div
                  className="max-h-[400px] overflow-hidden rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => { setActivePreviewIndex(0); setShowImagePreview(true); }}
                >
                  <img src={previewUrls[0]} alt="材料原图" className="w-full object-contain" />
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">点击图片放大查看</p>
              </div>
            )}
          </>
        )}

        {/* 发票审核结果 — 仅在有有效数据时渲染各模块 */}
        {auditResult && isInvoiceMaterial && (
          <>
            {/* 判断是否有有效的 OCR 数据（失败时可能全为空） */}
            {(() => {
              const hasOcrData = auditResult.ocrData && auditResult.ocrData.chargeItems && auditResult.ocrData.chargeItems.length > 0;
              const hasBasicInfo = auditResult.ocrData?.basicInfo && (auditResult.ocrData.basicInfo.name || auditResult.ocrData.basicInfo.age);

              // 如果完全失败且无任何有效数据，不渲染空的结果卡片
              if (auditResult.auditStatus === 'failed' && !hasOcrData && !hasBasicInfo) {
                return null;
              }

              return (
                <>
                  {/* 各步骤耗时汇总卡片 */}
                  {auditResult.stepTimings && auditResult.stepTimings.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-1.5 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        各步骤耗时
                      </h4>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                        {auditResult.stepTimings.map(t => (
                          <div key={t.step} className="text-center bg-white rounded-lg p-2 border border-gray-100">
                            <div className="text-[10px] text-gray-500 mb-0.5 truncate">{t.label}</div>
                            <div className="text-xs font-mono font-semibold text-gray-700">
                              {formatDuration(t.duration || 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 text-center">
                        <span className="text-xs text-gray-500">总耗时：</span>
                        <span className="text-sm font-mono font-semibold text-gray-700">
                          {formatDuration(auditResult.stepTimings.reduce((s, t) => s + (t.duration || 0), 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 上半部分：患者信息 + 发票信息 + 医保信息 (左) / 医院校验 + 汇总 (右) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* 左栏 2/3 */}
                    <div className="lg:col-span-2 space-y-6">
                      {renderBasicInfo()}
                      {renderInvoiceInfo()}
                      {renderMedicalInsuranceInfo()}
                    </div>
                    {/* 右栏 1/3 */}
                    <div className="space-y-6">
                      {renderHospitalValidation()}
                      {renderSummary()}
                    </div>
                  </div>

                  {/* 图片分类（多图模式） */}
                  {renderImageClassification()}

                  {/* 数据验证结果（全宽） */}
                  {renderValidationWarnings()}

                  {/* 汇总大类项目参考（多图模式） */}
                  {renderSummaryChargeItems()}

                  {/* 费用明细审核表（全宽） */}
                  {renderItemAuditsTable()}
                </>
              );
            })()}

            {/* 发票原图预览 — 始终显示（即使审核失败，也能查看上传的图片） */}
            {previewUrls.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  发票原图{previewUrls.length > 1 ? ` (${previewUrls.length} 张)` : ''}
                </h3>
                {previewUrls.length === 1 ? (
                  <div
                    className="max-h-[400px] overflow-hidden rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => { setActivePreviewIndex(0); setShowImagePreview(true); }}
                  >
                    <img src={previewUrls[0]} alt="发票原图" className="w-full object-contain" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {previewUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-[#4f46e5] transition-all"
                        onClick={() => { setActivePreviewIndex(idx); setShowImagePreview(true); }}
                      >
                        <img src={url} alt={`发票 ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-1 left-1 w-6 h-6 bg-[#4f46e5] text-white rounded-full flex items-center justify-center text-xs font-bold shadow">
                          {idx + 1}
                        </span>
                        {/* 多图模式下显示文档类型标签 */}
                        {auditResult?.imageOcrResults?.[idx] && (
                          <span className={`absolute bottom-1 left-1 right-1 text-center text-[10px] font-medium py-0.5 rounded ${
                            auditResult.imageOcrResults[idx].documentType === 'summary_invoice'
                              ? 'bg-blue-500/80 text-white'
                              : auditResult.imageOcrResults[idx].documentType === 'detail_list'
                                ? 'bg-green-500/80 text-white'
                                : 'bg-gray-500/80 text-white'
                          }`}>
                            {auditResult.imageOcrResults[idx].documentType === 'summary_invoice' ? '汇总发票' :
                             auditResult.imageOcrResults[idx].documentType === 'detail_list' ? '明细清单' : '完整发票'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2 text-center">点击图片放大查看</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 弹窗 */}
      {renderHistoryModal()}
      {renderImagePreviewModal()}
      {renderAiLogModal()}
      {renderStepLogModal()}
    </div>
  );
};

export default InvoiceAuditPage;
