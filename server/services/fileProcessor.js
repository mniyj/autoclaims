/**
 * 统一文件处理服务
 * 整合图片 OCR、PDF/Word/Excel 解析、视频处理等能力
 */

import { parseDocument } from './documentParser.js';
import { processVideo, extractKeyFrames } from './videoProcessor.js';
import { invokeAICapability } from './aiRuntime.js';
import { normalizeImageBufferForOcr } from './imageNormalization.js';

const GLM_OCR_URL = 'https://open.bigmodel.cn/api/paas/v4/layout_parsing';
const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8866/predict/ocr_system';

// 文件类型分类映射
const FILE_TYPE_MAPPINGS = {
  // 图片类型
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',

  // PDF
  'application/pdf': 'pdf',

  // Word
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',

  // Excel
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',

  // 视频
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/webm': 'video',
  'video/x-matroska': 'video',

  // 文本
  'text/plain': 'text',
  'text/csv': 'csv',
  'text/html': 'html',
};

/**
 * 获取文件类型分类
 * @param {string} mimeType - MIME 类型
 * @param {string} fileName - 文件名（用于扩展名判断）
 * @returns {string} 文件类型分类
 */
export function getFileCategory(mimeType, fileName = '') {
  const safeMimeType = mimeType || '';
  
  // 先根据 MIME 类型判断
  if (FILE_TYPE_MAPPINGS[safeMimeType]) {
    return FILE_TYPE_MAPPINGS[safeMimeType];
  }

  // 根据 MIME 类型前缀判断
  if (safeMimeType.startsWith('image/')) return 'image';
  if (safeMimeType.startsWith('video/')) return 'video';
  if (safeMimeType.startsWith('text/')) return 'text';

  // 根据文件扩展名判断
  const ext = fileName.split('.').pop()?.toLowerCase();
  const extMappings = {
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
    pdf: 'pdf',
    doc: 'word', docx: 'word',
    xls: 'excel', xlsx: 'excel',
    mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
    txt: 'text', csv: 'csv', html: 'html',
  };

  return extMappings[ext] || 'other';
}

/**
 * 推断文件的具体用途类型（发票、报告、身份证等）
 * @param {string} fileName - 文件名
 * @param {object} context - 上下文信息
 * @returns {string} 具体用途类型
 */
export function inferDocumentType(fileName, context = {}) {
  const lowerName = fileName.toLowerCase();

  // 发票相关
  if (lowerName.includes('发票') || lowerName.includes('invoice') || lowerName.includes('收据')) {
    return 'image_invoice';
  }

  // 检查报告
  if (lowerName.includes('报告') || lowerName.includes('report') ||
      lowerName.includes('化验') || lowerName.includes('检查') ||
      lowerName.includes('诊断') || lowerName.includes('diagnosis')) {
    return 'image_report';
  }

  // 身份证件
  if (lowerName.includes('身份证') || lowerName.includes('id') ||
      lowerName.includes('证件') || lowerName.includes('护照')) {
    return 'image_id';
  }

  // 现场照片/视频
  if (lowerName.includes('现场') || lowerName.includes('scene') ||
      lowerName.includes('事故') || lowerName.includes('accident')) {
    return lowerName.includes('video') || lowerName.includes('.mp4') ? 'video_scene' : 'image_scene';
  }

  // 费用清单
  if (lowerName.includes('费用') || lowerName.includes('清单') ||
      lowerName.includes('expense') || lowerName.includes('list')) {
    return 'excel_expense';
  }

  // 条款文件
  if (lowerName.includes('条款') || lowerName.includes('clause') ||
      lowerName.includes('合同') || lowerName.includes('contract')) {
    return 'pdf_clause';
  }

  // 根据上下文提示
  if (context.materialType) {
    return context.materialType;
  }

  // 默认
  return 'other';
}

// ============================================================================
// 图片处理（集成现有 OCR）
// ============================================================================

/**
 * 使用 Gemini Vision 处理图片
 * @param {string} base64Data - Base64 图片数据
 * @param {string} mimeType - MIME 类型
 * @param {string} prompt - AI 提示词
 * @param {object} options - 选项
 * @returns {Promise<object>}
 */
export async function processImageWithAI(base64Data, mimeType, prompt, options = {}) {
  let effectiveBase64Data = base64Data;
  let effectiveMimeType = mimeType;

  if (options.fileBuffer) {
    try {
      const normalizedImage = await normalizeImageBufferForOcr(
        options.fileBuffer,
        mimeType,
        options.fileName || 'image.jpg',
      );
      if (normalizedImage.wasAutoRotated) {
        effectiveBase64Data = normalizedImage.buffer.toString('base64');
        effectiveMimeType = normalizedImage.mimeType || mimeType;
      }
    } catch (normalizationError) {
      console.warn(
        '[fileProcessor] image auto-rotation failed:',
        normalizationError?.message || normalizationError,
      );
    }
  }

  const fallbackOrder = Array.isArray(options.ocrFallbackProviders)
    ? options.ocrFallbackProviders
    : String(process.env.IMAGE_OCR_FALLBACKS || 'glm-ocr,paddle-ocr')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  try {
    const { response } = await invokeAICapability({
      capabilityId: 'admin.material.general_analysis',
      request: {
        contents: {
          parts: [
            { inlineData: { mimeType: effectiveMimeType, data: effectiveBase64Data } },
            { text: prompt || '请识别并提取图片中的所有文字信息，以纯文本格式返回。' }
          ]
        },
        config: {
          responseMimeType: 'text/plain',
          temperature: options.temperature || 0.1
        }
      },
      meta: {
        sourceApp: 'admin-system',
        module: 'fileProcessor.processImageWithAI',
        operation: 'process_image_with_ai',
        context: {
          ...(options.logContext || {}),
          mimeType: effectiveMimeType,
          promptType: options.promptType || 'default',
        },
      },
    });

    const extractedText = response.text || '';
    
    // 尝试解析为结构化数据（如果返回的是JSON）
    let structuredData = {};
    try {
      if (extractedText.trim().startsWith('{')) {
        structuredData = JSON.parse(extractedText);
      }
    } catch {
      // 不是JSON格式，保持为空对象
    }

    return {
      success: true,
      text: extractedText,
      structuredData,
      usageMetadata: response.usageMetadata,
      provider: 'gemini-vision',
    };
  } catch (error) {
    const geminiError = error?.message || String(error);

    for (const providerId of fallbackOrder) {
      try {
        if (providerId === 'glm-ocr') {
          const text = await processImageWithGlmOcr(effectiveBase64Data, effectiveMimeType);
          return {
            success: true,
            text,
            structuredData: {},
            provider: 'glm-ocr',
            fallbackFrom: 'gemini-vision',
            fallbackReason: geminiError,
          };
        }

        if (providerId === 'paddle-ocr') {
          const text = await processImageWithPaddleOcr(effectiveBase64Data, effectiveMimeType);
          return {
            success: true,
            text,
            structuredData: {},
            provider: 'paddle-ocr',
            fallbackFrom: 'gemini-vision',
            fallbackReason: geminiError,
          };
        }
      } catch (fallbackError) {
        console.warn(`[fileProcessor] OCR fallback ${providerId} failed:`, fallbackError?.message || fallbackError);
      }
    }

    return {
      success: false,
      text: '',
      structuredData: {},
      error: geminiError,
      provider: 'gemini-vision',
    };
  }
}

async function processImageWithGlmOcr(base64Data, mimeType) {
  const apiKey = process.env.GLM_OCR_API_KEY || process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('GLM OCR API Key not found');
  }

  const response = await fetch(GLM_OCR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-ocr',
      file: `data:${mimeType};base64,${base64Data}`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM OCR Failed: ${errorText}`);
  }

  const data = await response.json();
  return data?.md_results || '';
}

async function processImageWithPaddleOcr(base64Data, mimeType) {
  const response = await fetch(PADDLE_OCR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: [`data:${mimeType};base64,${base64Data}`],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Paddle OCR Failed: ${errorText}`);
  }

  const data = await response.json();
  return (data?.results?.[0]?.data || [])
    .map((item) => item?.text)
    .filter(Boolean)
    .join('\n');
}

// ============================================================================
// 统一文件处理入口
// ============================================================================

/**
 * 处理单个文件
 * @param {object} params - 处理参数
 * @param {string} params.ossKey - OSS 存储路径
 * @param {string} params.ossUrl - OSS 访问 URL
 * @param {string} params.fileName - 原始文件名
 * @param {string} params.mimeType - MIME 类型
 * @param {Buffer} params.buffer - 文件 Buffer（可选，用于直接处理）
 * @param {object} params.options - 处理选项
 * @returns {Promise<object>} ParsedDocument
 */
export async function processFile(params) {
  const { ossKey, ossUrl, fileName, mimeType, buffer, options = {} } = params;
  const startTime = Date.now();
  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const category = getFileCategory(mimeType, fileName);
  const documentType = options.documentType || inferDocumentType(fileName, options.context);
  const baseLogContext = {
    ...(options.logContext || {}),
    ...(options.context || {}),
    fileName,
    documentId,
  };

  // 初始化结果
  const result = {
    documentId,
    fileName,
    fileType: documentType,
    mimeType,
    ossKey,
    ossUrl,
    parseStatus: 'processing',
    confidence: 0,
  };

  try {
    switch (category) {
      case 'image':
        // 图片处理 - 使用 AI OCR
        if (options.skipOCR) {
          result.extractedText = '';
          result.parseStatus = 'completed';
          result.confidence = 100;
        } else if (options.base64Data || buffer) {
          // Offline import may provide OSS-downloaded buffer instead of base64Data.
          // Convert to base64 here to keep both call paths compatible.
          const imageBase64 = options.base64Data || buffer.toString('base64');
          const imageResult = await processImageWithAI(
            imageBase64,
            mimeType,
            options.prompt,
            {
              ...options,
              fileBuffer: buffer || (options.base64Data ? Buffer.from(options.base64Data, 'base64') : null),
              fileName,
              logContext: baseLogContext,
            }
          );
          result.extractedText = imageResult.text;
          result.structuredData = imageResult.structuredData;
          result.ocrData = imageResult.structuredData;
          result.parseStatus = imageResult.success ? 'completed' : 'failed';
          result.confidence = imageResult.success ? 85 : 0;
          if (imageResult.error) result.errorMessage = imageResult.error;
        } else {
          result.parseStatus = 'failed';
          result.errorMessage = 'Image processing requires base64Data';
        }
        break;

      case 'pdf':
        // PDF 处理
        if (buffer) {
          const pdfResult = await parseDocument(buffer, mimeType, options);
          result.extractedText = pdfResult.text;
          result.structuredData = pdfResult.structuredData;
          result.pdfMetadata = {
            pageCount: pdfResult.structuredData.pages,
            hasText: !!pdfResult.text,
          };
          result.parseStatus = pdfResult.success ? 'completed' : 'failed';
          result.confidence = pdfResult.success ? 80 : 0;
          if (pdfResult.error) result.errorMessage = pdfResult.error;
        } else {
          result.parseStatus = 'failed';
          result.errorMessage = 'PDF processing requires buffer';
        }
        break;

      case 'word':
        // Word 处理
        if (buffer) {
          const wordResult = await parseDocument(buffer, mimeType, options);
          result.extractedText = wordResult.text;
          result.structuredData = wordResult.structuredData;
          result.parseStatus = wordResult.success ? 'completed' : 'failed';
          result.confidence = wordResult.success ? 75 : 0;
          if (wordResult.error) result.errorMessage = wordResult.error;
        } else {
          result.parseStatus = 'failed';
          result.errorMessage = 'Word processing requires buffer';
        }
        break;

      case 'excel':
        // Excel 处理
        if (buffer) {
          const excelResult = await parseDocument(buffer, mimeType, options);
          result.extractedText = '';
          result.structuredData = excelResult.structuredData;
          result.parseStatus = excelResult.success ? 'completed' : 'failed';
          result.confidence = excelResult.success ? 90 : 0;
          if (excelResult.error) result.errorMessage = excelResult.error;
        } else {
          result.parseStatus = 'failed';
          result.errorMessage = 'Excel processing requires buffer';
        }
        break;

      case 'video':
        // 视频处理
        if (options.skipVideo) {
          result.parseStatus = 'completed';
          result.confidence = 100;
        } else if (buffer || options.videoPath) {
          try {
            const videoResult = await processVideo({
              buffer,
              videoPath: options.videoPath,
              ossKey,
              options: {
                maxFrames: options.maxFrames || 10,
                extractAudio: options.extractAudio !== false,
              }
            });
            result.videoMetadata = videoResult.metadata;
            result.extractedText = videoResult.audioTranscript || '';
            result.parseStatus = videoResult.success ? 'completed' : 'failed';
            result.confidence = videoResult.success ? 70 : 0;
            if (videoResult.error) result.errorMessage = videoResult.error;
          } catch (videoError) {
            // 视频处理器可能未安装
            result.parseStatus = 'completed';
            result.confidence = 50;
            result.errorMessage = `Video processing skipped: ${videoError.message}`;
          }
        } else {
          result.parseStatus = 'failed';
          result.errorMessage = 'Video processing requires buffer or videoPath';
        }
        break;

      case 'text':
      case 'csv':
        // 文本文件直接读取
        if (buffer) {
          result.extractedText = buffer.toString('utf-8');
          result.parseStatus = 'completed';
          result.confidence = 100;
        } else {
          result.parseStatus = 'failed';
          result.errorMessage = 'Text processing requires buffer';
        }
        break;

      default:
        result.parseStatus = 'failed';
        result.errorMessage = `Unsupported file category: ${category}`;
    }

    // AI 分析（如果启用且解析成功）
    if (!options.skipAI && result.parseStatus === 'completed' && result.extractedText) {
      const aiAnalysis = await analyzeDocumentContent(result, {
        ...options,
        logContext: {
          ...baseLogContext,
          fileType: documentType,
        },
      });
      if (aiAnalysis) {
        result.aiAnalysis = aiAnalysis;
        result.confidence = Math.max(result.confidence, aiAnalysis.confidence);
      }
    }

  } catch (error) {
    result.parseStatus = 'failed';
    result.errorMessage = error.message;
    console.error(`[fileProcessor] Error processing file ${fileName}:`, error);
  }

  result.parseTime = new Date().toISOString();
  result.parseDuration = Date.now() - startTime;

  return result;
}

/**
 * 使用 AI 分析文档内容
 * @param {object} document - 解析后的文档
 * @param {object} options - 分析选项
 * @returns {Promise<object>}
 */
async function analyzeDocumentContent(document, options = {}) {
  const text = document.extractedText || '';
  const fileType = document.fileType;

  // 根据文件类型选择分析策略
  const analysisPrompts = {
    image_invoice: `分析以下医疗发票内容，提取关键信息：
- 患者姓名
- 医院名称
- 就诊日期
- 诊断结果
- 费用总额
- 是否有异常（重复收费、价格异常等）

内容：
${text}`,

    image_report: `分析以下检查报告内容，提取关键信息：
- 检查类型
- 检查日期
- 检查结果
- 是否有异常指标

内容：
${text}`,

    image_id: `验证身份证件信息：
- 证件类型
- 姓名
- 证件号码格式是否正确

内容：
${text}`,

    default: `分析以下文档内容，提取关键信息并判断文档类型：
${text?.substring(0, 2000)}`
  };

  const prompt = analysisPrompts[fileType] || analysisPrompts.default;

  try {
    const { response } = await invokeAICapability({
      capabilityId: 'admin.material.general_analysis',
      request: {
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      },
      meta: {
        sourceApp: 'admin-system',
        module: 'fileProcessor.analyzeDocumentContent',
        operation: 'analyze_document_content',
        context: {
          ...(options.logContext || {}),
          documentId: document.documentId,
          fileType,
          fileName: document.fileName,
        },
      },
    });

    const analysisText = response.text || '';
    return {
      documentType: fileType,
      confidence: 75,
      extractedFields: analysisText ? JSON.parse(analysisText) : {},
      summary: `文档分析完成`,
      warnings: [],
      anomalies: [],
    };
  } catch (error) {
    console.error('[fileProcessor] AI analysis error:', error);
    return null;
  }
}

/**
 * 批量处理文件
 * @param {Array} files - 文件列表
 * @param {object} options - 处理选项
 * @returns {Promise<Array>}
 */
export async function processFiles(files, options = {}) {
  const results = [];
  const concurrency = options.concurrency || 3;

  // 分批并发处理
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(file => processFile({ ...file, options }))
    );
    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// 导出
// ============================================================================

export default {
  getFileCategory,
  inferDocumentType,
  processImageWithAI,
  processFile,
  processFiles,
};
