import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import { resolveClaimTypeAndProductCode } from '../../../shared/claimRouting.js';

const GetCoverageInfoSchema = z.object({
  productCode: z.string().optional(),
  claimType: z.string().optional(),
});

export const getCoverageInfoTool = {
  name: '查询保障范围',
  description: '根据产品或险种查询保障范围',
  inputSchema: GetCoverageInfoSchema,
  handler: async (params: z.infer<typeof GetCoverageInfoSchema>) => {
    try {
      const products = await readData('products') || [];
      const product = params.productCode
        ? products.find((item: any) => item.productCode === params.productCode)
        : null;

      const { claimType } = resolveClaimTypeAndProductCode({
        explicitClaimType: params.claimType,
        explicitProductCode: params.productCode,
        claim: product
          ? {
              id: product.productCode || 'product',
              type: product.secondaryCategory || product.categoryLevel1Name || product.primaryCategory,
              productCode: product.productCode,
            }
          : undefined,
      });

      const responsibilities = Array.isArray(product?.responsibilities)
        ? product.responsibilities.slice(0, 6).map((item: any) => ({
            name: item.name || item.responsibilityName || '保障责任',
            description: item.description || item.details || '',
            limit: item.sumInsured || item.limit || undefined,
          }))
        : [];

      return {
        success: true,
        data: {
          claimType,
          productName: product?.marketingName || product?.regulatoryName || product?.productName,
          responsibilities,
          exclusions: product?.precautions
            ? String(product.precautions)
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
        },
        message: `已获取${claimType}保障范围`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询保障范围失败',
      };
    }
  },
};
