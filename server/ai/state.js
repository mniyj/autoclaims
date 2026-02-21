/**
 * LangGraph 状态定义和类型
 * 使用 LangGraph Annotation 定义理赔审核状态结构
 *
 * 增强版本：支持多文件处理、材料完整性检查、多级人工介入
 */

import { Annotation } from '@langchain/langgraph';

/**
 * 理赔审核状态 Schema
 * 使用 LangGraph Annotation 定义结构化状态
 */
export const ClaimState = Annotation.Root({
  // ============================================================================
  // 基础输入参数
  // ============================================================================

  claimCaseId: Annotation({
    default: () => null,
    reducer: (prev, next) => next ?? prev,
  }),

  productCode: Annotation({
    default: () => null,
    reducer: (prev, next) => next ?? prev,
  }),

  ocrData: Annotation({
    default: () => ({}),
    reducer: (prev, next) => next ?? prev,
  }),

  invoiceItems: Annotation({
    default: () => [],
    reducer: (prev, next) => next ?? prev,
  }),

  // ============================================================================
  // 多文件处理 (新增)
  // ============================================================================

  /** 原始文档列表（上传的文件信息） */
  documents: Annotation({
    default: () => [],
    reducer: (prev, next) => next ?? prev,
  }),

  /** 解析后的文档列表（包含 OCR/分析结果） */
  parsedDocuments: Annotation({
    default: () => [],
    reducer: (prev, next) => next ?? prev,
  }),

  /** 交叉验证结果 */
  crossValidationResults: Annotation({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),

  // ============================================================================
  // 材料完整性检查 (新增)
  // ============================================================================

  /** 材料完整性检查结果 */
  documentCompleteness: Annotation({
    default: () => null,
    reducer: (prev, next) => next ?? prev,
  }),

  /** 缺失的材料列表 */
  missingDocuments: Annotation({
    default: () => [],
    reducer: (prev, next) => next ?? prev,
  }),

  /** 完整度评分 (0-100) */
  completenessScore: Annotation({
    default: () => 0,
    reducer: (prev, next) => next ?? prev,
  }),

  // ============================================================================
  // 执行结果
  // ============================================================================

  eligibility: Annotation({
    default: () => null,
    reducer: (prev, next) => next ?? prev,
  }),

  calculation: Annotation({
    default: () => null,
    reducer: (prev, next) => next ?? prev,
  }),

  riskLevel: Annotation({
    default: () => null,
    reducer: (prev, next) => next ?? prev,
  }),

  decision: Annotation({
    default: () => 'MANUAL_REVIEW',
    reducer: (prev, next) => next ?? prev,
  }),

  reasoning: Annotation({
    default: () => '',
    reducer: (prev, next) => next ?? prev,
  }),

  // ============================================================================
  // 规则追踪
  // ============================================================================

  ruleTrace: Annotation({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),

  // ============================================================================
  // 消息历史（用于 LLM 交互）
  // ============================================================================

  messages: Annotation({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),

  // ============================================================================
  // 人工介入点 (新增)
  // ============================================================================

  /** 人工介入点列表 */
  interventionPoints: Annotation({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),

  /** 当前介入点索引 */
  currentInterventionIndex: Annotation({
    default: () => 0,
    reducer: (prev, next) => next ?? prev,
  }),

  /** 是否需要请求补充材料 */
  needsMoreDocuments: Annotation({
    default: () => false,
    reducer: (prev, next) => next ?? prev,
  }),

  /** 请求补充的材料列表 */
  requestedDocuments: Annotation({
    default: () => [],
    reducer: (prev, next) => next ?? prev,
  }),

  // ============================================================================
  // 人工审核相关
  // ============================================================================

  humanReviewRequired: Annotation({
    default: () => false,
    reducer: (prev, next) => next ?? prev,
  }),

  humanReviewResult: Annotation({
    default: () => null,
    reducer: (prev, next) => next ?? prev,
  }),

  /** 人工审核级别 (1-4) */
  humanReviewLevel: Annotation({
    default: () => 1,
    reducer: (prev, next) => next ?? prev,
  }),

  // ============================================================================
  // 调试信息
  // ============================================================================

  debug: Annotation({
    default: () => ({
      nodeExecutions: [],
      startTime: Date.now(),
    }),
    reducer: (prev, next) => ({ ...prev, ...next }),
  }),
});
