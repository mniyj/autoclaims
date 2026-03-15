/**
 * LangChain Tool: 金额计算
 * 调用规则引擎计算理赔金额
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { calculateAmount } from '../../rules/engine.js';
import { getLatestValidationFacts } from '../../rules/context.js';

export const calculateAmountTool = new DynamicStructuredTool({
  name: 'calculate_claim_amount',
  description: `计算理赔金额。
使用场景：
- 当责任判断通过后，需要计算具体赔付金额时
- 当需要根据发票费用明细计算可赔付金额时
- 当需要应用免赔额、赔付比例、限额等规则时

输入费用明细，返回：可赔付总额、免赔额、赔付比例、最终金额、各项明细等。`,
  
  schema: z.object({
    claimCaseId: z.string().optional().describe('理赔案件ID'),
    productCode: z.string().optional().describe('产品代码（如 ZA-002）'),
    invoiceItems: z.array(z.object({
      itemName: z.string().describe('费用项目名称'),
      category: z.string().optional().describe('费用类别（治疗费、检查费、药品费等）'),
      totalPrice: z.number().describe('金额'),
    })).optional().default([]).describe('发票费用明细列表，纯身故给付案件可为空'),
    totalAmount: z.number().optional().describe('发票总金额'),
    socialInsurancePaid: z.number().optional().describe('医保已支付金额'),
    deathConfirmed: z.boolean().optional().describe('是否已确认身故'),
    deathDate: z.string().optional().describe('死亡日期 YYYY-MM-DD'),
    priorDisabilityPaid: z.number().optional().describe('身故前已赔伤残金'),
    causeType: z.string().optional().describe('事故原因类型，如 ACCIDENT'),
    resultType: z.string().optional().describe('结果类型，如 DEATH'),
    scenario: z.string().optional().describe('事故场景，如 PUBLIC_TRANSPORT_PASSENGER'),
    transportType: z.string().optional().describe('交通工具类型，如 BUS、TRAIN、AIRCRAFT'),
  }),
  
  func: async ({
    claimCaseId,
    productCode,
    invoiceItems = [],
    totalAmount,
    socialInsurancePaid,
    deathConfirmed,
    deathDate,
    priorDisabilityPaid,
    causeType,
    resultType,
    scenario,
    transportType
  }) => {
    try {
      // 确保每个项目都有 category 字段
      const processedItems = invoiceItems.map(item => ({
        ...item,
        category: item.category || item.itemName
      }));
      
      const ocrData = {};
      if (totalAmount) {
        ocrData.totalAmount = totalAmount;
      }
      if (socialInsurancePaid) {
        ocrData.insurancePayment = {
          governmentFundPayment: socialInsurancePaid
        };
      }
      if (deathConfirmed !== undefined) {
        ocrData.death_confirmed = deathConfirmed;
      }
      if (deathDate) {
        ocrData.death_date = deathDate;
        ocrData.result_date = deathDate;
      }
      if (priorDisabilityPaid !== undefined) {
        ocrData.prior_disability_paid = priorDisabilityPaid;
      }
      if (causeType) {
        ocrData.cause_type = causeType;
      }
      if (resultType) {
        ocrData.result_type = resultType;
      }
      if (scenario) {
        ocrData.scenario = scenario;
      }
      if (transportType) {
        ocrData.transport_type = transportType;
      }
      
      const result = await calculateAmount({
        claimCaseId,
        productCode,
        invoiceItems: processedItems,
        ocrData,
        validationFacts: claimCaseId ? getLatestValidationFacts(claimCaseId) : null,
      });
      
      // 格式化输出
      let summary = `💰 金额计算结果:\n`;
      summary += `- 责任类型: ${result.coverageCode || '未识别'}\n`;
      summary += `- 申请总额: ¥${result.totalClaimable}\n`;
      summary += `- 免赔额: ¥${result.deductible}\n`;
      summary += `- 赔付比例: ${result.reimbursementRatio * 100}%\n`;
      summary += `- 最终赔付: ¥${result.finalAmount}\n`;
      if (result.needsManualReview) {
        const reasons = (result.manualReviewReasons || []).map(item => item.message).join('; ');
        summary += reasons ? `- 🔍 需要人工复核: ${reasons}\n` : `- 🔍 需要人工复核\n`;
      }
      if (result.warnings?.length > 0) {
        summary += `- ⚠️ ${result.warnings.map(item => item.message).join('; ')}\n`;
      }
      
      if (result.capApplied) {
        summary += `- ⚠️ 已达保额上限 ¥${result.sumInsured}\n`;
      }
      
      if (result.itemBreakdown && result.itemBreakdown.length > 0) {
        summary += `\n费用明细:\n`;
        for (const item of result.itemBreakdown) {
          const status = item.approved === item.claimed ? '✓' : '▼';
          summary += `  ${status} ${item.item}: ¥${item.claimed} → ¥${item.approved} (${item.reason})\n`;
        }
      }
      
      return JSON.stringify({
        summary,
        totalClaimable: result.totalClaimable,
        deductible: result.deductible,
        reimbursementRatio: result.reimbursementRatio,
        finalAmount: result.finalAmount,
        coverageCode: result.coverageCode,
        coverageResult: result.coverageResult,
        capApplied: result.capApplied,
        sumInsured: result.sumInsured,
        warnings: result.warnings,
        needsManualReview: result.needsManualReview,
        manualReviewReasons: result.manualReviewReasons || [],
        itemBreakdown: result.itemBreakdown
      }, null, 2);
      
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `金额计算失败: ${error.message}`
      });
    }
  }
});
