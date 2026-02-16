/**
 * LangChain Tool: 医保目录查询
 * 查询药品/项目是否在医保目录内
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getMedicalCatalog, checkMedicalCatalog } from '../../rules/context.js';

export const queryMedicalCatalogTool = new DynamicStructuredTool({
  name: 'query_medical_catalog',
  description: `查询药品或医疗项目是否在医保目录内。
使用场景：
- 当需要确认某个药品是否属于医保报销范围时
- 当需要区分甲类药/乙类药/丙类药时
- 当需要判断自费项目时

返回：药品名称、医保类别（甲/乙/丙）、限定支付范围等信息。`,
  
  schema: z.object({
    drugName: z.string().optional().describe('药品名称'),
    itemName: z.string().optional().describe('医疗项目名称'),
    keywords: z.array(z.string()).optional().describe('搜索关键词列表'),
  }),
  
  func: async ({ drugName, itemName, keywords }) => {
    try {
      const results = [];
      const searchTerms = [];
      
      if (drugName) searchTerms.push(drugName);
      if (itemName) searchTerms.push(itemName);
      if (keywords) searchTerms.push(...keywords);
      
      if (searchTerms.length === 0) {
        // 返回目录概览
        const catalog = getMedicalCatalog();
        return JSON.stringify({
          summary: `医保目录共 ${catalog.length} 项`,
          totalItems: catalog.length,
          sampleItems: catalog.slice(0, 5).map(item => ({
            name: item.name,
            category: item.category,
            type: item.type
          }))
        }, null, 2);
      }
      
      // 搜索每个关键词
      for (const term of searchTerms) {
        const found = checkMedicalCatalog(term);
        if (found) {
          results.push({
            searchTerm: term,
            found: true,
            name: found.name,
            category: found.category || '未分类',
            type: found.type || '未知',
            reimbursementRatio: found.reimbursementRatio,
            limitedPayment: found.limitedPayment,
            notes: found.notes
          });
        } else {
          results.push({
            searchTerm: term,
            found: false,
            message: `"${term}" 未在医保目录中找到，可能为自费项目`
          });
        }
      }
      
      // 格式化输出
      let summary = '🏥 医保目录查询结果:\n';
      for (const item of results) {
        if (item.found) {
          summary += `✅ ${item.name}: ${item.category} (${item.type})\n`;
          if (item.reimbursementRatio) {
            summary += `   报销比例: ${item.reimbursementRatio * 100}%\n`;
          }
          if (item.limitedPayment) {
            summary += `   限定: ${item.limitedPayment}\n`;
          }
        } else {
          summary += `❌ ${item.searchTerm}: 未找到（可能为自费项目）\n`;
        }
      }
      
      return JSON.stringify({
        summary,
        results
      }, null, 2);
      
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `医保目录查询失败: ${error.message}`
      });
    }
  }
});
