import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import { resolveClaimTypeAndProductCode } from '../../../shared/claimRouting.js';

const EstimateSettlementSchema = z.object({
  claimId: z.string().optional(),
  productCode: z.string().optional(),
  claimType: z.string().optional(),
});

function estimateAmount(claimType: string, amount: number): number {
  switch (claimType) {
    case '医疗险':
      return Math.round(amount * 0.8);
    case '重疾险':
      return amount > 0 ? amount : 50000;
    case '车险':
      return Math.round(amount * 0.9);
    case '意外险':
    default:
      return Math.round(amount * 0.7);
  }
}

export const estimateSettlementTool = {
  name: '查询赔付预估',
  description: '根据案件或险种估算赔付金额',
  inputSchema: EstimateSettlementSchema,
  handler: async (params: z.infer<typeof EstimateSettlementSchema>) => {
    try {
      const claims = await readData('claim-cases') || [];
      const claim = params.claimId
        ? claims.find((item: any) => item.id === params.claimId || item.reportNumber === params.claimId)
        : null;

      const { claimType } = resolveClaimTypeAndProductCode({
        explicitClaimType: params.claimType,
        explicitProductCode: params.productCode,
        claim: claim
          ? {
              id: claim.id,
              type: claim.productName,
              claimType: claim.claimType,
              incidentType: claim.incidentType,
              productCode: claim.productCode,
            }
          : undefined,
      });
      const baseAmount = Number(claim?.claimAmount || claim?.approvedAmount || 0);
      const estimatedAmount = estimateAmount(claimType, baseAmount || 1000);

      return {
        success: true,
        data: {
          claimId: claim?.id,
          claimType,
          estimatedAmount,
          basis: baseAmount > 0 ? `基于申报金额 ${baseAmount} 元估算` : '基于险种默认规则估算',
        },
        message: `已生成${claimType}赔付预估`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询赔付预估失败',
      };
    }
  },
};
