import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import { resolveClaimTypeAndProductCode } from '../../../shared/claimRouting.js';

const GetMissingClaimMaterialsSchema = z.object({
  claimId: z.string(),
  productCode: z.string().optional(),
  claimType: z.string().optional(),
});

function collectUploadedNames(claim: any): Set<string> {
  const names = new Set<string>();

  for (const doc of claim.documents || []) {
    if (doc?.name) names.add(String(doc.name));
    if (doc?.category) names.add(String(doc.category));
  }
  for (const category of claim.fileCategories || []) {
    if (category?.name) names.add(String(category.name));
    for (const file of category.files || []) {
      if (file?.name) names.add(String(file.name));
    }
  }
  for (const upload of claim.materialUploads || []) {
    if (upload?.materialName) names.add(String(upload.materialName));
    if (upload?.materialId) names.add(String(upload.materialId));
  }

  return names;
}

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

export const getMissingClaimMaterialsTool = {
  name: '查询缺失材料',
  description: '根据案件查询还缺哪些必需材料',
  inputSchema: GetMissingClaimMaterialsSchema,
  handler: async (params: z.infer<typeof GetMissingClaimMaterialsSchema>) => {
    try {
      const claims = await readData('claim-cases') || [];
      const products = await readData('products') || [];
      const allMaterials = await readData('claims-materials') || [];

      const claim = claims.find((item: any) => item.id === params.claimId || item.reportNumber === params.claimId);
      if (!claim) {
        return {
          success: false,
          error: '未找到对应理赔案件',
        };
      }

      const productCode = params.productCode || claim.productCode;
      const product = productCode
        ? products.find((item: any) => item.productCode === productCode)
        : null;
      const { claimType } = resolveClaimTypeAndProductCode({
        explicitClaimType: params.claimType,
        explicitProductCode: params.productCode || claim.productCode,
        claim: {
          id: claim.id,
          type: product?.secondaryCategory || product?.categoryLevel1Name || product?.primaryCategory,
          claimType: claim.claimType,
          incidentType: claim.incidentType,
          productCode: claim.productCode,
        },
      });

      let requiredMaterials: Array<{ id: string; name: string; required: boolean }> = [];
      const claimMaterials = product?.intakeConfig?.claimMaterials;

      if (claimMaterials?.materialOverrides) {
        requiredMaterials = Object.entries(claimMaterials.materialOverrides)
          .filter(([, config]: [string, any]) => config?.selected && config?.required !== false)
          .map(([materialId]: [string, any]) => {
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

      if (requiredMaterials.length === 0) {
        requiredMaterials = (DEFAULT_MATERIALS[claimType] || DEFAULT_MATERIALS['意外险']).filter((item) => item.required);
      }

      const uploadedNames = collectUploadedNames(claim);
      const missingMaterials = requiredMaterials.filter((material) => {
        return !Array.from(uploadedNames).some((name) => name.includes(material.name) || material.name.includes(name));
      });

      return {
        success: true,
        data: {
          claimId: claim.id,
          claimType,
          missingMaterials,
          uploadedCount: requiredMaterials.length - missingMaterials.length,
          totalRequired: requiredMaterials.length,
        },
        message: `已获取案件${claim.id}的缺失材料情况`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询缺失材料失败',
      };
    }
  },
};
