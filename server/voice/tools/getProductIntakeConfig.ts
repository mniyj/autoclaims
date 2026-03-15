import { z } from 'zod';
import { readData } from '../../utils/fileStore.js';
import type { IntakeFieldInfo } from '../intents/IntentTypes.js';

export const getProductIntakeConfigTool = {
  name: 'getProductIntakeConfig',
  description: '根据产品代码获取报案字段配置',
  inputSchema: z.object({
    productCode: z.string().describe('产品代码')
  }),
  
  handler: async (params: { productCode: string }) => {
    try {
      console.log(`[getProductIntakeConfig] Loading config for: ${params.productCode}`);
      
      // 读取产品配置
      const products = await readData('products') || [];
      const product = products.find((p: any) => 
        p.productCode === params.productCode
      );
      
      if (!product) {
        return {
          success: false,
          error: '未找到产品配置'
        };
      }
      
      // 获取报案配置
      const intakeConfig = product.intakeConfig;
      
      if (!intakeConfig || !intakeConfig.fields) {
        return {
          success: false,
          error: '该产品尚未配置报案字段，请联系管理员'
        };
      }
      
      // 只返回启用了语音的字段（默认启用）
      const voiceFields: IntakeFieldInfo[] = intakeConfig.fields
        .filter((f: any) => f.voice_slot_enabled !== false)
        .map((f: any) => ({
          fieldId: f.field_id,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
          placeholder: f.placeholder
        }));
      
      if (voiceFields.length === 0) {
        return {
          success: false,
          error: '该产品没有配置语音报案字段'
        };
      }
      
      // 按 required 排序，必填字段在前
      voiceFields.sort((a: IntakeFieldInfo, b: IntakeFieldInfo) => {
        if (a.required && !b.required) return -1;
        if (!a.required && b.required) return 1;
        return 0;
      });
      
      console.log(`[getProductIntakeConfig] Loaded ${voiceFields.length} fields`);
      
      return {
        success: true,
        data: {
          productName: product.marketingName || product.regulatoryName || product.productName,
          productCode: product.productCode,
          fields: voiceFields,
          accidentCauses: intakeConfig.accidentCauses || [],
          claimMaterials: intakeConfig.claimMaterials || { extraMaterialIds: [] }
        },
        message: `获取到${voiceFields.length}个报案字段`
      };
    } catch (error) {
      console.error('[getProductIntakeConfig] Error:', error);
      return {
        success: false,
        error: '获取报案配置失败'
      };
    }
  }
};
