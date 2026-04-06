import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import { resolveClaimTypeAndProductCode } from '../../../shared/claimRouting.js';

const GetClaimMaterialsSchema = z.object({
  productCode: z.string().optional(),
  claimType: z.string().optional(),
  subFocus: z.string().optional(),
});

const DEFAULT_MATERIALS: Record<string, Array<{ id: string; name: string; required: boolean }>> = {
  '医疗险': [
    { id: 'mat-medical-invoice', name: '医疗发票', required: true },
    { id: 'mat-medical-record', name: '病历资料', required: true },
    { id: 'mat-fee-list', name: '费用清单', required: true },
  ],
  '意外险': [
    { id: 'mat-accident-proof', name: '事故证明', required: true },
    { id: 'mat-medical-record', name: '医疗记录', required: true },
    { id: 'mat-id-card', name: '身份证件', required: true },
  ],
  '车险': [
    { id: 'mat-driver-license', name: '驾驶证', required: true },
    { id: 'mat-vehicle-license', name: '行驶证', required: true },
    { id: 'mat-accident-liability', name: '事故责任认定书', required: true },
  ],
  '重疾险': [
    { id: 'mat-diagnosis', name: '确诊证明', required: true },
    { id: 'mat-pathology', name: '病理报告', required: true },
    { id: 'mat-id-card', name: '身份证件', required: true },
  ],
};

export const getClaimMaterialsTool = {
  name: '查询材料清单',
  description: '根据产品或险种查询理赔材料清单',
  inputSchema: GetClaimMaterialsSchema,
  handler: async (params: z.infer<typeof GetClaimMaterialsSchema>) => {
    try {
      const products = await readData('products') || [];
      const allMaterials = await readData('claims-materials') || [];
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

      const claimMaterials = product?.intakeConfig?.claimMaterials;
      let materials: Array<{ id: string; name: string; required: boolean }> = [];

      if (claimMaterials?.materialOverrides) {
        materials = Object.entries(claimMaterials.materialOverrides)
          .filter(([, config]: [string, any]) => config?.selected)
          .map(([materialId, config]: [string, any]) => {
            const material = allMaterials.find((item: any) => item.id === materialId);
            return material
              ? {
                  id: material.id,
                  name: material.name,
                  required: config.required !== false,
                }
              : null;
          })
          .filter(Boolean) as Array<{ id: string; name: string; required: boolean }>;
      }

      if (materials.length === 0 && claimMaterials?.extraMaterialIds?.length) {
        materials = claimMaterials.extraMaterialIds
          .map((materialId: string) => {
            const material = allMaterials.find((item: any) => item.id === materialId);
            return material
              ? {
                  id: material.id,
                  name: material.name,
                  required: true,
                }
              : null;
          })
          .filter(Boolean) as Array<{ id: string; name: string; required: boolean }>;
      }

      if (materials.length === 0) {
        materials = DEFAULT_MATERIALS[claimType] || DEFAULT_MATERIALS['意外险'];
      }

      const filteredMaterials = params.subFocus === 'outpatient'
        ? materials.filter((item) => /门诊|发票|病历|清单/.test(item.name))
        : params.subFocus === 'inpatient'
          ? materials.filter((item) => /住院|发票|病历|清单/.test(item.name)) || materials
          : materials;

      return {
        success: true,
        data: {
          claimType,
          subFocus: params.subFocus,
          materials: filteredMaterials.length > 0 ? filteredMaterials : materials,
        },
        message: `已获取${claimType}材料清单`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询材料清单失败',
      };
    }
  },
};
