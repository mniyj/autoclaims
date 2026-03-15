import { z } from 'zod';
import { readData } from '../../../server/utils/fileStore.js';
import { normalizeClaimType } from '../../../shared/claimRouting.js';

// Progress query schema
const ProgressSchema = z.object({
  reportNumber: z.string().optional(),
  policyNumber: z.string().optional()
});

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'REPORTED': '已报案',
    'PROCESSING': '处理中',
    'PENDING_INFO': '待补传',
    'APPROVED': '已结案-给付',
    'REJECTED': '已结案-拒赔',
    'CANCELLED': '已撤案'
  };
  return labels[status] || status;
}

function getNextStep(status: string): string {
  const steps: Record<string, string> = {
    'REPORTED': '等待审核',
    'PROCESSING': '审核进行中',
    'PENDING_INFO': '请补充材料',
    'APPROVED': '等待打款',
    'REJECTED': '案件已结案',
    'CANCELLED': '案件已撤案'
  };
  return steps[status] || '等待处理';
}

export const getProgressTool = {
  name: '查询理赔进度',
  description: '查询理赔案件的处理进度',
  inputSchema: ProgressSchema,
  handler: async (params: z.infer<typeof ProgressSchema>, context?: { userId?: string }) => {
    try {
      // Read claims from jsonlist
      const claims = await readData('claim-cases') || [];
      
      let matched = claims;
      
      if (params.reportNumber) {
        matched = claims.filter((c: any) => 
          c.reportNumber === params.reportNumber
        );
      } else if (params.policyNumber) {
        matched = claims.filter((c: any) => 
          c.productCode === params.policyNumber
        );
      } else if (context?.userId && !['admin', 'test', 'gclife'].includes(context.userId)) {
        matched = claims.filter((c: any) =>
          c.reporter === context.userId ||
          c.insured === context.userId ||
          c.userId === context.userId
        );
      }
      
      if (matched.length === 0) {
        return {
          success: false,
          error: '未找到相关理赔案件'
        };
      }
      
      const results = matched.map((c: any, index: number) => ({
        index: index + 1,
        claimId: c.id,
        reportNumber: c.reportNumber,
        productCode: c.productCode,
        claimType: normalizeClaimType(c.claimType || c.incidentType || c.productName || c.productCode),
        status: c.status,
        statusLabel: getStatusLabel(c.status),
        accidentReason: c.accidentReason,
        claimAmount: c.claimAmount,
        approvedAmount: c.approvedAmount,
        submitTime: c.reportTime,
        lastUpdate: c.updatedAt || c.reportTime,
        nextStep: getNextStep(c.status)
      }));
      
      return {
        success: true,
        data: results,
        message: `找到 ${results.length} 个理赔案件`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      };
    }
  }
};
