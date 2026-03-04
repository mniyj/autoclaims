import { z } from 'zod';
import { readData, writeData } from '../../../server/utils/fileStore.js';
import { ClaimStatus } from '../../../types';

// Claim submission schema
const SubmitClaimSchema = z.object({
  policyNumber: z.string(),
  reporter: z.string(),
  accidentTime: z.string(),
  accidentReason: z.string(),
  accidentLocation: z.string().optional(),
  claimAmount: z.number().optional(),
  incidentType: z.enum(['medical', 'accident', 'vehicle', 'property', 'death'])
});

function generateReportNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CLM${dateStr}${random}`;
}

export const submitClaimTool = {
  name: '提交报案',
  description: '提交理赔报案申请',
  inputSchema: SubmitClaimSchema,
  requiresConfirmation: true,
  handler: async (params: z.infer<typeof SubmitClaimSchema>) => {
    try {
      // Generate report number
      const reportNumber = generateReportNumber();
      
      // Create claim case
      const claimCase = {
        id: `claim_${Date.now()}`,
        reportNumber,
        reporter: params.reporter,
        reportTime: new Date().toISOString(),
        accidentTime: params.accidentTime,
        accidentReason: params.accidentReason,
        accidentLocation: params.accidentLocation,
        claimAmount: params.claimAmount || 0,
        productCode: params.policyNumber,
        status: ClaimStatus.REPORTED,
        operator: 'voice-system'
      };
      
      // Read existing claims
      const claims = await readData('claim-cases') || [];
      claims.push(claimCase);
      
      // Write back
      await writeData('claim-cases', claims);
      
      // Calculate required materials based on incident type
      const requiredMaterials = getRequiredMaterials(params.incidentType);
      
      return {
        success: true,
        data: {
          claimId: claimCase.id,
          reportNumber,
          status: ClaimStatus.REPORTED,
          requiredMaterials,
          estimatedProcessTime: '3个工作日'
        },
        message: `报案成功！您的报案号是 ${reportNumber}。请准备以下材料：${requiredMaterials.map(m => m.name).join('、')}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '提交失败'
      };
    }
  }
};

function getRequiredMaterials(incidentType: string): Array<{ id: string; name: string; required: boolean }> {
  const baseMaterials = [
    { id: 'id_card', name: '被保险人身份证正反面', required: true }
  ];
  
  switch (incidentType) {
    case 'medical':
      return [
        ...baseMaterials,
        { id: 'medical_invoice', name: '医疗发票原件', required: true },
        { id: 'discharge_summary', name: '出院小结或诊断证明', required: true },
        { id: 'fee_list', name: '费用明细清单', required: true }
      ];
    case 'accident':
      return [
        ...baseMaterials,
        { id: 'accident_proof', name: '事故证明', required: true },
        { id: 'medical_records', name: '医疗记录', required: true }
      ];
    default:
      return baseMaterials;
  }
}
