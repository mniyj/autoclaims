/**
 * LangChain Tool: 金额计算
 * 调用规则引擎计算理赔金额
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { calculateAmount } from '../../rules/engine.js';

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
    })).describe('发票费用明细列表'),
    totalAmount: z.number().optional().describe('发票总金额'),
    socialInsurancePaid: z.number().optional().describe('医保已支付金额'),
  }),
  
  func: async ({ claimCaseId, productCode, invoiceItems, totalAmount, socialInsurancePaid }) => {
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
      
      const result = await calculateAmount({
        claimCaseId,
        productCode,
        invoiceItems: processedItems,
        ocrData
      });
      
      // 格式化输出
      let summary = `💰 金额计算结果:\n`;
      summary += `- 申请总额: ¥${result.totalClaimable}\n`;
      summary += `- 免赔额: ¥${result.deductible}\n`;
      summary += `- 赔付比例: ${result.reimbursementRatio * 100}%\n`;
      summary += `- 最终赔付: ¥${result.finalAmount}\n`;
      
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
        capApplied: result.capApplied,
        sumInsured: result.sumInsured,
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
