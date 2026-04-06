import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import { resolveClaimTypeAndProductCode } from '../../../shared/claimRouting.js';

const GetCoverageInfoSchema = z.object({
  productCode: z.string().optional(),
  claimType: z.string().optional(),
  subFocus: z.string().optional(),
});

function matchesSubFocus(item: any, subFocus?: string): boolean {
  if (!subFocus) return true;
  const name = String(item?.name || item?.responsibilityName || "").toLowerCase();
  const description = String(item?.description || item?.details || "").toLowerCase();
  const haystack = `${name} ${description}`;

  switch (subFocus) {
    case "inpatient":
      return /住院|住院医疗/.test(haystack);
    case "outpatient":
      return /门诊|急诊/.test(haystack);
    case "compulsory":
      return /交强/.test(haystack);
    case "third_party":
      return /第三者|三者|责任/.test(haystack);
    case "vehicle_damage":
      return /车损|车辆损失|机动车损失/.test(haystack);
    case "driver_passenger":
      return /驾乘|车上人员|司机|乘客/.test(haystack);
    default:
      return true;
  }
}

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
        ? product.responsibilities
            .filter((item: any) => matchesSubFocus(item, params.subFocus))
            .slice(0, 6)
            .map((item: any) => ({
            name: item.name || item.responsibilityName || '保障责任',
            description: item.description || item.details || '',
            limit: item.sumInsured || item.limit || undefined,
          }))
        : [];

      return {
        success: true,
        data: {
          claimType,
          subFocus: params.subFocus,
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
