import { z } from 'zod';
import { readData, writeData } from '../../../server/utils/fileStore.js';

// Policy schema
const PolicySchema = z.object({
  policyNumber: z.string().optional(),
  idNumber: z.string().optional(),
  phone: z.string().optional()
});

export const checkPolicyTool = {
  name: '查询保单',
  description: '根据保单号或身份证号查询保单信息',
  inputSchema: PolicySchema,
  handler: async (params: z.infer<typeof PolicySchema>) => {
    try {
      // Read policies from jsonlist
      const policies = await readData('policies') || [];
      
      let matched = null;
      
      if (params.policyNumber) {
        matched = policies.find((p: any) => 
          p.policyNumber === params.policyNumber
        );
      } else if (params.idNumber) {
        matched = policies.find((p: any) => 
          p.policyholder?.idNumber === params.idNumber
        );
      }
      
      if (!matched) {
        return {
          success: false,
          error: '未找到匹配的保单，请确认保单号或身份信息'
        };
      }
      
      return {
        success: true,
        data: {
          policyNumber: matched.policyNumber,
          productName: matched.productName,
          policyholderName: matched.policyholder?.name,
          insuredName: matched.insureds?.[0]?.name,
          effectiveDate: matched.effectiveDate,
          expiryDate: matched.expiryDate,
          status: matched.status
        },
        message: `找到保单：${matched.productName}，保单号${matched.policyNumber}，状态${matched.status}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      };
    }
  }
};
