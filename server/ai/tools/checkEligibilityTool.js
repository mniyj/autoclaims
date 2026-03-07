/**
 * LangChain Tool: 责任判断
 * 调用规则引擎判断理赔是否符合保单责任
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { checkEligibility } from '../../rules/engine.js';

export const checkEligibilityTool = new DynamicStructuredTool({
  name: 'check_eligibility',
  description: `判断理赔案件是否符合保单责任。
使用场景：
- 当需要判断一个理赔案件是否在保险责任范围内时
- 当需要检查是否存在除外责任（如酒驾、等待期等）时
- 当需要确认保障期间是否有效时

返回结果包含：是否符合责任、匹配的规则、拒赔原因、风险警告等。`,
  
  schema: z.object({
    claimCaseId: z.string().optional().describe('理赔案件ID（如 CLM001）'),
    productCode: z.string().optional().describe('产品代码（如 ZA-002）'),
    accidentDate: z.string().optional().describe('事故日期 YYYY-MM-DD'),
    isDrunkDriving: z.boolean().optional().describe('是否酒驾'),
    diagnosis: z.string().optional().describe('诊断结果'),
    hospitalName: z.string().optional().describe('医院名称'),
  }),
  
  func: async ({ claimCaseId, productCode, accidentDate, isDrunkDriving, diagnosis, hospitalName }) => {
    try {
      // 构建 OCR 数据对象
      const ocrData = {};
      
      if (accidentDate) {
        ocrData.accident_date = accidentDate;
      }
      if (isDrunkDriving !== undefined) {
        ocrData.is_drunk_driving = isDrunkDriving;
      }
      if (diagnosis) {
        ocrData.basicInfo = { dischargeDiagnosis: diagnosis };
      }
      if (hospitalName) {
        ocrData.invoiceInfo = { hospitalName };
      }
      
      const result = await checkEligibility({
        claimCaseId,
        productCode,
        ocrData
      });
      
      // 格式化输出供 AI 理解
      let summary = '';
      
      if (result.eligible) {
        summary = `✅ 责任判断通过。匹配规则: ${result.matchedRules.join(', ')}。`;
        if (result.warnings.length > 0) {
          summary += `\n⚠️ 注意事项: ${result.warnings.map(w => w.message).join('; ')}`;
        }
        if (result.needsManualReview) {
          summary += '\n🔍 需要人工复核。';
        }
      } else if (result.needsManualReview) {
        summary = `🔍 责任判断暂不能自动确认，需要人工复核。`;
        if (result.warnings.length > 0) {
          summary += `\n复核原因: ${result.warnings.map(w => w.message).join('; ')}`;
        }
      } else {
        summary = `❌ 责任判断未通过。`;
        if (result.rejectionReasons.length > 0) {
          const reason = result.rejectionReasons[0];
          summary += `\n拒赔原因: ${reason.rule_name} (${reason.reason_code})`;
          summary += `\n条款依据: ${reason.source_text}`;
        }
      }
      
      return JSON.stringify({
        summary,
        eligible: result.eligible,
        matchedRules: result.matchedRules,
        rejectionReasons: result.rejectionReasons,
        warnings: result.warnings,
        needsManualReview: result.needsManualReview,
        fraudFlagged: result.fraudFlagged,
        productInfo: result.context
      }, null, 2);
      
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `责任判断失败: ${error.message}`
      });
    }
  }
});
