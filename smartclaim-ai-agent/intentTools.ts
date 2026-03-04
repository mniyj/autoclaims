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
  MaterialItem,
  ClaimEvent
} from "./types";

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
  [IntentType.QUERY_SETTLEMENT_AMOUNT]: handleUnimplemented,
  [IntentType.QUERY_SETTLEMENT_DETAIL]: handleUnimplemented,
  [IntentType.QUERY_POLICY_INFO]: handleUnimplemented,
  [IntentType.QUERY_CLAIM_HISTORY]: handleUnimplemented,
  [IntentType.QUERY_PAYMENT_STATUS]: handleUnimplemented,

  // ---- 协助类 ----
  [IntentType.GUIDE_CLAIM_PROCESS]: handleUnimplemented,
  [IntentType.GUIDE_DOCUMENT_PHOTO]: handleUnimplemented,
  [IntentType.QUERY_CLAIM_TIMELINE]: handleUnimplemented,
  [IntentType.QUERY_COVERAGE]: handleUnimplemented,
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

/**
 * 查询理赔进度
 */
async function handleQueryProgress(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  // 1. 确定要查询的案件
  let targetClaim = claimState.historicalClaims?.[0];
  
  if (entities.claimId) {
    targetClaim = claimState.historicalClaims?.find(c => 
      c.id === entities.claimId || 
      c.id.includes(entities.claimId!)
    );
  }

  if (!targetClaim) {
    return {
      success: false,
      data: null,
      message: "您还没有关联的理赔案件。如需查询案件进度，请先报案或关联已有案件。",
      uiComponent: undefined
    };
  }

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
    uiData: progressInfo
  };
}

/**
 * 查询理赔材料清单
 */
async function handleQueryMaterialsList(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  // 1. 确定理赔类型
  const claimType = entities.claimType || 
    claimState.historicalClaims?.[0]?.type || 
    getIncidentTypeFromState(claimState);

  // 2. 获取材料清单
  const materials = await fetchMaterialsList(claimType, entities.productCode);

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
    uiData: listInfo
  };
}

/**
 * 查询缺失材料
 */
async function handleQueryMissingMaterials(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  // 1. 确定目标案件
  let targetClaim = claimState.historicalClaims?.[0];
  
  if (entities.claimId) {
    targetClaim = claimState.historicalClaims?.find(c => 
      c.id === entities.claimId || 
      c.id.includes(entities.claimId!)
    );
  }

  if (!targetClaim) {
    return {
      success: false,
      data: null,
      message: "您还没有关联的理赔案件。如需查询还缺什么材料，请先报案或关联已有案件。",
      uiComponent: undefined
    };
  }

  // 2. 获取该案件的材料清单和已上传材料
  const allMaterials = await fetchMaterialsList(targetClaim.type, entities.productCode);
  const uploadedDocs = targetClaim.documents || [];

  // 3. 对比找出缺失的材料
  const missingItems = allMaterials.filter(material => {
    // 检查是否已上传
    const isUploaded = uploadedDocs.some(doc => 
      doc.category?.includes(material.name) ||
      doc.name?.includes(material.name) ||
      material.id === doc.id
    );
    return material.required && !isUploaded;
  });

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
    uiData: missingInfo
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
    uiData: impactInfo
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
    uiComponent: undefined
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
