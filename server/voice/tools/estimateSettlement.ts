import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import { resolveClaimTypeAndProductCode } from '../../../shared/claimRouting.js';

const EstimateSettlementSchema = z.object({
  claimId: z.string().optional(),
  productCode: z.string().optional(),
  claimType: z.string().optional(),
  subFocus: z.string().optional(),
});

function estimateAmount(claimType: string, amount: number, subFocus?: string): number {
  if (claimType === '车险') {
    switch (subFocus) {
      case 'compulsory':
        return Math.round(amount * 0.75);
      case 'third_party':
        return Math.round(amount * 0.85);
      case 'vehicle_damage':
        return Math.round(amount * 0.9);
      case 'driver_passenger':
        return Math.round(amount * 0.8);
      default:
        return Math.round(amount * 0.9);
    }
  }

  if (claimType === '医疗险') {
    switch (subFocus) {
      case 'outpatient':
        return Math.round(amount * 0.6);
      case 'inpatient':
        return Math.round(amount * 0.85);
      default:
        return Math.round(amount * 0.8);
    }
  }

  switch (claimType) {
    case '重疾险':
      return amount > 0 ? amount : 50000;
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
      const estimatedAmount = estimateAmount(claimType, baseAmount || 1000, params.subFocus);

      return {
        success: true,
        data: {
          claimId: claim?.id,
          claimType,
          subFocus: params.subFocus,
          estimatedAmount,
          basis: baseAmount > 0
            ? `基于申报金额 ${baseAmount} 元${params.subFocus ? `，按${params.subFocus}口径` : ''}估算`
            : `基于险种默认规则${params.subFocus ? `和${params.subFocus}口径` : ''}估算`,
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
