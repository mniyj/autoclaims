/**
 * AI Tools 统一导出
 */

import { checkEligibilityTool } from './checkEligibilityTool.js';
import { calculateAmountTool } from './calculateAmountTool.js';
import { queryMedicalCatalogTool } from './queryMedicalCatalogTool.js';
import { queryHospitalInfoTool } from './queryHospitalInfoTool.js';

// 重新导出
export { checkEligibilityTool, calculateAmountTool, queryMedicalCatalogTool, queryHospitalInfoTool };

/**
 * 获取所有可用工具
 * @returns {Tool[]} 工具数组
 */
export function getAllTools() {
  return [
    checkEligibilityTool,
    calculateAmountTool,
    queryMedicalCatalogTool,
    queryHospitalInfoTool
  ];
}
