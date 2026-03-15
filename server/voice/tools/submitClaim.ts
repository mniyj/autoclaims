import { z } from 'zod';
import { readData, writeData } from '../../../server/utils/fileStore.js';
import { ClaimStatus } from '../../../types.js';

// 动态字段提交 schema
const SubmitClaimSchema = z.object({
  policyNumber: z.string(),
  productCode: z.string(),
  fieldData: z.record(z.string(), z.any()).describe('动态字段数据')
});

function generateReportNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CLM${dateStr}${random}`;
}

// 字段映射：将收集的字段映射到标准字段名
const FIELD_MAPPINGS: Record<string, string> = {
  // 日期相关
  'accident_date': 'accidentTime',
  'accidentDate': 'accidentTime',
  'incident_date': 'accidentTime',
  'incidentDate': 'accidentTime',
  'discharge_date': 'dischargeDate',
  
  // 原因相关
  'accident_reason': 'accidentReason',
  'accidentReason': 'accidentReason',
  'incident_reason': 'accidentReason',
  'incidentReason': 'accidentReason',
  'incident_description': 'accidentReason',
  
  // 地点相关
  'hospital_name': 'hospitalName',
  'hospitalName': 'hospitalName',
  'accident_location': 'accidentLocation',
  'accidentLocation': 'accidentLocation',
  
  // 金额相关
  'claim_amount': 'claimAmount',
  'claimAmount': 'claimAmount',
  'estimated_amount': 'claimAmount',
  
  // 人员相关
  'reporter_name': 'reporter',
  'reporterName': 'reporter',
  'policyholder_name': 'reporter',
  
  // 类型相关
  'incident_type': 'incidentType',
  'incidentType': 'incidentType',
  'treatment_type': 'treatmentType',
};

export const submitClaimTool = {
  name: 'submitClaim',
  description: '提交理赔报案申请（支持动态字段）',
  inputSchema: SubmitClaimSchema,
  requiresConfirmation: true,
  
  handler: async (params: z.infer<typeof SubmitClaimSchema>) => {
    try {
      console.log(`[submitClaim] Submitting claim for policy: ${params.policyNumber}`);
      console.log(`[submitClaim] Field data:`, params.fieldData);
      
      // 生成报案号
      const reportNumber = generateReportNumber();
      
      // 标准化字段数据
      const normalizedData = normalizeFieldData(params.fieldData);
      
      // 获取保单信息用于 reporter 字段
      const policies = await readData('policies') || [];
      const policy = policies.find((p: any) => p.policyNumber === params.policyNumber);
      
      // 创建报案记录
      const claimCase: any = {
        id: `claim_${Date.now()}`,
        reportNumber,
        policyNumber: params.policyNumber,
        productCode: params.productCode,
        reporter: normalizedData.reporter || policy?.policyholder?.name || '未知',
        reportTime: new Date().toISOString(),
        status: ClaimStatus.REPORTED,
        operator: 'voice-agent',
        
        // 标准字段
        accidentTime: normalizedData.accidentTime || new Date().toISOString(),
        accidentReason: normalizedData.accidentReason || '',
        accidentLocation: normalizedData.accidentLocation || normalizedData.hospitalName || '',
        hospitalName: normalizedData.hospitalName || '',
        claimAmount: normalizedData.claimAmount || 0,
        incidentType: normalizedData.incidentType || 'medical',
        treatmentType: normalizedData.treatmentType || '',
        dischargeDate: normalizedData.dischargeDate || '',
        
        // 保留原始字段数据
        rawFieldData: params.fieldData,
        
        // 元数据
        source: 'voice',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // 读取并保存报案
      const claims = await readData('claim-cases') || [];
      claims.push(claimCase);
      await writeData('claim-cases', claims);
      
      console.log(`[submitClaim] Claim created: ${reportNumber}`);
      
      // 获取所需材料（基于产品配置）
      const requiredMaterials = await getRequiredMaterials(params.productCode, params.fieldData);
      
      return {
        success: true,
        data: {
          claimId: claimCase.id,
          reportNumber,
          status: ClaimStatus.REPORTED,
          requiredMaterials,
          estimatedProcessTime: '3个工作日'
        },
        message: `报案成功！您的报案号是 ${reportNumber}`
      };
    } catch (error) {
      console.error('[submitClaim] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '提交失败'
      };
    }
  }
};

/**
 * 标准化字段数据
 */
function normalizeFieldData(fieldData: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(fieldData)) {
    // 尝试映射到标准字段名
    const standardKey = FIELD_MAPPINGS[key] || key;
    normalized[standardKey] = value;
  }
  
  return normalized;
}

/**
 * 获取所需材料（基于产品配置）
 */
// 基础材料定义（放在函数外部以便复用）
const BASE_MATERIALS = [
  { id: 'id_card', name: '被保险人身份证正反面', required: true }
];

async function getRequiredMaterials(
  productCode: string, 
  fieldData: Record<string, any>
): Promise<Array<{ id: string; name: string; required: boolean }>> {
  try {
    // 读取产品配置
    const products = await readData('products') || [];
    const product = products.find((p: any) => p.productCode === productCode);
    
    if (!product?.intakeConfig?.claimMaterials) {
      // 没有配置时使用默认材料
      return [...BASE_MATERIALS, ...getDefaultMaterials(fieldData)];
    }
    
    const { materialOverrides, extraMaterialIds } = product.intakeConfig.claimMaterials;
    
    // 读取所有材料定义
    const allMaterials = await readData('claims-materials') || [];
    
    // 组合选中的材料
    const selectedMaterials: Array<{ id: string; name: string; required: boolean }> = [];
    
    // 添加基础材料
    selectedMaterials.push(...BASE_MATERIALS);
    
    // 根据 overrides 添加材料
    if (materialOverrides) {
      for (const [materialId, config] of Object.entries(materialOverrides as Record<string, any>)) {
        if (config.selected) {
          const material = allMaterials.find((m: any) => m.id === materialId);
          if (material) {
            selectedMaterials.push({
              id: materialId,
              name: material.name,
              required: config.required !== false
            });
          }
        }
      }
    }
    
    // 添加 extraMaterialIds 中的材料
    if (extraMaterialIds) {
      for (const materialId of extraMaterialIds) {
        const material = allMaterials.find((m: any) => m.id === materialId);
        if (material && !selectedMaterials.find(m => m.id === materialId)) {
          selectedMaterials.push({
            id: materialId,
            name: material.name,
            required: true
          });
        }
      }
    }
    
    return selectedMaterials.length > BASE_MATERIALS.length 
      ? selectedMaterials 
      : [...BASE_MATERIALS, ...getDefaultMaterials(fieldData)];
      
  } catch (error) {
    console.error('[getRequiredMaterials] Error:', error);
    return [...BASE_MATERIALS, ...getDefaultMaterials(fieldData)];
  }
}

/**
 * 获取默认材料（基于事故类型）
 */
function getDefaultMaterials(fieldData: Record<string, any>): Array<{ id: string; name: string; required: boolean }> {
  const incidentType = fieldData.incidentType || fieldData.incident_type || 'medical';
  
  switch (incidentType) {
    case 'medical':
      return [
        { id: 'medical_invoice', name: '医疗发票原件', required: true },
        { id: 'discharge_summary', name: '出院小结或诊断证明', required: true },
        { id: 'fee_list', name: '费用明细清单', required: true }
      ];
    case 'accident':
      return [
        { id: 'accident_proof', name: '事故证明', required: true },
        { id: 'medical_records', name: '医疗记录', required: true }
      ];
    default:
      return [
        { id: 'medical_invoice', name: '医疗发票原件', required: true },
        { id: 'discharge_summary', name: '出院小结或诊断证明', required: true }
      ];
  }
}
