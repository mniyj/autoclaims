/**
 * 意图工具执行器
 * 实现各个意图对应的具体业务逻辑
 */

import {
  IntentType,
  IntentEntities,
  ToolResponse,
  ClaimState,
  ClaimStatus,
  UIComponentType,
  ClaimProgressInfo,
  MaterialsListInfo,
  MissingMaterialsInfo,
  PremiumImpactInfo,
  SettlementEstimateInfo,
  SettlementDetailInfo,
  PolicyInfoData,
  ClaimHistoryInfo,
  PaymentStatusInfo,
  CoverageInfo,
  Policy,
  MaterialItem,
  ClaimEvent
} from "./types";
import { materialConfigService } from "./services/materialConfigService";
import { settlementConfigService } from "./services/settlementConfigService";
import {
  resolveClaimSelection,
  resolveClaimTypeAndProductCode as resolveSharedClaimTypeAndProductCode,
} from "../shared/claimRouting";
import {
  ClaimOrchestratorContext,
  type ClaimOrchestratorState,
  continueClaimFieldCollection,
  continueClaimSubmission,
  createClaimOrchestratorTools,
  isClaimOrchestratorIntent,
  routeClaimIntent,
} from "./claimOrchestrator";

/** 工具函数类型 */
type ToolHandler = (
  entities: IntentEntities,
  claimState: ClaimState
) => Promise<ToolResponse> | ToolResponse;

/** 工具注册表 */
const TOOL_REGISTRY: Record<IntentType, ToolHandler> = {
  // ---- 报案类 ----
  [IntentType.REPORT_NEW_CLAIM]: handleUnimplemented,
  [IntentType.RESUME_CLAIM_REPORT]: handleUnimplemented,
  [IntentType.MODIFY_CLAIM_REPORT]: handleUnimplemented,
  [IntentType.CANCEL_CLAIM]: handleUnimplemented,

  // ---- 材料上传类 ----
  [IntentType.UPLOAD_DOCUMENT]: handleUnimplemented,
  [IntentType.SUPPLEMENT_DOCUMENT]: handleUnimplemented,
  [IntentType.VIEW_UPLOADED_DOCUMENTS]: handleUnimplemented,
  [IntentType.REPLACE_DOCUMENT]: handleUnimplemented,

  // ---- 查询类 ----
  [IntentType.QUERY_PROGRESS]: handleQueryProgress,
  [IntentType.QUERY_MATERIALS_LIST]: handleQueryMaterialsList,
  [IntentType.QUERY_MISSING_MATERIALS]: handleQueryMissingMaterials,
  [IntentType.QUERY_PREMIUM_IMPACT]: handleQueryPremiumImpact,
  [IntentType.QUERY_SETTLEMENT_AMOUNT]: handleQuerySettlementAmount,
  [IntentType.QUERY_SETTLEMENT_DETAIL]: handleQuerySettlementDetail,
  [IntentType.QUERY_POLICY_INFO]: handleQueryPolicyInfo,
  [IntentType.QUERY_CLAIM_HISTORY]: handleQueryClaimHistory,
  [IntentType.QUERY_PAYMENT_STATUS]: handleQueryPaymentStatus,

  // ---- 协助类 ----
  [IntentType.GUIDE_CLAIM_PROCESS]: handleUnimplemented,
  [IntentType.GUIDE_DOCUMENT_PHOTO]: handleUnimplemented,
  [IntentType.QUERY_CLAIM_TIMELINE]: handleUnimplemented,
  [IntentType.QUERY_COVERAGE]: handleQueryCoverage,
  [IntentType.QUERY_FAQ]: handleUnimplemented,

  // ---- 沟通类 ----
  [IntentType.TRANSFER_TO_AGENT]: handleUnimplemented,
  [IntentType.FILE_COMPLAINT]: handleUnimplemented,
  [IntentType.EXPEDITE_CLAIM]: handleUnimplemented,
  [IntentType.LEAVE_MESSAGE]: handleUnimplemented,

  // ---- 操作类 ----
  [IntentType.UPDATE_BANK_INFO]: handleUnimplemented,
  [IntentType.CONFIRM_SETTLEMENT]: handleUnimplemented,
  [IntentType.REJECT_SETTLEMENT]: handleUnimplemented,
  [IntentType.SIGN_AGREEMENT]: handleUnimplemented,

  // ---- 兜底类 ----
  [IntentType.GENERAL_CHAT]: handleGeneralChat,
  [IntentType.UNCLEAR_INTENT]: handleGeneralChat,
  [IntentType.OUT_OF_SCOPE]: handleUnimplemented
};

const claimOrchestratorTools = createClaimOrchestratorTools();

function hydrateClaimOrchestratorContext(claimState: ClaimState): ClaimOrchestratorContext {
  const context = new ClaimOrchestratorContext(claimState.claimant);
  const snapshot = claimState.claimOrchestrator;
  if (!snapshot) {
    return context;
  }

  context.setState(snapshot.state as ClaimOrchestratorState);
  context.setAvailablePolicies(snapshot.availablePolicies || []);
  context.setSelectedPolicy(snapshot.selectedPolicy || null);
  context.setIntakeConfig(snapshot.intakeConfig || null);
  Object.entries(snapshot.collectedFields || {}).forEach(([fieldId, value]) => {
    context.updateField(fieldId, value);
  });
  context.setPendingFieldId(snapshot.pendingFieldId || null);
  if (snapshot.lastResponse) {
    context.setLastResponse(snapshot.lastResponse);
  }
  return context;
}

function buildClaimStatePatch(
  claimState: ClaimState,
  context: ClaimOrchestratorContext,
  options?: {
    submittedClaim?: {
      claimId: string;
      productCode?: string;
      productName?: string;
      reason?: string;
    };
  },
): Partial<ClaimState> {
  const snapshot = context.getSnapshot();
  const historicalClaims = [...(claimState.historicalClaims || [])];
  const hasDraftState =
    snapshot.availablePolicies.length > 0 ||
    Boolean(snapshot.selectedPolicy) ||
    Boolean(snapshot.intakeConfig) ||
    Object.keys(snapshot.collectedFields).length > 0;

  if (options?.submittedClaim) {
    historicalClaims.unshift({
      id: options.submittedClaim.claimId,
      date: new Date().toISOString().split("T")[0],
      type:
        options.submittedClaim.productName ||
        options.submittedClaim.productCode ||
        snapshot.selectedPolicy?.type ||
        "新报案",
      status: ClaimStatus.REPORTING,
      incidentReason: options.submittedClaim.reason,
      timeline: [
        {
          date: new Date().toLocaleString(),
          label: "报案登记",
          description: "用户通过索赔人端语音管家提交报案",
          status: "completed",
        },
      ],
    });
  }

  return {
    ...claimState,
    claimOrchestrator: snapshot,
    selectedPolicyId: hasDraftState
      ? snapshot.selectedPolicy?.id || claimState.selectedPolicyId
      : undefined,
    historicalClaims,
    requiredDocs:
      hasDraftState && snapshot.intakeConfig
        ? snapshot.intakeConfig.fields.map((field) => ({
            name: field.label,
            description: field.placeholder || field.label,
            received: field.field_id in snapshot.collectedFields,
          }))
        : [],
    reportInfo: hasDraftState
      ? {
          ...claimState.reportInfo,
          ...snapshot.collectedFields,
          policyNumber:
            snapshot.selectedPolicy?.id || claimState.reportInfo.policyNumber,
        }
      : {},
  };
}

export async function executeClaimOrchestratorSelection(
  policyIndex: number,
  claimState: ClaimState,
): Promise<ToolResponse> {
  const context = hydrateClaimOrchestratorContext(claimState);
  const result = await continueClaimSubmission(
    context,
    claimOrchestratorTools,
    policyIndex,
  );

  return {
    success: result.success,
    data: {
      claimStatePatch: buildClaimStatePatch(claimState, context),
    },
    message: result.message,
  };
}

export async function continueClaimOrchestratorWithText(
  userInput: string,
  claimState: ClaimState,
): Promise<ToolResponse> {
  const context = hydrateClaimOrchestratorContext(claimState);

  if (context.getState() === "CONFIRMING_SUBMISSION") {
    const result = await continueClaimSubmission(context, claimOrchestratorTools);
    const submittedClaim =
      result.data &&
      typeof result.data === "object" &&
      "toolResponse" in result.data &&
      (result.data.toolResponse as any)?.data?.claimId
        ? {
            claimId: (result.data.toolResponse as any).data.claimId as string,
            productCode: (result.data.toolResponse as any).data.payload?.productCode,
            reason:
              (result.data.toolResponse as any).data.payload?.fieldData?.accident_reason ||
              (result.data.toolResponse as any).data.payload?.fieldData?.accidentReason,
          }
        : undefined;
    return {
      success: result.success,
      data: {
        claimStatePatch: buildClaimStatePatch(claimState, context, {
          submittedClaim,
        }),
        submittedClaim,
        toolResult: result.data,
      },
      message: result.message,
    };
  }

  const result = await continueClaimFieldCollection(context, {
    rawValue: userInput,
  });

  return {
    success: result.success,
    data: {
      claimStatePatch: buildClaimStatePatch(claimState, context),
    },
    message: result.message,
  };
}

export async function cancelActiveClaimOrchestrator(
  claimState: ClaimState,
): Promise<ToolResponse> {
  const context = hydrateClaimOrchestratorContext(claimState);
  const result = await routeClaimIntent(
    IntentType.CANCEL_CLAIM,
    {},
    context,
    claimOrchestratorTools,
  );

  return {
    success: result?.success ?? false,
    data: {
      claimStatePatch: buildClaimStatePatch(claimState, context),
    },
    message: result?.message || "已取消当前报案流程。",
  };
}

/**
 * 执行工具
 * @param intent 意图类型
 * @param entities 实体参数
 * @param claimState 当前理赔状态
 * @returns 工具执行结果
 */
export async function executeTool(
  intent: IntentType,
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  if (isClaimOrchestratorIntent(intent)) {
    const context = hydrateClaimOrchestratorContext(claimState);
    const result = await routeClaimIntent(
      intent,
      entities,
      context,
      claimOrchestratorTools,
    );

    if (result) {
      return {
        success: result.success,
        data: {
          ...(result.data || {}),
          claimStatePatch: buildClaimStatePatch(claimState, context),
        },
        message: result.message,
      };
    }
  }

  const handler = TOOL_REGISTRY[intent];
  if (!handler) {
    return {
      success: false,
      data: null,
      message: "抱歉，我暂时无法处理这个请求。",
      uiComponent: undefined
    };
  }

  try {
    return await handler(entities, claimState);
  } catch (error) {
    console.error(`[Tool Execution Error] ${intent}:`, error);
    return {
      success: false,
      data: null,
      message: "处理请求时出现错误，请稍后重试或联系人工客服。",
      uiComponent: undefined
    };
  }
}

// ============================================================================
// 工具实现
// ============================================================================

function getClaimProductCode(claim: ClaimState["historicalClaims"] extends Array<infer T> ? T : never): string | undefined {
  const productCode = (claim as { productCode?: string }).productCode;
  return typeof productCode === "string" && productCode ? productCode : undefined;
}

function resolveTargetClaim(
  entities: IntentEntities,
  claimState: ClaimState,
): ReturnType<typeof resolveClaimSelection<NonNullable<ClaimState["historicalClaims"]>[number]>> {
  return resolveClaimSelection(claimState.historicalClaims || [], entities.claimId);
}

function buildClaimSelectionResponse(
  intent: IntentType,
  claims: NonNullable<ClaimState["historicalClaims"]>,
  message: string,
): ToolResponse {
  return {
    success: false,
    data: { claims },
    message,
    uiComponent: UIComponentType.CLAIM_SELECTION,
    uiData: {
      intent,
      claims,
    },
  };
}

function buildNoClaimResponse(message: string): ToolResponse {
  return {
    success: false,
    data: null,
    message,
    uiComponent: undefined,
  };
}

function resolveClaimContext(
  intent: IntentType,
  entities: IntentEntities,
  claimState: ClaimState,
  missingMessage: string,
  selectionMessage: string,
): { claim?: NonNullable<ClaimState["historicalClaims"]>[number]; response?: ToolResponse } {
  const resolution = resolveTargetClaim(entities, claimState);
  if (resolution.kind === "resolved") {
    return { claim: resolution.claim };
  }
  if (resolution.kind === "missing") {
    return { response: buildNoClaimResponse(missingMessage) };
  }
  return {
    response: buildClaimSelectionResponse(intent, resolution.claims, selectionMessage),
  };
}

function resolveClaimTypeAndProductCode(
  entities: IntentEntities,
  claimState: ClaimState,
  claim?: NonNullable<ClaimState["historicalClaims"]>[number],
): { claimType: string; productCode?: string } {
  return resolveSharedClaimTypeAndProductCode({
    explicitClaimType: entities.claimType,
    explicitProductCode: entities.productCode || (claim ? getClaimProductCode(claim) : undefined),
    claim,
    fallbackClaimType: claimState.incidentType || getIncidentTypeFromState(claimState),
  });
}

function extractUploadedDocuments(claim: NonNullable<ClaimState["historicalClaims"]>[number]) {
  const docsFromDocuments = (claim.documents || []).map((doc) => ({
    id: doc.id,
    category: doc.category,
    name: doc.name,
  }));
  const docsFromCategories = (claim.fileCategories || []).flatMap((category) =>
    category.files.map((file) => ({
      id: undefined,
      category: category.name,
      name: file.name,
    })),
  );
  const docsFromMaterialUploads = (claim.materialUploads || []).flatMap((upload) =>
    upload.files.map((file) => ({
      id: upload.materialId,
      category: upload.materialName,
      name: file.name,
    })),
  );

  return [...docsFromDocuments, ...docsFromCategories, ...docsFromMaterialUploads];
}

async function fetchPolicies(): Promise<Policy[]> {
  const response = await fetch("/api/policies");
  if (!response.ok) {
    throw new Error("Failed to load policies");
  }
  const rawPolicies = await response.json();
  const policies = Array.isArray(rawPolicies) ? rawPolicies : [];
  return policies
    .map((policy: any) => ({
      id: policy.policyNumber || policy.id || "",
      policyholderName: policy.policyholder?.name || policy.policyholderName || "",
      insuredName:
        policy.insureds?.[0]?.name || policy.insuredName || policy.policyholder?.name || "",
      type: policy.productName || policy.productCode || "未知险种",
      validFrom: policy.effectiveDate || policy.issueDate || "",
      validUntil: policy.expiryDate || "",
      productCode: policy.productCode || "",
    }))
    .filter((policy: Policy) => Boolean(policy.id));
}

async function fetchProduct(productCode?: string): Promise<any | null> {
  if (!productCode) return null;
  const response = await fetch(`/api/products/${encodeURIComponent(productCode)}`);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function formatClaimStatusLabel(status: ClaimStatus): string {
  return getStatusLabel(status);
}

/**
 * 查询理赔进度
 */
async function handleQueryProgress(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const context = resolveClaimContext(
    IntentType.QUERY_PROGRESS,
    entities,
    claimState,
    "您还没有关联的理赔案件。如需查询案件进度，请先报案或关联已有案件。",
    "您有多个理赔案件，请先选择要查询进度的案件。",
  );
  if (context.response) return context.response;
  const targetClaim = context.claim!;

  // 2. 构建进度信息
  const progressInfo: ClaimProgressInfo = {
    claimId: targetClaim.id,
    status: targetClaim.status,
    statusLabel: getStatusLabel(targetClaim.status),
    progress: calculateProgress(targetClaim.status, targetClaim.timeline),
    currentStage: getCurrentStage(targetClaim.status),
    timeline: targetClaim.timeline || generateDefaultTimeline(targetClaim)
  };

  // 3. 生成回复消息
  const message = generateProgressMessage(progressInfo);

  return {
    success: true,
    data: progressInfo,
    message,
    uiComponent: UIComponentType.CLAIM_PROGRESS,
    uiData: progressInfo,
    suggestedFollowups: [
      "还缺哪些材料",
      "预估能赔多少",
      "理赔大约还要多久",
    ],
  };
}

/**
 * 查询理赔材料清单
 */
async function handleQueryMaterialsList(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  let targetClaim: NonNullable<ClaimState["historicalClaims"]>[number] | undefined;
  if (!entities.claimType && !entities.productCode && (claimState.historicalClaims || []).length > 1) {
    const context = resolveClaimContext(
      IntentType.QUERY_MATERIALS_LIST,
      entities,
      claimState,
      "暂时没有可参考的理赔案件。请告诉我您想咨询的险种，或先发起报案。",
      "您有多个理赔案件，请先选择想查看材料清单的案件，或者直接告诉我险种。",
    );
    if (context.response) return context.response;
    targetClaim = context.claim;
  } else if ((claimState.historicalClaims || []).length === 1) {
    targetClaim = claimState.historicalClaims?.[0];
  }

  const { claimType, productCode } = resolveClaimTypeAndProductCode(
    entities,
    claimState,
    targetClaim,
  );
  const queryResult = await materialConfigService.queryMaterials({
    claimType,
    productCode,
    uploadedDocuments: targetClaim ? extractUploadedDocuments(targetClaim) : undefined,
  });
  const materials = queryResult.materials.map((material) => ({
    id: material.id,
    name: material.name,
    description: material.description,
    required: material.required,
    sampleUrl: material.sampleUrl,
    ossKey: material.ossKey,
    uploaded: material.uploaded,
  }));

  if (!materials || materials.length === 0) {
    return {
      success: false,
      data: null,
      message: `暂时无法获取「${claimType}」的材料清单。建议您联系人工客服获取准确信息。`,
      uiComponent: undefined
    };
  }

  // 3. 构建材料清单信息
  const listInfo: MaterialsListInfo = {
    claimType,
    materials
  };

  // 4. 生成回复消息
  const requiredCount = materials.filter(m => m.required).length;
  const message = `「${claimType}」理赔需要准备以下材料：

📋 **必需材料 (${requiredCount}项)**：
${materials.filter(m => m.required).map(m => `• ${m.name}`).join('\n')}

${materials.some(m => !m.required) ? `
📎 **补充材料 (${materials.filter(m => !m.required).length}项)**：
${materials.filter(m => !m.required).map(m => `• ${m.name}`).join('\n')}
` : ''}

💡 **温馨提示**：材料齐全可以加快审核进度，请您尽量一次性准备完整。`;

  return {
    success: true,
    data: listInfo,
    message,
    uiComponent: UIComponentType.MATERIALS_LIST,
    uiData: listInfo,
    suggestedFollowups: [
      "还缺哪些材料",
      "材料怎么拍才合格",
      "理赔大约能赔多少",
    ],
  };
}

/**
 * 查询缺失材料
 */
async function handleQueryMissingMaterials(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const context = resolveClaimContext(
    IntentType.QUERY_MISSING_MATERIALS,
    entities,
    claimState,
    "您还没有关联的理赔案件。如需查询还缺什么材料，请先报案或关联已有案件。",
    "您有多个理赔案件，请先选择要检查缺失材料的案件。",
  );
  if (context.response) return context.response;
  const targetClaim = context.claim!;

  const { claimType, productCode } = resolveClaimTypeAndProductCode(
    entities,
    claimState,
    targetClaim,
  );
  const materialResult = await materialConfigService.queryMaterials({
    claimType,
    productCode,
    uploadedDocuments: extractUploadedDocuments(targetClaim),
  });
  const missingItems = materialResult.missingMaterials.map((material) => ({
    id: material.id,
    name: material.name,
    description: material.description,
    required: material.required,
    sampleUrl: material.sampleUrl,
    ossKey: material.ossKey,
    uploaded: material.uploaded,
  }));

  // 4. 构建缺失材料信息
  const missingInfo: MissingMaterialsInfo = {
    claimId: targetClaim.id,
    missingItems,
    urgency: calculateUrgency(targetClaim.status, missingItems.length),
    deadline: calculateDeadline(targetClaim)
  };

  // 5. 生成回复消息
  let message: string;
  if (missingItems.length === 0) {
    message = `✅ **好消息！** 案件 **${targetClaim.id}** 的必需材料已齐全，无需再补充。我们会尽快进行审核。`;
  } else {
    message = `案件 **${targetClaim.id}** 还缺以下 ${missingItems.length} 项必需材料：

${missingItems.map((m, i) => `${i + 1}. **${m.name}**\n   ${m.description}`).join('\n\n')}

${missingInfo.deadline ? `⏰ **补交截止**：${missingInfo.deadline}` : ''}

请及时补充，以免影响审核进度。`;
  }

  return {
    success: true,
    data: missingInfo,
    message,
    uiComponent: missingItems.length > 0 ? UIComponentType.MISSING_MATERIALS : undefined,
    uiData: missingInfo,
    suggestedFollowups:
      missingItems.length > 0
        ? [
            `上传${missingItems[0]?.name || "材料"}`,
            "材料怎么拍才合格",
            "查询理赔进度",
          ]
        : [
            "查询理赔进度",
            "预估能赔多少",
            "理赔大约还要多久",
          ],
  };
}

async function handleQuerySettlementAmount(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const resolution = resolveTargetClaim(entities, claimState);
  let targetClaim: NonNullable<ClaimState["historicalClaims"]>[number] | undefined;

  if (resolution.kind === "selection" && !entities.claimType && !entities.productCode) {
    return buildClaimSelectionResponse(
      IntentType.QUERY_SETTLEMENT_AMOUNT,
      resolution.claims,
      "您有多个理赔案件，请先选择要查看赔付预估的案件，或者直接告诉我险种。",
    );
  }
  if (resolution.kind === "resolved") {
    targetClaim = resolution.claim;
  }

  const { claimType, productCode } = resolveClaimTypeAndProductCode(
    entities,
    claimState,
    targetClaim,
  );

  let settlementResult =
    targetClaim?.id && productCode
      ? await settlementConfigService.calculateSettlement(targetClaim.id, productCode)
      : null;

  if (!settlementResult) {
    const baseAmount = targetClaim?.amount || entities.amount || 0;
    settlementResult = await settlementConfigService.estimateSettlement(claimType, {
      approvedExpenses: baseAmount,
      sumInsured: Math.max(baseAmount, 1) * 2,
    });
  }

  if (!settlementResult) {
    return {
      success: false,
      data: null,
      message: `暂时无法生成「${claimType}」的赔付预估，请稍后重试或联系人工客服。`,
      uiComponent: undefined,
    };
  }

  const estimateInfo: SettlementEstimateInfo = {
    claimId: targetClaim?.id || "未绑定案件",
    claimType,
    estimatedAmount: settlementResult.finalAmount,
    breakdown: (settlementResult.steps || []).map((step) => ({
      item: step.name,
      amount: step.output,
      note: step.expression,
    })),
    deductible: 0,
    disclaimer: settlementResult.isEstimate
      ? "当前金额为预估值，最终结果以审核结论为准。"
      : "当前金额基于案件与产品规则计算，最终结果以审核结论为准。",
  };

  return {
    success: true,
    data: estimateInfo,
    message: `${claimType}当前${settlementResult.isEstimate ? "预估" : "计算"}赔付金额约为 ${settlementResult.finalAmount.toLocaleString()} 元。`,
    uiComponent: UIComponentType.SETTLEMENT_ESTIMATE,
    uiData: estimateInfo,
    suggestedFollowups: [
      "赔付明细怎么算的",
      "查询理赔进度",
      "还缺哪些材料",
    ],
  };
}

async function handleQuerySettlementDetail(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const context = resolveClaimContext(
    IntentType.QUERY_SETTLEMENT_DETAIL,
    entities,
    claimState,
    "您还没有关联的理赔案件。如需查询赔付明细，请先报案或关联已有案件。",
    "您有多个理赔案件，请先选择要查看赔付明细的案件。",
  );
  if (context.response) return context.response;
  const targetClaim = context.claim!;

  const { claimType, productCode } = resolveClaimTypeAndProductCode(
    entities,
    claimState,
    targetClaim,
  );
  const settlementResult =
    targetClaim.id && productCode
      ? await settlementConfigService.calculateSettlement(targetClaim.id, productCode)
      : await settlementConfigService.estimateSettlement(claimType, {
          approvedExpenses: targetClaim.amount || 0,
          sumInsured: Math.max(targetClaim.amount || 1, 1) * 2,
        });

  if (!settlementResult) {
    return {
      success: false,
      data: null,
      message: `暂时无法获取案件 ${targetClaim.id} 的赔付明细，请稍后重试。`,
      uiComponent: undefined,
    };
  }

  const detailItems =
    targetClaim.assessment?.items?.map((item) => ({
      name: item.name,
      claimed: item.claimed,
      approved: item.approved,
      deduction: item.deduction,
    })) ||
    (settlementResult.breakdown || []).map((item) => ({
      name: item.category,
      claimed: item.amount,
      approved: item.coveredAmount,
      deduction:
        item.deductible || item.ratio
          ? `免赔额 ${item.deductible || 0}，赔付比例 ${item.ratio || 0}`
          : "按条款计算",
    }));

  const totalClaimed = detailItems.reduce((sum, item) => sum + item.claimed, 0);
  const totalApproved = detailItems.reduce((sum, item) => sum + item.approved, 0);
  const detailInfo: SettlementDetailInfo = {
    claimId: targetClaim.id,
    items: detailItems,
    totalClaimed,
    totalApproved,
    deductible: 0,
    finalAmount: settlementResult.finalAmount,
  };

  return {
    success: true,
    data: detailInfo,
    message: `案件 ${targetClaim.id} 的赔付明细已整理，核定赔付金额约为 ${settlementResult.finalAmount.toLocaleString()} 元。`,
    uiComponent: UIComponentType.SETTLEMENT_DETAIL,
    uiData: detailInfo,
    suggestedFollowups: [
      "打款到账了吗",
      "这个金额为什么这样算",
      "查询理赔进度",
    ],
  };
}

async function handleQueryPolicyInfo(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const policies = await fetchPolicies();
  const targetPolicyId =
    entities.policyId ||
    claimState.selectedPolicyId ||
    claimState.reportInfo.policyNumber;
  const matchedPolicy = targetPolicyId
    ? policies.find((policy) => policy.id === targetPolicyId || policy.id.includes(targetPolicyId))
    : undefined;

  if (!matchedPolicy && policies.length === 0) {
    return buildNoClaimResponse("暂未查询到保单信息，请稍后重试或联系客服。");
  }

  if (!matchedPolicy && policies.length > 1) {
    return {
      success: false,
      data: { policies },
      message: "您有多张保单，请先选择想查询的保单。",
      uiComponent: undefined,
      nextAction: {
        type: "none",
        label: "选择保单",
        data: policies,
      },
    };
  }

  const policy = matchedPolicy || policies[0];
  const product = await fetchProduct(policy.productCode);
  const policyInfo: PolicyInfoData = {
    policyId: policy.id,
    policyholderName: policy.policyholderName,
    insuredName: policy.insuredName,
    productName: product?.marketingName || product?.regulatoryName || policy.type,
    validFrom: policy.validFrom,
    validUntil: policy.validUntil,
    coverages: (product?.responsibilities || [])
      .slice(0, 6)
      .map((item: any) => ({
        name: item.name || item.responsibilityName || "保障责任",
        limit: Number(item.sumInsured || item.limit || 0),
        deductible: item.deductible ? Number(item.deductible) : undefined,
      })),
    status: "生效中",
  };

  return {
    success: true,
    data: policyInfo,
    message:
      `保单 ${policyInfo.policyId} 当前为${policyInfo.status}，产品为「${policyInfo.productName}」，` +
      `被保人 ${policyInfo.insuredName}，保障期限 ${policyInfo.validFrom || "未知"} 至 ${policyInfo.validUntil || "未知"}。`,
    uiComponent: UIComponentType.POLICY_INFO,
    uiData: policyInfo,
    suggestedFollowups: [
      "这张保单都保什么",
      "查看我的理赔历史",
      "我要报案",
    ],
  };
}

function handleQueryClaimHistory(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  const claims = claimState.historicalClaims || [];
  if (claims.length === 0) {
    return buildNoClaimResponse("您当前还没有历史理赔案件。");
  }

  const historyInfo: ClaimHistoryInfo = {
    claims: claims.map((claim) => ({
      id: claim.id,
      date: claim.date,
      type: claim.type,
      status: claim.status,
      amount: claim.amount,
      statusLabel: formatClaimStatusLabel(claim.status),
    })),
    totalCount: claims.length,
    totalAmount: claims.reduce((sum, claim) => sum + (claim.amount || 0), 0),
  };

  return {
    success: true,
    data: historyInfo,
    message: `您当前共有 ${historyInfo.totalCount} 个理赔案件，我已为您列出历史记录。`,
    uiComponent: UIComponentType.CLAIM_HISTORY,
    uiData: historyInfo,
    suggestedFollowups: [
      "查询最新案件进度",
      "查看我的保单",
      "我要报案",
    ],
  };
}

async function handleQueryPaymentStatus(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const context = resolveClaimContext(
    IntentType.QUERY_PAYMENT_STATUS,
    entities,
    claimState,
    "您还没有关联的理赔案件。如需查询打款状态，请先报案或关联已有案件。",
    "您有多个理赔案件，请先选择要查询打款状态的案件。",
  );
  if (context.response) return context.response;
  const targetClaim = context.claim!;

  const paymentStatus = targetClaim.payment?.status || "pending";
  const paymentInfo: PaymentStatusInfo = {
    claimId: targetClaim.id,
    paymentStatus,
    amount: targetClaim.assessment?.finalAmount || targetClaim.amount,
    bankName: targetClaim.payment?.bankName,
    accountTail: targetClaim.payment?.accountNumber?.slice(-4),
    transactionId: targetClaim.payment?.transactionId,
    completedDate: targetClaim.payment?.timestamp
      ? new Date(targetClaim.payment.timestamp).toLocaleDateString("zh-CN")
      : undefined,
    estimatedDate:
      paymentStatus === "processing" || paymentStatus === "pending"
        ? "预计1-3个工作日内到账"
        : undefined,
  };

  const paymentLabelMap: Record<PaymentStatusInfo["paymentStatus"], string> = {
    pending: "待打款",
    processing: "打款处理中",
    success: "已到账",
    failed: "打款失败",
  };

  return {
    success: true,
    data: paymentInfo,
    message:
      `案件 ${targetClaim.id} 当前打款状态为「${paymentLabelMap[paymentStatus]}」` +
      (paymentInfo.amount ? `，金额约 ${paymentInfo.amount.toLocaleString()} 元。` : "。"),
    uiComponent: UIComponentType.PAYMENT_STATUS,
    uiData: paymentInfo,
    suggestedFollowups:
      paymentStatus === "success"
        ? ["查看赔付明细", "查看我的保单", "我要报案"]
        : ["查看赔付明细", "查询理赔进度", "更新银行卡信息"],
  };
}

async function handleQueryCoverage(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const resolution = resolveTargetClaim(entities, claimState);
  const targetClaim = resolution.kind === "resolved" ? resolution.claim : undefined;
  const { claimType, productCode } = resolveClaimTypeAndProductCode(
    entities,
    claimState,
    targetClaim,
  );
  const product = await fetchProduct(productCode);

  const coverageItems = (product?.responsibilities || []).slice(0, 6).map((item: any) => ({
    name: item.name || item.responsibilityName || "保障责任",
    covered: true,
    limit: item.sumInsured ? Number(item.sumInsured) : undefined,
    note: item.description || item.details,
  }));

  const coverageInfo: CoverageInfo = {
    isInScope: coverageItems.length > 0 ? true : null,
    coverageItems,
    exclusions: product?.precautions
      ? String(product.precautions)
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    explanation:
      coverageItems.length > 0
        ? `当前已按 ${claimType} 产品责任为您整理主要保障范围。`
        : `暂未查询到 ${claimType} 的结构化保障责任，请以正式保单条款为准。`,
  };

  return {
    success: true,
    data: coverageInfo,
    message:
      coverageItems.length > 0
        ? `我已为您整理 ${claimType} 的主要保障责任，可重点查看责任范围和注意事项。`
        : `暂未查询到 ${claimType} 的完整保障范围结构化数据，建议结合保单条款进一步确认。`,
    uiComponent: UIComponentType.COVERAGE_INFO,
    uiData: coverageInfo,
    suggestedFollowups: [
      "理赔需要哪些材料",
      "预估能赔多少",
      "我要报案",
    ],
  };
}

/**
 * 查询保费影响
 */
async function handleQueryPremiumImpact(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  // 1. 确定保单类型和理赔金额
  const policyType = entities.policyId || claimState.historicalClaims?.[0]?.type || '车险';
  
  // 从已结案的案件中获取理赔金额
  const claimAmount = claimState.historicalClaims?.find(c => 
    c.status === ClaimStatus.SETTLED || 
    c.status === ClaimStatus.PAID
  )?.amount || 0;

  // 2. 计算保费影响
  const impactInfo = calculatePremiumImpact(policyType, claimAmount);

  // 3. 生成回复消息
  const changeText = impactInfo.premiumChange.direction === 'increase' 
    ? `上涨 ${impactInfo.premiumChange.amount}元 (${impactInfo.premiumChange.percentage}%)`
    : impactInfo.premiumChange.direction === 'decrease'
    ? `下降 ${Math.abs(impactInfo.premiumChange.amount)}元 (${Math.abs(impactInfo.premiumChange.percentage)}%)`
    : '保持不变';

  const message = `关于理赔对保费的影响：

📊 **NCD系数变化**：${impactInfo.currentNCD} → ${impactInfo.nextYearNCD}
💰 **保费预估变化**：${changeText}

**说明**：
${impactInfo.explanation}

💡 **建议**：
${impactInfo.suggestions.map(s => `• ${s}`).join('\n')}

*注：以上估算仅供参考，实际保费以保险公司核算为准。*`;

  return {
    success: true,
    data: impactInfo,
    message,
    uiComponent: UIComponentType.PREMIUM_IMPACT,
    uiData: impactInfo,
    suggestedFollowups: [
      "怎样避免保费上涨",
      "查看我的保单",
      "查询理赔历史",
    ],
  };
}

/**
 * 普通对话
 */
function handleGeneralChat(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  return {
    success: true,
    data: null,
    message: "", // 空消息表示需要走普通 AI 回复流程
    uiComponent: undefined,
    // Default starter suggestions when the user is just chatting / not sure
    // what to ask. The assistant's free-form reply is appended above these.
    suggestedFollowups: [
      "查询我的理赔进度",
      "还缺哪些材料",
      "我要报案",
      "查看我的保单",
    ],
  };
}

/**
 * 未实现的功能
 */
function handleUnimplemented(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  return {
    success: false,
    data: null,
    message: "抱歉，此功能暂未实现，请联系人工客服获取帮助。",
    uiComponent: undefined
  };
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取状态标签
 */
function getStatusLabel(status: ClaimStatus): string {
  const labels: Record<ClaimStatus, string> = {
    [ClaimStatus.REPORTING]: "报案登记",
    [ClaimStatus.DOCUMENTING]: "材料补充",
    [ClaimStatus.REVIEWING]: "审核中",
    [ClaimStatus.SETTLED]: "审核完成",
    [ClaimStatus.PAYING]: "打款中",
    [ClaimStatus.PAID]: "已结案",
    [ClaimStatus.REJECTED]: "已拒赔"
  };
  return labels[status] || "处理中";
}

/**
 * 计算进度百分比
 */
function calculateProgress(status: ClaimStatus, timeline?: ClaimEvent[]): number {
  const progressMap: Record<ClaimStatus, number> = {
    [ClaimStatus.REPORTING]: 10,
    [ClaimStatus.DOCUMENTING]: 30,
    [ClaimStatus.REVIEWING]: 60,
    [ClaimStatus.SETTLED]: 90,
    [ClaimStatus.PAYING]: 95,
    [ClaimStatus.PAID]: 100,
    [ClaimStatus.REJECTED]: 100
  };
  return progressMap[status] || 50;
}

/**
 * 获取当前阶段
 */
function getCurrentStage(status: ClaimStatus): string {
  const stages: Record<ClaimStatus, string> = {
    [ClaimStatus.REPORTING]: "等待提交材料",
    [ClaimStatus.DOCUMENTING]: "收集理赔材料",
    [ClaimStatus.REVIEWING]: "专业审核中",
    [ClaimStatus.SETTLED]: "审核已通过",
    [ClaimStatus.PAYING]: "打款处理中",
    [ClaimStatus.PAID]: "理赔已完成",
    [ClaimStatus.REJECTED]: "案件已关闭"
  };
  return stages[status] || "处理中";
}

/**
 * 生成进度消息
 */
function generateProgressMessage(info: ClaimProgressInfo): string {
  const progressBar = generateProgressBar(info.progress);
  
  return `案件 **${info.claimId}** 的当前进度：

${progressBar} ${info.progress}%

📍 **当前状态**：${info.statusLabel}
🔹 **当前阶段**：${info.currentStage}

${info.progress < 100 ? '我们会尽快完成审核，请耐心等待。如有疑问可随时联系我。' : '您的理赔已处理完成，如有其他问题欢迎随时咨询。'}`;
}

/**
 * 生成进度条
 */
function generateProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 生成默认时间线
 */
function generateDefaultTimeline(claim: any): ClaimEvent[] {
  const events: ClaimEvent[] = [
    {
      date: claim.date || new Date().toISOString(),
      label: "报案提交",
      description: "用户提交理赔申请",
      status: "completed"
    }
  ];
  
  if (claim.status !== ClaimStatus.REPORTING) {
    events.push({
      date: "处理中",
      label: "材料审核",
      description: "审核人员审核材料",
      status: claim.status === ClaimStatus.REVIEWING ? "active" : "completed"
    });
  }
  
  if (claim.status === ClaimStatus.SETTLED || claim.status === ClaimStatus.PAID) {
    events.push({
      date: claim.status === ClaimStatus.PAID ? "已完成" : "待打款",
      label: "理赔结算",
      description: "审核通过，等待打款",
      status: claim.status === ClaimStatus.PAID ? "completed" : "active"
    });
  }
  
  return events;
}

/**
 * 从状态推断事故类型
 */
function getIncidentTypeFromState(claimState: ClaimState): string {
  if (claimState.incidentType) return claimState.incidentType;
  if (claimState.reportInfo?.description?.includes('车')) return '车险';
  if (claimState.reportInfo?.description?.includes('医')) return '医疗险';
  return '意外险';
}

/**
 * 获取材料清单
 */
async function fetchMaterialsList(
  claimType: string, 
  productCode?: string
): Promise<MaterialItem[]> {
  try {
    // 尝试从后端 API 获取
    const response = await fetch('/api/claim-materials/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimType, productCode })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.materials) {
        return result.materials.map((m: any) => ({
          id: m.materialId || m.id,
          name: m.materialName || m.name,
          description: m.materialDescription || m.description || '',
          required: m.required !== false,
          sampleUrl: m.sampleUrl,
          uploaded: false
        }));
      }
    }
  } catch (error) {
    console.warn('[Fetch Materials Failed]', error);
  }

  // 返回默认材料清单
  return getDefaultMaterials(claimType);
}

/**
 * 获取默认材料清单
 */
function getDefaultMaterials(claimType: string): MaterialItem[] {
  const defaults: Record<string, MaterialItem[]> = {
    '车险': [
      { id: '1', name: '身份证', description: '被保险人身份证正反面照片', required: true, uploaded: false },
      { id: '2', name: '驾驶证', description: '驾驶人驾驶证照片', required: true, uploaded: false },
      { id: '3', name: '行驶证', description: '车辆行驶证照片', required: true, uploaded: false },
      { id: '4', name: '事故认定书', description: '交警出具的事故责任认定书', required: true, uploaded: false },
      { id: '5', name: '维修发票', description: '车辆维修费用发票', required: true, uploaded: false },
      { id: '6', name: '现场照片', description: '事故现场照片（多角度）', required: false, uploaded: false }
    ],
    '医疗险': [
      { id: '1', name: '身份证', description: '被保险人身份证', required: true, uploaded: false },
      { id: '2', name: '医疗发票', description: '医院出具的医疗费用发票原件', required: true, uploaded: false },
      { id: '3', name: '病历资料', description: '门诊/住院病历', required: true, uploaded: false },
      { id: '4', name: '费用清单', description: '医疗费用明细清单', required: true, uploaded: false },
      { id: '5', name: '出院小结', description: '出院诊断证明/小结', required: false, uploaded: false },
      { id: '6', name: '银行卡', description: '收款人银行卡', required: true, uploaded: false }
    ]
  };

  return defaults[claimType] || [
    { id: '1', name: '身份证', description: '身份证明文件', required: true, uploaded: false },
    { id: '2', name: '保单', description: '保险单或电子保单', required: true, uploaded: false },
    { id: '3', name: '事故证明', description: '相关事故证明材料', required: true, uploaded: false }
  ];
}

/**
 * 计算紧急程度
 */
function calculateUrgency(status: ClaimStatus, missingCount: number): 'low' | 'medium' | 'high' {
  if (missingCount === 0) return 'low';
  if (status === ClaimStatus.REVIEWING) return 'high';
  if (missingCount > 3) return 'high';
  if (missingCount > 1) return 'medium';
  return 'low';
}

/**
 * 计算补交截止日
 */
function calculateDeadline(claim: any): string | undefined {
  // 根据报案日期 + 30天估算
  if (claim.date) {
    const date = new Date(claim.date);
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('zh-CN');
  }
  return undefined;
}

/**
 * 计算保费影响
 */
function calculatePremiumImpact(policyType: string, claimAmount: number): PremiumImpactInfo {
  // 简化的保费计算逻辑（实际应调用后端 API）
  const baseNCD = 0.7; // 基础 NCD 系数
  const nextNCD = 0.85; // 理赔后 NCD 系数
  
  const basePremium = 5000; // 假设基础保费
  const currentPremium = basePremium * baseNCD;
  const nextPremium = basePremium * nextNCD;
  
  return {
    currentNCD: baseNCD,
    nextYearNCD: nextNCD,
    premiumChange: {
      amount: Math.round(nextPremium - currentPremium),
      percentage: Math.round(((nextNCD - baseNCD) / baseNCD) * 100),
      direction: 'increase'
    },
    explanation: policyType.includes('车险') 
      ? '根据车险NCD系数规则，出险一次下一年度保费将恢复至基准保费，无法再享受无赔款优待折扣。'
      : '本次理赔可能会影响下一年度的保费定价，具体以保险公司核保结果为准。',
    suggestions: [
      '如果损失较小，可以考虑是否值得理赔',
      '下一年度保持良好的驾驶记录，可重新获得保费折扣',
      '可以咨询保险公司了解具体的保费计算规则'
    ]
  };
}
