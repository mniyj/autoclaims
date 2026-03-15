import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import type { VoicePolicyInfo } from '../intents/IntentTypes.js';

const ACTIVE_POLICY_STATUSES = new Set(['ACTIVE', '生效', '生效中']);
const COMPANY_NAME_BY_CODE: Record<string, string> = {
  gclife: '国财人寿',
  xintai: '信泰保险',
};

export const listUserPoliciesTool = {
  name: 'listUserPolicies',
  description: '查询当前用户的所有有效保单列表',
  inputSchema: z.object({}),
  requiresAuth: true,
  
  handler: async (_params: any, context: { userId: string; companyCode?: string }) => {
    try {
      console.log(
        `[listUserPolicies] Querying policies for user: ${context.userId}, companyCode=${context.companyCode || '-'}`,
      );
      
      // 从 jsonlist/policies.json 读取
      const policies = await readData('policies') || [];

      const activePolicies = policies.filter((p: any) =>
        ACTIVE_POLICY_STATUSES.has(p.status)
      );

      let userPolicies = activePolicies.filter((p: any) => {
        // 匹配用户ID - 可能是 policyholder.id 或 policyholderId
        const policyholderId = p.policyholder?.id || p.policyholderId;
        return policyholderId === context.userId;
      });

      if (userPolicies.length === 0 && context.companyCode) {
        const companyName = COMPANY_NAME_BY_CODE[context.companyCode];
        if (companyName) {
          userPolicies = activePolicies.filter((p: any) => p.companyName === companyName);
        }
      }

      if (userPolicies.length === 0 && ['admin', 'test', 'gclife'].includes(context.userId)) {
        userPolicies = activePolicies;
      }
      
      console.log(`[listUserPolicies] Found ${userPolicies.length} policies`);
      
      if (userPolicies.length === 0) {
        return {
          success: false,
          error: '未找到您的有效保单，请先购买保险或联系客服'
        };
      }
      
      // 格式化保单信息用于语音播报
      const formattedPolicies: VoicePolicyInfo[] = userPolicies.map((p: any, index: number) => ({
        index: index + 1,                    // 序号，方便用户选择
        policyNumber: p.policyNumber,
        productCode: p.productCode,
        productName: p.productName || p.marketingName || p.regulatoryName || '未知产品',
        companyName: p.companyName || '未知保险公司',
        policyholderName: p.policyholder?.name || p.policyholderName || '未知',
        insuredName: p.insureds?.[0]?.name || p.insuredName || p.policyholder?.name || '未知',
        effectiveDate: formatDateForSpeech(p.effectiveDate),
        expiryDate: p.expiryDate,
        status: p.status
      }));
      
      return {
        success: true,
        data: formattedPolicies,
        message: `找到${formattedPolicies.length}张有效保单`
      };
    } catch (error) {
      console.error('[listUserPolicies] Error:', error);
      return {
        success: false,
        error: '查询保单失败，请稍后重试'
      };
    }
  }
};

/**
 * 格式化日期用于语音播报
 * 将 "2024-01-15" 转换为 "2024年1月15日"
 */
function formatDateForSpeech(dateStr: string): string {
  if (!dateStr) return '未知日期';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return `${year}年${month}月${day}日`;
  } catch {
    return dateStr;
  }
}
