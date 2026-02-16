/**
 * LangChain Tool: 医院信息查询
 * 查询医院等级、是否为定点医院等信息
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getHospitalInfo } from '../../rules/context.js';

export const queryHospitalInfoTool = new DynamicStructuredTool({
  name: 'query_hospital_info',
  description: `查询医院信息。
使用场景：
- 当需要确认医院是否为定点医院时
- 当需要查询医院等级（三甲、三乙、二甲等）时
- 当需要验证医院是否符合保单要求时

返回：医院名称、等级、是否定点、地址等信息。`,
  
  schema: z.object({
    hospitalName: z.string().describe('医院名称'),
  }),
  
  func: async ({ hospitalName }) => {
    try {
      const hospital = getHospitalInfo(hospitalName);
      
      if (!hospital) {
        return JSON.stringify({
          summary: `❓ 未找到医院 "${hospitalName}" 的信息`,
          found: false,
          hospitalName,
          message: '该医院不在数据库中，建议人工核实'
        }, null, 2);
      }
      
      let summary = `🏥 医院信息:\n`;
      summary += `- 名称: ${hospital.name}\n`;
      summary += `- 等级: ${hospital.level || '未知'}\n`;
      summary += `- 类型: ${hospital.type || '未知'}\n`;
      summary += `- 是否定点: ${hospital.isDesignated ? '是' : '否'}\n`;
      if (hospital.address) {
        summary += `- 地址: ${hospital.address}\n`;
      }
      if (hospital.province) {
        summary += `- 地区: ${hospital.province} ${hospital.city || ''}\n`;
      }
      
      // 检查是否符合保单要求（通常要求二级及以上医院）
      const levelMatch = hospital.level?.match(/([一二三])级?([甲乙丙])?/);
      let meetsRequirement = false;
      if (levelMatch) {
        const levelNum = { '一': 1, '二': 2, '三': 3 }[levelMatch[1]];
        meetsRequirement = levelNum >= 2;
      }
      
      summary += `\n📋 是否符合保单要求（二级及以上医院）: ${meetsRequirement ? '✅ 是' : '❌ 否'}`;
      
      return JSON.stringify({
        summary,
        found: true,
        hospitalName: hospital.name,
        level: hospital.level,
        type: hospital.type,
        isDesignated: hospital.isDesignated,
        address: hospital.address,
        province: hospital.province,
        city: hospital.city,
        meetsRequirement
      }, null, 2);
      
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `医院信息查询失败: ${error.message}`
      });
    }
  }
});
